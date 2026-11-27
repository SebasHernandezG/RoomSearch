type Environment = Record<string, string | undefined>;

export const getCookieSecret = (env: Environment = process.env): string => {
    const secret = env.COOKIE_SECRET?.trim();
    if (env.NODE_ENV === "production" && (!secret || secret.length < 32 || secret === "local-roomies-secret-change-me")) {
        throw new Error("COOKIE_SECRET must contain at least 32 characters in production.");
    }
    return secret || "local-roomies-secret-change-me";
};

export const getGoogleCallback = (env: Environment = process.env): string => {
    let callback = env.ELYSIA_GOOGLE_REDIRECT_URI?.trim();
    if (!callback && env.NODE_ENV === "production") {
        const publicUrl = env.APP_URL?.trim() || env.RENDER_EXTERNAL_URL?.trim();
        if (!publicUrl) {
            throw new Error("APP_URL or RENDER_EXTERNAL_URL is required in production.");
        }
        callback = new URL("/api/auth/google/callback", publicUrl).toString();
    }
    callback ||= "http://localhost:3000/api/auth/google/callback";
    const url = new URL(callback);
    if (env.NODE_ENV === "production" && (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
        throw new Error("Google callback must use a public HTTPS URL in production.");
    }
    return callback;
};

export const getServerConfig = (env: Environment = process.env) => {
    getCookieSecret(env);
    getGoogleCallback(env);
    const port = Number(env.PORT ?? 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535.");
    }
    const databasePath = env.DB_DATABASE?.trim() || "database/database.sqlite";
    if (env.NODE_ENV === "production" && (!env.DB_DATABASE?.trim() || databasePath === ":memory:")) {
        throw new Error("DB_DATABASE must specify a persistent SQLite file in production.");
    }
    return { port, databasePath };
};
