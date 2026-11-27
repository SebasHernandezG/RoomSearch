import { createApp } from "./app";
import { createFrontend } from "./frontend";
import { getServerConfig } from "./config";
import { createDatabase } from "./database";

const config = getServerConfig();
if (process.env.NODE_ENV === "production" && !(await Bun.file(new URL("../../dist/index.html", import.meta.url)).exists())) {
    throw new Error("Build the frontend before starting the production server.");
}
const database = createDatabase(config.databasePath);
const app = createApp(database)
    .use(createFrontend())
    .listen({ port: config.port, hostname: "0.0.0.0" });

let stopping = false;
const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await app.stop();
    database.close();
    process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(
    `Roomies está disponible en http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
