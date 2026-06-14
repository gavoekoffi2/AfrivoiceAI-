CREATE TABLE IF NOT EXISTS "lead_databases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sector" text NOT NULL,
	"country" text DEFAULT 'TG' NOT NULL,
	"city" text,
	"description" text NOT NULL,
	"price_fcfa" numeric(12, 2) DEFAULT '0' NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"quality_score" integer DEFAULT 0 NOT NULL,
	"data_source" text DEFAULT 'Sources publiques B2B' NOT NULL,
	"allowed_usage" text DEFAULT 'Prospection B2B responsable à partir de données publiques professionnelles.' NOT NULL,
	"sample_records" jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lead_databases_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_database_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"database_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text,
	"sector" text,
	"country" text DEFAULT 'TG' NOT NULL,
	"city" text,
	"phone" text,
	"email" text,
	"website" text,
	"address" text,
	"source_url" text,
	"source_name" text,
	"opportunity_score" integer DEFAULT 0 NOT NULL,
	"priority_band" text DEFAULT 'C' NOT NULL,
	"recommended_offer" text,
	"outreach_angle" text,
	"ai_email" text,
	"ai_call_script" text,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_database_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"database_id" uuid NOT NULL,
	"amount_fcfa" numeric(12, 2) DEFAULT '0' NOT NULL,
	"access_level" text DEFAULT 'full' NOT NULL,
	"export_allowed" boolean DEFAULT true NOT NULL,
	"campaign_allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_database_records" ADD CONSTRAINT "lead_database_records_database_id_lead_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."lead_databases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_database_purchases" ADD CONSTRAINT "lead_database_purchases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_database_purchases" ADD CONSTRAINT "lead_database_purchases_database_id_lead_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."lead_databases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_databases_sector_idx" ON "lead_databases" USING btree ("sector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_databases_published_idx" ON "lead_databases" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_database_records_database_idx" ON "lead_database_records" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_database_records_city_idx" ON "lead_database_records" USING btree ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_database_records_score_idx" ON "lead_database_records" USING btree ("opportunity_score");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lead_database_records_database_company_phone_unique" ON "lead_database_records" USING btree ("database_id", "company_name", "phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_database_purchases_org_idx" ON "lead_database_purchases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_database_purchases_database_idx" ON "lead_database_purchases" USING btree ("database_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lead_database_purchases_org_database_unique" ON "lead_database_purchases" USING btree ("organization_id", "database_id");
