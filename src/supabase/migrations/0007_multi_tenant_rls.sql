-- Phase 0 — Isolation multi-tenant par Row-Level Security (RLS).
--
-- ⚠️  À APPLIQUER SEULEMENT lorsque la couche d'accès aux données route TOUTES
--     les lectures/écritures tenant via `withTenant()` / `withServiceContext()`
--     (src/lib/db/tenant.ts). Activer cette migration AVANT ce routage ferait
--     renvoyer des résultats vides aux requêtes non encapsulées.
--
--     Déploiement recommandé : en même temps que le refactor en couches
--     (services domaine) de la Partie D. Ce fichier est fourni prêt à l'emploi
--     et testé au niveau du helper, mais laissé à l'activation de l'opérateur.
--
-- Pré-requis : le rôle applicatif de connexion (DATABASE_URL) ne doit PAS
-- posséder l'attribut BYPASSRLS. `FORCE ROW LEVEL SECURITY` est utilisé pour
-- que la policy s'applique même au propriétaire de la table.

-- 1) Fonctions de contexte (lues par les policies).
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true) = 'on', false)
$$;

-- 2) Tables tenant à colonne organization_id directe.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'orders', 'campaigns', 'leads', 'calls',
    'wallets', 'voice_clone_profiles', 'lead_database_purchases'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (app_rls_bypass() OR organization_id = app_current_org()) WITH CHECK (app_rls_bypass() OR organization_id = app_current_org())',
      t
    );
  END LOOP;
END $$;

-- 3) Table transactions : pas de organization_id direct → on scope via wallet.
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "transactions";
CREATE POLICY tenant_isolation ON "transactions"
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "transactions".wallet_id
        AND w.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "transactions".wallet_id
        AND w.organization_id = app_current_org()
    )
  );

-- Note : `users` et `organizations` ne sont PAS forcées en RLS ici car elles
-- servent à amorcer la session (résolution de l'organisation à partir de
-- l'identifiant Supabase, avant qu'un contexte tenant n'existe). Leur accès
-- reste protégé au niveau applicatif. Le catalogue marketplace
-- (`lead_databases`, `lead_database_records`) est volontairement global.
