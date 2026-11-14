import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import "dotenv/config";

const remote = Boolean(process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL));

function connectionString() {
    const raw = process.env.DATABASE_URL;
    if (!raw || !remote) return raw;
    return raw.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, "").replace("?&", "?");
}

export const pool = new Pool({
    connectionString: connectionString(),
    ssl: remote ? { rejectUnauthorized: false } : undefined,
});

// An idle client dropped by the server (restart, pooler recycle) must not crash the process.
pool.on("error", (err) => {
    console.warn("[db] idle client error:", err.message);
});

export const db = drizzle(pool, { schema });
export * from "./schema";

export { eq, or, and, isNull, isNotNull, inArray, ne, count, sql, lt, gt, desc, asc, avg } from "drizzle-orm";
