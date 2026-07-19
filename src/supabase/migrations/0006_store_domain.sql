-- Routage multi-tenant des webhooks e-commerce :
-- chaque organisation déclare le domaine de sa boutique, et les webhooks
-- Shopify/WooCommerce retrouvent l'organisation via ce domaine.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "store_domain" text;

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_store_domain_unique"
  ON "organizations" ("store_domain")
  WHERE "store_domain" IS NOT NULL;
