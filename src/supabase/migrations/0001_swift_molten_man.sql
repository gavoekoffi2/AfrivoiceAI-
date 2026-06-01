ALTER TABLE "organizations" ADD COLUMN "shop_domain" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_shop_domain_unique" UNIQUE("shop_domain");