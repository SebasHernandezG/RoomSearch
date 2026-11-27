import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { createApp } from "../../src/server/app";
import {
    createDatabase,
    type RoomiesDatabase,
} from "../../src/server/database";

const databasePath = "database/roomies-test.sqlite";
let database: RoomiesDatabase;

const jsonRequest = (
    path: string,
    method: string,
    body?: unknown,
    cookie?: string,
) =>
    new Request(`http://localhost${path}`, {
        method,
        headers: {
            ...(body ? { "content-type": "application/json" } : {}),
            ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

const register = async (app: ReturnType<typeof createApp>, email: string) => {
    const response = await app.handle(
        jsonRequest("/api/auth/register", "POST", {
            name: email.split("@")[0],
            email,
            password: "password123",
        }),
    );
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    expect(response.status).toBe(201);
    expect(cookie).toBeTruthy();
    return cookie!;
};

describe("Roomies Elysia API", () => {
    beforeEach(() => {
        database = createDatabase(databasePath);
    });
    afterEach(() => {
        database.close();
        for (const suffix of ["", "-shm", "-wal"]) {
            try {
                unlinkSync(databasePath + suffix);
            } catch {
                /* The file may not exist. */
            }
        }
    });

    it("registers a user and returns the authenticated session", async () => {
        const app = createApp(database).compile();
        const cookie = await register(app, "ana@example.com");
        const response = await app.handle(
            jsonRequest("/api/me", "GET", undefined, cookie),
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            user: { name: "ana", email: "ana@example.com" },
        });
    });

    it("removes the authenticated session on logout", async () => {
        const app = createApp(database);
        const cookie = await register(app, "logout@example.com");
        const logout = await app.handle(
            jsonRequest("/api/auth/logout", "POST", undefined, cookie),
        );
        const response = await app.handle(
            jsonRequest("/api/me", "GET", undefined, cookie),
        );

        expect(logout.status).toBe(200);
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
            message: "Debes iniciar sesión.",
        });
    });

    it("starts Google authentication in Spanish", async () => {
        const app = createApp(database, {}, {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
            redirectUri: "http://localhost:3000/api/auth/google/callback",
        });
        const response = await app.handle(
            jsonRequest("/api/auth/google", "GET"),
        );
        const location = new URL(response.headers.get("location")!);

        expect(response.status).toBe(302);
        expect(location.hostname).toBe("accounts.google.com");
        expect(location.searchParams.get("hl")).toBe("es");
        expect(location.searchParams.get("redirect_uri")).toBe(
            "http://localhost:3000/api/auth/google/callback",
        );
    });

    it("creates and publicly filters listings", async () => {
        const app = createApp(database);
        const cookie = await register(app, "owner@example.com");
        const created = await app.handle(
            jsonRequest(
                "/api/listings",
                "POST",
                {
                    type: "offer",
                    title: "Cuarto luminoso",
                    description: "Incluye todos los servicios.",
                    city: "Ciudad Quesada",
                    zone: "Barrio San Martín",
                    budget: 250000,
                    latitude: 10.3257,
                    longitude: -84.43,
                },
                cookie,
            ),
        );
        expect(created.status).toBe(201);

        const response = await app.handle(
            new Request(
                "http://localhost/api/listings?city=San%20Mart%C3%ADn&type=offer",
            ),
        );
        const payload = (await response.json()) as {
            listings: Array<{ title: string }>;
        };
        expect(response.status).toBe(200);
        expect(payload.listings).toHaveLength(1);
        expect(payload.listings[0]?.title).toBe("Cuarto luminoso");
    });

    it("prevents a user from editing another users listing", async () => {
        const app = createApp(database);
        const ownerCookie = await register(app, "owner@example.com");
        const created = await app.handle(
            jsonRequest(
                "/api/listings",
                "POST",
                {
                    type: "offer",
                    title: "Cuarto luminoso",
                    description: "Incluye todos los servicios.",
                    city: "Ciudad Quesada",
                    zone: null,
                    budget: 250000,
                    latitude: 10.3257,
                    longitude: -84.43,
                },
                ownerCookie,
            ),
        );
        const { id } = (await created.json()) as { id: number };
        const strangerCookie = await register(app, "stranger@example.com");
        const response = await app.handle(
            jsonRequest(
                `/api/listings/${id}`,
                "PUT",
                {
                    type: "offer",
                    title: "Título cambiado",
                    description: "Descripción suficientemente larga.",
                    city: "Ciudad Quesada",
                    zone: null,
                    budget: 1,
                    latitude: 10.3257,
                    longitude: -84.43,
                },
                strangerCookie,
            ),
        );
        expect(response.status).toBe(403);
    });

    it("allows an owner to edit and delete their listing", async () => {
        const app = createApp(database);
        const ownerCookie = await register(app, "proposal-owner@example.com");
        const created = await app.handle(jsonRequest("/api/listings", "POST", {
            type: "search",
            title: "Busco apartamento",
            description: "Busco una opción cerca del centro.",
            city: "Ciudad Quesada",
            zone: "San Martín",
            budget: 50000,
        }, ownerCookie));
        const { id } = (await created.json()) as { id: number };

        const updated = await app.handle(jsonRequest(`/api/listings/${id}`, "PUT", {
            type: "search",
            title: "Busco dos propuestas",
            description: "Busco varias opciones cerca del centro.",
            city: "Florencia",
            zone: "Centro",
            budget: 45000,
        }, ownerCookie));
        const deleted = await app.handle(jsonRequest(
            `/api/listings/${id}`,
            "DELETE",
            undefined,
            ownerCookie,
        ));
        const missing = await app.handle(new Request(`http://localhost/api/listings/${id}`));

        expect(updated.status).toBe(200);
        expect(deleted.status).toBe(200);
        expect(missing.status).toBe(404);
    });

    it("supports private interest and owner reply flow", async () => {
        const app = createApp(database);
        const ownerCookie = await register(app, "owner@example.com");
        const created = await app.handle(
            jsonRequest(
                "/api/listings",
                "POST",
                {
                    type: "offer",
                    title: "Cuarto luminoso",
                    description: "Incluye todos los servicios.",
                    city: "Ciudad Quesada",
                    budget: 250000,
                    latitude: 10.3257,
                    longitude: -84.43,
                },
                ownerCookie,
            ),
        );
        const { id } = (await created.json()) as { id: number };
        const applicantCookie = await register(app, "applicant@example.com");
        const interest = await app.handle(
            jsonRequest(
                `/api/listings/${id}/interests`,
                "POST",
                {
                    message: "Me interesa conocer el espacio.",
                },
                applicantCookie,
            ),
        );
        expect(interest.status).toBe(201);

        const inbox = await app.handle(
            jsonRequest("/api/interests", "GET", undefined, ownerCookie),
        );
        const { received } = (await inbox.json()) as {
            received: Array<{ id: number }>;
        };
        expect(received).toHaveLength(1);
        const reply = await app.handle(
            jsonRequest(
                `/api/interests/${received[0]!.id}/reply`,
                "PUT",
                {
                    reply: "Claro, coordinemos una visita.",
                },
                ownerCookie,
            ),
        );
        expect(reply.status).toBe(200);
    });

    it("recommends graph matches by city, zone, and budget", async () => {
        const app = createApp(database);
        const ownerCookie = await register(app, "offer-owner@example.com");
        await app.handle(jsonRequest("/api/listings", "POST", {
            type: "offer",
            title: "Apartamento en San Martín",
            description: "Apartamento disponible cerca del centro.",
            city: "Ciudad Quesada",
            zone: "Barrio San Martín",
            budget: 180000,
            latitude: 10.3257,
            longitude: -84.43,
        }, ownerCookie));

        const seekerCookie = await register(app, "seeker@example.com");
        await app.handle(jsonRequest("/api/listings", "POST", {
            type: "search",
            title: "Busco apartamento",
            description: "Busco una opción tranquila y céntrica.",
            city: "Ciudad Quesada",
            zone: "San Martín",
            budget: 200000,
        }, seekerCookie));

        const response = await app.handle(jsonRequest(
            "/api/recommendations",
            "GET",
            undefined,
            seekerCookie,
        ));
        const payload = (await response.json()) as {
            recommendations: Array<{ offer: { title: string } }>;
        };

        expect(response.status).toBe(200);
        expect(payload.recommendations).toHaveLength(1);
        expect(payload.recommendations[0]?.offer.title).toBe("Apartamento en San Martín");
    });
});
