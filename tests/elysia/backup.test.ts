import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase } from "../../src/server/backup";
import { createDatabase, type RoomiesDatabase } from "../../src/server/database";
import { createApp } from "../../src/server/app";

describe("SQLite backup recovery", () => {
    let directory: string | undefined;
    const databases: Array<RoomiesDatabase> = [];
    afterEach(async () => {
        for (const database of databases.splice(0)) database.close();
        if (directory) await rm(directory, { recursive: true, force: true });
        directory = undefined;
    });

    it("recovers accounts, sessions and listings from a backup while the original database is open", async () => {
        directory = await mkdtemp(join(tmpdir(), "roomies-backup-"));
        const source = join(directory, "roomies.sqlite");
        const destination = join(directory, "backups", "snapshot.sqlite");
        const original = createDatabase(source);
        databases.push(original);
        original.exec("PRAGMA wal_autocheckpoint = 0");
        const app = createApp(original);
        const registered = await app.handle(new Request("http://localhost/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Ana", email: "ana@example.com", password: "password123" }),
        }));
        expect(registered.status).toBe(201);
        const cookie = registered.headers.get("set-cookie")!.split(";")[0];
        const created = await app.handle(new Request("http://localhost/api/listings", {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ type: "search", title: "Busco habitación", description: "Busco una habitación tranquila.", city: "Ciudad Quesada", zone: "Centro", budget: 150000 }),
        }));
        expect(created.status).toBe(201);

        expect(backupDatabase(source, destination)).toBe(destination);
        const recovered = createDatabase(destination);
        databases.push(recovered);
        const restoredApp = createApp(recovered);
        const me = await restoredApp.handle(new Request("http://localhost/api/me", { headers: { cookie } }));
        const listings = await restoredApp.handle(new Request("http://localhost/api/listings"));

        expect(me.status).toBe(200);
        expect(await me.json()).toMatchObject({ user: { name: "Ana", email: "ana@example.com" } });
        expect(await listings.json()).toMatchObject({ listings: [{ title: "Busco habitación", budget: 150000 }] });
        expect(recovered.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
        expect(original.query("SELECT COUNT(*) AS count FROM listings").get()).toEqual({ count: 1 });
    });

    it("refuses to overwrite an existing backup even if the file is empty", async () => {
        directory = await mkdtemp(join(tmpdir(), "roomies-backup-"));
        const destination = join(directory, "existing.sqlite");
        const source = join(directory, "source.sqlite");
        await Bun.write(destination, "");

        expect(() => backupDatabase(source, destination)).toThrow("already exists");
        expect(await Bun.file(destination).text()).toBe("");
    });

    it("does not create a missing source database or a misleading empty backup", async () => {
        directory = await mkdtemp(join(tmpdir(), "roomies-backup-"));
        const source = join(directory, "missing.sqlite");
        const destination = join(directory, "backup.sqlite");

        expect(() => backupDatabase(source, destination)).toThrow();
        await expect(access(source)).rejects.toThrow();
        await expect(access(destination)).rejects.toThrow();
    });

    it("refuses to use the source file as the destination", async () => {
        directory = await mkdtemp(join(tmpdir(), "roomies-backup-"));
        const source = join(directory, "source.sqlite");
        const database = new Database(source, { create: true });
        databases.push(database);

        expect(() => backupDatabase(source, source)).toThrow("separate backup");
    });

    it("rejects an in-memory source instead of creating a new file", () => {
        expect(() => backupDatabase(":memory:", "backup.sqlite")).toThrow("persistent database");
    });
});
