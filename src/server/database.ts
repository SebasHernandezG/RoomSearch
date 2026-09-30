import { Database } from "bun:sqlite";

export type UserRow = {
    id: number;
    name: string;
    email: string;
    password: string;
};
export type AuthenticatedUser = Pick<UserRow, "id" | "name" | "email">;

export const now = () => new Date().toISOString();

export const hashToken = (token: string) =>
    new Bun.CryptoHasher("sha256").update(token).digest("hex");

export const createDatabase = (
    filename = process.env.DB_DATABASE ?? "database/database.sqlite",
) => {
    const database = new Database(filename, { create: true });
    database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE, email_verified_at TEXT,
            password TEXT NOT NULL, remember_token TEXT, created_at TEXT, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            city TEXT, zone TEXT, budget_min INTEGER, budget_max INTEGER,
            bio TEXT, phone TEXT, created_at TEXT, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK(type IN ('offer', 'search')),
            title TEXT NOT NULL, description TEXT NOT NULL, city TEXT NOT NULL,
            zone TEXT, budget INTEGER NOT NULL, contact_method TEXT NOT NULL DEFAULT 'interest',
            is_active INTEGER NOT NULL DEFAULT 1, photos TEXT, created_at TEXT, updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS listings_search_index ON listings(city, type, is_active);
        CREATE TABLE IF NOT EXISTS interests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL, reply TEXT, replied_at TEXT, created_at TEXT, updated_at TEXT,
            UNIQUE(listing_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS auth_sessions_expiry_index ON auth_sessions(expires_at);
        CREATE TABLE IF NOT EXISTS google_accounts (
            subject TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS google_oauth_states (
            state_hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires_at TEXT NOT NULL
        );
    `);

    const listingColumns = database
        .query<{ name: string }, []>("PRAGMA table_info(listings)")
        .all();
    const columnNames = new Set(listingColumns.map((column) => column.name));
    if (!columnNames.has("latitude"))
        database.exec("ALTER TABLE listings ADD COLUMN latitude REAL");
    if (!columnNames.has("longitude"))
        database.exec("ALTER TABLE listings ADD COLUMN longitude REAL");

    return database;
};

export type RoomiesDatabase = ReturnType<typeof createDatabase>;

export const findUserBySession = (
    database: RoomiesDatabase,
    token?: string,
): AuthenticatedUser | null => {
    if (!token) return null;
    return (
        database
            .query<AuthenticatedUser, [string, string]>(
                `
        SELECT users.id, users.name, users.email FROM auth_sessions
        JOIN users ON users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
    `,
            )
            .get(hashToken(token), now()) ?? null
    );
};
