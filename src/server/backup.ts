import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const backupDatabase = (source: string, destination: string): string => {
    const sourcePath = resolve(source);
    const destinationPath = resolve(destination);
    if (source === ":memory:" || sourcePath === destinationPath) {
        throw new Error("Choose a separate backup file for a persistent database.");
    }
    if (existsSync(destinationPath)) {
        throw new Error("The backup destination already exists. Choose a new filename.");
    }
    const database = new Database(sourcePath, { readonly: true });
    try {
        mkdirSync(dirname(destinationPath), { recursive: true });
        database.query("VACUUM INTO ?").run(destinationPath);
        chmodSync(destinationPath, 0o600);
        return destinationPath;
    } finally {
        database.close();
    }
};

if (import.meta.main) {
    const source = process.env.DB_DATABASE?.trim() || "database/database.sqlite";
    const destination = process.argv[2] || join(dirname(source), "backups", `roomies-${Date.now()}-${crypto.randomUUID()}.sqlite`);
    try {
        console.log(`Respaldo creado: ${backupDatabase(source, destination)}`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : "No fue posible crear el respaldo.");
        process.exitCode = 1;
    }
}
