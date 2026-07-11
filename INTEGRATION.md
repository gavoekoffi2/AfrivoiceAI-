# INTEGRATION.md — Guide de configuration et d'intégration

Plateforme AfrivoiceAI : agents vocaux IA multilingues (français, anglais,
éwé, yoruba, haoussa) déployés par téléphone et widget web.

## 1. Architecture (vue d'ensemble)

```
UI (dashboard, studio /agents, démo /widget-demo)
API publique /api/v1/*        Widget /api/widget/*        Télécom /api/telephony/*
        │                            │                            │
        └────────────── Services domaine (agents, call logs) ─────┘
                                     │
                    VoiceAgentPipeline (streaming, barge-in)
                                     │
   STT Whisper · LLM Claude/Gemini · Traduction LLM · TTS OpenVoice · Africa's Talking
                                     │
                    PostgreSQL (Drizzle, multi-tenant) + RLS
```

- **Providers** : interfaces dans `src/lib/providers/types.ts`, sélection par
  env dans `factory.ts`. Une brique non déployée échoue proprement avec un
  message actionnable — la plateforme ne simule jamais une capacité.
- **Licences** : uniquement des ressources à licence commerciale confirmée
  (voir `DATASETS.md`). Le stub NLLB est volontairement non activable.

## 2. Variables d'environnement (nouvelles couches)

```bash
# --- LLM (cerveau conversationnel) ---
LLM_PROVIDER=claude               # claude (défaut) | gemini
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL_SIMPLE=claude-haiku-4-5     # agents simples (FAQ, RDV) — le moins cher
LLM_MODEL_DEFAULT=claude-sonnet-4-6   # conversations standard
LLM_MODEL_PREMIUM=claude-opus-4-8     # raisonnement complexe (ou claude-fable-5)

# --- STT (reconnaissance vocale) ---
STT_PROVIDER=whisper
WHISPER_API_URL=https://votre-serveur-whisper:8000   # endpoint /v1/audio/transcriptions
WHISPER_API_KEY=                    # si le serveur en exige une
WHISPER_MODEL=large-v3

# --- Traduction (fr <-> langues locales) ---
TRANSLATION_PROVIDER=llm            # llm (Claude) | nllb-stub (NON activable, licence NC)
TRANSLATION_MODEL=simple            # tier LLM utilisé pour traduire (Haiku)

# --- TTS (synthèse vocale) ---
TTS_PROVIDER=openvoice              # openvoice | none (mode texte)
OPENVOICE_API_URL=https://votre-serveur-openvoice
OPENVOICE_API_KEY=

# --- Widget ---
WIDGET_SESSION_SECRET=<aléatoire ≥ 16 caractères>

# --- Téléphonie : voir TELEPHONY.md ---
```

Déployer un serveur Whisper compatible : `faster-whisper-server` ou
`speaches` (API OpenAI-compatible `/v1/audio/transcriptions`) — licence MIT,
auto-hébergeable sur le Docker existant ou un GPU dédié.

## 3. Studio d'agents (no-code)

Dashboard → **/agents** :
- créer un agent : nom, langue parlée (fr/en/ee/yo/ha), niveau d'intelligence
  (simple = Haiku, standard = Sonnet, premium = Fable/Opus), personnalité,
  scénario d'appel, message d'accueil, voix OpenVoice clonée (optionnel) ;
- **base de connaissances** : documents texte consultés par l'agent
  (injectés dans son contexte avec budget de troncature) ;
- passer l'agent en statut **Actif** pour l'utiliser ;
- cocher **Exposer au widget** pour l'intégration web.

Multi-tenant : chaque organisation ne voit et ne modifie que ses agents
(`organization_id` dans toutes les requêtes + RLS en base).

## 4. Widget web intégrable

### 4.1 Configurer (une fois par organisation)

Dashboard → /agents → carte **Widget web** : saisir les domaines autorisés
(ex. `monsite.com`). La **clé publique** `pk_…` est générée automatiquement.

### 4.2 Intégrer

Coller sur le site de l'entreprise :

```html
<script src="https://votre-instance.com/widget.js" defer
        data-public-key="pk_xxxxxxxx"
        data-agent-id="UUID_DE_L_AGENT"></script>
```

Un bouton flottant 🎙 apparaît : conversation **texte** et **vocale**
(micro → STT → agent → TTS).

### 4.3 Sécurité du widget

