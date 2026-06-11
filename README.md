# AfrivoiceAI

Plateforme SaaS d'appels vocaux par IA pour l'Afrique francophone :

- **Confirmation automatique des commandes COD** (paiement à la livraison) : une commande Shopify/WooCommerce arrive → l'IA appelle le client en français pour confirmer la commande et l'adresse → le statut est mis à jour automatiquement.
- **Prospection téléphonique automatisée** : importez vos leads en CSV, définissez un script, l'IA appelle, qualifie et résume chaque conversation.
- **Wallet en FCFA** : chaque appel est facturé au réel (coût API converti en FCFA + marge), avec historique des transactions.

## Stack

Next.js 14 (App Router) · Supabase (Auth + Postgres) · Drizzle ORM · [Vapi](https://vapi.ai) (orchestration vocale) · ElevenLabs (voix) · Google Gemini (LLM) · Deepgram (transcription fr) · Tailwind + shadcn/ui.

## Démarrage rapide

### 1. Prérequis

- Node.js 20+
- Un projet [Supabase](https://supabase.com) (gratuit)
- Un compte [Vapi](https://vapi.ai) avec un numéro de téléphone (`VAPI_PHONE_NUMBER_ID`)

### 2. Configuration

```bash
cp .env.example .env.local
npm install
```

Renseignez dans `.env.local` :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth côté client |
| `SUPABASE_SERVICE_ROLE_KEY` | Création des comptes (server only) |
| `DATABASE_URL` | Connexion Postgres (Supabase → Settings → Database). Le pooler en mode *transaction* (port 6543) est supporté. |
| `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID` | Lancement des appels |
| `VAPI_WEBHOOK_SECRET` | Doit être identique au **Server URL Secret** configuré dans Vapi |
| `ELEVENLABS_VOICE_ID` | Voix utilisée (configurer la clé ElevenLabs dans Vapi → Provider Credentials) |
| `SHOPIFY_WEBHOOK_SECRET`, `WOOCOMMERCE_WEBHOOK_SECRET` | Vérification HMAC des webhooks e-commerce |
| `EXCHANGE_RATE_USD_TO_FCFA`, `PROFIT_MARGIN_PERCENTAGE` | Facturation (600 et 30 par défaut) |

### 3. Base de données

```bash
npm run db:push        # crée les tables dans Supabase
```

### 4. Lancer

```bash
npm run dev            # http://localhost:3000
```

Créez un compte sur `/register` (organisation + wallet créés automatiquement), rechargez le wallet (simulation intégrée en attendant Mobile Money), et lancez vos premiers appels.

## Configuration des webhooks (production)

Les URLs exactes (avec votre identifiant d'organisation) sont affichées dans **Paramètres → Intégrations** de l'application.

| Source | URL | Notes |
|---|---|---|
| Vapi | `https://votre-domaine/api/webhooks/vapi` | Dashboard Vapi → Server URL. Renseignez le *Server URL Secret* = `VAPI_WEBHOOK_SECRET`. **Sans ce webhook, les appels ne sont ni facturés ni mis à jour.** |
| Shopify | `https://votre-domaine/api/webhooks/shopify?org=<ID>` | Topic `orders/create`. Seules les commandes COD déclenchent un appel. |
| WooCommerce | `https://votre-domaine/api/webhooks/woocommerce?org=<ID>` | Topic `Order created`. |

Le paramètre `?org=<ID>` route la commande vers la bonne organisation (multi-tenant). Sans ce paramètre, le webhook n'est accepté que s'il n'existe qu'une seule organisation.

## Facturation des appels

```
coût client (FCFA) = ceil(coût Vapi en USD × EXCHANGE_RATE_USD_TO_FCFA × (1 + PROFIT_MARGIN_PERCENTAGE/100))
```

Le débit du wallet se fait à la réception du rapport de fin d'appel Vapi (idempotent : une relivraison du webhook ne débite pas deux fois). Chaque appel est plafonné à 5 minutes (`maxDurationSeconds`).

## Scripts

```bash
npm run dev          # développement
npm run build        # build production
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest
npm run db:push      # synchroniser le schéma Drizzle → Postgres
npm run db:studio    # explorer la base
```

## Déploiement

- **Netlify** : configuration fournie (`netlify.toml`, plugin Next.js). Définissez toutes les variables d'environnement dans l'UI Netlify et mettez `NEXT_PUBLIC_SITE_URL` sur votre domaine.
- **Docker** : `docker compose up` (voir `Dockerfile` / `docker-compose.yml`, build standalone).

## Limites connues (MVP)

- La recharge du wallet est une **simulation** (l'intégration Mobile Money / Stripe est prévue) — ne pas exposer en production payante sans la remplacer.
- L'issue d'une commande (confirmée/annulée) est déduite par mots-clés du résumé d'appel ; vérifiez les commandes douteuses depuis le dashboard.
- Le lancement de campagne appelle par lots de 5 (limite de durée des fonctions serverless) : relancez le bouton tant qu'il reste des leads.
