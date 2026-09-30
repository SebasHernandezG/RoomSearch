import { Elysia } from "elysia";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";

const defaultDirectory = fileURLToPath(new URL("../../dist/", import.meta.url));

export const createFrontend = (directory = defaultDirectory) => {
    const assetDirectory = resolve(directory, "assets");

    return new Elysia({ name: "roomies-frontend" })
        .get("/assets/*", async ({ params }) => {
            const filename = resolve(assetDirectory, params["*"]);
            const withinAssets = relative(assetDirectory, filename);
            if (
                !withinAssets || withinAssets === ".." ||
                withinAssets.startsWith(`..${sep}`) || isAbsolute(withinAssets)
            ) {
                return new Response("Not found", { status: 404 });
            }
            const file = Bun.file(filename);
            if (!(await file.exists())) {
                return new Response("Not found", { status: 404 });
            }
            return new Response(file, {
                headers: {
                    "Content-Type": file.type,
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "X-Content-Type-Options": "nosniff",
                },
            });
        })
        .get("/", async () => {
            const file = Bun.file(resolve(directory, "index.html"));
            if (!(await file.exists())) {
                return new Response("La interfaz no está compilada. Ejecuta bun run build.", { status: 503 });
            }
            return new Response(file, {
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff",
                },
            });
        });
};
