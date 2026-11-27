import {
    FormEvent,
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useState,
} from "react";
import {
    ArrowRightIcon,
    ListIcon,
    LogOutIcon,
    MapIcon,
    MoonIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    SunIcon,
    Trash2Icon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, type Listing, type User } from "@/client/api";
import { AuthGate } from "@/client/components/AuthGate";
import roomSearchLogo from "@/client/assets/roomsearch-brand.jpg";

const ListingMap = lazy(() =>
    import("@/client/components/ListingMap").then((module) => ({
        default: module.ListingMap,
    })),
);
const LocationPicker = lazy(() =>
    import("@/client/components/LocationPicker").then((module) => ({
        default: module.LocationPicker,
    })),
);

type ViewMode = "list" | "map";
type Recommendation = {
    search: Listing;
    offer: Listing;
    reasons: string[];
};
type ListingDraft = {
    type: "offer" | "search";
    title: string;
    description: string;
    city: string;
    zone: string;
    budget: string;
    latitude: number | null;
    longitude: number | null;
};

const emptyDraft: ListingDraft = {
    type: "offer",
    title: "",
    description: "",
    city: "Ciudad Quesada",
    zone: "",
    budget: "50000",
    latitude: null,
    longitude: null,
};

export function App() {
    return <AuthGate>{(user, onLogout) => <ListingsApp user={user} onLogout={onLogout} />}</AuthGate>;
}

