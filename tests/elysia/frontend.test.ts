import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFrontend } from "../../src/server/frontend";
import { createApp } from "../../src/server/app";
import { createDatabase, type RoomiesDatabase } from "../../src/server/database";

describe("Elysia frontend delivery", () => {
    let directory: string;
    let database: RoomiesDatabase;

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), "roomies-frontend-"));
        database = createDatabase(":memory:");
        await mkdir(join(directory, "assets"));
        await Bun.write(join(directory, "index.html"), '<div id="root"></div><script type="module" src="/assets/app.js"></script>');
        await Bun.write(join(directory, "assets/app.js"), 'document.querySelector("#root").textContent = "Roomies";');
        await Bun.write(join(directory, "assets/app.css"), "body { margin: 0; }");
    });
    afterEach(async () => {
        database.close();
        await rm(directory, { recursive: true, force: true });
    });

    const get = (path: string) => createApp(database).use(createFrontend(directory))
        .handle(new Request(`http://localhost${path}`));

    it("serves the HTML without caching old asset references", async () => {
        const response = await get("/");
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it.each([["app.js", "javascript"], ["app.css", "text/css"]])("serves %s with its correct MIME type", async (name, mime) => {
        const response = await get(`/assets/${name}`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(mime);
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(await response.text()).not.toContain('<div id="root">');
    });

    it("finds assets generated after server initialization", async () => {
        const app = createApp(database).use(createFrontend(directory));
        await app.handle(new Request("http://localhost/"));
        await Bun.write(join(directory, "assets/new-build.js"), "export const ready = true;");
        const response = await app.handle(new Request("http://localhost/assets/new-build.js"));
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("export const ready = true;");
    });

    it.each(["/assets/missing.js", "/api/missing", "/unknown", "/assets/..%5cindex.html"])("does not replace missing or unsafe paths with HTML: %s", async (path) => {
        const response = await get(path);
        expect(response.status).toBe(404);
        expect(response.headers.get("content-type") ?? "").not.toContain("text/html");
    });

    it("returns a useful error before the first build", async () => {
        const response = await createFrontend(join(directory, "unbuilt"))
            .handle(new Request("http://localhost/"));
        expect(response.status).toBe(503);
        expect(await response.text()).toContain("bun run build");
    });
});
