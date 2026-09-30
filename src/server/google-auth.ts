import { randomBytes, createHash } from "node:crypto";
import { hashToken, now, type RoomiesDatabase } from "./database";

export type GoogleAuthOptions = {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    fetch?: (url: string, options: RequestInit) => Promise<Response>;
    timeoutMs?: number;
};

const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const createGoogleAuth = (database: RoomiesDatabase, options: GoogleAuthOptions = {}) => {
    const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID ?? "";
    const clientSecret = options.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET ?? "";
    const redirectUri = options.redirectUri ?? process.env.ELYSIA_GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback";
    const requestGoogle = options.fetch ?? fetch;
    const callback = new URL(redirectUri);
    if (callback.pathname !== "/api/auth/google/callback" || callback.search || callback.hash || callback.username || callback.password ||
        (callback.protocol !== "https:" && !(callback.protocol === "http:" && ["localhost", "127.0.0.1"].includes(callback.hostname)))) {
        throw new Error("ELYSIA_GOOGLE_REDIRECT_URI must be an HTTPS callback URL (HTTP localhost is allowed).");
    }
    const home = (error?: string) => {
        const url = new URL("/", callback);
        if (error) url.searchParams.set("google_error", error);
        return url.toString();
    };

    return {
        home,
        begin() {
            if (!clientId.trim() || !clientSecret.trim()) return { error: "not_configured" };
            database.query("DELETE FROM google_oauth_states WHERE expires_at <= ?").run(now());
            const count = database.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM google_oauth_states").get()!;
            if (count.count >= 1000) return { error: "unavailable" };
            const state = randomBytes(32).toString("base64url");
            const verifier = randomBytes(32).toString("base64url");
            database.query("INSERT INTO google_oauth_states (state_hash, verifier, expires_at) VALUES (?, ?, ?)")
                .run(hashToken(state), verifier, new Date(Date.now() + 600_000).toISOString());
            const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
            url.search = new URLSearchParams({
                client_id: clientId, redirect_uri: redirectUri, response_type: "code",
                scope: "openid email profile", state, prompt: "select_account",
                code_challenge: createHash("sha256").update(verifier).digest("base64url"),
                code_challenge_method: "S256",
            }).toString();
            return { state, url: url.toString() };
        },
        async finish(query: URLSearchParams, browserState?: string): Promise<{ token: string } | { error: string }> {
            const state = query.get("state");
            if (!state || !browserState || state !== browserState || state.length > 128) return { error: "invalid_state" };
            const pending = database.query<{ verifier: string }, [string, string]>(
                "DELETE FROM google_oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING verifier",
            ).get(hashToken(state), now());
            if (!pending) return { error: "invalid_state" };
            if (query.has("error")) return { error: "cancelled" };
            const code = query.get("code");
            if (!code || code.length > 4096) return { error: "failed" };
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
            try {
                const tokenResponse = await requestGoogle("https://oauth2.googleapis.com/token", {
                    method: "POST", redirect: "error", signal: controller.signal,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        client_id: clientId, client_secret: clientSecret, code,
                        redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: pending.verifier,
                    }).toString(),
                });
                if (!tokenResponse.ok) return { error: "failed" };
                const tokens: unknown = await tokenResponse.json();
                if (!record(tokens) || typeof tokens.access_token !== "string" || !tokens.access_token || tokens.token_type !== "Bearer") return { error: "failed" };
                const profileResponse = await requestGoogle("https://openidconnect.googleapis.com/v1/userinfo", {
                    headers: { Authorization: `Bearer ${tokens.access_token}` },
                    redirect: "error", signal: controller.signal,
                });
                if (!profileResponse.ok) return { error: "failed" };
                const profile: unknown = await profileResponse.json();
                if (!record(profile) || typeof profile.sub !== "string" || !profile.sub || profile.sub.length > 255 ||
                    typeof profile.email !== "string" || profile.email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) || profile.email_verified !== true) {
                    return { error: "unverified" };
                }
                const subject = profile.sub;
                const email = profile.email.trim().toLowerCase();
                const name = typeof profile.name === "string" && profile.name.trim() ? profile.name.trim().slice(0, 120) : email.split("@")[0];
                const password = await Bun.password.hash(randomBytes(32).toString("base64url"), { algorithm: "bcrypt", cost: 12 });
                return database.transaction(() => {
                    let userId = database.query<{ user_id: number }, [string]>("SELECT user_id FROM google_accounts WHERE subject = ?").get(subject)?.user_id;
                    if (!userId) {
                        // Never link an existing password account solely by matching email.
                        if (database.query("SELECT id FROM users WHERE lower(email) = ?").get(email)) return { error: "existing_account" };
                        const timestamp = now();
                        const created = database.query("INSERT INTO users (name, email, password, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
                            .run(name, email, password, timestamp, timestamp, timestamp);
                        userId = Number(created.lastInsertRowid);
                        database.query("INSERT INTO profiles (user_id, created_at, updated_at) VALUES (?, ?, ?)").run(userId, timestamp, timestamp);
                        database.query("INSERT INTO google_accounts (subject, user_id) VALUES (?, ?)").run(subject, userId);
                    }
                    const token = randomBytes(48).toString("base64url");
                    database.query("INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
                        .run(userId, hashToken(token), new Date(Date.now() + 30 * 86400000).toISOString(), now());
                    return { token };
                })();
            } catch {
                return { error: "unavailable" };
            } finally {
                clearTimeout(timeout);
            }
        },
    };
};
