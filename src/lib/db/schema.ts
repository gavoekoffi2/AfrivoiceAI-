import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  jsonb,
  decimal,
  index,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// 1. Gestion des Utilisateurs et Organisations (Multi-tenant)
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  shopName: text("shop_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // Lié à auth.users de Supabase
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull().unique(),
    role: text("role").default("member").notNull(), // 'owner', 'admin', 'member'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("users_org_idx").on(table.organizationId),
  })
);

// 2. Wallet et Facturation (FCFA / USD)
export const wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  balanceFcfa: decimal("balance_fcfa", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .references(() => wallets.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(), // 'deposit', 'call_cost'
    amountFcfa: decimal("amount_fcfa", {
      precision: 12,
      scale: 2,
    }).notNull(),
    description: text("description"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    walletIdx: index("transactions_wallet_idx").on(table.walletId),
    createdAtIdx: index("transactions_created_at_idx").on(table.createdAt),
  })
);

// 3. Module E-commerce (Commandes COD)
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(), // ID Shopify/WooCommerce
    source: text("source").default("shopify").notNull(), // 'shopify', 'woocommerce'
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerAddress: text("customer_address"),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
    currency: text("currency").default("XOF").notNull(),
    status: text("status").default("pending").notNull(), // 'pending', 'calling', 'confirmed', 'cancelled', 'no_answer'
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("orders_org_idx").on(table.organizationId),
    statusIdx: index("orders_status_idx").on(table.status),
  })
);

// 4. Module Prospection (Campagnes et Leads)
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    objective: text("objective").notNull(),
    scriptTemplate: text("script_template").notNull(), // Prompt pour l'IA
    status: text("status").default("draft").notNull(), // 'draft', 'active', 'completed', 'paused'
    totalLeads: integer("total_leads").default(0).notNull(),
    calledLeads: integer("called_leads").default(0).notNull(),
    qualifiedLeads: integer("qualified_leads").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("campaigns_org_idx").on(table.organizationId),
    statusIdx: index("campaigns_status_idx").on(table.status),
  })
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name"),
    phone: text("phone").notNull(),
    company: text("company"),
    email: text("email"),
    status: text("status").default("new").notNull(), // 'new', 'called', 'qualified', 'callback', 'not_interested', 'no_answer'
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("leads_campaign_idx").on(table.campaignId),
    statusIdx: index("leads_status_idx").on(table.status),
  })
);

// 5. Marketplace de bases de prospects premium
export const leadDatabases = pgTable(
  "lead_databases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    sector: text("sector").notNull(),
    country: text("country").default("TG").notNull(),
    city: text("city"),
    description: text("description").notNull(),
    priceFcfa: decimal("price_fcfa", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    recordCount: integer("record_count").default(0).notNull(),
    qualityScore: integer("quality_score").default(0).notNull(),
    dataSource: text("data_source").default("Sources publiques B2B").notNull(),
    allowedUsage: text("allowed_usage")
      .default("Prospection B2B responsable à partir de données publiques professionnelles.")
      .notNull(),
    sampleRecords: jsonb("sample_records"),
    isPublished: boolean("is_published").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sectorIdx: index("lead_databases_sector_idx").on(table.sector),
    publishedIdx: index("lead_databases_published_idx").on(table.isPublished),
  })
);

export const leadDatabaseRecords = pgTable(
  "lead_database_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    databaseId: uuid("database_id")
      .references(() => leadDatabases.id, { onDelete: "cascade" })
      .notNull(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    sector: text("sector"),
    country: text("country").default("TG").notNull(),
    city: text("city"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    address: text("address"),
    sourceUrl: text("source_url"),
    sourceName: text("source_name"),
    opportunityScore: integer("opportunity_score").default(0).notNull(),
    priorityBand: text("priority_band").default("C").notNull(),
    recommendedOffer: text("recommended_offer"),
    outreachAngle: text("outreach_angle"),
    aiEmail: text("ai_email"),
    aiCallScript: text("ai_call_script"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    databaseIdx: index("lead_database_records_database_idx").on(table.databaseId),
    cityIdx: index("lead_database_records_city_idx").on(table.city),
    scoreIdx: index("lead_database_records_score_idx").on(table.opportunityScore),
    recordUnique: uniqueIndex("lead_database_records_database_company_phone_unique").on(
      table.databaseId,
      table.companyName,
      table.phone
    ),
  })
);

export const leadDatabasePurchases = pgTable(
  "lead_database_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    databaseId: uuid("database_id")
      .references(() => leadDatabases.id, { onDelete: "cascade" })
      .notNull(),
    amountFcfa: decimal("amount_fcfa", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    accessLevel: text("access_level").default("full").notNull(),
    exportAllowed: boolean("export_allowed").default(true).notNull(),
    campaignAllowed: boolean("campaign_allowed").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("lead_database_purchases_org_idx").on(table.organizationId),
    databaseIdx: index("lead_database_purchases_database_idx").on(table.databaseId),
    orgDatabaseUnique: uniqueIndex("lead_database_purchases_org_database_unique").on(
      table.organizationId,
      table.databaseId
    ),
  })
);

// 6. Historique des Appels (Vapi)
export const calls = pgTable(
  "calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    vapiCallId: text("vapi_call_id").unique().notNull(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    type: text("type").notNull(), // 'ecommerce_confirmation', 'prospecting'
    status: text("status").notNull(), // 'queued', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer'
    durationSeconds: integer("duration_seconds"),
    costUsd: decimal("cost_usd", { precision: 10, scale: 4 }), // Coût brut API
    costFcfa: decimal("cost_fcfa", { precision: 10, scale: 2 }), // Coût facturé client
    recordingUrl: text("recording_url"),
    transcript: text("transcript"),
    summary: text("summary"),
    callMessages: jsonb("call_messages").$type<
      Array<{
        speaker: "assistant" | "client" | "system" | "unknown";
        text: string;
        role?: string;
        timestamp?: string;
        secondsFromStart?: number;
      }>
    >(),
    callArtifact: jsonb("call_artifact").$type<Record<string, unknown>>(),
    endedReason: text("ended_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("calls_org_idx").on(table.organizationId),
    statusIdx: index("calls_status_idx").on(table.status),
    createdAtIdx: index("calls_created_at_idx").on(table.createdAt),
    vapiCallIdx: index("calls_vapi_call_idx").on(table.vapiCallId),
  })
);

// Types inférés
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadDatabase = typeof leadDatabases.$inferSelect;
export type NewLeadDatabase = typeof leadDatabases.$inferInsert;
export type LeadDatabaseRecord = typeof leadDatabaseRecords.$inferSelect;
export type NewLeadDatabaseRecord = typeof leadDatabaseRecords.$inferInsert;
export type LeadDatabasePurchase = typeof leadDatabasePurchases.$inferSelect;
export type NewLeadDatabasePurchase = typeof leadDatabasePurchases.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
