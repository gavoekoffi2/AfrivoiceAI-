# AfrivoiceAI

Plateforme SaaS multi-tenant de Voice AI pour l'Afrique francophone :
confirmation automatique de commandes COD (Shopify / WooCommerce) et campagnes
de prospection B2B via appels téléphoniques IA en français.

## Stack

- **Next.js 14** (App Router, Server Actions, Server Components)
- **TypeScript** strict
- **Supabase** (Auth + Postgres)
- **Drizzle ORM** + migrations SQL versionnées
- **Vapi.ai** (orchestration vocale) avec function-calling pour des résultats structurés
- **ElevenLabs** (voix), **Google Gemini** (LLM)
- **Stripe** (paiement par carte)
- **Tailwind CSS** + shadcn/ui, dark mode
- **Docker** / Docker Compose / Nginx (déploiement self-hosted)

## Démarrage rapide

```bash
# 1. Cloner et installer
npm install

# 2. Configurer l'environnement
cp .env.example .env.local
# → Renseigner DATABASE_URL, Supabase keys, Vapi key, INTERNAL_API_SECRET

# 3. Appliquer le schéma à la base
npm run db:push          # ou : psql $DATABASE_URL -f src/supabase/migrations/0001_initial_schema.sql

# 4. (Supabase uniquement) appliquer les triggers d'auth
psql $DATABASE_URL -f src/supabase/migrations/0002_auth_triggers.sql

# 5. Lancer en dev
npm run dev
```

Application disponible sur http://localhost:3000.

## Architecture

```
src/
├── app/                          # Routes Next.js App Router
│   ├── (auth)/                   # login, register, forgot-password, reset-password
│   ├── (dashboard)/              # dashboard, calls, campaigns, e-commerce, wallet, settings
│   ├── api/                      # endpoints REST
│   │   ├── calls/initiate/       # déclenchement d'appels (interne + dashboard)
│   │   ├── campaigns/[id]/launch # batch d'appels de prospection
│   │   ├── wallet/{balance,deposit,checkout}
│   │   ├── webhooks/{shopify,woocommerce,vapi,stripe}
│   │   └── settings/{,webhook-token}
│   ├── landing/                  # page marketing publique
│   ├── terms/ privacy/           # mentions légales
│   └── auth/callback/            # redirect Supabase OAuth/email confirm
├── components/
│   ├── providers/                # ThemeProvider
│   ├── shared/                   # composants métier (Sidebar, Header, AudioPlayer, etc.)
│   └── ui/                       # primitives shadcn
├── lib/
│   ├── auth.ts                   # session + provisioning fallback
│   ├── calls/trigger.ts          # service de déclenchement d'appels
│   ├── db/                       # schema Drizzle + connexion
│   ├── organizations/resolver.ts # routage multi-tenant des webhooks
│   ├── shopify/ woocommerce/ vapi/  # verifs HMAC + clients
│   ├── stripe/                   # client + checkout
│   ├── utils/                    # hmac, retry, logger, rate-limit, csv, env, billing
│   ├── validations/              # schémas Zod
│   ├── wallet/service.ts         # service wallet (transactionnel, idempotent)
│   └── webhooks/idempotency.ts   # déduplication des événements
└── supabase/migrations/          # SQL versionnés (initial + auth triggers + seed)
```

### Sécurité

- **HMAC** : toutes les vérifications webhook utilisent une comparaison
  à temps constant (`crypto.timingSafeEqual` enveloppé pour éviter les crashes).
- **Secrets obligatoires en production** : si `VAPI_WEBHOOK_SECRET` ou
  `SHOPIFY_WEBHOOK_SECRET` est absent en prod, les webhooks sont rejetés.
- **Auth interne** : `INTERNAL_API_SECRET` séparé de la `service_role` Supabase.
- **Rate-limiting** in-memory sur login, register, forgot-password, webhooks,
  deposit, batch-launch.
- **Idempotency** : table `webhook_events` (Vapi/Shopify/Woo/Stripe) et
  `transactions.idempotency_key` empêchent les doublons.
- **Wallet** : `SELECT FOR UPDATE` + contrainte `CHECK balance >= 0` au niveau DB.

### Multi-tenant

Le routage des webhooks Shopify/WooCommerce vers la bonne organisation se fait :

1. via `?token=<webhook_token>` dans l'URL (recommandé), OU
2. via `shopify_domain` / `woocommerce_domain` enregistrés dans
   `organizations`.

L'URL à coller dans Shopify/Woo se trouve dans **Paramètres → Intégrations**.

### Function-calling Vapi

Au lieu d'analyser les transcripts par mots-clés (peu fiable),
l'assistant Vapi appelle un outil structuré (`recordOrderOutcome` /
`recordProspectingOutcome`) en fin d'appel. Le webhook lit cet appel pour
classer l'issue (`confirmed`, `cancelled`, `qualified`, `voicemail`, ...).

## Scripts

```bash
npm run dev              # serveur dev
npm run build            # build de production
npm run start            # serveur prod
npm run lint             # ESLint
npm run db:push          # push schema vers la DB (sans migration)
npm run db:generate      # générer une migration depuis le schema
npm run db:migrate       # appliquer les migrations
npm run db:studio        # Drizzle Studio
```

## Déploiement

### Vercel / Netlify
Standard Next.js. Définir toutes les variables d'env du `.env.example`.

### Docker Compose (self-hosted)

```bash
docker compose up -d --build
# → app sur :3000, postgres sur :5432, nginx sur :80/:443
```

Pour Nginx + HTTPS : placer le certificat dans `nginx/ssl/{cert,key}.pem`
et mettre à jour `server_name` dans `nginx/nginx.conf`.

## Roadmap

- [ ] Intégrations Mobile Money (PayDunya, Flooz, TMoney, Wave)
- [ ] Page real-time des appels en cours (websocket)
- [ ] Marketplace de voix africaines
- [ ] Support des langues locales (Éwé, Wolof, Fon, Dioula, Twi, Haoussa)
- [ ] Invitations d'équipe (table `organization_invitations` déjà présente)
- [ ] Sentry + monitoring uptime

## Licence

Propriétaire — © AfrivoiceAI.
