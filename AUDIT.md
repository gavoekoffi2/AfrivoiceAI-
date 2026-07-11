# AUDIT — AfrivoiceAI

> Audit d'architecture, de sécurité et de qualité du socle existant, puis
> proposition d'architecture cible pour transformer AfrivoiceAI en plateforme
> SaaS multi-tenant d'agents vocaux (appels + widget web) en langues africaines.
>
> **Statut : document de décision. Aucune ligne de code applicatif n'a encore été
> modifiée. La refonte n'est appliquée qu'après ta validation.**

Date : 2026-07-10 · Périmètre : branche de travail, code présent dans le repo.

---

## 0. Résumé exécutif

AfrivoiceAI est aujourd'hui une **application Next.js mono-tenant de fait**,
orientée « centre d'appels e-commerce / prospection », qui délègue **100 % du
pipeline vocal à Vapi** (plateforme hébergée qui fait STT + LLM + TTS +
téléphonie). Le code est propre par endroits (validations Zod, transactions DB,
vérif HMAC des webhooks e-commerce, séparation admin par permissions), mais il
comporte **trois défauts structurels bloquants** pour une plateforme SaaS :

1. **Faille d'authentification critique** : `getUserSession()` retombe
   silencieusement sur une **session démo administrateur partagée** dès qu'une
   erreur survient ou que l'utilisateur n'est pas authentifié. → Contournement
   d'auth + effondrement de l'isolation multi-tenant.
2. **Isolation multi-tenant applicative uniquement** (filtres `WHERE
   organization_id` à la main), **sans RLS Postgres**. Un seul filtre oublié =
   fuite inter-organisations. Le webhook Shopify **assigne déjà toutes les
   commandes à la première organisation de la base**.
3. **Pas de couche providers** : STT/LLM/TTS/Traduction/Téléphonie sont
   codés en dur autour de Vapi et **Gemini** (alors que le cahier des charges
   impose des interfaces abstraites, un pipeline streaming propre, et Claude
   configurable). Impossible d'ajouter Africa's Talking, un widget web, ou un
   pipeline < 1,5 s sans introduire cette couche.

**Verdict** : l'architecture actuelle **n'est pas adaptée** à la cible
(multi-tenant, temps réel, fort trafic, marque blanche). Elle doit être
**refondue sur son socle** (auth, tenancy, sécurité, couche providers) **avant**
d'empiler les fonctionnalités A→F. Le code métier réutilisable (billing,
webhooks e-commerce, schéma de base, UI dashboard) sera conservé et adapté.

---

## 1. Architecture actuelle (cartographie)

### 1.1 Stack

| Couche | Technologie |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript |
| Auth | Supabase Auth (`@supabase/ssr`) + middleware |
| DB / ORM | PostgreSQL (Supabase) + Drizzle ORM (`postgres` driver) |
| Voix / Appels | **Vapi** (`@vapi-ai/server-sdk`) — pipeline vocal hébergé complet |
| LLM (cerveau) | **Google Gemini** `gemini-1.5-flash` (via Vapi) |
| STT | Deepgram `nova-2` (via Vapi) |
| TTS | ElevenLabs / Azure (via Vapi) + prototype local `mms-tts-ewe` (custom-voice) |
| Clonage voix | OpenVoice V2 (microservice externe, `OPENVOICE_API_URL`) |
| Paiement | Stripe (présent, non branché) ; wallet FCFA interne |
| E-commerce | Webhooks Shopify / WooCommerce (COD) |
| Déploiement | Docker + nginx ; configs Netlify & Vercel |
| Tests | Vitest — 4 fichiers de test (utilitaires uniquement) |

### 1.2 Découpage du code (`src/`)

