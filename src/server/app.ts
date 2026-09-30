import { Elysia, t } from "elysia";
import {
    createDatabase,
    findUserBySession,
    hashToken,
    now,
    type RoomiesDatabase,
    type UserRow,
} from "./database";
import { credentialsSchema, listingSchema, profileSchema, routeSchema } from "./schemas";
import { createRouteHandler, type RouteOptions } from "./route";
import { createGoogleAuth, type GoogleAuthOptions } from "./google-auth";

type ListingRow = {
    id: number;
    user_id: number;
    owner_name: string;
    type: "offer" | "search";
    title: string;
    description: string;
    city: string;
    zone: string | null;
    budget: number;
    latitude: number | null;
    longitude: number | null;
    is_active: number;
    photos: string | null;
    created_at: string;
};

const sessionCookie = t.Cookie(
    { roomies_session: t.Optional(t.String()) },
    {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
    },
);

const presentListing = (listing: ListingRow) => ({
    id: listing.id,
    ownerId: listing.user_id,
    ownerName: listing.owner_name,
    type: listing.type,
    title: listing.title,
    description: listing.description,
    city: listing.city,
    zone: listing.zone,
    budget: listing.budget,
    latitude: listing.latitude,
    longitude: listing.longitude,
    isActive: Boolean(listing.is_active),
    photos: listing.photos ? JSON.parse(listing.photos) : [],
    createdAt: listing.created_at,
});

