-- Phase 0 — Sécurité & multi-tenant : colonnes de support.
-- Migration SÛRE, applicable immédiatement (aucun impact sur les requêtes
-- existantes).

-- Routage des webhooks e-commerce vers la BONNE organisation.
-- (Corrige la faille où toutes les commandes Shopify/WooCommerce étaient
--  assignées à la première organisation de la base.)
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "shop_domain" text;

-- Rétention configurable des données personnelles d'appel (conformité
-- loi togolaise n°2019-014). NULL = valeur par défaut plateforme.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "data_retention_days" integer;

-- Un domaine de boutique ne peut appartenir qu'à une seule organisation.
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_shop_domain_unique"
  ON "organizations" ("shop_domain");
