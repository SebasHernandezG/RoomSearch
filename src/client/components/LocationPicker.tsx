import { MapPinIcon } from "lucide-react";
import { Map as MapLibreMap, Marker, setWorkerUrl, type LngLatBoundsLike, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

setWorkerUrl(mapLibreWorkerUrl);

type Coordinates = { latitude: number; longitude: number };
const sanCarlosBounds: LngLatBoundsLike = [[-84.57, 10.25], [-84.35, 10.47]];
const pickerStyle: StyleSpecification = {
    version: 8,
    sources: {
        openstreetmap: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
            maxzoom: 19,
        },
    },
    layers: [{
        id: "openstreetmap",
        type: "raster",
        source: "openstreetmap",
        paint: { "raster-saturation": -0.3, "raster-contrast": 0.08 },
    }],
};

export function LocationPicker({ value, onChange }: {
    value: Coordinates | null;
    onChange: (coordinates: Coordinates) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markerRef = useRef<Marker | null>(null);
    const onChangeRef = useRef(onChange);
    const [error, setError] = useState("");
    onChangeRef.current = onChange;

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        try {
            const map = new MapLibreMap({
                container: containerRef.current,
                style: pickerStyle,
                center: value ? [value.longitude, value.latitude] : [-84.4596, 10.3596],
                zoom: value ? 15 : 11.6,
                minZoom: 11,
                maxZoom: 17,
                maxBounds: sanCarlosBounds,
                attributionControl: false,
            });
            const resizeObserver = new ResizeObserver(() => map.resize());
            resizeObserver.observe(containerRef.current);
            const placeMarker = (longitude: number, latitude: number) => {
                markerRef.current?.remove();
                markerRef.current = new Marker({ color: "#166534", draggable: true })
                    .setLngLat([longitude, latitude])
                    .addTo(map);
                markerRef.current.on("dragend", () => {
                    const position = markerRef.current!.getLngLat();
                    onChangeRef.current({ latitude: position.lat, longitude: position.lng });
                });
            };
            if (value) placeMarker(value.longitude, value.latitude);
            map.on("click", ({ lngLat }) => {
                placeMarker(lngLat.lng, lngLat.lat);
                onChangeRef.current({ latitude: lngLat.lat, longitude: lngLat.lng });
            });
            map.on("error", (event) => {
                if (!event.error?.message.includes("tile")) {
                    setError("No pudimos abrir el mapa. Revisa tu conexión.");
                }
            });
            mapRef.current = map;
            return () => {
                resizeObserver.disconnect();
                markerRef.current?.remove();
                markerRef.current = null;
                map.remove();
                mapRef.current = null;
            };
        } catch {
            setError("No pudimos abrir el mapa en este navegador.");
        }
    }, []);

    return (
        <div className="flex flex-col gap-2">
            <div ref={containerRef} className="h-72 overflow-hidden rounded-lg border border-border" aria-label="Selecciona una ubicación en San Carlos" />
            <p className="text-sm text-muted-foreground">
                Haz clic en Ciudad Quesada o Florencia y arrastra el marcador para ajustar la ubicación.
            </p>
            {error && (
                <Alert variant="destructive">
                    <MapPinIcon />
                    <AlertTitle>Mapa no disponible</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
