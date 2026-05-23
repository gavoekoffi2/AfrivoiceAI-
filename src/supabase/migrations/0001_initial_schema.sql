-- ============================================================================
-- AfrivoiceAI – Initial schema (idempotent)
-- Cette migration crée toutes les tables, indexes et contraintes nécessaires.
-- Compatible avec une base Postgres standalone OU Supabase (où auth.users existe).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. organizations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT NOT NULL,
  slug                        TEXT NOT NULL UNIQUE,
  shop_name                   TEXT,
  shopify_domain              TEXT,
  woocommerce_domain          TEXT,
  webhook_token               TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  low_balance_threshold_fcfa  NUMERIC(12,2) NOT NULL DEFAULT 5000,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_shopify_domain_idx
  ON organizations (shopify_domain) WHERE shopify_domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_woocommerce_domain_idx
  ON organizations (woocommerce_domain) WHERE woocommerce_domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_webhook_token_idx
  ON organizations (webhook_token);

-- ---------------------------------------------------------------------------
-- 2. users (lié à auth.users de Supabase quand disponible)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  role            TEXT NOT NULL DEFAULT 'member',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_org_idx ON users (organization_id);

-- ---------------------------------------------------------------------------
-- 3. organization_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_invitations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email                TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'member',
  token                TEXT NOT NULL UNIQUE,
  invited_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at          TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS org_invitations_org_idx ON organization_invitations (organization_id);

-- ---------------------------------------------------------------------------
-- 4. wallets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  balance_fcfa    NUMERIC(14,2) NOT NULL DEFAULT 0,
  version         INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_non_negative_balance CHECK (balance_fcfa >= 0)
);

-- ---------------------------------------------------------------------------
-- 5. transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id             UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL,
  amount_fcfa           NUMERIC(14,2) NOT NULL,
  balance_after_fcfa    NUMERIC(14,2),
  description           TEXT,
  metadata              JSONB,
  external_reference    TEXT,
  idempotency_key       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_wallet_idx ON transactions (wallet_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_idempotency_idx
  ON transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id      TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'shopify',
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  customer_address TEXT,
  total_amount     NUMERIC(12,2),
  currency         TEXT NOT NULL DEFAULT 'XOF',
  status           TEXT NOT NULL DEFAULT 'pending',
  call_attempts    INTEGER NOT NULL DEFAULT 0,
  last_call_at     TIMESTAMPTZ,
  raw_payload      JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_org_idx ON orders (organization_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE UNIQUE INDEX IF NOT EXISTS orders_org_external_idx
  ON orders (organization_id, source, external_id);

-- ---------------------------------------------------------------------------
-- 7. campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  objective        TEXT NOT NULL,
  script_template  TEXT NOT NULL,
  voice_id         TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  total_leads      INTEGER NOT NULL DEFAULT 0,
  called_leads     INTEGER NOT NULL DEFAULT 0,
  qualified_leads  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_org_idx ON campaigns (organization_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

-- ---------------------------------------------------------------------------
-- 8. leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT,
  phone            TEXT NOT NULL,
  company          TEXT,
  email            TEXT,
  status           TEXT NOT NULL DEFAULT 'new',
  call_attempts    INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_campaign_idx ON leads (campaign_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone);

-- ---------------------------------------------------------------------------
-- 9. calls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calls (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vapi_call_id       TEXT NOT NULL UNIQUE,
  order_id           UUID REFERENCES orders(id) ON DELETE SET NULL,
  lead_id            UUID REFERENCES leads(id) ON DELETE SET NULL,
  type               TEXT NOT NULL,
  status             TEXT NOT NULL,
  duration_seconds   INTEGER,
  cost_usd           NUMERIC(10,4),
  cost_fcfa          NUMERIC(10,2),
  recording_url      TEXT,
  transcript         TEXT,
  summary            TEXT,
  structured_result  JSONB,
  outcome            TEXT,
  ended_reason       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calls_org_idx ON calls (organization_id);
CREATE INDEX IF NOT EXISTS calls_status_idx ON calls (status);
CREATE INDEX IF NOT EXISTS calls_created_at_idx ON calls (created_at);
CREATE INDEX IF NOT EXISTS calls_vapi_call_idx ON calls (vapi_call_id);
CREATE INDEX IF NOT EXISTS calls_outcome_idx ON calls (outcome);

-- ---------------------------------------------------------------------------
-- 10. webhook_events (idempotency log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source             TEXT NOT NULL,
  external_event_id  TEXT NOT NULL,
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  payload            JSONB,
  processed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_unique_idx
  ON webhook_events (source, external_event_id);

-- ---------------------------------------------------------------------------
-- 11. audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  action           TEXT NOT NULL,
  entity_type      TEXT,
  entity_id        TEXT,
  metadata         JSONB,
  ip_address       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_idx ON audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);

-- ---------------------------------------------------------------------------
-- 12. Trigger updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['organizations','orders','campaigns','calls'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I_set_updated_at ON %I;
       CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;
