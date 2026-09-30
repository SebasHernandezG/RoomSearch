import { MapPinIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadMapsLibrary, loadMarkerLibrary } from "@/client/lib/google-maps";

type Coordinates = { latitude: number; longitude: number };

export function LocationPicker({
    value,
    onChange,
}: {
    value: Coordinates | null;
    onChange: (coordinates: Coordinates) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!containerRef.current || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
            return;
        let marker: google.maps.marker.AdvancedMarkerElement | null = null;
        let cancelled = false;

        const initialize = async () => {
            try {
                const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
                    loadMapsLibrary(),
                    loadMarkerLibrary(),
                ]);
                if (cancelled || !containerRef.current) return;
                const center = value
                    ? { lat: value.latitude, lng: value.longitude }
                    : { lat: 9.9281, lng: -84.0907 };
                const map = new Map(containerRef.current, {
                    center,
                    zoom: value ? 16 : 10,
                    mapId:
                        import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
                        "DEMO_MAP_ID",
                    disableDefaultUI: true,
                    zoomControl: true,
                });
                const setMarker = (position: google.maps.LatLngLiteral) => {
                    if (marker) marker.map = null;
                    marker = new AdvancedMarkerElement({
                        map,
                        position,
                        gmpDraggable: true,
                        title: "Ubicación del departamento",
                    });
                    marker.addListener("dragend", () => {
                        const next = marker?.position;
                        if (next && "lat" in next) {
                            const latitude =
                                typeof next.lat === "function"
                                    ? next.lat()
                                    : next.lat;
                            const longitude =
                                typeof next.lng === "function"
                                    ? next.lng()
                                    : next.lng;
                            onChange({ latitude, longitude });
                        }
                    });
                };
                if (value) setMarker(center);
                map.addListener("click", (event: google.maps.MapMouseEvent) => {
                    const position = event.latLng?.toJSON();
                    if (!position) return;
                    setMarker(position);
                    onChange({
                        latitude: position.lat,
                        longitude: position.lng,
                    });
                });
            } catch (caught) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "No fue posible abrir el selector de ubicación.",
                );
            }
        };
        void initialize();
        return () => {
            cancelled = true;
            if (marker) marker.map = null;
        };
    }, []);

    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
        return (
            <Alert>
                <MapPinIcon />
                <AlertTitle>Configura Google Maps</AlertTitle>
                <AlertDescription>
                    Agrega la clave para seleccionar la ubicación exacta del
                    departamento.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div
                ref={containerRef}
                className="h-72 overflow-hidden rounded-lg border border-border"
                aria-label="Selecciona la ubicación del departamento"
            />
            <p className="text-sm text-muted-foreground">
                Haz clic sobre el mapa y arrastra el marcador para ajustar la
                entrada del departamento.
            </p>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
