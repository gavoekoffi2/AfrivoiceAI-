ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_plan" text DEFAULT 'free' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_expires_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_permissions" jsonb;

UPDATE "users"
SET
  "subscription_plan" = CASE
    WHEN "email" = 'c1domefa@gmail.com' THEN 'enterprise'
    ELSE COALESCE("subscription_plan", 'free')
  END,
  "subscription_expires_at" = CASE
    WHEN "email" = 'c1domefa@gmail.com' THEN NULL
    ELSE "subscription_expires_at"
  END,
  "is_active" = COALESCE("is_active", true),
  "role" = CASE
    WHEN "email" = 'c1domefa@gmail.com' THEN 'super_admin'
    ELSE "role"
  END;