- Seule la **clé publique** transite côté client — jamais de clé secrète.
- Le serveur vérifie l'`Origin` de la page contre l'**allowlist de domaines**
  de l'organisation : un tiers qui copie le snippet sur un autre domaine
  reçoit `403 origin_not_allowed`.
- Les échanges utilisent un **token de session éphémère signé HMAC (30 min)**.
- Rate limiting par clé publique et par agent.

Page de démonstration : `/widget-demo?pk=<clé publique>&agent=<agentId>`.

## 5. API publique REST (`/api/v1`)

### 5.1 Authentification

Créer une clé dans Dashboard → /agents → **API publique** (affichée une seule
fois ; stockage hashé SHA-256 ; révocable).

```
Authorization: Bearer avk_live_...
```

### 5.2 Rate limiting par plan

| Plan | Quota |
|---|---|
| free | 30 req/min |
| pro | 120 req/min |
| enterprise | 600 req/min |

Réponses avec en-têtes `X-RateLimit-Limit / Remaining / Reset` ; dépassement
→ `429 rate_limited`. (Limiteur par instance Node — passer sur Redis avant un
déploiement multi-replicas, voir `src/lib/security/rate-limit.ts`.)

### 5.3 Endpoints

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/v1/agents` | Liste des agents |
| POST | `/api/v1/agents` | Créer un agent |
| GET | `/api/v1/agents/:id` | Détail + base de connaissances |
| PATCH | `/api/v1/agents/:id` | Mise à jour partielle |
| DELETE | `/api/v1/agents/:id` | Suppression |
| POST | `/api/v1/calls` | Déclencher un appel sortant `{ agentId, to }` |
| GET | `/api/v1/calls?agentId=&limit=` | Journal des appels |
| GET | `/api/v1/calls/:id` | Détail : transcript, messages, résumé |

Exemples :

```bash
# Créer un agent
curl -X POST https://votre-instance.com/api/v1/agents \
  -H "Authorization: Bearer avk_live_..." -H "Content-Type: application/json" \
  -d '{"name":"Awa","speakLanguage":"ee","model":"simple",
       "systemPrompt":"Tu renseignes sur les horaires de la mairie.",
       "status":"active"}'

# Déclencher un appel
curl -X POST https://votre-instance.com/api/v1/calls \
  -H "Authorization: Bearer avk_live_..." -H "Content-Type: application/json" \
  -d '{"agentId":"<uuid>","to":"+22890000000"}'

# Récupérer la transcription
curl https://votre-instance.com/api/v1/calls/<callId> \
  -H "Authorization: Bearer avk_live_..."
```

Codes d'erreur : `401 unauthorized` · `403 origin_not_allowed` ·
`404 not_found` · `409 agent_not_active` · `422 invalid_phone` ·
`429 rate_limited` · `502 telephony_error / llm_error` ·
`503 telephony_not_configured / provider_not_deployed / stt_not_configured`.

## 6. Pipeline vocal (Partie B) — points clés

- `VoiceAgentPipeline` (`src/lib/pipeline/`) : STT streaming → LLM streaming →
  découpage en phrases → traduction (si l'agent « pense » en français et parle
  une langue locale) → TTS streaming. L'audio de la première phrase part
  pendant que la suite se génère.
- **Tour de parole** : fin d'énoncé signalée par le STT (VAD par silence) ;
  **barge-in** : l'utilisateur peut couper l'agent (annulation LLM+TTS).
- **Erreurs par étape** : STT fatale ; traduction/TTS dégradées (texte
  conservé) ; LLM échoue le tour sans tuer la session.
- Tests : `src/lib/pipeline/voice-agent-pipeline.test.ts` (providers mockés).

## 7. Données personnelles & conformité

- Les transcripts/enregistrements d'appel sont des **données personnelles**.
- Rétention configurable par organisation (`organizations.data_retention_days`,
  défaut `DATA_RETENTION_DAYS`). Un job de purge doit être planifié en prod
  (cron Docker) — voir AUDIT.md §5.7.
- **Togo : loi n°2019-014** relative à la protection des données à caractère
  personnel (autorité : IPDCP). Obligations principales : information des
  personnes appelées (annonce d'enregistrement), finalité, durée de
  conservation, droit d'accès/suppression. TODO conformité documenté.
- Ne jamais mettre de vraie donnée client dans les bases de connaissances de
  démo.

## 8. Déploiement

Le temps réel (callbacks télécom, TTS, futur MediaBridge WebSocket) requiert
un **process Node persistant** : utiliser le `docker-compose.yml` + nginx du
repo. Netlify/Vercel serverless ne convient pas à ces routes (documenté).
