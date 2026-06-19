ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "call_messages" jsonb;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "call_artifact" jsonb;
