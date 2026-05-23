-- ============================================================================
-- AfrivoiceAI – seed minimal (Postgres standalone uniquement)
-- En mode Supabase, l'onboarding est géré par les triggers de 0002.
-- En mode docker-compose local, ce fichier crée une organisation de démo.
-- ============================================================================

\i /docker-entrypoint-initdb.d/0001_initial_schema.sql

-- Organisation de démonstration (uniquement si la table est vide)
INSERT INTO organizations (id, name, slug, shop_name)
SELECT gen_random_uuid(), 'AfrivoiceAI Demo', 'demo', 'Demo Shop'
WHERE NOT EXISTS (SELECT 1 FROM organizations);

INSERT INTO wallets (organization_id, balance_fcfa)
SELECT id, 10000 FROM organizations WHERE slug = 'demo'
ON CONFLICT (organization_id) DO NOTHING;
