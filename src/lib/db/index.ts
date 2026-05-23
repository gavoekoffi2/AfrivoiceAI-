import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "[db] DATABASE_URL est requis. Configurez-le dans votre environnement."
  );
}

const poolMax = parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10);

// En serverless (Vercel/Lambda) une connexion par instance suffit largement.
// En long-running (Node/Docker), on tolère un pool plus grand.
const client = postgres(connectionString, {
  max: Number.isFinite(poolMax) ? poolMax : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // compatible PgBouncer transaction mode (Supabase)
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
