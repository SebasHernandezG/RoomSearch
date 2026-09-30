import { LocateFixedIcon, MapPinIcon, NavigationIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { Listing } from "@/client/api";
import {
    loadMapsLibrary,
    loadMarkerLibrary,
    loadRoutesLibrary,
} from "@/client/lib/google-maps";

type ListingMapProps = {
    listings: Listing[];
    selectedListing: Listing | null;
    onSelect: (listing: Listing) => void;
};

const fallbackMapCenter = { lat: 10.3236, lng: -84.4274 };
const fallbackMapZoom = 14;
const mapTileSize = 256;
const minFallbackMapZoom = 11;
const maxFallbackMapZoom = 17;

function mapPixelPosition(lat: number, lng: number, zoom: number) {
    const scale = 2 ** zoom;
    const x = ((lng + 180) / 360) * scale * mapTileSize;
    const sine = Math.sin((lat * Math.PI) / 180);
    const y =
        (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) *
        scale *
        mapTileSize;

    return { x, y };
}

function mapCoordinateFromPixel(x: number, y: number, zoom: number) {
    const scale = 2 ** zoom;
    const lng = (x / (scale * mapTileSize)) * 360 - 180;
    const mercatorY = 0.5 - y / (scale * mapTileSize);
    const lat =
        (180 / Math.PI) *
        Math.atan(Math.sinh(mercatorY * 2 * Math.PI));

    return { lat, lng };
}

export function ListingMap({
    listings,
    selectedListing,
    onSelect,
}: ListingMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const routePolylinesRef = useRef<google.maps.Polyline[]>([]);
    const [mapError, setMapError] = useState("");
    const [routeSummary, setRouteSummary] = useState("");
    const [fallbackCenter, setFallbackCenter] = useState(fallbackMapCenter);
    const [fallbackZoom, setFallbackZoom] = useState(fallbackMapZoom);
    const fallbackDragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        center: { lat: number; lng: number };
    } | null>(null);
    const mappableListings = listings.filter(
        (listing) => listing.latitude != null && listing.longitude != null,
    );

    useEffect(() => {
        if (!containerRef.current || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
            return;
        let cancelled = false;
        const markers: google.maps.marker.AdvancedMarkerElement[] = [];

        const initializeMap = async () => {
            try {
                const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
                    loadMapsLibrary(),
                    loadMarkerLibrary(),
                ]);
                if (cancelled || !containerRef.current) return;

                const center = mappableListings[0]
                    ? {
                          lat: mappableListings[0].latitude!,
                          lng: mappableListings[0].longitude!,
                      }
                    : { lat: 9.9281, lng: -84.0907 };
                const map = new Map(containerRef.current, {
                    center,
                    zoom: mappableListings.length ? 13 : 9,
                    mapId:
                        import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
                        "DEMO_MAP_ID",
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: "greedy",
                });
                mapRef.current = map;

                for (const listing of mappableListings) {
                    const price = document.createElement("button");
                    price.type = "button";
                    price.className = "map-price-marker";
                    price.textContent = `₡${Math.round(listing.budget / 1000)}k`;
                    price.setAttribute(
                        "aria-label",
                        `${listing.title}, ₡${listing.budget.toLocaleString("es-CR")}`,
                    );
                    const marker = new AdvancedMarkerElement({
                        map,
                        position: {
                            lat: listing.latitude!,
                            lng: listing.longitude!,
                        },
                        title: listing.title,
                        content: price,
                    });
                    marker.addListener("click", () => onSelect(listing));
                    markers.push(marker);
                }
            } catch (error) {
                setMapError(
                    error instanceof Error
                        ? error.message
                        : "No fue posible cargar Google Maps.",
                );
            }
        };

        void initializeMap();
        return () => {
            cancelled = true;
            markers.forEach((marker) => {
                marker.map = null;
            });
        };
    }, [listings, onSelect]);

    useEffect(() => {
        if (
            !selectedListing?.latitude ||
            !selectedListing.longitude ||
            !mapRef.current
        )
            return;
        mapRef.current.panTo({
            lat: selectedListing.latitude,
            lng: selectedListing.longitude,
        });
        mapRef.current.setZoom(15);
    }, [selectedListing]);

    const routeToListing = () => {
        const map = mapRef.current;
        if (!selectedListing?.latitude || !selectedListing.longitude || !map)
            return;
        if (!navigator.geolocation) {
            setMapError("Tu navegador no permite obtener la ubicación actual.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                try {
                    const { Route } = await loadRoutesLibrary();
                    const { routes } = await Route.computeRoutes({
                        origin: { lat: coords.latitude, lng: coords.longitude },
                        destination: {
                            lat: selectedListing.latitude!,
                            lng: selectedListing.longitude!,
                        },
                        travelMode: "DRIVING",
                        fields: [
                            "path",
                            "distanceMeters",
                            "durationMillis",
                            "localizedValues",
                        ],
                    });
                    const route = routes?.[0];
                    if (!route)
                        throw new Error("No se encontró una ruta disponible.");
                    routePolylinesRef.current.forEach((polyline) =>
                        polyline.setMap(null),
                    );
                    routePolylinesRef.current = route.createPolylines();
                    routePolylinesRef.current.forEach((polyline) => {
                        polyline.setOptions({
                            strokeColor: "#166534",
                            strokeWeight: 6,
                            strokeOpacity: 0.9,
                        });
                        polyline.setMap(map);
                    });
                    const bounds = new google.maps.LatLngBounds();
                    route.path?.forEach((point) => bounds.extend(point));
                    map.fitBounds(bounds, 64);
                    setRouteSummary(
                        `${route.localizedValues?.distance ?? ""} · ${route.localizedValues?.duration ?? ""}`,
                    );
                } catch (error) {
                    setMapError(
                        error instanceof Error
                            ? error.message
                            : "No fue posible calcular la ruta.",
                    );
                }
            },
            () =>
                setMapError(
                    "Permite el acceso a tu ubicación para calcular cómo llegar.",
                ),
            {
                enableHighAccuracy: true,
                timeout: 10000,
            },
        );
    };

    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
        const centerPixel = mapPixelPosition(
            fallbackCenter.lat,
            fallbackCenter.lng,
            fallbackZoom,
        );
        const centerTileX = Math.floor(centerPixel.x / mapTileSize);
        const centerTileY = Math.floor(centerPixel.y / mapTileSize);
        const tiles = Array.from({ length: 25 }, (_, index) => {
            const offsetX = (index % 5) - 2;
            const offsetY = Math.floor(index / 5) - 2;
            const tileX = centerTileX + offsetX;
            const tileY = centerTileY + offsetY;

            return {
                key: `${tileX}-${tileY}`,
                src: `https://tile.openstreetmap.org/${fallbackZoom}/${tileX}/${tileY}.png`,
                left: `calc(50% + ${tileX * mapTileSize - centerPixel.x}px)`,
                top: `calc(50% + ${tileY * mapTileSize - centerPixel.y}px)`,
            };
        });

        return (
            <div
                className="relative min-h-[560px] touch-none select-none overflow-hidden rounded-xl border border-border bg-[#d9e9d8]"
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    fallbackDragRef.current = {
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                        center: fallbackCenter,
                    };
                }}
                onPointerMove={(event) => {
                    const drag = fallbackDragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId) return;
                    const startPixel = mapPixelPosition(
                        drag.center.lat,
                        drag.center.lng,
                        fallbackZoom,
                    );
                    const nextCenter = mapCoordinateFromPixel(
                        startPixel.x - (event.clientX - drag.startX),
                        startPixel.y - (event.clientY - drag.startY),
                        fallbackZoom,
                    );
                    setFallbackCenter(nextCenter);
                }}
                onPointerUp={() => {
                    fallbackDragRef.current = null;
                }}
                onPointerCancel={() => {
                    fallbackDragRef.current = null;
                }}
                onWheel={(event) => {
                    setFallbackZoom((zoom) =>
                        Math.min(
                            maxFallbackMapZoom,
                            Math.max(
                                minFallbackMapZoom,
                                zoom + (event.deltaY < 0 ? 1 : -1),
                            ),
                        ),
                    );
                }}
            >
                <div className="absolute inset-0 overflow-hidden" aria-label="Mapa de Ciudad Quesada">
                    {tiles.map((tile) => (
                        <img
                            key={tile.key}
                            src={tile.src}
                            alt=""
                            className="absolute size-64 max-w-none"
                            style={{ left: tile.left, top: tile.top }}
                        />
                    ))}
                </div>
                <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center">
                    <MapPinIcon className="size-12 fill-primary text-primary-foreground drop-shadow-lg" />
                    <span className="rounded-md bg-background/90 px-3 py-1 text-sm font-semibold shadow-lg">
                        Ciudad Quesada
                    </span>
                </div>
                <div className="absolute left-3 top-3 flex flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-lg">
                    <button
                        type="button"
                        className="grid size-10 place-items-center text-xl font-semibold hover:bg-muted"
                        aria-label="Acercar mapa"
                        onClick={() => setFallbackZoom((zoom) => Math.min(maxFallbackMapZoom, zoom + 1))}
                    >
                        +
                    </button>
                    <button
                        type="button"
                        className="grid size-10 place-items-center border-t border-border text-xl font-semibold hover:bg-muted"
                        aria-label="Alejar mapa"
                        onClick={() => setFallbackZoom((zoom) => Math.max(minFallbackMapZoom, zoom - 1))}
                    >
                        -
                    </button>
                </div>
                <Alert className="absolute bottom-3 left-3 right-3 bg-background/95 sm:left-auto sm:max-w-md">
                    <MapPinIcon data-icon="inline-start" />
                    <AlertTitle>Ciudad Quesada</AlertTitle>
                    <AlertDescription>
                        Configura `VITE_GOOGLE_MAPS_API_KEY` para activar el
                        mapa interactivo, los anuncios y las rutas.
                        <a
                            href="https://www.google.com/maps/search/?api=1&query=Ciudad%20Quesada%2C%20Costa%20Rica"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block font-semibold text-primary underline underline-offset-4"
                        >
                            Abrir en Google Maps
                        </a>
                    </AlertDescription>
                </Alert>
                <a
                    href="https://www.openstreetmap.org/?mlat=10.3236&mlon=-84.4274#map=14/10.3236/-84.4274"
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-1 left-2 text-[10px] text-slate-700 underline"
                >
                    © OpenStreetMap
                </a>
            </div>
        );
    }

    return (
        <div className="relative min-h-[560px] overflow-hidden rounded-xl border border-border bg-muted">
            <div
                ref={containerRef}
                className="absolute inset-0"
                aria-label="Mapa de departamentos disponibles"
            />
            <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:right-3 sm:w-80">
                {selectedListing ? (
                    <Card className="shadow-xl">
                        <CardHeader>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-col gap-1">
                                    <CardTitle>
                                        {selectedListing.title}
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedListing.city}
                                        {selectedListing.zone
                                            ? ` · ${selectedListing.zone}`
                                            : ""}
                                    </CardDescription>
                                </div>
                                <Badge>
                                    ₡
                                    {selectedListing.budget.toLocaleString(
                                        "es-CR",
                                    )}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            {routeSummary && (
                                <p className="text-sm font-medium text-foreground">
                                    {routeSummary}
                                </p>
                            )}
                            <Button onClick={routeToListing} size="lg">
                                <NavigationIcon data-icon="inline-start" />
                                Cómo llegar desde mi ubicación
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card size="sm" className="shadow-xl">
                        <CardContent className="flex items-center gap-3">
                            <LocateFixedIcon className="text-primary" />
                            <p className="text-sm text-muted-foreground">
                                Selecciona un precio en el mapa para ver el
                                departamento y calcular la ruta.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
            {mapError && (
                <Alert
                    variant="destructive"
                    className="absolute left-3 right-3 top-3 sm:right-auto sm:max-w-md"
                >
                    <AlertTitle>No pudimos completar la acción</AlertTitle>
                    <AlertDescription>{mapError}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
