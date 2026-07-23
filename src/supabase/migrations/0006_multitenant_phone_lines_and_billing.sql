CREATE TABLE IF NOT EXISTS "organization_billing_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "plan_code" text DEFAULT 'essential' NOT NULL,
  "status" text DEFAULT 'trial' NOT NULL,
  "included_minutes_monthly" integer DEFAULT 60 NOT NULL,
  "used_minutes_this_cycle" numeric(12,2) DEFAULT 0 NOT NULL,
  "bonus_minutes_balance" numeric(12,2) DEFAULT 0 NOT NULL,
  "billing_cycle_started_at" timestamp DEFAULT now() NOT NULL,
  "billing_cycle_ends_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "organization_billing_profiles_plan_check"
    CHECK ("plan_code" IN ('essential', 'growth', 'business', 'enterprise')),
  CONSTRAINT "organization_billing_profiles_status_check"
    CHECK ("status" IN ('trial', 'active', 'past_due', 'suspended', 'cancelled'))
);

ALTER TABLE "organization_billing_profiles"
  ADD COLUMN IF NOT EXISTS "included_minutes_monthly" integer DEFAULT 60 NOT NULL;
ALTER TABLE "organization_billing_profiles"
  ADD COLUMN IF NOT EXISTS "used_minutes_this_cycle" numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE "organization_billing_profiles"
  ADD COLUMN IF NOT EXISTS "bonus_minutes_balance" numeric(12,2) DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "phone_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "phone_number" text,
  "connection_type" text NOT NULL,
  "provider" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "verification_status" text DEFAULT 'pending' NOT NULL,
  "verification_method" text,
  "vapi_phone_number_id" text,
  "vapi_credential_id" text,
  "external_reference" text,
  "public_config" jsonb,
  "is_default" boolean DEFAULT false NOT NULL,
  "last_health_check_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "phone_lines_connection_type_check"
    CHECK ("connection_type" IN ('platform', 'sim_gateway', 'sip_trunk', 'twilio', 'telnyx')),
  CONSTRAINT "phone_lines_status_check"
    CHECK ("status" IN ('pending', 'provisioning', 'active', 'degraded', 'disabled')),
  CONSTRAINT "phone_lines_verification_check"
    CHECK ("verification_status" IN ('pending', 'verified', 'rejected')),
  CONSTRAINT "phone_lines_org_phone_unique" UNIQUE NULLS NOT DISTINCT ("organization_id", "phone_number")
);

CREATE INDEX IF NOT EXISTS "phone_lines_org_idx" ON "phone_lines" ("organization_id");
CREATE INDEX IF NOT EXISTS "phone_lines_status_idx" ON "phone_lines" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "phone_lines_one_default_per_org"
  ON "phone_lines" ("organization_id") WHERE "is_default" = true;

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "phone_line_id" uuid REFERENCES "phone_lines"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "campaigns_phone_line_idx" ON "campaigns" ("phone_line_id");

ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "phone_line_id" uuid REFERENCES "phone_lines"("id") ON DELETE SET NULL;
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "billed_minute_rate_fcfa" numeric(10,2);
CREATE INDEX IF NOT EXISTS "calls_phone_line_idx" ON "calls" ("phone_line_id");

INSERT INTO "organization_billing_profiles" ("organization_id", "plan_code", "status")
SELECT "id", 'essential', 'trial'
FROM "organizations"
ON CONFLICT ("organization_id") DO NOTHING;

INSERT INTO "phone_lines" (
  "organization_id",
  "name",
  "connection_type",
  "provider",
  "status",
  "verification_status",
  "verification_method",
  "public_config",
  "is_default"
)
SELECT
  o."id",
  'Ligne AfrivoxAI',
  'platform',
  'vapi',
  'active',
  'verified',
  'platform_managed',
  '{"source":"environment","managedBy":"afrivoxai"}'::jsonb,
  true
FROM "organizations" o
WHERE NOT EXISTS (
  SELECT 1 FROM "phone_lines" p WHERE p."organization_id" = o."id"
);

UPDATE "campaigns" c
SET "phone_line_id" = p."id"
FROM "phone_lines" p
WHERE c."organization_id" = p."organization_id"
  AND p."is_default" = true
  AND c."phone_line_id" IS NULL;