```
app/
  (auth)/            login, register
  (dashboard)/       admin, african-voices, calls, campaigns, e-commerce,
                     lead-databases, settings, voice-cloning, wallet
  actions/           admin, auth, campaigns, lead-databases, voice-clones  (Server Actions)
  api/
    calls/initiate           → crée un appel Vapi (e-commerce OU prospection)
    campaigns/**             → CRUD + launch
    webhooks/vapi            → end-of-call-report / status-update
    webhooks/shopify,woocommerce
    tts/ewe/{demo,vapi}      → TTS éwé local (Python + ffmpeg)
    voice-cloning/openvoice/callback
    wallet/{balance,deposit}
    settings, health/**
lib/
  db/                schema.ts (Drizzle), queries.ts, index.ts
  vapi/              client.ts, verify.ts, artifacts.ts
  voice-cloning/     openvoice.ts
  supabase/          server.ts, client.ts
  auth.ts, admin.ts, utils/billing.ts, prospecting.ts, validations/**
middleware.ts        protection de routes via Supabase
```

### 1.3 Modèle de données (Drizzle) — tables existantes

`organizations`, `users` (liées à `auth.users` Supabase), `wallets`,
`transactions`, `orders`, `campaigns`, `leads`, `lead_databases`,
`lead_database_records`, `lead_database_purchases`, `voice_clone_profiles`,
`calls`. Toutes les tables métier portent `organization_id` avec
`onDelete: cascade` et des index — **bonne base**, mais l'isolation n'est
imposée qu'au niveau applicatif (voir §2 et §3).

### 1.4 Flux d'appel actuel (résumé)

```
Dashboard/Webhook → POST /api/calls/initiate
   → vérifie solde wallet (FCFA)
   → génère prompt système (FR/éwé)
   → vapi.calls.create({ model: gemini-1.5-flash, voice: 11labs/azure/custom, transcriber: deepgram })
   → insert calls(status=queued)
Vapi gère l'appel (STT+LLM+TTS+télécom)
   → POST /api/webhooks/vapi (status-update, end-of-call-report)
   → maj calls + déduction wallet + maj order/lead
```

**Conséquence clé** : il n'existe **aucun** pipeline vocal, orchestrateur de tour
de parole, ni fournisseur télécom propres dans ce repo. Tout cela est délégué à
Vapi. Les Parties B et C du cahier des charges consistent donc à **introduire
cette couche** (interfaces + implémentations), Vapi devenant *une* stratégie
parmi d'autres (« pipeline managé ») à côté du pipeline auto-hébergé.

---

## 2. Diagnostic — faiblesses structurelles

