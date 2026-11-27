import { LocateFixedIcon, NavigationIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Listing } from "@/client/api";

type ListingMapProps = {
    listings: Listing[];
    selectedListing: Listing | null;
    onSelect: (listing: Listing) => void;
    currentUserId: number;
    onEdit: (listing: Listing) => void;
    onDelete: (listing: Listing) => void;
};

const mapAreas = {
    "san-carlos": { label: "San Carlos", bounds: [-84.57, 10.25, -84.35, 10.47] },
    quesada: { label: "Ciudad Quesada", bounds: [-84.475, 10.295, -84.385, 10.36] },
    florencia: { label: "Florencia", bounds: [-84.535, 10.365, -84.445, 10.425] },
} as const;

type MapArea = keyof typeof mapAreas;

export function ListingMap({ listings, selectedListing, onSelect, currentUserId, onEdit, onDelete }: ListingMapProps) {
    const [activeArea, setActiveArea] = useState<MapArea>("san-carlos");
    const area = mapAreas[activeArea];
    const [west, south, east, north] = area.bounds;
    const mapUrl = useMemo(() => {
        const parameters = new URLSearchParams({ bbox: `${west},${south},${east},${north}`, layer: "mapnik" });
        return `https://www.openstreetmap.org/export/embed.html?${parameters}`;
    }, [west, south, east, north]);
    const visibleOffers = listings.filter((listing) =>
        listing.type === "offer" && listing.latitude != null && listing.longitude != null &&
        listing.latitude >= south && listing.latitude <= north && listing.longitude >= west && listing.longitude <= east,
    );

    return (
        <div className="relative min-h-[560px] overflow-hidden rounded-xl border border-border bg-muted">
            <iframe key={mapUrl} title={`Mapa de ${area.label}`} src={mapUrl} className="absolute inset-0 size-full border-0 grayscale-[15%] contrast-[.95] dark:brightness-[.72] dark:saturate-[.75]" loading="eager" referrerPolicy="strict-origin-when-cross-origin" />

            <div role="group" aria-label="Zonas de San Carlos" className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] gap-1 overflow-x-auto rounded-xl border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur">
                {(Object.keys(mapAreas) as MapArea[]).map((areaKey) => (
                    <Button key={areaKey} type="button" size="sm" variant={activeArea === areaKey ? "default" : "ghost"} className="shrink-0" aria-pressed={activeArea === areaKey} onClick={() => setActiveArea(areaKey)}>
                        {mapAreas[areaKey].label}
                    </Button>
                ))}
            </div>

            {visibleOffers.map((listing) => {
                const left = ((listing.longitude! - west) / (east - west)) * 100;
                const top = ((north - listing.latitude!) / (north - south)) * 100;
                return (
                    <button key={listing.id} type="button" className="map-price-marker absolute z-10 -translate-x-1/2 -translate-y-full" style={{ left: `${left}%`, top: `${top}%` }} aria-label={`${listing.title}, ₡${listing.budget.toLocaleString("es-CR")}`} aria-pressed={selectedListing?.id === listing.id} onClick={() => onSelect(listing)}>
                        ₡{listing.budget.toLocaleString("es-CR")}
                    </button>
                );
            })}

            <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:right-3 sm:w-96">
                {selectedListing ? (
                    <Card className="border-border/70 bg-background/95 shadow-xl backdrop-blur">
                        <CardHeader>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="truncate">{selectedListing.title}</CardTitle>
                                    <CardDescription>{selectedListing.city}{selectedListing.zone ? ` · ${selectedListing.zone}` : ""}</CardDescription>
                                </div>
                                <Badge>₡{selectedListing.budget.toLocaleString("es-CR")}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {selectedListing.ownerId === currentUserId ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" onClick={() => onEdit(selectedListing)}><PencilIcon data-icon="inline-start" />Editar</Button>
                                    <Button variant="destructive" onClick={() => onDelete(selectedListing)}><Trash2Icon data-icon="inline-start" />Eliminar</Button>
                                </div>
                            ) : selectedListing.type === "offer" && selectedListing.latitude != null && selectedListing.longitude != null ? (
                                <Button render={<a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedListing.latitude},${selectedListing.longitude}`} target="_blank" rel="noreferrer" />} className="w-full">
                                    <NavigationIcon data-icon="inline-start" />Cómo llegar
                                </Button>
                            ) : (
                                <p className="text-sm text-muted-foreground">Busca opciones en {selectedListing.zone}, {selectedListing.city}.</p>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card size="sm" className="border-border/70 bg-background/95 shadow-xl backdrop-blur">
                        <CardContent className="flex items-center gap-3">
                            <LocateFixedIcon className="text-primary" />
                            <p className="text-sm text-muted-foreground">Selecciona un precio para ver el anuncio.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
