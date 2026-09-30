import { createApp } from "./app";
import { createFrontend } from "./frontend";

const app = createApp()
    .use(createFrontend())
    .listen(Number(process.env.PORT ?? 3000));

console.log(
    `Roomies está disponible en http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
