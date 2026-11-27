import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRightIcon, MoonIcon, SunIcon } from "lucide-react";
import { api, ApiError, googleAuthErrorMessage, type User } from "@/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import roomSearchLogo from "@/client/assets/roomsearch-brand.jpg";

const isStaticPreview = import.meta.env.VITE_STATIC_PREVIEW === "true";

export function AuthGate({ children }: {
    children: (user: User, onLogout: () => void) => ReactNode;
}) {
    const [user, setUser] = useState<User | null>(null);
    const [checking, setChecking] = useState(!isStaticPreview);
    const [sessionError, setSessionError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(() => {
        const url = new URL(window.location.href);
        const message = googleAuthErrorMessage(url.searchParams.get("google_error"));

        if (url.searchParams.has("google_error")) {
            url.searchParams.delete("google_error");
            window.history.replaceState({}, "", url);
        }

        return message;
    });
    const [dark, setDark] = useState(() => {
        const saved = localStorage.getItem("roomies-theme");
        return saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    });

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        localStorage.setItem("roomies-theme", dark ? "dark" : "light");
    }, [dark]);

    useEffect(() => {
        if (isStaticPreview) return;

        const controller = new AbortController();
        let active = true;
        const timeout = setTimeout(() => controller.abort(), 10_000);
        setChecking(true);
        setSessionError(false);
        api<{ user: User }>("/me", { signal: controller.signal })
            .then(({ user }) => { if (active) setUser(user); })
            .catch((caught) => {
                if (active && !(caught instanceof ApiError && caught.status === 401)) {
                    setSessionError(true);
                }
            })
            .finally(() => {
                clearTimeout(timeout);
                if (active) setChecking(false);
            });
        return () => { active = false; clearTimeout(timeout); controller.abort(); };
    }, [attempt]);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending || isStaticPreview) return;
        const body = Object.fromEntries(new FormData(event.currentTarget));
        setPending(true);
        setError("");
        try {
            const result = await api<{ user: User }>(`/auth/${mode}`, {
                method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
            });
            setUser(result.user);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : "No pudimos conectar. Revisa tu conexión e intenta de nuevo.");
        } finally {
            setPending(false);
        }
    }

    if (user) return children(user, () => {
        setUser(null);
        setMode("login");
        setError("");
        setDark(document.documentElement.classList.contains("dark"));
    });

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
                <span className="flex items-center gap-3 text-lg font-semibold tracking-tight sm:text-xl">
                    <img className="size-9 rounded-lg object-cover sm:size-10" src={roomSearchLogo} alt="" />
                    RoomSearch
                </span>
                <Button variant="ghost" size="icon" aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"} onClick={() => setDark(!dark)}>
                    {dark ? <SunIcon /> : <MoonIcon />}
                </Button>
            </header>
            <main className="mx-auto grid max-w-6xl items-center gap-6 px-5 pb-8 pt-4 sm:px-8 min-[680px]:min-h-[calc(100dvh-76px)] min-[680px]:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] min-[680px]:py-4 lg:gap-16 lg:px-10 lg:py-10">
                <section className="mx-auto flex w-full max-w-md flex-col gap-3 lg:mx-0 lg:max-w-lg lg:gap-5">
                    <h1 className="max-w-xl text-2xl font-semibold leading-tight tracking-tight lg:text-5xl">Un nuevo hogar empieza contigo.</h1>
                    <p className="max-w-md text-sm leading-6 text-muted-foreground lg:text-base lg:leading-7">Encuentra una habitación, explora el mapa y conecta con personas para compartir tu próximo hogar.</p>
                    <p className="hidden text-sm font-medium text-primary lg:block">Tu espacio. Tu gente.</p>
                </section>
                <Card className="w-full max-w-md justify-self-center gap-3 py-5 lg:justify-self-end">
                    <CardHeader className="gap-1 px-5 sm:px-7">
                        <CardTitle><h2 className="text-xl font-semibold tracking-tight">{mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}</h2></CardTitle>
                        <CardDescription>{isStaticPreview ? "Esta versión permite revisar la interfaz, pero no iniciar sesión." : mode === "login" ? "Ingresa a tu cuenta para explorar Roomies." : "Regístrate para comenzar a buscar tu próximo hogar."}</CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 sm:px-7">
                        <div className="flex flex-col gap-4">
                            {isStaticPreview && <Alert><AlertTitle>Vista previa</AlertTitle><AlertDescription>El acceso con Google y las publicaciones requieren el servidor de la aplicación.</AlertDescription></Alert>}
                            {checking && <p role="status" className="text-xs text-muted-foreground">Comprobando sesión…</p>}
                            {sessionError && (
                                <div className="flex flex-col gap-1">
                                    <Alert variant="destructive"><AlertTitle>No pudimos comprobar tu sesión</AlertTitle><AlertDescription>Revisa tu conexión e intenta de nuevo.</AlertDescription></Alert>
                                    <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setAttempt(attempt + 1)}>Reintentar</Button>
                                </div>
                            )}
                            <form key={mode} onSubmit={submit} aria-busy={pending} className="flex flex-col gap-4">
                                {error && <Alert variant="destructive"><AlertTitle>No pudimos continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                                <FieldGroup>
                                    {mode === "register" && <Field><FieldLabel htmlFor="auth-name">Nombre</FieldLabel><Input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={120} disabled={pending} className="h-11" /></Field>}
                                    <Field><FieldLabel htmlFor="auth-email">Correo electrónico</FieldLabel><Input id="auth-email" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required maxLength={255} disabled={pending} className="h-11" /></Field>
                                    <Field><FieldLabel htmlFor="auth-password">Contraseña</FieldLabel><Input id="auth-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : undefined} maxLength={255} disabled={pending} className="h-11" />{mode === "register" && <FieldDescription>Usa al menos 8 caracteres.</FieldDescription>}</Field>
                                </FieldGroup>
                                <Button type="submit" size="lg" className="h-11 w-full" disabled={pending || isStaticPreview}>{pending ? "Un momento…" : mode === "login" ? "Ingresar" : "Crear cuenta"}<ArrowRightIcon data-icon="inline-end" /></Button>
                            </form>
                            {!isStaticPreview && (
                                <Button type="button" variant="outline" size="lg" className="h-11 w-full" disabled={pending} onClick={() => { window.location.href = "/api/auth/google"; }}>
                                    Continuar con Google
                                </Button>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex-wrap justify-center gap-1 px-5 py-3 sm:px-7">
                        <span className="text-sm text-muted-foreground">{mode === "login" ? "¿Primera vez en Roomies?" : "¿Ya tienes cuenta?"}</span>
                        <Button variant="link" disabled={pending} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Crear cuenta" : "Ingresar"}</Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
