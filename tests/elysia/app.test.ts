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
        const app = createApp(database);
        const cookie = await register(app, "ana@example.com");
        const response = await app.handle(
            jsonRequest("/api/me", "GET", undefined, cookie),
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            user: { name: "ana", email: "ana@example.com" },
        });
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
                    city: "San José",
                    zone: "Escalante",
                    budget: 250000,
                },
                cookie,
            ),
        );
        expect(created.status).toBe(201);

        const response = await app.handle(
            new Request(
                "http://localhost/api/listings?city=Escalante&type=offer",
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
                    city: "San José",
                    zone: null,
                    budget: 250000,
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
                    city: "San José",
                    zone: null,
                    budget: 1,
                },
                strangerCookie,
            ),
        );
        expect(response.status).toBe(403);
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
                    city: "San José",
                    budget: 250000,
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
});