export const createApp = (
    database: RoomiesDatabase = createDatabase(),
    routeOptions: RouteOptions = {},
    googleOptions: GoogleAuthOptions = {},
) => {
    const routeHandler = createRouteHandler(routeOptions);
    const googleAuth = createGoogleAuth(database, googleOptions);

    return new Elysia({
        name: "roomies-api",
        cookie: {
            secrets:
                process.env.COOKIE_SECRET ??
                (process.env.NODE_ENV === "production"
                    ? (() => {
                          throw new Error(
                              "COOKIE_SECRET is required in production.",
                          );
                      })()
                    : "local-roomies-secret-change-me"),
            sign: ["roomies_session"],
        },
    })
        .onError(({ code, error, set }) => {
            if (code === "VALIDATION") {
                set.status = 422;
                return {
                    message: "Revisa los datos enviados.",
                    details: error.all,
                };
            }
            if (code === "NOT_FOUND") {
                set.status = 404;
                return { message: "Ruta no encontrada." };
            }
            console.error(error);
            set.status = 500;
            return { message: "Ocurrió un error inesperado." };
        })
        .derive(({ cookie }) => {
            const token = cookie.roomies_session.value;

            return {
                user: findUserBySession(
                    database,
                    typeof token === "string" ? token : undefined,
                ),
            };
        })
        .post("/route", routeHandler, { body: routeSchema })
        .group("/api", (api) =>
            api
                .get("/auth/google", ({ cookie, redirect, set }) => {
                    set.headers["Cache-Control"] = "no-store";
                    const result = googleAuth.begin();
                    if (!result.state || !result.url) return redirect(googleAuth.home(result.error));
                    cookie.roomies_google_state.set({
                        value: result.state, httpOnly: true, sameSite: "lax", path: "/",
                        secure: process.env.NODE_ENV === "production", maxAge: 600,
                    });
                    return redirect(result.url);
                })
                .get("/auth/google/callback", async ({ request, cookie, redirect, set }) => {
                    set.headers["Cache-Control"] = "no-store";
                    set.headers["Referrer-Policy"] = "no-referrer";
                    const state = cookie.roomies_google_state.value;
                    cookie.roomies_google_state.set({ value: "", path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
                    const result = await googleAuth.finish(new URL(request.url).searchParams, typeof state === "string" ? state : undefined);
                    if ("error" in result) return redirect(googleAuth.home(result.error));
                    cookie.roomies_session.set({
                        value: result.token, httpOnly: true, sameSite: "lax", path: "/",
                        secure: process.env.NODE_ENV === "production", maxAge: 30 * 86400,
                    });
                    return redirect(googleAuth.home());
                })
                .post("/route", routeHandler, { body: routeSchema })
                .get("/health", () => ({ status: "ok" as const }))
                .post(
                    "/auth/register",
                    async ({ body, cookie, set }) => {
                        const email = body.email.trim().toLowerCase();
                        if (
                            database
                                .query("SELECT id FROM users WHERE email = ?")
                                .get(email)
                        ) {
                            set.status = 409;
                            return {
                                message: "Ese correo ya está registrado.",
                            };
                        }
                        const timestamp = now();
                        const password = await Bun.password.hash(
                            body.password,
                            { algorithm: "bcrypt", cost: 12 },
                        );
                        const result = database
                            .query(
                                "INSERT INTO users (name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                            )
                            .run(
                                body.name.trim(),
                                email,
                                password,
                                timestamp,
                                timestamp,
                            );
                        database
                            .query(
                                "INSERT INTO profiles (user_id, created_at, updated_at) VALUES (?, ?, ?)",
                            )
                            .run(result.lastInsertRowid, timestamp, timestamp);
                        const token = crypto.randomUUID() + crypto.randomUUID();
                        database
                            .query(
                                "INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
                            )
                            .run(
                                result.lastInsertRowid,
                                hashToken(token),
                                new Date(
                                    Date.now() + 30 * 86400000,
                                ).toISOString(),
                                timestamp,
                            );
                        cookie.roomies_session.value = token;
                        set.status = 201;
                        return {
                            user: {
                                id: Number(result.lastInsertRowid),
                                name: body.name.trim(),
                                email,
                            },
                        };
                    },
                    {
                        body: t.Intersect([
                            credentialsSchema,
                            t.Object({
                                name: t.String({
                                    minLength: 2,
                                    maxLength: 120,
                                }),
                            }),
                        ]),
                        cookie: sessionCookie,
                    },
                )
                .post(
                    "/auth/login",
                    async ({ body, cookie, set }) => {
                        const user = database
                            .query<UserRow, [string]>(
                                "SELECT id, name, email, password FROM users WHERE email = ?",
                            )
                            .get(body.email.trim().toLowerCase());
                        if (
                            !user ||
                            !(await Bun.password.verify(
                                body.password,
                                user.password,
                            ))
                        ) {
                            set.status = 422;
                            return {
                                message: "Las credenciales no son válidas.",
                            };
                        }
                        const token = crypto.randomUUID() + crypto.randomUUID();
                        database
                            .query(
                                "INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
                            )
                            .run(
                                user.id,
                                hashToken(token),
                                new Date(
                                    Date.now() + 30 * 86400000,
                                ).toISOString(),
                                now(),
                            );
                        cookie.roomies_session.value = token;
                        return {
                            user: {
                                id: user.id,
                                name: user.name,
                                email: user.email,
                            },
                        };
                    },
                    { body: credentialsSchema, cookie: sessionCookie },
                )
                .post(
                    "/auth/logout",
                    ({ cookie }) => {
                        const token = cookie.roomies_session.value;
                        if (token)
                            database
                                .query(
                                    "DELETE FROM auth_sessions WHERE token_hash = ?",
                                )
                                .run(hashToken(token));
                        cookie.roomies_session.remove();
                        return { message: "Sesión cerrada." };
                    },
                    { cookie: sessionCookie },
                )
                .get("/me", ({ user, set }) => {
                    if (!user) {
                        set.status = 401;
                        return { message: "Debes iniciar sesión." };
                    }
                    return { user };
                })
                .get(
                    "/listings",
                    ({ query }) => {
                        const conditions = ["listings.is_active = 1"];
                        const values: string[] = [];
                        if (query.city) {
                            conditions.push(
                                "(listings.city LIKE ? OR listings.zone LIKE ?)",
                            );
                            values.push(`%${query.city}%`, `%${query.city}%`);
                        }
                        if (query.type) {
                            conditions.push("listings.type = ?");
                            values.push(query.type);
                        }
                        const listings = database
                            .query<ListingRow, string[]>(
                                `
                SELECT listings.*, users.name AS owner_name FROM listings
                JOIN users ON users.id = listings.user_id WHERE ${conditions.join(" AND ")}
                ORDER BY listings.created_at DESC, listings.id DESC LIMIT 100
            `,
                            )
                            .all(...values);
                        return { listings: listings.map(presentListing) };
                    },
                    {
                        query: t.Object({
                            city: t.Optional(t.String({ maxLength: 100 })),
                            type: t.Optional(
                                t.Union([
                                    t.Literal("offer"),
                                    t.Literal("search"),
                                ]),
                            ),
                        }),
                    },
                )
                .get(
                    "/listings/:id",
                    ({ params, user, set }) => {
                        const listing = database
                            .query<ListingRow, [number]>(
                                `
                SELECT listings.*, users.name AS owner_name FROM listings
                JOIN users ON users.id = listings.user_id WHERE listings.id = ?
            `,
                            )
                            .get(params.id);
                        if (
                            !listing ||
                            (!listing.is_active && listing.user_id !== user?.id)
                        ) {
                            set.status = 404;
                            return { message: "Publicación no encontrada." };
                        }
                        return { listing: presentListing(listing) };
                    },
                    { params: t.Object({ id: t.Numeric() }) },
                )
                .post(
                    "/listings",
                    ({ body, user, set }) => {
                        if (!user) {
                            set.status = 401;
                            return { message: "Debes iniciar sesión." };
                        }
                        const timestamp = now();
                        const result = database
                            .query(
                                `
                INSERT INTO listings (user_id, type, title, description, city, zone, budget, latitude, longitude, contact_method, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'interest', ?, ?, ?)
            `,
                            )
                            .run(
                                user.id,
                                body.type,
                                body.title.trim(),
                                body.description.trim(),
                                body.city.trim(),
                                body.zone?.trim() || null,
                                body.budget,
                                body.latitude ?? null,
                                body.longitude ?? null,
                                body.isActive === false ? 0 : 1,
                                timestamp,
                                timestamp,
                            );
                        set.status = 201;
                        return { id: Number(result.lastInsertRowid) };
                    },
                    { body: listingSchema },
                )
                .put(
                    "/listings/:id",
                    ({ params, body, user, set }) => {
                        if (!user) {
                            set.status = 401;
                            return { message: "Debes iniciar sesión." };
                        }
                        const listing = database
                            .query<{ user_id: number }, [number]>(
                                "SELECT user_id FROM listings WHERE id = ?",
                            )
                            .get(params.id);
                        if (!listing) {
                            set.status = 404;
                            return { message: "Publicación no encontrada." };
                        }
                        if (listing.user_id !== user.id) {
                            set.status = 403;
                            return {
                                message: "No puedes editar esta publicación.",
                            };
                        }
                        database
                            .query(
                                "UPDATE listings SET type = ?, title = ?, description = ?, city = ?, zone = ?, budget = ?, latitude = ?, longitude = ?, is_active = ?, updated_at = ? WHERE id = ?",
                            )
                            .run(
                                body.type,
                                body.title.trim(),
                                body.description.trim(),
                                body.city.trim(),
                                body.zone?.trim() || null,
                                body.budget,
                                body.latitude ?? null,
                                body.longitude ?? null,
                                body.isActive === false ? 0 : 1,
                                now(),
                                params.id,
                            );
                        return { message: "Publicación actualizada." };
                    },
                    {
                        params: t.Object({ id: t.Numeric() }),
                        body: listingSchema,
                    },
                )
                .delete(
                    "/listings/:id",
                    ({ params, user, set }) => {
                        if (!user) {
                            set.status = 401;
                            return { message: "Debes iniciar sesión." };
                        }
                        const result = database
                            .query(
                                "DELETE FROM listings WHERE id = ? AND user_id = ?",
                            )
                            .run(params.id, user.id);
                        if (!result.changes) {
                            set.status = 404;
                            return { message: "Publicación no encontrada." };
                        }
                        return { message: "Publicación eliminada." };
                    },
                    { params: t.Object({ id: t.Numeric() }) },
                )
                .get("/profile", ({ user, set }) => {
                    if (!user) {
                        set.status = 401;
                        return { message: "Debes iniciar sesión." };
                    }
                    return {
                        profile: database
                            .query(
                                "SELECT city, zone, budget_min AS budgetMin, budget_max AS budgetMax, bio, phone FROM profiles WHERE user_id = ?",
                            )
                            .get(user.id),
                    };
                })
                .put(
                    "/profile",
                    ({ body, user, set }) => {
                        if (!user) {
                            set.status = 401;
                            return { message: "Debes iniciar sesión." };
                        }
                        if (
                            body.budgetMin != null &&
                            body.budgetMax != null &&
                            body.budgetMin > body.budgetMax
                        ) {
                            set.status = 422;
                            return {
                                message:
                                    "El presupuesto mínimo no puede superar el máximo.",
                            };
                        }
                        database
                            .query(
                                "UPDATE profiles SET city = ?, zone = ?, budget_min = ?, budget_max = ?, bio = ?, phone = ?, updated_at = ? WHERE user_id = ?",
                            )
                            .run(
                                body.city ?? null,
                                body.zone ?? null,
                                body.budgetMin ?? null,
                                body.budgetMax ?? null,
                                body.bio ?? null,
                                body.phone ?? null,
                                now(),
                                user.id,
                            );
                        return { message: "Perfil actualizado." };
                    },
                    { body: profileSchema },
                )
                .post(
                    "/listings/:id/interests",
                    ({ params, body, user, set }) => {
                        if (!user) {
                            set.status = 401;
                            return { message: "Debes iniciar sesión." };
                        }
                        const listing = database
                            .query<
                                { user_id: number; is_active: number },
                                [number]
                            >(
                                "SELECT user_id, is_active FROM listings WHERE id = ?",
                            )
                            .get(params.id);
                        if (!listing || !listing.is_active) {
                            set.status = 404;
                            return { message: "Publicación no encontrada." };
                        }
                        if (listing.user_id === user.id) {
                            set.status = 422;
                            return {
                                message:
                                    "No puedes contactar tu propia publicación.",
                            };
                        }
                        try {
                            const timestamp = now();
                            database
                                .query(
                                    "INSERT INTO interests (listing_id, user_id, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                                )
                                .run(
                                    params.id,
                                    user.id,
                                    body.message.trim(),
                                    timestamp,
                                    timestamp,
                                );
                            set.status = 201;
                            return { message: "Solicitud enviada." };
                        } catch {
                            set.status = 409;
                            return {
                                message:
                                    "Ya enviaste una solicitud para esta publicación.",
                            };
                        }
                    },
                    {
                        params: t.Object({ id: t.Numeric() }),
                        body: t.Object({
                            message: t.String({
                                minLength: 1,
                                maxLength: 1000,
                            }),
                        }),
                    },
                )
                .get("/interests", ({ user, set }) => {
                    if (!user) {
                        set.status = 401;
                        return { message: "Debes iniciar sesión." };
                    }
                    const received = database
                        .query(
                            "SELECT interests.*, listings.title AS listing_title, users.name AS requester_name FROM interests JOIN listings ON listings.id = interests.listing_id JOIN users ON users.id = interests.user_id WHERE listings.user_id = ? ORDER BY interests.created_at DESC",
                        )
                        .all(user.id);
                    const sent = database
                        .query(
                            "SELECT interests.*, listings.title AS listing_title, users.name AS owner_name FROM interests JOIN listings ON listings.id = interests.listing_id JOIN users ON users.id = listings.user_id WHERE interests.user_id = ? ORDER BY interests.created_at DESC",
                        )
                        .all(user.id);
                    return { received, sent };
                })
                .put(
                    "/interests/:id/reply",
                    ({ params, body, user, set }) => {
                        if (!user) {
                            set.status = 401;
                            return { message: "Debes iniciar sesión." };
                        }
                        const result = database
                            .query(
                                "UPDATE interests SET reply = ?, replied_at = ?, updated_at = ? WHERE id = ? AND listing_id IN (SELECT id FROM listings WHERE user_id = ?)",
                            )
                            .run(
                                body.reply.trim(),
                                now(),
                                now(),
                                params.id,
                                user.id,
                            );
                        if (!result.changes) {
                            set.status = 404;
                            return { message: "Solicitud no encontrada." };
                        }
                        return { message: "Respuesta guardada." };
                    },
                    {
                        params: t.Object({ id: t.Numeric() }),
                        body: t.Object({
                            reply: t.String({ minLength: 1, maxLength: 2000 }),
                        }),
                    },
                ),
        );
};

export type RoomiesApp = ReturnType<typeof createApp>;
