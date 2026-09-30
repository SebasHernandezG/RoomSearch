import type { routeSchema } from "./schemas";

type RouteInput = typeof routeSchema.static;
type RouteFetch = (url: string, options: RequestInit) => Promise<Response>;

export type RouteOptions = {
    apiKey?: string;
    fetch?: RouteFetch;
    timeoutMs?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const failure = (
    status: number,
    code: string,
    message: string,
    retryAfter?: number,
) => Response.json(
    { code, message },
    {
        status,
        headers: {
            "Cache-Control": "no-store",
            ...(retryAfter === undefined ? {} : { "Retry-After": String(retryAfter) }),
        },
    },
);

export const createRouteHandler = (options: RouteOptions = {}) => {
    const apiKey = (options.apiKey ?? process.env.GOOGLE_MAPS_API_KEY)?.trim();
    const requestGoogle = options.fetch ?? fetch;
    // Both URL aliases share a bounded, per-process budget and Google cooldown.
    let windowStart = 0;
    let requests = 0;
    let blockedUntil = 0;

    return async ({ body }: { body: RouteInput }): Promise<Response> => {
        if (!apiKey) {
            return failure(503, "ROUTES_NOT_CONFIGURED", "El servicio de rutas no está configurado.");
        }

        const now = Date.now();
        if (now >= windowStart + 60_000) {
            windowStart = now;
            requests = 0;
        }
        if (now < blockedUntil || requests >= 60) {
            const retryAt = Math.max(blockedUntil, requests >= 60 ? windowStart + 60_000 : now);
            return failure(429, "ROUTE_RATE_LIMITED", "Demasiadas solicitudes de rutas. Intenta más tarde.", Math.max(1, Math.ceil((retryAt - now) / 1000)));
        }
        requests++;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
        try {
            const waypoint = ({ lat, lng }: RouteInput["origin"]) => ({
                location: { latLng: { latitude: lat, longitude: lng } },
            });
            const response = await requestGoogle(
                "https://routes.googleapis.com/directions/v2:computeRoutes",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Goog-Api-Key": apiKey,
                        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
                    },
                    body: JSON.stringify({
                        origin: waypoint(body.origin),
                        destination: waypoint(body.destination),
                        travelMode: "DRIVE",
                        routingPreference: "TRAFFIC_AWARE",
                        computeAlternativeRoutes: false,
                        polylineEncoding: "ENCODED_POLYLINE",
                    }),
                    signal: controller.signal,
                    redirect: "error",
                },
            );

            if (response.status === 429) {
                const header = response.headers.get("Retry-After");
                const seconds = header && /^\d+$/.test(header)
                    ? Number(header)
                    : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : NaN;
                const retryAfter = Number.isFinite(seconds) ? Math.max(1, Math.min(seconds, 3600)) : 60;
                blockedUntil = Date.now() + retryAfter * 1000;
                await response.body?.cancel();
                return failure(429, "GOOGLE_RATE_LIMITED", "El proveedor de rutas alcanzó su límite. Intenta más tarde.", retryAfter);
            }
            if (!response.ok) {
                const status = response.status;
                await response.body?.cancel();
                if (status === 400 || status === 401 || status === 403) {
                    return failure(503, "GOOGLE_ROUTES_REJECTED", "Google rechazó la solicitud. Revisa la clave, los permisos y la configuración del servicio.");
                }
                return failure(502, "GOOGLE_ROUTES_UNAVAILABLE", "No fue posible consultar el servicio de rutas.");
            }

            const payload: unknown = await response.json();
            if (!isRecord(payload) || "error" in payload) {
                return failure(502, "INVALID_GOOGLE_RESPONSE", "El servicio de rutas devolvió una respuesta inválida.");
            }
            // Google can omit the repeated routes field when there are no routes.
            if (Object.keys(payload).length === 0 || (Array.isArray(payload.routes) && payload.routes.length === 0)) {
                return failure(404, "ROUTE_NOT_FOUND", "No se encontró una ruta en automóvil entre estos puntos.");
            }
            const route: unknown = Array.isArray(payload.routes) ? payload.routes[0] : undefined;
            if (
                !isRecord(route) ||
                typeof route.duration !== "string" ||
                !/^\d+(?:\.\d{1,9})?s$/.test(route.duration) ||
                !Number.isFinite(Number(route.duration.slice(0, -1))) ||
                typeof route.distanceMeters !== "number" ||
                !Number.isSafeInteger(route.distanceMeters) ||
                route.distanceMeters < 0 ||
                !isRecord(route.polyline) ||
                typeof route.polyline.encodedPolyline !== "string" ||
                !/^[?-~]+$/.test(route.polyline.encodedPolyline)
            ) {
                return failure(502, "INVALID_GOOGLE_RESPONSE", "El servicio de rutas devolvió una respuesta inválida.");
            }
            return Response.json({
                duration: route.duration,
                distanceMeters: route.distanceMeters,
                encodedPolyline: route.polyline.encodedPolyline,
            }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
            if (controller.signal.aborted) {
                return failure(504, "ROUTE_TIMEOUT", "El servicio de rutas tardó demasiado en responder.");
            }
            if (error instanceof SyntaxError) {
                return failure(502, "INVALID_GOOGLE_RESPONSE", "El servicio de rutas devolvió una respuesta inválida.");
            }
            return failure(502, "GOOGLE_ROUTES_UNAVAILABLE", "No fue posible conectar con el servicio de rutas.");
        } finally {
            clearTimeout(timeout);
        }
    };
};
