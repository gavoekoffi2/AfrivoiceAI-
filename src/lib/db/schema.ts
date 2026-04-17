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
  shopifyDomain: text("shopify_domain").unique(),
  woocommerceDomain: text("woocommerce_domain").unique(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  countryCode: text("country_code").default("TG").notNull(),
  timezone: text("timezone").default("Africa/Lome").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull().unique(),
    fullName: text("full_name"),
    role: text("role").default("member").notNull(),
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
  balanceFcfa: decimal("balance_fcfa", { precision: 14, scale: 2 })
    .default("0")
    .notNull(),
  lowBalanceAlertSent: boolean("low_balance_alert_sent").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .references(() => wallets.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(), // 'deposit', 'call_cost', 'refund', 'adjustment'
    amountFcfa: decimal("amount_fcfa", { precision: 14, scale: 2 }).notNull(),
    description: text("description"),
    status: text("status").default("completed").notNull(), // 'pending', 'completed', 'failed'
    provider: text("provider"), // 'stripe', 'mobile_money', 'manual'
    providerRef: text("provider_ref"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    walletIdx: index("transactions_wallet_idx").on(table.walletId),
    createdAtIdx: index("transactions_created_at_idx").on(table.createdAt),
    providerRefIdx: uniqueIndex("transactions_provider_ref_idx").on(
      table.providerRef
    ),
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
    externalId: text("external_id").notNull(),
    source: text("source").default("shopify").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerAddress: text("customer_address"),
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }),
    currency: text("currency").default("XOF").notNull(),
    status: text("status").default("pending").notNull(),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("orders_org_idx").on(table.organizationId),
    statusIdx: index("orders_status_idx").on(table.status),
    externalUnique: uniqueIndex("orders_external_unique_idx").on(
      table.organizationId,
      table.source,
      table.externalId
    ),
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
    scriptTemplate: text("script_template").notNull(),
    status: text("status").default("draft").notNull(),
    totalLeads: integer("total_leads").default(0).notNull(),
    calledLeads: integer("called_leads").default(0).notNull(),
    qualifiedLeads: integer("qualified_leads").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
    status: text("status").default("new").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("leads_campaign_idx").on(table.campaignId),
    statusIdx: index("leads_status_idx").on(table.status),
    phoneUniqueIdx: uniqueIndex("leads_campaign_phone_idx").on(
      table.campaignId,
      table.phone
    ),
  })
);

// 5. Historique des Appels (Vapi)
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
    type: text("type").notNull(),
    status: text("status").notNull(),
    durationSeconds: integer("duration_seconds"),
    costUsd: decimal("cost_usd", { precision: 10, scale: 4 }),
    costFcfa: decimal("cost_fcfa", { precision: 10, scale: 2 }),
    recordingUrl: text("recording_url"),
    transcript: text("transcript"),
    summary: text("summary"),
    endedReason: text("ended_reason"),
    outcome: text("outcome"), // 'confirmed', 'cancelled', 'no_answer', 'qualified', 'not_interested', 'unclear'
    sentiment: text("sentiment"), // 'positive', 'neutral', 'negative'
    billed: boolean("billed").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("calls_org_idx").on(table.organizationId),
    statusIdx: index("calls_status_idx").on(table.status),
    createdAtIdx: index("calls_created_at_idx").on(table.createdAt),
    vapiCallIdx: index("calls_vapi_call_idx").on(table.vapiCallId),
  })
);

// 6. Notifications dans l'application
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'call_completed', 'low_balance', 'order_received', 'campaign_done', 'system'
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("notifications_org_idx").on(table.organizationId),
    readIdx: index("notifications_read_idx").on(table.read),
  })
);

// 7. Idempotency tracker (webhooks, external events)
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(), // 'shopify', 'woocommerce', 'vapi', 'stripe'
    externalId: text("external_id").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    payload: jsonb("payload"),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
  (table) => ({
    providerEventUnique: uniqueIndex("webhook_events_provider_external_idx").on(
      table.provider,
      table.externalId
    ),
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
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
