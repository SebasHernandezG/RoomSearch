import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRightIcon, Building2Icon, MoonIcon, SunIcon } from "lucide-react";
import { api, ApiError, type User } from "@/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGate({ children }: {
    children: (user: User, onLogout: () => void) => ReactNode;
}) {
    const [user, setUser] = useState<User | null>(null);
    const [checking, setChecking] = useState(true);
    const [sessionError, setSessionError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [dark, setDark] = useState(() => {
        const saved = localStorage.getItem("roomies-theme");
        return saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    });

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        localStorage.setItem("roomies-theme", dark ? "dark" : "light");
    }, [dark]);

    useEffect(() => {
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
        if (pending) return;
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
        <div className="min-h-[100dvh] bg-background text-foreground">
            <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
                <span className="flex items-center gap-3 text-xl font-semibold tracking-tight">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Building2Icon aria-hidden="true" /></span>
                    Roomies
                </span>
                <Button variant="ghost" size="icon" aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"} onClick={() => setDark(!dark)}>
                    {dark ? <SunIcon /> : <MoonIcon />}
                </Button>
            </header>
            <main className="mx-auto grid min-h-[calc(100dvh-88px)] max-w-6xl items-center gap-10 px-6 pb-12 pt-6 md:grid-cols-2 md:gap-16 sm:px-10">
                <section className="flex max-w-lg flex-col gap-5">
                    <p className="text-sm font-medium text-primary">Tu espacio. Tu gente.</p>
                    <h1 className="text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">Un nuevo hogar empieza contigo.</h1>
                    <p className="max-w-sm text-base leading-7 text-muted-foreground">Encuentra una habitación, explora el mapa y conecta con personas para compartir tu próximo hogar.</p>
                    <div className="mt-4 hidden border-l-2 border-primary pl-5 md:block">
                        <p className="font-medium">Encuentra donde encajar.</p>
                        <p className="mt-2 text-sm text-muted-foreground">Habitaciones y roomies en Costa Rica.</p>
                    </div>
                </section>
                <Card className="w-full max-w-md justify-self-center md:justify-self-end" >
                    <CardHeader className="gap-3 px-6 pt-4 sm:px-8">
                        <CardTitle><h2>{mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}</h2></CardTitle>
                        <CardDescription>{mode === "login" ? "Ingresa a tu cuenta para explorar Roomies." : "Regístrate para comenzar a buscar tu próximo hogar."}</CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 py-3 sm:px-8">
                        {checking ? (
                            <div role="status" aria-label="Comprobando sesión" className="flex flex-col gap-5">
                                <Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
                                <span className="sr-only">Comprobando sesión…</span>
                            </div>
                        ) : sessionError ? (
                            <div className="flex flex-col gap-4">
                                <Alert variant="destructive"><AlertTitle>No pudimos comprobar tu sesión</AlertTitle><AlertDescription>Verifica que el servidor esté disponible e intenta nuevamente.</AlertDescription></Alert>
                                <Button onClick={() => setAttempt(attempt + 1)}>Reintentar</Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <form key={mode} onSubmit={submit} aria-busy={pending} className="flex flex-col gap-6">
                                    {error && <Alert variant="destructive"><AlertTitle>No pudimos continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                                    <FieldGroup>
                                        {mode === "register" && <Field><FieldLabel htmlFor="auth-name">Nombre</FieldLabel><Input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={120} disabled={pending} className="h-11" /></Field>}
                                        <Field><FieldLabel htmlFor="auth-email">Correo electrónico</FieldLabel><Input id="auth-email" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required maxLength={255} disabled={pending} className="h-11" /></Field>
                                        <Field><FieldLabel htmlFor="auth-password">Contraseña</FieldLabel><Input id="auth-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : undefined} maxLength={255} disabled={pending} className="h-11" />{mode === "register" && <FieldDescription>Usa al menos 8 caracteres.</FieldDescription>}</Field>
                                    </FieldGroup>
                                    <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>{pending ? "Un momento…" : mode === "login" ? "Ingresar" : "Crear cuenta"}<ArrowRightIcon data-icon="inline-end" /></Button>
                                </form>
                                <Button type="button" variant="outline" size="lg" className="h-11 w-full" disabled={pending} onClick={() => { window.location.href = "/api/auth/google"; }}>
                                    Continuar con Google
                                </Button>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex-wrap justify-center gap-1 px-6 py-5">
                        <span className="text-sm text-muted-foreground">{mode === "login" ? "¿Primera vez en Roomies?" : "¿Ya tienes cuenta?"}</span>
                        <Button variant="link" disabled={pending || checking || sessionError} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Crear cuenta" : "Ingresar"}</Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