| # | Faiblesse | Impact | Gravité |
|---|---|---|---|
| D1 | **Fallback session démo admin** dans `auth.ts` / `queries.ts` | Contournement d'auth ; toutes les erreurs deviennent invisibles ; données écrites sous une org démo partagée | 🔴 Critique |
| D2 | **Isolation multi-tenant applicative, sans RLS** | Un filtre `organization_id` oublié = fuite inter-tenant ; aucune défense en profondeur | 🔴 Critique |
| D3 | **Pas de couche d'abstraction providers** (STT/LLM/TTS/Traduction/Téléphonie) | Impossible d'ajouter Africa's Talking, un pipeline streaming, ou de rendre le LLM configurable sans réécriture | 🔴 Critique |
| D4 | **Cerveau = Gemini codé en dur** (`gemini-1.5-flash`) | Contredit l'exigence « Claude Haiku/Sonnet par défaut, Fable/Opus en option, configurable » | 🟠 Élevé |
| D5 | **Couplage webhook→API par `fetch` interne + service_role_key** | Fire-and-forget non fiable (perte d'appels), secret god-mode en header, pas de file d'attente | 🟠 Élevé |
| D6 | **TTS éwé = Python+ffmpeg synchrone dans une route Next** | Ne tourne pas en serverless (Netlify/Vercel) ; bloquant ; vecteur DoS CPU | 🟠 Élevé |
| D7 | **Aucune file d'attente d'appels** | Les campagnes lancent des appels en boucle via `fetch` ; pas de contrôle de débit, retry, concurrence | 🟠 Élevé |
| D8 | **PII en clair** (transcripts, enregistrements, téléphones) | Pas de chiffrement au repos ni de politique de rétention ; enjeu conformité (loi togolaise) | 🟠 Élevé |
| D9 | **Pas de clés API par organisation ni de clé publique widget** | Bloque les Parties E (widget) et F (API publique) | 🟠 Élevé |
| D10 | **Webhooks « fail-open »** (`verifyVapiWebhook` renvoie `true` sans secret) | Endpoints falsifiables si l'env n'est pas configuré | 🟠 Élevé |
| D11 | **Couverture de tests quasi nulle** (4 fichiers utilitaires) | Aucun test sur l'auth, le multi-tenant, le billing, l'orchestration | 🟡 Moyen |
| D12 | **Table `calls` figée sur Vapi** (`vapi_call_id` NOT NULL UNIQUE) | Ne modélise pas les agents no-code ni les appels non-Vapi (télécom direct, widget) | 🟡 Moyen |
| D13 | **Pas de rate limiting** | Abus API, coûts non maîtrisés | 🟡 Moyen |
| D14 | **`middleware` de protection incomplet et redondant** avec le fallback démo | Cohérence de la protection de routes non garantie | 🟡 Moyen |

---

## 3. Audit de sécurité

Gravité : 🔴 critique · 🟠 élevée · 🟡 moyenne · ⚪ faible.

### S1 — 🔴 Fallback session démo administrateur (contournement d'auth)
`src/lib/auth.ts` : `getUserSession()` renvoie `DEMO_SESSION` (role `admin`,
org fixe `…010`) si `supabase.auth.getUser()` échoue, si l'utilisateur est
introuvable/inactif, **ou sur toute exception**. `src/lib/db/queries.ts`
applique le même patron avec `DEMO_STATS`.
- **Risque** : un visiteur non authentifié obtient une session admin ; toute
  panne d'auth ouvre l'accès ; les données créées le sont sous une org partagée.
  `/admin` n'étant pas dans la liste `protectedRoutes` du middleware, il est
  atteignable, et `isPlatformAdmin(demo)` vaut `true`.
- **Correction** : supprimer tout fallback démo. Une session absente ⇒ `null` ⇒
  401/redirection. Prévoir un vrai « mode démo » cloisonné et opt-in explicite
  (`DEMO_MODE=true`, jamais admin, org démo isolée) si nécessaire pour les démos.

### S2 — 🔴 Isolation multi-tenant sans RLS
Aucune Row-Level Security Postgres ; l'isolation repose uniquement sur des
`WHERE organization_id = …` répétés. Défense en profondeur nulle.
- **Correction** : activer **RLS sur toutes les tables tenant**, poser le
  `organization_id` du contexte via `SET LOCAL app.current_org`, et centraliser
  l'accès DB derrière un helper `withTenant(orgId)`. RLS devient le filet de
  sécurité même si un filtre applicatif est oublié.

### S3 — 🔴 Webhook Shopify → mauvaise organisation
`src/app/api/webhooks/shopify/route.ts` : `db.select().from(organizations).limit(1)`
assigne **toutes** les commandes entrantes à la **première** organisation.
- **Risque** : corruption/fuite de données inter-tenant, appels facturés à la
  mauvaise org.
- **Correction** : table de mapping `shop_domain → organization_id`, résolution
  par `x-shopify-shop-domain`, rejet si non mappé.

### S4 — 🟠 `service_role_key` utilisée comme secret partagé en header
`x-internal-secret === SUPABASE_SERVICE_ROLE_KEY` (webhook Shopify → `/api/calls/initiate`).
La clé service_role est une **clé god-mode** (bypass RLS, accès total DB).
- **Correction** : ne jamais la transmettre en header applicatif. Remplacer par
  un **token interne dédié** (`INTERNAL_JOB_TOKEN`) ou, mieux, un **appel de
  fonction/queue** sans HTTP interne.

### S5 — 🟠 Webhooks « fail-open »
`verifyVapiWebhook` renvoie `true` si `VAPI_WEBHOOK_SECRET` absent ; la route TTS
`tts/ewe/vapi` n'exige le secret que s'il est configuré.
- **Correction** : **fail-closed** — refuser (401) si le secret n'est pas
  configuré ou si la signature ne correspond pas.

### S6 — 🟠 PII non chiffrées, pas de rétention
Transcripts, résumés, `recordingUrl`, numéros de téléphone, `raw_payload`
stockés en clair et indéfiniment.
- **Correction** : chiffrement au repos des champs sensibles (enveloppe
  applicative ou `pgcrypto`), `retention_days` par organisation + job de purge,
  consentement d'enregistrement, journalisation des accès. **Conformité : Togo,
  loi n°2019-014 relative à la protection des données à caractère personnel
  (autorité : IPDCP)** — à documenter comme exigence, pas seulement TODO.

### S7 — 🟠 Absence de clés API / clé publique widget
Aucun mécanisme de clé API par org (Partie F) ni de clé publique + allowlist de
domaines (Partie E). Sans cela, widget et API publique sont non sécurisables.
- **Correction** : `api_keys` (hash SHA-256, préfixe visible, scopes, révocation),
  `public_key` + `allowed_domains` par org, vérif `Origin`/`Referer` côté widget,
  jamais de secret côté client.

### S8 — 🟡 Pas de rate limiting / quotas par plan
- **Correction** : limiteur (par IP + par clé API + par plan) sur l'API publique,
  le widget et l'auth.

### S9 — 🟡 `checkAuthFromRequest` trompeur
Lit le header `authorization` puis l'ignore et appelle `getUserSession()`.
- **Correction** : supprimer ou implémenter réellement l'auth par bearer.

### S10 — 🟡 Exécution de binaires depuis une route web
`tts/ewe/vapi` lance `python` puis `ffmpeg` (`execFile`, args en tableau — pas
d'injection shell, correct). Reste un risque de DoS CPU et une dépendance à un
environnement non serverless.
- **Correction** : déporter le TTS dans le microservice voix (comme OpenVoice),
  derrière une interface `TextToSpeechProvider`.

> **Point positif** : aucun secret réel n'est commité (`.env*` bien ignoré,
> seul `.env.example` avec placeholders), les webhooks e-commerce vérifient
> l'HMAC, `crypto.timingSafeEqual` est utilisé, les Server Actions admin passent
> par `requirePlatformAdmin(permission)`, les mutations wallet sont
> transactionnelles. Ces acquis sont conservés.

---

## 4. Liste des bugs

| # | Bug | Fichier | Effet |
|---|---|---|---|
| B1 | Commandes Shopify assignées à `organizations.limit(1)` | `webhooks/shopify/route.ts` | Mauvais tenant (= S3) |
| B2 | `analyzeCallOutcome` **retourne `confirmed` par défaut** si aucun mot-clé | `webhooks/vapi/route.ts` | Fausses confirmations de commande → livraisons/facturation erronées |
| B3 | Détection d'issue par sous-chaîne (`"non"`, `"ok"`) | `webhooks/vapi/route.ts` | Faux positifs/négatifs (matches partiels) |
| B4 | Pas d'idempotence sur `end-of-call-report` | `webhooks/vapi/route.ts` | Un renvoi du webhook peut **débiter le wallet deux fois** |
| B5 | Solde vérifié sur estimation fixe 2 min, sans plafond de durée | `billing.ts`, `calls/initiate` | Un appel long peut mettre le wallet **négatif** |
| B6 | Modèle LLM figé `gemini-1.5-flash` | `calls/initiate/route.ts` | Non configurable (= D4) |
| B7 | `getEweCustomVoice()` **throw** si `NEXT_PUBLIC_SITE_URL` absent | `vapi/client.ts` | Échec de tout appel éwé si env non posée |
| B8 | `fetch` interne fire-and-forget non attendu | `webhooks/shopify/route.ts` | Perte silencieuse d'appels si l'appel échoue |
| B9 | Route TTS locale inopérante en serverless | `tts/ewe/vapi/route.ts` | 503 en production Netlify/Vercel |
| B10 | Fallback démo masque les erreurs réelles d'auth/DB | `auth.ts`, `queries.ts` | Bugs invisibles en prod (= S1) |
| B11 | Licence **CC-BY-NC** du modèle éwé de démo (`mms-tts-ewe`) utilisée en prod | `scripts/african_tts`, route TTS | **Non-conformité licence commerciale** (voir `DATASETS.md`) |

---

## 5. Architecture cible proposée

### 5.1 Principes

1. **Séparation stricte en couches** : `API/UI → Services (domaine) → Providers
   (abstractions) → Données`. Aucune route ne parle directement à un SDK externe.
2. **Providers enfichables** : chaque capacité externe est une interface avec
   plusieurs implémentations sélectionnables par configuration. Vapi devient une
   stratégie « pipeline managé », à côté du pipeline auto-hébergé.
3. **Multi-tenant par défaut** : RLS Postgres + contexte tenant unique par
   requête ; le code applicatif ne peut pas contourner l'isolation.
4. **Temps réel découplé** : un pont média (WebSocket) relie la source audio
   (télécom ou widget) à l'orchestrateur `VoiceAgentPipeline` en streaming.
5. **Fiabilité par file d'attente** : les appels sortants passent par une file,
   pas par des `fetch` fire-and-forget.
6. **Sécurité et conformité intégrées** : clés API/hash, clé publique + allowlist
   widget, chiffrement PII, rétention configurable, rate limiting par plan.

### 5.2 Schéma en couches

```
┌───────────────────────────────────────────────────────────────┐
│ UI (dashboard, studio no-code, page démo widget)               │
│ API publique REST (F)  ·  Widget embarquable (E)               │
├───────────────────────────────────────────────────────────────┤
│ SERVICES DOMAINE                                               │
│  AgentService · CallService · BillingService · KnowledgeService│
│  ApiKeyService · TenantContext · RetentionService              │
├───────────────────────────────────────────────────────────────┤
│ CORE TEMPS RÉEL                                               │
│  VoiceAgentPipeline (STT→[Traduction]→LLM→[Traduction]→TTS)   │
│  Turn-taking / VAD / barge-in · MediaBridge (WebSocket)       │
│  CallQueue (file d'attente d'appels sortants)                 │
├───────────────────────────────────────────────────────────────┤
│ PROVIDERS (interfaces + implémentations)                      │
│  SpeechToTextProvider   → Whisper/faster-whisper · (Vapi/Deepgram)│
│  LLMProvider            → Claude (Haiku/Sonnet/Fable/Opus) · Gemini│
│  TranslationProvider    → LLM-based (Claude) · stub NLLB(NC, off)│
│  TextToSpeechProvider   → OpenVoice V2 · Piper/Kokoro · 11labs │
│  TelephonyProvider      → Africa's Talking · Twilio (stub)     │
├───────────────────────────────────────────────────────────────┤
│ DONNÉES : PostgreSQL + Drizzle + RLS · Storage (audio) · cache │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 Interfaces providers (contrats visés)

```ts
interface SpeechToTextProvider {
  transcribeStream(audio: AsyncIterable<AudioChunk>, opts: SttOptions):
    AsyncIterable<Transcript>;                 // partiels + finaux
}
interface LLMProvider {
  complete(msgs: ChatMessage[], opts: LlmOptions): AsyncIterable<TextDelta>;
}
interface TranslationProvider {
  translate(text: string, from: Lang, to: Lang): Promise<string>;
}
interface TextToSpeechProvider {
  synthesizeStream(text: AsyncIterable<string>, opts: TtsOptions):
    AsyncIterable<AudioChunk>;
}
interface TelephonyProvider {
  makeCall(p: OutboundCallParams): Promise<CallHandle>;
  handleInbound(req: InboundCallRequest): Promise<MediaSession>;
  // streaming audio bidirectionnel via MediaBridge
}
```

Chaque provider est instancié par une **factory config-driven** (variables
d'env + config par agent). Une capacité non déployée ⇒ **implémentation stub
documentée** qui échoue proprement (jamais de fausse implémentation), conformément
à la contrainte impérative n°1.

### 5.4 LLM configurable (contrainte n°3)

`LLM_MODEL_DEFAULT=claude-sonnet-4-6`, `LLM_MODEL_SIMPLE=claude-haiku-4-5`,
`LLM_MODEL_PREMIUM=claude-fable-5` (ou `claude-opus-4-8`). Surcharge possible
**par agent** (`agents.model`). Haiku/Sonnet par défaut pour maîtriser les coûts,
Fable/Opus réservés aux agents à raisonnement complexe.

### 5.5 Évolution du modèle de données (multi-tenant, no-code, API)

Ajouts (Drizzle + migrations + RLS) :

- `agents` : `organization_id`, `name`, `languages[]`, `voice_config`,
  `system_prompt`, `model`, `telephony_config`, `status`, `public_enabled`.
- `agent_knowledge` : documents/URLs indexés par agent (base de connaissances).
- `agent_scenarios` : scénarios/flux d'appel.
- `call_logs` : généralisation de `calls` (découplée de Vapi ; `provider`,
  `direction` in/out, `agent_id`, PII chiffrées, `channel` phone/widget).
- `api_keys` : `organization_id`, `hashed_key`, `prefix`, `scopes[]`,
  `last_used_at`, `revoked_at`.
- `organizations` **étendue** : `public_key`, `allowed_domains[]`, `plan`,
  `retention_days`, mapping e-commerce (`shop_domain`).
- `phone_numbers` : numéros télécom par org (Africa's Talking/Twilio).
- `usage_counters` : compteurs pour rate limiting / quotas par plan.

RLS activée sur toutes ces tables.

### 5.6 Temps réel & scalabilité

- **MediaBridge** : serveur WebSocket (route Node dédiée / worker) qui relie
  l'audio télécom (Africa's Talking/Twilio media streams) **ou** le widget WebRTC
  à `VoiceAgentPipeline`. Streaming bout-en-bout, barge-in (interruption) et VAD
  pour le tour de parole. Objectif latence < 1,5 s en pipelinant STT partiel →
  LLM en flux → TTS en flux.
- **CallQueue** : file d'attente (démarrage : table `call_jobs` + worker, type
  `pg-boss` ; évolutif vers Redis/BullMQ) pour les campagnes sortantes — débit,
  retries, concurrence, idempotence.
- **Stateless API** + workers séparés pour le média (le serverless ne convient
  pas aux connexions longues : prévoir un process Node persistant, cohérent avec
  le `docker-compose` déjà présent).

### 5.7 Sécurité cible (récapitulatif)

RLS partout · suppression du fallback démo · token interne dédié · webhooks
fail-closed · clés API hashées + scopes · clé publique widget + allowlist de
domaines + vérif Origin · chiffrement PII au repos · rétention configurable +
purge · rate limiting par plan · consentement/enregistrement + conformité loi
togolaise n°2019-014.

---

## 6. Plan de refonte et d'implémentation (proposé, après validation)

> Ordre pensé pour **corriger le socle d'abord**, puis construire A→F dessus.
> Chaque phase est livrée avec tests (providers mockés) et sans casser l'existant.

- **Phase 0 — Sécurité & tenancy (socle)** : supprimer le fallback démo (S1/B10),
  activer RLS + `TenantContext` (S2), corriger le mapping Shopify (S3/B1),
  webhooks fail-closed (S5/D10), token interne dédié (S4), idempotence webhook +
  plafond de durée (B4/B5), corriger `analyzeCallOutcome` (B2/B3). Tests
  d'isolation multi-tenant.
- **Phase A — `DATASETS.md`** : déjà rédigé (ressources à licence commerciale
  confirmée). Retirer le modèle CC-BY-NC de la voie de production (B11).
- **Phase B — Couche providers + pipeline** : interfaces STT/LLM/Traduction/TTS,
  `VoiceAgentPipeline` streaming, LLM Claude configurable (D4/B6), TTS OpenVoice
  étendu, stubs documentés pour les briques non déployées. Tests orchestrateur.
- **Phase C — Téléphonie** : `TelephonyProvider`, implémentation Africa's Talking
  (SDK officiel), stub Twilio, `MediaBridge`, `CallQueue`, `TELEPHONY.md`.
- **Phase D — Studio no-code** : schéma `agents`/`agent_knowledge`/`call_logs`,
  UI de création, isolation par `organization_id`.
- **Phase E — Widget** : snippet embarquable, clé publique + allowlist domaines,
  page de démo, canal voix/texte via MediaBridge.
- **Phase F — API publique** : REST documentée, clés API par org, rate limiting
  par plan, `INTEGRATION.md`.

---

## 7. Ce que je conserve vs. ce que je refonds

**Conservé et adapté** : schéma DB de base (tables + index + cascades),
`billing.ts`, vérif HMAC e-commerce, Server Actions admin & permissions,
transactions wallet, adapter OpenVoice, UI dashboard, `docker-compose`/nginx.

**Refondu** : `auth.ts` (suppression démo), tenancy (RLS + contexte), couche
providers (nouvelle), pipeline temps réel (nouveau), `calls`→`call_logs`,
sécurité webhooks/secrets, TTS local déporté en service.

---

## 8. Questions ouvertes avant la refonte (validation requise)

1. **Vapi : on garde ou on remplace ?** Recommandation : **garder Vapi comme
   provider « pipeline managé »** (fonctionne aujourd'hui) *et* construire le
   pipeline auto-hébergé (B/C) en parallèle, sélectionnable par agent. Éviter un
   big-bang.
2. **Périmètre de la refonte immédiate** : tout Phase 0→F d'un coup, ou
   Phase 0 + A validées d'abord puis B→F ? (Recommandation : livrer et valider
   **Phase 0 + `DATASETS.md`** avant d'écrire le reste.)
3. **Cible de déploiement du temps réel** : le média long-running impose un
   process Node persistant (Docker) — Netlify/Vercel serverless ne suffit pas.
   OK pour s'appuyer sur le `docker-compose` existant ?
4. **Traduction commerciale** : pas de modèle open **et** commercial fiable pour
   ces langues (NLLB/MMS/MAFAND sont CC-BY-NC). Recommandation : traduction **par
   LLM Claude** (commercial). OK ?

---

## 9. Statut d'implémentation — Phase 0 (socle) ✅ appliquée

Décisions validées : Vapi **conservé** comme provider managé + pipeline
auto-hébergé à ajouter ensuite ; livraison **Phase 0 seule** avant B→F ; temps
réel sur le **Docker existant**.

Correctifs livrés dans cette phase (avec tests, `typecheck` + `lint` verts,
34 tests passants) :

| Réf. audit | Correctif appliqué | Fichiers |
|---|---|---|
| S1 / B10 | Suppression du fallback session démo admin ; fail-closed (null) ; mode démo opt-in **non-admin** (`DEMO_MODE`) | `lib/auth.ts`, `lib/db/queries.ts` |
| S2 | Helper `withTenant` / `withServiceContext` + migration RLS **prête, à activer par l'opérateur** avec le refactor requêtes (Partie D) | `lib/db/tenant.ts`, `migrations/0007_multi_tenant_rls.sql` |
| S3 / B1 | Webhooks Shopify & WooCommerce routés vers la **bonne organisation** par domaine (rejet si non mappé) | `webhooks/shopify`, `webhooks/woocommerce`, `schema.ts`, `migrations/0006` |
| S4 | Token interne **dédié** (`INTERNAL_JOB_TOKEN`) au lieu de la clé service_role | `lib/internal/jobs.ts`, `calls/initiate`, webhooks e-commerce |
| S5 / D10 | Webhooks **fail-closed** (Vapi, WooCommerce, TTS) si secret absent | `vapi/verify.ts`, `webhooks/woocommerce`, `tts/ewe/vapi` |
| S6 | Colonne `data_retention_days` par org (base rétention PII) | `schema.ts`, `migrations/0006` |
| B2 / B3 | `analyzeOrderCallOutcome` : **plus de confirmation par défaut** (`uncertain`) + matching par racine (fin des faux positifs de sous-chaîne) | `lib/calls/outcome.ts`, `webhooks/vapi` |
| B4 | **Idempotence** du rapport de fin d'appel (anti double-débit du wallet) | `webhooks/vapi` |
| B5 | Garde-fou **durée max d'appel** (`CALL_MAX_DURATION_SECONDS`) | `lib/vapi/assistant-config.ts`, `calls/initiate`, `campaigns/launch` |
| B6 | **Modèle LLM configurable** (env) au lieu de `gemini-1.5-flash` codé en dur | `lib/vapi/assistant-config.ts` + sites d'appel |
| B7 | Voix éwé : **repli gracieux** au lieu d'un `throw` bloquant | `lib/vapi/client.ts` |
| D14 | Middleware : protection étendue à **toutes** les routes dashboard | `middleware.ts` |

**Important — RLS (S2)** : la migration `0007` est fournie **prête mais non
activée automatiquement**. L'activer avant que la couche d'accès aux données ne
route toutes les requêtes tenant via `withTenant()` renverrait des résultats
vides. Elle sera activée avec le refactor en couches (Partie D). Les failles
d'isolation **immédiatement exploitables** (fallback démo, webhooks première-org)
sont, elles, **corrigées dès maintenant**.

**Non couvert par Phase 0 (planifié B→F)** : couche providers complète et
pipeline streaming, téléphonie Africa's Talking, studio agents, widget, API
publique + rate limiting, chiffrement effectif des PII au repos, déport du TTS
local dans le microservice voix.

---

## 10. Statut d'implémentation — Parties B→F ✅ appliquées

| Partie | Livré | Emplacement |
|---|---|---|
| B — Providers | Interfaces `SpeechToTextProvider` / `LLMProvider` / `TranslationProvider` / `TextToSpeechProvider` / `TelephonyProvider` + factory config-driven | `src/lib/providers/` |
| B — LLM | Claude (SSE streaming, tiers Haiku/Sonnet/Fable-Opus par env + par agent) ; Gemini en alternative | `providers/llm/` |
| B — STT | Whisper via endpoint d'inférence configurable (`WHISPER_API_URL`), VAD par silence, streaming par énoncés (limite Whisper documentée) | `providers/stt/whisper.ts` |
| B — Traduction | Par LLM (Claude) — choix documenté (NLLB & co = CC-BY-NC) ; stub NLLB non activable | `providers/translation/` |
| B — TTS | OpenVoice V2 étendu : contrat `/tts` streaming ajouté à l'adapter | `providers/tts/openvoice.ts` |
| B — Orchestrateur | `VoiceAgentPipeline` : streaming bout-en-bout, phrases → TTS pendant la génération, tour de parole, **barge-in**, erreurs par étape (STT fatale, traduction/TTS dégradées, LLM par tour) | `src/lib/pipeline/` |
| C — Téléphonie | Africa's Talking (SDK officiel) : appels sortants + webhook voix + boucle conversation tour-par-tour (limite media streams AT documentée) ; **stub Twilio documenté** (voie < 1,5 s via Media Streams) | `providers/telephony/`, `api/telephony/`, `TELEPHONY.md` |
| D — Studio | Tables `agents` / `agent_knowledge` / `call_logs` (+ `api_keys`), migration 0008 avec policies RLS, service domaine isolé par org, UI no-code `/agents` (création, édition, base de connaissances) | `services/agents.ts`, `(dashboard)/agents/` |
| E — Widget | Script embarquable `widget.js` (texte + voix micro), session par **clé publique + allowlist domaines + token HMAC éphémère**, page démo `/widget-demo` | `public/widget.js`, `api/widget/` |
| F — API publique | REST `/api/v1` (agents CRUD, calls trigger/list/detail), clés API hashées SHA-256 affichées une seule fois, révocation, **rate limiting par plan** (30/120/600 req/min) | `api/v1/`, `security/` |
| Tests | 66 tests : orchestrateur (streaming, barge-in, erreurs par étape, traduction), sécurité (allowlist, tokens, clés API, rate limit), tenant helper, services | `*.test.ts` |
| Docs | `INTEGRATION.md` (env, studio, widget, API), `TELEPHONY.md` (AT + Twilio) | racine |

**Limites honnêtes documentées** : latence tour-par-tour d'Africa's Talking
(3-6 s ; la cible < 1,5 s exige Twilio Media Streams ou le widget) ; rate
limiter et cache audio par instance Node (Redis/S3 avant multi-replicas) ;
STT Whisper par énoncés (pas de partiels intra-énoncé) ; chiffrement PII au
repos et job de purge de rétention encore à câbler en production.
```
