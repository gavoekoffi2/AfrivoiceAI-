# Déploiement AfrivoiceAI (Netlify + Supabase)

Ce guide explique comment rendre l'application **pleinement fonctionnelle** en
ligne (connexion + dashboard + appels). Le site est déjà déployé sur Netlify
mais tourne avec des valeurs **placeholder** : il faut renseigner les vrais
secrets puis relancer un déploiement.

URL de production : https://afrivoiceai-mvp.netlify.app

---

## 1. Prérequis

- Un projet **Supabase** (https://supabase.com) — gratuit pour démarrer.
- (Pour les appels) un compte **Vapi** (https://vapi.ai) avec un numéro.
- (Optionnel e-commerce) une boutique **Shopify** ou **WooCommerce**.

---

## 2. Variables d'environnement

À renseigner dans **Netlify → Site settings → Environment variables**
(ou via CLI, voir §5). Remplacez les placeholders existants.

### Indispensables (connexion + dashboard)

| Variable | Où la trouver | Sensibilité |
|----------|---------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → **Project URL** | publique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → **anon public** | publique |
| `DATABASE_URL` | Supabase → Project Settings → Database → **Connection pooling** (Transaction, port **6543**) | **secrète** |

> ⚠️ Pour `DATABASE_URL`, utilisez la chaîne **pooler** (`...pooler.supabase.com:6543/postgres?...`),
> pas la connexion directe : en serverless, la connexion directe épuise le pool.
> La config DB de l'app est déjà compatible (`max:1`, `prepare:false`).

### Pour les appels (Vapi)

| Variable | Où la trouver |
|----------|---------------|
| `VAPI_API_KEY` | Vapi → API Keys (private) |
| `VAPI_PHONE_NUMBER_ID` | Vapi → Phone Numbers |
| `VAPI_WEBHOOK_SECRET` | Vapi → Webhooks (à définir, puis copier ici) |
| `ELEVENLABS_VOICE_ID` | (optionnel) ID de voix ElevenLabs, défaut fourni |

### Pour les webhooks e-commerce

| Variable | Où la trouver |
|----------|---------------|
| `SHOPIFY_WEBHOOK_SECRET` | Shopify → Notifications → Webhooks (signing secret) |
| `WOOCOMMERCE_WEBHOOK_SECRET` | WooCommerce → Webhooks (secret) |

### Déjà configurées (ne pas toucher sauf besoin)

| Variable | Valeur | Rôle |
|----------|--------|------|
| `NEXT_PUBLIC_SITE_URL` | `https://afrivoiceai-mvp.netlify.app` | URLs absolues / origines |
| `DB_SERVERLESS` | `true` | Pool DB adapté serverless |
| `ENABLE_SIMULATED_DEPOSITS` | `false` | Recharge wallet simulée (mettre `true` pour une démo) |
| `EXCHANGE_RATE_USD_TO_FCFA` | `600` | Taux de conversion |
| `PROFIT_MARGIN_PERCENTAGE` | `30` | Marge appliquée |

---

## 3. Appliquer les migrations à la base

Le schéma (tables organizations/users/wallets/orders/calls…) est versionné dans
`src/supabase/migrations/`. À appliquer **une fois** sur votre base Supabase,
avec la connexion **directe** (port **5432**, pas le pooler) :

```bash
DATABASE_URL="postgresql://postgres:[MOT_DE_PASSE]@db.[REF].supabase.co:5432/postgres" \
  npm run db:migrate
```

> L'inscription crée ensuite automatiquement l'organisation, l'utilisateur et le
> wallet (provisionnement idempotent) — aucune donnée à insérer à la main.

---

## 4. Authentification Supabase

Dans **Supabase → Authentication → Providers → Email** :

- Pour une **démo fluide**, désactivez « Confirm email » (connexion immédiate
  après inscription).
- Sinon, laissez activé : l'utilisateur confirme via email avant de se connecter
  (le flux gère les deux cas).

---

## 5. Mettre à jour les variables via CLI (alternative au dashboard)

```bash
export NETLIFY_AUTH_TOKEN="<votre_token>"   # ne pas committer
netlify link --name afrivoiceai-mvp

netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://[REF].supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "eyJ..."
netlify env:set DATABASE_URL "postgresql://...pooler.supabase.com:6543/postgres?..." --secret
# (puis VAPI_*, SHOPIFY_/WOOCOMMERCE_WEBHOOK_SECRET au besoin)
```

---

## 6. Redéployer

Les variables `NEXT_PUBLIC_*` sont **injectées au build** : il faut relancer un
déploiement après toute modification.

```bash
netlify deploy --build --prod
```

Ou : Netlify → Deploys → **Trigger deploy** → *Clear cache and deploy site*.

---

## 7. Configurer les webhooks (après mise en ligne)

| Plateforme | URL à coller | Topic |
|------------|--------------|-------|
| Shopify | `https://afrivoiceai-mvp.netlify.app/api/webhooks/shopify` | `orders/create` |
| WooCommerce | `https://afrivoiceai-mvp.netlify.app/api/webhooks/woocommerce` | `order.created` |
| Vapi | `https://afrivoiceai-mvp.netlify.app/api/webhooks/vapi` | end-of-call / status |

---

## 8. Vérifier

```bash
curl -s https://afrivoiceai-mvp.netlify.app/api/health        # {"status":"ok",...}
```

Puis : créer un compte sur `/register`, se connecter, accéder au dashboard.

---

## Sécurité

- Ne committez jamais de secret (`.env`, tokens) — `.gitignore` les exclut déjà.
- `DATABASE_URL` et les clés service contiennent des identifiants : préférez le
  dashboard Netlify (chiffré) plutôt que le chat ou des fichiers.
- Faites tourner régulièrement les tokens partagés.
