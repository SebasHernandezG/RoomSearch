import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createApp } from "../../src/server/app";
import { createDatabase, type RoomiesDatabase } from "../../src/server/database";
import type { RouteOptions } from "../../src/server/route";

const input = {
    origin: { lat: 9.9325, lng: -84.08 },
    destination: { lat: 9.935, lng: -84.053 },
};
const result = {
    duration: "165.5s",
    distanceMeters: 772,
    polyline: { encodedPolyline: "ipkcFfichVnP@j@BLoFVwM{E?" },
};
const request = (body: unknown = input, path = "/route") => new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

describe("Google Routes endpoint", () => {
    let database: RoomiesDatabase;
    beforeEach(() => { database = createDatabase(":memory:"); });
    afterEach(() => { database.close(); });

    const fakeGoogle = () => mock(async (_url: string, _options: RequestInit) => Response.json({ routes: [result] }));
    const appWith = (options: RouteOptions = {}) => createApp(database, { apiKey: "test-server-key", ...options });

    it("returns driving directions on both aliases and requests only required Google fields", async () => {
        const fetch = fakeGoogle();
        const app = appWith({ fetch });
        for (const path of ["/route", "/api/route"]) {
            const response = await app.handle(request(input, path));
            expect(response.status).toBe(200);
            expect(response.headers.get("cache-control")).toBe("no-store");
            expect(await response.json()).toEqual({
                duration: "165.5s", distanceMeters: 772,
                encodedPolyline: result.polyline.encodedPolyline,
            });
        }
        const [url, options] = fetch.mock.calls[0]!;
        expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
        expect(options.method).toBe("POST");
        expect(options.headers).toMatchObject({
            "X-Goog-Api-Key": "test-server-key",
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        });
        expect(JSON.parse(String(options.body))).toMatchObject({
            origin: { location: { latLng: { latitude: input.origin.lat, longitude: input.origin.lng } } },
            destination: { location: { latLng: { latitude: input.destination.lat, longitude: input.destination.lng } } },
            travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE",
            polylineEncoding: "ENCODED_POLYLINE",
        });
    });

    it.each([
        {}, { origin: input.origin },
        { ...input, origin: { lat: 91, lng: 0 } },
        { ...input, origin: { lat: -91, lng: 0 } },
        { ...input, destination: { lat: 0, lng: 181 } },
        { ...input, destination: { lat: 0, lng: -181 } },
        { ...input, origin: { lat: "9.9", lng: 0 } },
        { ...input, destination: null },
    ] as unknown[])("rejects invalid coordinates without calling Google: %j", async (body) => {
        const fetch = fakeGoogle();
        const response = await appWith({ fetch }).handle(request(body));
        expect(response.status).toBe(422);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("accepts coordinate boundaries", async () => {
        const response = await appWith({ fetch: fakeGoogle() }).handle(request({
            origin: { lat: -90, lng: -180 }, destination: { lat: 90, lng: 180 },
        }));
        expect(response.status).toBe(200);
    });

    it("reports missing server configuration without an outbound call", async () => {
        const fetch = fakeGoogle();
        const response = await appWith({ fetch, apiKey: " " }).handle(request());
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ code: "ROUTES_NOT_CONFIGURED" });
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([{}, { routes: [] }])("handles no route: %j", async (payload) => {
        const response = await appWith({ fetch: async () => Response.json(payload) }).handle(request());
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ code: "ROUTE_NOT_FOUND" });
    });

    it.each([400, 401, 403, 500, 503])("sanitizes Google HTTP %i errors", async (status) => {
        const response = await appWith({ fetch: async () => new Response("private upstream details test-server-key", { status }) }).handle(request());
        expect(response.status).toBe(status < 500 ? 503 : 502);
        expect(await response.text()).not.toContain("test-server-key");
    });

    it.each([
        null, [], { routes: null }, { routes: {} }, { routes: [{}] },
        { routes: [{ ...result, duration: "tomorrow" }] },
        { routes: [{ ...result, distanceMeters: -1 }] },
        { routes: [{ ...result, distanceMeters: "772" }] },
        { routes: [{ ...result, polyline: { encodedPolyline: "" } }] },
        { error: { message: "private details" } },
    ].map((payload) => ({ payload })))("rejects malformed Google responses: %j", async ({ payload }) => {
        const response = await appWith({ fetch: async () => Response.json(payload) }).handle(request());
        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({ code: "INVALID_GOOGLE_RESPONSE" });
    });

    it("handles non-JSON success responses", async () => {
        const response = await appWith({ fetch: async () => new Response("<html>error</html>") }).handle(request());
        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({ code: "INVALID_GOOGLE_RESPONSE" });
    });

    it("handles network failures", async () => {
        const response = await appWith({ fetch: async () => { throw new TypeError("network failure"); } }).handle(request());
        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({ code: "GOOGLE_ROUTES_UNAVAILABLE" });
    });

    it("aborts slow requests", async () => {
        const response = await appWith({
            timeoutMs: 10,
            fetch: async (_url, options) => new Promise<Response>((_resolve, reject) => {
                options.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
            }),
        }).handle(request());
        expect(response.status).toBe(504);
        expect(await response.json()).toMatchObject({ code: "ROUTE_TIMEOUT" });
    });

    it("keeps the timeout active while reading the response body", async () => {
        const response = await appWith({
            timeoutMs: 10,
            fetch: async (_url, options) => new Response(new ReadableStream({
                start(controller) {
                    options.signal!.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
                },
            })),
        }).handle(request());
        expect(response.status).toBe(504);
    });

    it.each(["120", "invalid"])("respects Google rate limits and shares cooldown between aliases (%s)", async (retryAfter) => {
        const fetch = mock(async () => new Response("quota exceeded", { status: 429, headers: { "Retry-After": retryAfter } }));
        const app = appWith({ fetch });
        const response = await app.handle(request());
        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe(retryAfter === "invalid" ? "60" : "120");
        expect(await response.json()).toMatchObject({ code: "GOOGLE_RATE_LIMITED" });
        expect((await app.handle(request(input, "/api/route"))).status).toBe(429);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("limits outbound requests to 60 per minute across both aliases", async () => {
        const fetch = fakeGoogle();
        const app = appWith({ fetch });
        for (let index = 0; index < 60; index++) {
            expect((await app.handle(request())).status).toBe(200);
        }
        const response = await app.handle(request(input, "/api/route"));
        expect(response.status).toBe(429);
        expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
        expect(await response.json()).toMatchObject({ code: "ROUTE_RATE_LIMITED" });
        expect(fetch).toHaveBeenCalledTimes(60);
    });
});
