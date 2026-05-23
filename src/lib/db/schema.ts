import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  jsonb,
  decimal,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// 1. Gestion des Utilisateurs et Organisations (Multi-tenant)
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    shopName: text("shop_name"),
    shopifyDomain: text("shopify_domain"),
    woocommerceDomain: text("woocommerce_domain"),
    webhookToken: text("webhook_token").notNull(),
    lowBalanceThresholdFcfa: decimal("low_balance_threshold_fcfa", {
      precision: 12,
      scale: 2,
    })
      .default("5000")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    shopifyDomainIdx: uniqueIndex("organizations_shopify_domain_idx").on(
      table.shopifyDomain
    ),
    woocommerceDomainIdx: uniqueIndex(
      "organizations_woocommerce_domain_idx"
    ).on(table.woocommerceDomain),
    webhookTokenIdx: uniqueIndex("organizations_webhook_token_idx").on(
      table.webhookToken
    ),
  })
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // Lié à auth.users de Supabase
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull().unique(),
    fullName: text("full_name"),
    role: text("role").default("member").notNull(), // 'owner', 'admin', 'member'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("users_org_idx").on(table.organizationId),
  })
);

// Invitations à rejoindre une organisation
export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    role: text("role").default("member").notNull(),
    token: text("token").unique().notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("org_invitations_org_idx").on(table.organizationId),
    tokenIdx: uniqueIndex("org_invitations_token_idx").on(table.token),
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
  version: integer("version").default(0).notNull(), // verrouillage optimiste
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
    amountFcfa: decimal("amount_fcfa", {
      precision: 14,
      scale: 2,
    }).notNull(),
    balanceAfterFcfa: decimal("balance_after_fcfa", {
      precision: 14,
      scale: 2,
    }),
    description: text("description"),
    metadata: jsonb("metadata"),
    externalReference: text("external_reference"), // ID Stripe, Mobile Money, etc.
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    walletIdx: index("transactions_wallet_idx").on(table.walletId),
    createdAtIdx: index("transactions_created_at_idx").on(table.createdAt),
    idempotencyIdx: uniqueIndex("transactions_idempotency_idx").on(
      table.idempotencyKey
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
    externalId: text("external_id").notNull(), // ID Shopify/WooCommerce
    source: text("source").default("shopify").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerAddress: text("customer_address"),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
    currency: text("currency").default("XOF").notNull(),
    status: text("status").default("pending").notNull(),
    callAttempts: integer("call_attempts").default(0).notNull(),
    lastCallAt: timestamp("last_call_at"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("orders_org_idx").on(table.organizationId),
    statusIdx: index("orders_status_idx").on(table.status),
    externalIdx: uniqueIndex("orders_org_external_idx").on(
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
    voiceId: text("voice_id"),
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
    callAttempts: integer("call_attempts").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("leads_campaign_idx").on(table.campaignId),
    statusIdx: index("leads_status_idx").on(table.status),
    phoneIdx: index("leads_phone_idx").on(table.phone),
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
    type: text("type").notNull(), // 'ecommerce_confirmation', 'prospecting'
    status: text("status").notNull(),
    durationSeconds: integer("duration_seconds"),
    costUsd: decimal("cost_usd", { precision: 10, scale: 4 }),
    costFcfa: decimal("cost_fcfa", { precision: 10, scale: 2 }),
    recordingUrl: text("recording_url"),
    transcript: text("transcript"),
    summary: text("summary"),
    structuredResult: jsonb("structured_result"),
    outcome: text("outcome"), // 'confirmed', 'cancelled', 'no_answer', 'voicemail', 'qualified', 'not_interested'
    endedReason: text("ended_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("calls_org_idx").on(table.organizationId),
    statusIdx: index("calls_status_idx").on(table.status),
    createdAtIdx: index("calls_created_at_idx").on(table.createdAt),
    vapiCallIdx: index("calls_vapi_call_idx").on(table.vapiCallId),
    outcomeIdx: index("calls_outcome_idx").on(table.outcome),
  })
);

// 6. Webhook event log (idempotency)
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(), // 'vapi', 'shopify', 'woocommerce', 'stripe'
    externalEventId: text("external_event_id").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    payload: jsonb("payload"),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueEventIdx: uniqueIndex("webhook_events_unique_idx").on(
      table.source,
      table.externalEventId
    ),
  })
);

// 7. Audit log
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("audit_logs_org_idx").on(table.organizationId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
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
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;
