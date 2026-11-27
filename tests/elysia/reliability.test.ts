import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createApp } from "../../src/server/app";
import { createDatabase, type RoomiesDatabase } from "../../src/server/database";

const request = (path: string, body: unknown, cookie?: string, method = "POST") => new Request(`http://localhost/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
});
const credentials = { name: "Ana", email: "ana@example.com", password: "password123" };
const listing = { type: "search", title: "Busco habitación", description: "Busco una habitación tranquila.", city: "Ciudad Quesada", zone: "Centro", budget: 150000 };

describe("Reliable account and listing writes", () => {
    let database: RoomiesDatabase;
    let app: ReturnType<typeof createApp>;
    beforeEach(() => {
        database = createDatabase(":memory:");
        app = createApp(database);
    });
    afterEach(() => database.close());

    const count = (table: "users" | "profiles" | "auth_sessions" | "listings" | "interests") => database.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get()!.count;
    const register = async (email = credentials.email) => {
        const response = await app.handle(request("/auth/register", { ...credentials, email }));
        expect(response.status).toBe(201);
        return response.headers.get("set-cookie")!.split(";")[0];
    };

    it("returns 201 and 409 for concurrent registrations of the same email", async () => {
        const responses = await Promise.all([
            app.handle(request("/auth/register", credentials)),
            app.handle(request("/auth/register", credentials)),
        ]);

        expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
        expect(count("users")).toBe(1);
        expect(count("profiles")).toBe(1);
        expect(count("auth_sessions")).toBe(1);
    });

    it("rolls back the account and profile when creating its session fails", async () => {
        database.exec("CREATE TRIGGER fail_session BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(ABORT, 'session unavailable'); END;");
        const log = spyOn(console, "error").mockImplementation(() => {});
        try {
            const response = await app.handle(request("/auth/register", credentials));

            expect(response.status).toBe(500);
            expect(response.headers.get("set-cookie")).toBeNull();
            expect(count("users")).toBe(0);
            expect(count("profiles")).toBe(0);
            expect(count("auth_sessions")).toBe(0);
        } finally {
            log.mockRestore();
        }
    });

    it.each(["   ", " A "])("rejects a name too short after trimming with 422: %s", async (name) => {
        const response = await app.handle(request("/auth/register", { ...credentials, name }));

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ message: "Escribe un nombre de al menos 2 caracteres." });
        expect(count("users")).toBe(0);
    });

    it.each([{ title: "   " }, { description: "          " }, { title: " A " }])("rejects invalid trimmed listing text with 422: %j", async (overrides) => {
        const cookie = await register();

        const response = await app.handle(request("/listings", { ...listing, ...overrides }, cookie));

        expect(response.status).toBe(422);
        expect(count("listings")).toBe(0);
    });

    it("preserves a listing when an edit contains only spaces", async () => {
        const cookie = await register();
        const created = await app.handle(request("/listings", listing, cookie));
        const { id } = await created.json() as { id: number };

        const response = await app.handle(request(`/listings/${id}`, { ...listing, description: "          " }, cookie, "PUT"));

        expect(response.status).toBe(422);
        expect(database.query("SELECT description FROM listings WHERE id = ?").get(id)).toEqual({ description: "Busco una habitación tranquila." });
    });

    it("rejects blank messages and replies, and distinguishes duplicate requests from database failures", async () => {
        const ownerCookie = await register();
        const created = await app.handle(request("/listings", listing, ownerCookie));
        const { id } = await created.json() as { id: number };
        const applicantCookie = await register("applicant@example.com");
        const path = `/listings/${id}/interests`;

        const blank = await app.handle(request(path, { message: "  " }, applicantCookie));
        expect(blank.status).toBe(422);
        expect(count("interests")).toBe(0);

        const sent = await app.handle(request(path, { message: "Me interesa." }, applicantCookie));
        expect(sent.status).toBe(201);
        const duplicate = await app.handle(request(path, { message: "Me interesa." }, applicantCookie));
        expect(duplicate.status).toBe(409);
        expect(count("interests")).toBe(1);

        const interest = database.query<{ id: number }, []>("SELECT id FROM interests").get()!;
        const reply = await app.handle(request(`/interests/${interest.id}/reply`, { reply: "  " }, ownerCookie, "PUT"));
        expect(reply.status).toBe(422);
        expect(database.query("SELECT reply FROM interests").get()).toEqual({ reply: null });

        database.exec("CREATE TRIGGER fail_interest BEFORE INSERT ON interests BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;");
        const log = spyOn(console, "error").mockImplementation(() => {});
        try {
            const failed = await app.handle(request(path, { message: "Me interesa." }, applicantCookie));
            expect(failed.status).toBe(500);
            expect(await failed.json()).toEqual({ message: "Ocurrió un error inesperado." });
            expect(count("interests")).toBe(1);
        } finally {
            log.mockRestore();
        }
    });
});
