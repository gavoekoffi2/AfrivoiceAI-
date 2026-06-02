import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// On ne lève pas d'erreur ici : `next build` importe ce module sans
// DATABASE_URL (les requêtes ne s'exécutent qu'au runtime). La connexion
// postgres-js est paresseuse et n'échouera qu'à la première requête réelle.
const connectionString = process.env.DATABASE_URL ?? "";

// On met en cache le client sur globalThis pour éviter d'ouvrir un nouveau pool
// à chaque rechargement à chaud (dev) ou réutilisation de module (serverless),
// ce qui finit par épuiser les connexions Postgres.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
