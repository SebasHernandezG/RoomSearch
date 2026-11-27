import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCookieSecret, getGoogleCallback, getServerConfig } from "../../src/server/config";
import { createDatabase, type RoomiesDatabase } from "../../src/server/database";
import { createApp } from "../../src/server/app";

const production = {
    NODE_ENV: "production",
    COOKIE_SECRET: "a-secure-test-secret-with-at-least-32-characters",
    APP_URL: "https://roomies.example",
    DB_DATABASE: "/app/data/roomies.sqlite",
};

describe("Production configuration", () => {
    it.each([undefined, "", "   ", "short", "local-roomies-secret-change-me"])("rejects insecure session secrets: %s", (secret) => {
        expect(() => getCookieSecret({ ...production, COOKIE_SECRET: secret })).toThrow("COOKIE_SECRET");
    });

    it("accepts a production secret and persistent database path", () => {
        expect(getCookieSecret(production)).toBe(production.COOKIE_SECRET);
        expect(getServerConfig({ ...production, PORT: "10000" })).toEqual({ port: 10000, databasePath: "/app/data/roomies.sqlite" });
    });

    it("derives Google's callback from the public address when the override is blank", () => {
        expect(getGoogleCallback({ ...production, ELYSIA_GOOGLE_REDIRECT_URI: "  " })).toBe("https://roomies.example/api/auth/google/callback");
    });

    it("uses Render's public address for the QA deployment", () => {
        expect(getGoogleCallback({ ...production, APP_URL: "", RENDER_EXTERNAL_URL: "https://roomsearch-qa.onrender.com" }))
            .toBe("https://roomsearch-qa.onrender.com/api/auth/google/callback");
    });

    it("accepts an explicit production callback", () => {
        expect(getGoogleCallback({ ...production, ELYSIA_GOOGLE_REDIRECT_URI: "https://other.example/api/auth/google/callback" })).toBe("https://other.example/api/auth/google/callback");
    });

    it.each(["http://roomies.example", "https://localhost", "https://127.0.0.1", "https://[::1]"])("rejects unsafe public addresses: %s", (url) => {
        expect(() => getGoogleCallback({ ...production, APP_URL: url })).toThrow("HTTPS");
    });

    it("requires a public address in production", () => {
        expect(() => getGoogleCallback({ ...production, APP_URL: "" })).toThrow("APP_URL");
    });

    it.each([undefined, "", ":memory:"])("rejects missing or temporary production database paths: %s", (path) => {
        expect(() => getServerConfig({ ...production, DB_DATABASE: path })).toThrow("DB_DATABASE");
    });

    it.each(["", "0", "-1", "65536", "3000.5", "invalid"])("rejects invalid server ports: %s", (port) => {
        expect(() => getServerConfig({ ...production, PORT: port })).toThrow("PORT");
    });

    it("retains local development defaults", () => {
        expect(getCookieSecret({})).toBe("local-roomies-secret-change-me");
        expect(getGoogleCallback({})).toBe("http://localhost:3000/api/auth/google/callback");
        expect(getServerConfig({})).toEqual({ port: 3000, databasePath: "database/database.sqlite" });
    });
});

describe("Persistent production data", () => {
    let directory: string | undefined;
    let database: RoomiesDatabase | undefined;

    afterEach(async () => {
        database?.close();
        database = undefined;
        if (directory) await rm(directory, { recursive: true, force: true });
        directory = undefined;
    });

    it("keeps accounts and sessions when the server reopens its database", async () => {
        directory = await mkdtemp(join(tmpdir(), "roomies-persistence-"));
        const path = join(directory, "data", "roomies.sqlite");
        database = createDatabase(path);
        const app = createApp(database);
        const response = await app.handle(new Request("http://localhost/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Ana", email: "ana@example.com", password: "password123" }),
        }));
        expect(response.status).toBe(201);
        const cookie = response.headers.get("set-cookie")!.split(";")[0];
        database.close();
        database = createDatabase(path);

        const restored = await createApp(database).handle(new Request("http://localhost/api/me", { headers: { cookie } }));

        expect(restored.status).toBe(200);
        expect(await restored.json()).toMatchObject({ user: { name: "Ana", email: "ana@example.com" } });
    });

    it("returns 500 from the health check when the database is unavailable", async () => {
        database = createDatabase(":memory:");
        const app = createApp(database);
        database.close();
        database = undefined;

        const response = await app.handle(new Request("http://localhost/api/health"));

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ message: "Ocurrió un error inesperado." });
    });
});
