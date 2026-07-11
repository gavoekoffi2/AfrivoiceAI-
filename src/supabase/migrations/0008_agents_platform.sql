-- Parties D/E/F — plateforme d'agents : studio no-code, widget, API publique.

-- Organisations : clé publique widget, allowlist de domaines, plan.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "public_key" text,
  ADD COLUMN IF NOT EXISTS "allowed_domains" jsonb,
  ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'free' NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_public_key_unique"
  ON "organizations" ("public_key");

-- Studio d'agents (multi-tenant : organization_id partout).
CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "speak_language" text DEFAULT 'fr' NOT NULL,
  "think_language" text DEFAULT 'fr' NOT NULL,
  "model" text DEFAULT 'default' NOT NULL,
  "voice_id" text,
  "system_prompt" text NOT NULL,
  "call_scenario" text,
  "greeting" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "widget_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agents_org_idx" ON "agents" ("organization_id");
CREATE INDEX IF NOT EXISTS "agents_status_idx" ON "agents" ("status");

CREATE TABLE IF NOT EXISTS "agent_knowledge" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "source_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_knowledge_agent_idx" ON "agent_knowledge" ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_knowledge_org_idx" ON "agent_knowledge" ("organization_id");

CREATE TABLE IF NOT EXISTS "call_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "provider" text NOT NULL,
  "provider_call_id" text,
  "direction" text DEFAULT 'outbound' NOT NULL,
  "channel" text DEFAULT 'phone' NOT NULL,
  "phone_number" text,
  "status" text DEFAULT 'queued' NOT NULL,
  "duration_seconds" integer,
  "cost_fcfa" numeric(10,2),
  "transcript" text,
  "summary" text,
  "messages" jsonb,
  "started_at" timestamp,
  "ended_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "call_logs_org_idx" ON "call_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "call_logs_agent_idx" ON "call_logs" ("agent_id");
CREATE INDEX IF NOT EXISTS "call_logs_provider_call_idx" ON "call_logs" ("provider_call_id");
CREATE INDEX IF NOT EXISTS "call_logs_created_at_idx" ON "call_logs" ("created_at");

-- Clés API (API publique) : hash SHA-256 uniquement, jamais la clé en clair.
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "prefix" text NOT NULL,
  "hashed_key" text NOT NULL UNIQUE,
  "scopes" jsonb,
  "last_used_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "api_keys_org_idx" ON "api_keys" ("organization_id");
CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys" ("prefix");

-- RLS : ces nouvelles tables tenant sont couvertes par le même modèle que la
-- migration 0007 (à activer avec elle).
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_current_org') THEN
    FOREACH t IN ARRAY ARRAY['agents','agent_knowledge','call_logs','api_keys'] LOOP
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (app_rls_bypass() OR organization_id = app_current_org()) WITH CHECK (app_rls_bypass() OR organization_id = app_current_org())',
        t
      );
    END LOOP;
  END IF;
END $$;
