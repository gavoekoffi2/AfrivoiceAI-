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
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    shopName: text("shop_name"),
    // Domaine de la boutique e-commerce, utilisé pour router les webhooks
    // entrants (Shopify `x-shopify-shop-domain`, URL du site WooCommerce)
    // vers la BONNE organisation. Sans mapping, un webhook est rejeté.
    shopDomain: text("shop_domain"),
    // Rétention configurable des données personnelles d'appel (transcripts,
    // enregistrements, numéros). NULL = conservation par défaut plateforme.
    // Cf. conformité loi togolaise n°2019-014 sur la protection des données.
    dataRetentionDays: integer("data_retention_days"),
    // Clé PUBLIQUE du widget embarquable (préfixe pk_). Jamais de secret ici :
    // cette valeur est visible côté client par construction.
    publicKey: text("public_key").unique(),
    // Allowlist des domaines autorisés à charger le widget de cette org.
    allowedDomains: jsonb("allowed_domains").$type<string[]>(),
    // Plan de l'organisation (rate limiting API publique) : free|pro|enterprise.
    plan: text("plan").default("free").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    shopDomainIdx: uniqueIndex("organizations_shop_domain_unique").on(
      table.shopDomain
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
    role: text("role").default("member").notNull(), // 'super_admin', 'admin', 'owner', 'member'
    subscriptionPlan: text("subscription_plan").default("free").notNull(), // 'free', 'pro', 'enterprise'
    subscriptionExpiresAt: timestamp("subscription_expires_at"), // NULL = illimité/permanent pour un plan payant
    isActive: boolean("is_active").default(true).notNull(),
    adminPermissions: jsonb("admin_permissions"),
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
    voiceLanguage: text("voice_language").default("fr").notNull(), // 'fr', 'ewe'
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

export const voiceCloneProfiles = pgTable(
  "voice_clone_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    provider: text("provider").default("openvoice").notNull(),
    model: text("model").default("myshell-ai/OpenVoice").notNull(),
    status: text("status").default("draft").notNull(),
    consentConfirmed: boolean("consent_confirmed").default(false).notNull(),
    sampleAudioUrl: text("sample_audio_url"),
    externalVoiceId: text("external_voice_id"),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("voice_clone_profiles_org_idx").on(table.organizationId),
    statusIdx: index("voice_clone_profiles_status_idx").on(table.status),
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

// 7. Studio d'agents IA (plateforme marque blanche, multi-tenant)
export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    // Langue parlée avec l'appelant ('fr', 'en', 'ee' éwé, 'yo', 'ha'…).
    speakLanguage: text("speak_language").default("fr").notNull(),
    // Langue de « pensée » du LLM (traduction auto si != speakLanguage).
    thinkLanguage: text("think_language").default("fr").notNull(),
    // Tier de modèle ('simple' | 'default' | 'premium') ou id complet.
    model: text("model").default("default").notNull(),
    // Voix TTS (ex. id de voix clonée OpenVoice de l'organisation).
    voiceId: text("voice_id"),
    // Personnalité / instructions système rédigées dans le studio no-code.
    systemPrompt: text("system_prompt").notNull(),
    // Scénarios d'appel (étapes, objections, objectifs) — texte structuré.
    callScenario: text("call_scenario"),
    // Message d'accueil prononcé en début de conversation.
    greeting: text("greeting"),
    status: text("status").default("draft").notNull(), // 'draft' | 'active' | 'archived'
    // Expose l'agent au widget web public (avec clé publique + allowlist).
    widgetEnabled: boolean("widget_enabled").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("agents_org_idx").on(table.organizationId),
    statusIdx: index("agents_status_idx").on(table.status),
  })
);

export const agentKnowledge = pgTable(
  "agent_knowledge",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .references(() => agents.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    // Contenu textuel consultable par l'agent (injecté dans le contexte).
    content: text("content").notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    agentIdx: index("agent_knowledge_agent_idx").on(table.agentId),
    orgIdx: index("agent_knowledge_org_idx").on(table.organizationId),
  })
);

// Journal d'appels/conversations généralisé (découplé de Vapi) : téléphonie
// directe (Africa's Talking/Twilio), widget web, et pipeline auto-hébergé.
export const callLogs = pgTable(
  "call_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    // 'africas-talking' | 'twilio' | 'vapi' | 'widget'
    provider: text("provider").notNull(),
    providerCallId: text("provider_call_id"),
    direction: text("direction").default("outbound").notNull(), // 'outbound' | 'inbound'
    channel: text("channel").default("phone").notNull(), // 'phone' | 'widget'
    phoneNumber: text("phone_number"),
    status: text("status").default("queued").notNull(),
    durationSeconds: integer("duration_seconds"),
    costFcfa: decimal("cost_fcfa", { precision: 10, scale: 2 }),
    transcript: text("transcript"),
    summary: text("summary"),
    messages: jsonb("messages").$type<
      Array<{ role: string; content: string; at?: string }>
    >(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("call_logs_org_idx").on(table.organizationId),
    agentIdx: index("call_logs_agent_idx").on(table.agentId),
    providerCallIdx: index("call_logs_provider_call_idx").on(
      table.providerCallId
    ),
    createdAtIdx: index("call_logs_created_at_idx").on(table.createdAt),
  })
);

// 8. Clés API de l'API publique (Partie F). Seul le hash SHA-256 est stocké.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    // Préfixe non secret affichable (ex. "avk_live_ab12cd34") pour identifier
    // la clé dans l'UI sans jamais réafficher le secret.
    prefix: text("prefix").notNull(),
    hashedKey: text("hashed_key").unique().notNull(),
    scopes: jsonb("scopes").$type<string[]>(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("api_keys_org_idx").on(table.organizationId),
    prefixIdx: index("api_keys_prefix_idx").on(table.prefix),
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
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentKnowledge = typeof agentKnowledge.$inferSelect;
export type NewAgentKnowledge = typeof agentKnowledge.$inferInsert;
export type CallLog = typeof callLogs.$inferSelect;
export type NewCallLog = typeof callLogs.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
