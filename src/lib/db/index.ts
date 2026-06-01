import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// En environnement serverless (Netlify/AWS Lambda), chaque instance crée son
// propre pool : on limite à 1 connexion pour éviter d'épuiser la base, et on
// désactive les prepared statements (compatibilité PgBouncer/Supabase pooler
// en mode transaction, port 6543).
const isServerless =
  !!process.env.NETLIFY ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.DB_SERVERLESS === "true";

const client = postgres(connectionString, {
  max: isServerless ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: !isServerless,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