function ListingsApp({ user, onLogout }: { user: User; onLogout: () => void }) {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [city, setCity] = useState("Ciudad Quesada");
    const [type, setType] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("map");
    const [selectedListing, setSelectedListing] = useState<Listing | null>(
        null,
    );
    const [showCreate, setShowCreate] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [draft, setDraft] = useState(emptyDraft);
    const [dark, setDark] = useState(
        () => localStorage.getItem("roomies-theme") === "dark",
    );

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        localStorage.setItem("roomies-theme", dark ? "dark" : "light");
    }, [dark]);

    const loadListings = useCallback(
        async (nextCity = city, nextType = type) => {
            setLoading(true);
            setError("");
            try {
                const query = new URLSearchParams();
                if (nextCity) query.set("city", nextCity);
                if (nextType) query.set("type", nextType);
                const data = await api<{ listings: Listing[] }>(
                    `/listings?${query}`,
                );
                setListings(data.listings);
                setSelectedListing((current) =>
                    current && data.listings.some(({ id }) => id === current.id)
                        ? current
                        : (data.listings[0] ?? null),
                );
            } catch (caught) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "No fue posible cargar los anuncios.",
                );
            } finally {
                setLoading(false);
            }
        },
        [city, type],
    );

    const loadRecommendations = useCallback(async () => {
        try {
            const data = await api<{ recommendations: Recommendation[] }>(
                "/recommendations",
            );
            setRecommendations(data.recommendations);
        } catch {
            setRecommendations([]);
        }
    }, []);

    useEffect(() => {
        void loadListings("Ciudad Quesada", "");
        void loadRecommendations();
    }, []);

    const saveListing = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        try {
            await api(
                editingListing ? `/listings/${editingListing.id}` : "/listings",
                {
                method: editingListing ? "PUT" : "POST",
                body: JSON.stringify({
                    ...draft,
                    latitude: draft.type === "offer" ? draft.latitude : null,
                    longitude: draft.type === "offer" ? draft.longitude : null,
                    budget: Number(draft.budget),
                }),
            });
            setDraft(emptyDraft);
            setShowCreate(false);
            setEditingListing(null);
            await loadListings();
            await loadRecommendations();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "No fue posible publicar.",
            );
        }
    };

    const openCreate = () => {
        setEditingListing(null);
        setDraft(emptyDraft);
        setShowCreate(true);
    };

    const openEdit = (listing: Listing) => {
        setEditingListing(listing);
        setDraft({
            type: listing.type,
            title: listing.title,
            description: listing.description,
            city: listing.city,
            zone: listing.zone ?? "",
            budget: String(listing.budget),
            latitude: listing.latitude,
            longitude: listing.longitude,
        });
        setShowCreate(true);
    };

    const deleteListing = async (listing: Listing) => {
        if (!window.confirm(`¿Eliminar "${listing.title}"? Esta acción no se puede deshacer.`)) return;
        setError("");
        try {
            await api(`/listings/${listing.id}`, { method: "DELETE" });
            setSelectedListing((current) => current?.id === listing.id ? null : current);
            await loadListings();
            await loadRecommendations();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "No fue posible eliminar la publicación.");
        }
    };

    const logout = async () => {
        try {
            await api("/auth/logout", { method: "POST" });
            onLogout();
        } catch {
            setError("No pudimos cerrar tu sesión. Intenta de nuevo.");
        }
    };

    return (
        <div className="min-h-[100dvh] bg-background text-foreground">
            <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <a
                        href="#top"
                        className="flex items-center gap-3 text-lg font-semibold tracking-tight"
                    >
                        <img
                            className="size-10 rounded-lg object-cover"
                            src={roomSearchLogo}
                            alt=""
                        />
                        RoomSearch
                    </a>
                    <nav
                        className="flex items-center gap-2"
                        aria-label="Navegación principal"
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDark((value) => !value)}
                            aria-label={
                                dark ? "Usar tema claro" : "Usar tema oscuro"
                            }
                        >
                            {dark ? <SunIcon /> : <MoonIcon />}
                        </Button>
                        <span className="hidden text-sm text-muted-foreground sm:inline">Hola, {user.name}</span>
                        <Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Publicar</Button>
                        <Button onClick={logout} variant="outline">
                            <LogOutIcon data-icon="inline-start" />
                            <span className="hidden sm:inline">Cerrar sesión</span>
                            <span className="sm:hidden">Salir</span>
                        </Button>
                    </nav>
                </div>
            </header>

            <main id="top">
                <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_1fr] md:py-12 lg:px-8">
                    <div className="max-w-3xl">
                        <p className="mb-5 text-sm font-semibold uppercase tracking-[.22em] text-primary">
                            Compartir se siente mejor
                        </p>
                        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                            Encuentra tu próximo hogar.
                        </h1>
                        <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
                            Encuentra departamentos y roomies, revisa su
                            ubicación exacta y calcula cómo llegar desde donde
                            estás.
                        </p>
                    </div>
                    <Card className="self-center">
                        <CardHeader>
                            <CardTitle>¿Dónde quieres vivir?</CardTitle>
                            <CardDescription>
                                Busca por ciudad, zona o tipo de anuncio.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void loadListings();
                                }}
                            >
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel>Ciudad</FieldLabel>
                                        <Select value={city} onValueChange={(value) => setCity(String(value))}>
                                            <SelectTrigger className="w-full"><SelectValue>{city}</SelectValue></SelectTrigger>
                                            <SelectContent><SelectGroup>
                                                <SelectItem value="Ciudad Quesada">Ciudad Quesada</SelectItem>
                                                <SelectItem value="Florencia">Florencia</SelectItem>
                                            </SelectGroup></SelectContent>
                                        </Select>
                                    </Field>
                                    <Field>
                                        <FieldLabel>Tipo de anuncio</FieldLabel>
                                        <Select
                                            value={type || "all"}
                                            onValueChange={(value) =>
                                                setType(
                                                    value === "all"
                                                        ? ""
                                                        : String(value),
                                                )
                                            }
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue>
                                                    {type === "offer"
                                                        ? "Ofrecen habitación"
                                                        : type === "search"
                                                          ? "Buscan habitación"
                                                          : "Todos los anuncios"}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="all">
                                                        Todos los anuncios
                                                    </SelectItem>
                                                    <SelectItem value="offer">
                                                        Ofrecen habitación
                                                    </SelectItem>
                                                    <SelectItem value="search">
                                                        Buscan habitación
                                                    </SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Button type="submit" size="lg">
                                        <SearchIcon data-icon="inline-start" />
                                        Buscar ahora
                                    </Button>
                                </FieldGroup>
                            </form>
                        </CardContent>
                    </Card>
                </section>

                <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-24 sm:px-6 lg:px-8">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <div>
                            <p className="text-sm font-medium text-primary">
                                Explora opciones reales
                            </p>
                            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                                Anuncios recientes
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                                {listings.length} resultados
                            </Badge>
                            <Button
                                variant={
                                    viewMode === "list" ? "secondary" : "ghost"
                                }
                                onClick={() => setViewMode("list")}
                            >
                                <ListIcon data-icon="inline-start" />
                                Lista
                            </Button>
                            <Button
                                variant={
                                    viewMode === "map" ? "secondary" : "ghost"
                                }
                                onClick={() => setViewMode("map")}
                            >
                                <MapIcon data-icon="inline-start" />
                                Mapa
                            </Button>
                        </div>
                    </div>
                    <Separator />
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>
                                No pudimos completar la acción
                            </AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {loading ? (
                        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map((item) => (
                                <Skeleton
                                    key={item}
                                    className="h-72 rounded-xl"
                                />
                            ))}
                        </div>
                    ) : viewMode === "map" ? (
                        <Suspense
                            fallback={
                                <Skeleton className="h-[560px] rounded-xl" />
                            }
                        >
                            <ListingMap
                                listings={listings}
                                selectedListing={selectedListing}
                                onSelect={setSelectedListing}
                                currentUserId={user.id}
                                onEdit={openEdit}
                                onDelete={(listing) => void deleteListing(listing)}
                            />
                        </Suspense>
                    ) : listings.length === 0 ? (
                        <Card>
                            <CardHeader className="py-14 text-center">
                                <CardTitle>
                                    Todavía no hay coincidencias
                                </CardTitle>
                                <CardDescription>
                                    Prueba otra ciudad o elimina los filtros.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {listings.map((listing) => (
                                <Card
                                    key={listing.id}
                                    className="transition hover:-translate-y-1 hover:shadow-lg"
                                >
                                    <CardHeader>
                                        <CardAction>
                                            <Badge>
                                                {listing.type === "offer"
                                                    ? "Disponible"
                                                    : "Busca habitación"}
                                            </Badge>
                                        </CardAction>
                                        <CardTitle className="pr-24 text-xl">
                                            {listing.title}
                                        </CardTitle>
                                        <CardDescription>
                                            {listing.city}
                                            {listing.zone
                                                ? ` · ${listing.zone}`
                                                : ""}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="line-clamp-3 leading-6 text-muted-foreground">
                                            {listing.description}
                                        </p>
                                    </CardContent>
                                    <CardFooter className="justify-between">
                                        <div>
                                            <p className="font-semibold">
                                                ₡
                                                {listing.budget.toLocaleString(
                                                    "es-CR",
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                por {listing.ownerName}
                                            </p>
                                        </div>
                                        {listing.ownerId === user.id ? (
                                            <div className="flex gap-1">
                                                <Button variant="outline" onClick={() => openEdit(listing)}><PencilIcon data-icon="inline-start" />Editar</Button>
                                                <Button variant="destructive" onClick={() => void deleteListing(listing)}><Trash2Icon data-icon="inline-start" />Eliminar</Button>
                                            </div>
                                        ) : listing.type === "offer" ? (
                                            <Button variant="ghost" onClick={() => { setSelectedListing(listing); setViewMode("map"); }}>
                                                Ver mapa <ArrowRightIcon data-icon="inline-end" />
                                            </Button>
                                        ) : (
                                            <Badge variant="outline">Busca en {listing.zone}</Badge>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                {recommendations.length > 0 && (
                    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
                        <p className="text-sm font-medium text-primary">Coincidencias para tus búsquedas</p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Recomendadas por zona y presupuesto</h2>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            {recommendations.map(({ search, offer, reasons }) => (
                                <Card key={`${search.id}-${offer.id}`}>
                                    <CardHeader>
                                        <CardDescription>Para “{search.title}”</CardDescription>
                                        <CardTitle>{offer.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent><p className="text-sm text-muted-foreground">{reasons.join(" · ")}</p></CardContent>
                                    <CardFooter className="justify-between">
                                        <span className="font-semibold">₡{offer.budget.toLocaleString("es-CR")}</span>
                                        <Button variant="outline" onClick={() => { setSelectedListing(offer); setViewMode("map"); }}>
                                            Ver oferta <ArrowRightIcon data-icon="inline-end" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
                    <form
                        onSubmit={saveListing}
                        className="flex flex-col gap-6"
                    >
                        <DialogHeader>
                            <DialogTitle>{editingListing ? "Edita tu publicación" : "Crea una publicación"}</DialogTitle>
                            <DialogDescription>
                                {draft.type === "offer"
                                    ? "Agrega la información y marca la entrada en el mapa."
                                    : "Indica ciudad, zona y presupuesto para encontrar coincidencias."}
                            </DialogDescription>
                        </DialogHeader>
                        <FieldGroup>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field>
                                    <FieldLabel>Tipo</FieldLabel>
                                    <Select
                                        value={draft.type}
                                        onValueChange={(value) =>
                                            setDraft({
                                                ...draft,
                                                type: value as ListingDraft["type"],
                                                latitude: value === "search" ? null : draft.latitude,
                                                longitude: value === "search" ? null : draft.longitude,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue>
                                                {draft.type === "offer"
                                                    ? "Ofrezco habitación"
                                                    : "Busco habitación"}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="offer">
                                                    Ofrezco habitación
                                                </SelectItem>
                                                <SelectItem value="search">
                                                    Busco habitación
                                                </SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="budget">
                                        Presupuesto
                                    </FieldLabel>
                                    <Input
                                        id="budget"
                                        required
                                        type="number"
                                        min="0"
                                        step="1000"
                                        placeholder="50000"
                                        value={draft.budget}
                                        onChange={(event) =>
                                            setDraft({
                                                ...draft,
                                                budget: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                            <Field>
                                <FieldLabel htmlFor="title">Título</FieldLabel>
                                <Input
                                    id="title"
                                    required
                                    minLength={3}
                                    value={draft.title}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            title: event.target.value,
                                        })
                                    }
                                />
                            </Field>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field>
                                    <FieldLabel>Ciudad</FieldLabel>
                                    <Select
                                        value={draft.city}
                                        onValueChange={(value) => setDraft({ ...draft, city: String(value) })}
                                    >
                                        <SelectTrigger className="w-full"><SelectValue>{draft.city}</SelectValue></SelectTrigger>
                                        <SelectContent><SelectGroup>
                                            <SelectItem value="Ciudad Quesada">Ciudad Quesada</SelectItem>
                                            <SelectItem value="Florencia">Florencia</SelectItem>
                                        </SelectGroup></SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="zone">Zona</FieldLabel>
                                    <Input
                                        id="zone"
                                        required={draft.type === "search"}
                                        placeholder="Ej. Barrio San Martín"
                                        value={draft.zone}
                                        onChange={(event) =>
                                            setDraft({
                                                ...draft,
                                                zone: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                            {draft.type === "offer" && <Field>
                                <FieldLabel htmlFor="description">
                                    Descripción
                                </FieldLabel>
                                <Textarea
                                    id="description"
                                    required
                                    minLength={10}
                                    rows={5}
                                    value={draft.description}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            description: event.target.value,
                                        })
                                    }
                                />
                            </Field>}
                            <Field>
                                <FieldLabel>
                                    Ubicación del departamento
                                </FieldLabel>
                                <FieldDescription>
                                    Esta ubicación permite mostrar el precio en
                                    el mapa y calcular cómo llegar.
                                </FieldDescription>
                                <Suspense
                                    fallback={
                                        <Skeleton className="h-72 rounded-lg" />
                                    }
                                >
                                    <LocationPicker
                                        value={
                                            draft.latitude != null &&
                                            draft.longitude != null
                                                ? {
                                                      latitude: draft.latitude,
                                                      longitude:
                                                          draft.longitude,
                                                  }
                                                : null
                                        }
                                        onChange={(coordinates) =>
                                            setDraft({
                                                ...draft,
                                                ...coordinates,
                                            })
                                        }
                                    />
                                </Suspense>
                            </Field>
                        </FieldGroup>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { setShowCreate(false); setEditingListing(null); setDraft(emptyDraft); }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    (draft.type === "offer" && (draft.latitude == null || draft.longitude == null)) ||
                                    (draft.type === "search" && !draft.zone.trim())
                                }
                            >
                                {draft.type === "offer" ? <MapIcon data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}
                                {editingListing ? "Guardar cambios" : draft.type === "offer" ? "Publicar oferta" : "Publicar búsqueda"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
