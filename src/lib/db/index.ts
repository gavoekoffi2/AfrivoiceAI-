import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL n'est pas configuré. Copiez .env.example vers .env.local et renseignez la connexion Postgres (Supabase)."
    );
  }

  // Pool de connexions. `prepare: false` est requis avec le pooler Supabase
  // en mode transaction (port 6543) et sans effet en connexion directe.
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return drizzle(client, { schema });
}

type DrizzleDb = ReturnType<typeof createDb>;

let dbInstance: DrizzleDb | null = null;

// Initialisation paresseuse : le build Next.js importe les modules sans
// variables d'environnement — on ne crée la connexion qu'au premier usage.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, _receiver) {
    if (!dbInstance) dbInstance = createDb();
    const value = Reflect.get(dbInstance, prop, dbInstance);
    return typeof value === "function" ? value.bind(dbInstance) : value;
  },
});

export type Database = DrizzleDb;
