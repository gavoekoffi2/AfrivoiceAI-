import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Contexte tenant pour l'isolation multi-organisation.
 *
 * Ces helpers ouvrent une transaction et posent la variable de session
 * PostgreSQL `app.current_org` (via `set_config(..., is_local = true)`), qui
 * est lue par les policies Row-Level Security (voir la migration
 * `0006_phase0_tenant_security.sql`). RLS devient ainsi le filet de sécurité :
 * même si un filtre applicatif `organization_id` est oublié, la base ne
 * renvoie que les lignes de l'organisation courante.
 *
 * `is_local = true` garantit que la variable est réinitialisée à la fin de la
 * transaction, ce qui évite toute fuite entre requêtes réutilisant une
 * connexion du pool.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string): string {
  if (!UUID_RE.test(value)) {
    throw new Error(`organizationId invalide: ${value}`);
  }
  return value;
}

/**
 * Exécute `fn` dans le contexte d'une organisation donnée. Toutes les requêtes
 * effectuées via le `tx` fourni sont soumises aux policies RLS de cette org.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const orgId = assertUuid(organizationId);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_org', ${orgId}, true)`
    );
    return fn(tx);
  });
}

/**
 * Exécute `fn` avec un contexte de service qui contourne RLS. À réserver
 * STRICTEMENT aux opérations légitimement inter-tenant : webhooks entrants
 * (avant résolution de l'org), tâches d'administration plateforme, jobs
 * système. Ne jamais exposer ce contexte à une requête utilisateur.
 */
export async function withServiceContext<T>(
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    return fn(tx);
  });
}
