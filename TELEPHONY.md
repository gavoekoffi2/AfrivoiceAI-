# TELEPHONY.md — Infrastructure d'appels téléphoniques

Les appels réels nécessitent un fournisseur télécom. **Sans fournisseur
configuré, la plateforme ne passe aucun appel** : l'API répond
`503 telephony_not_configured` (jamais de faux appel simulé).

Architecture : interface `TelephonyProvider`
(`src/lib/providers/types.ts`) avec deux implémentations :

| Provider | Fichier | État | Media streaming temps réel |
|---|---|---|---|
| **Africa's Talking** | `providers/telephony/africas-talking.ts` | ✅ implémenté (SDK officiel) | ❌ non supporté par AT → mode tour-par-tour |
| **Twilio** | `providers/telephony/twilio-stub.ts` | 🔶 stub documenté | ✅ (Media Streams) une fois branché |

Sélection : `TELEPHONY_PROVIDER=africas-talking` (défaut) ou `twilio`.

---

## 1. Africa's Talking (recommandé pour le Togo / Afrique de l'Ouest)

### 1.1 Obtenir un compte et un numéro

1. Créer un compte sur <https://africastalking.com> (choisir le pays de
   facturation ; le Togo est couvert via l'offre Voice internationale).
2. Dans le dashboard : **Voice → Phone Numbers → Buy Number**. Choisir un
   numéro vocal (les numéros locaux disponibles varient par pays ; pour le
   Togo, vérifier la disponibilité auprès du support AT — sinon un numéro
   international fonctionne pour les appels sortants).
3. Générer une clé API : **Settings → API Key**.
4. Pour tester sans payer : utiliser l'username `sandbox` + le
   [simulateur AT](https://developers.africastalking.com/simulator).

### 1.2 Configuration AfrivoiceAI

```bash
AFRICASTALKING_API_KEY=atsk_...
AFRICASTALKING_USERNAME=votre_username      # "sandbox" pour les tests
AFRICASTALKING_PHONE_NUMBER=+228XXXXXXXX    # numéro acheté (E.164)
AFRICASTALKING_CALLBACK_TOKEN=<token aléatoire ≥ 16 caractères>
AFRICASTALKING_INBOUND_AGENT_ID=<uuid agent> # agent des appels ENTRANTS
```

### 1.3 Configurer le callback voix

Dans le dashboard AT : **Voice → Callback URL** :

```
https://votre-instance.com/api/telephony/africas-talking/voice?token=<AFRICASTALKING_CALLBACK_TOKEN>
```

⚠️ **Sécurité** : Africa's Talking ne signe pas ses callbacks voix (pas de
HMAC). La protection repose sur ce token secret d'URL, vérifié en temps
constant, **fail-closed** (callbacks refusés si le token n'est pas configuré).

### 1.4 Comment la conversation fonctionne (et sa limite)

Africa's Talking **ne fournit pas de flux média bidirectionnel temps réel**
(pas d'équivalent des Twilio Media Streams). La conversation IA passe donc
par un **mode tour-par-tour** :

```
Appel connecté → AT appelle notre webhook
  → réponse XML : <Play accueil_TTS/> + <Record/>
L'appelant parle, raccroche le tour (silence ou #)
  → AT rappelle le webhook avec recordingUrl
  → STT (Whisper) → VoiceAgentPipeline (LLM + traduction) → TTS (OpenVoice)
  → réponse XML : <Play réponse/> + <Record/>  (boucle)
Fin d'appel → callback isActive=0 → clôture du call_log
```

**Latence honnête** : chaque tour coûte le temps enregistrement + STT + LLM +
TTS, soit typiquement **3 à 6 s** — au-dessus de l'objectif < 1,5 s.
L'objectif < 1,5 s nécessite un provider à media streaming (Twilio, ou le
widget web qui parle directement au pipeline). C'est une limite d'Africa's
Talking, pas du pipeline : `VoiceAgentPipeline` est streaming de bout en bout
et atteint la cible dès que le canal audio l'est aussi.

Dégradations prévues :
- TTS OpenVoice indisponible → repli `<Say>` (TTS intégré AT, qualité moindre) ;
- STT non configuré → message d'excuse et fin d'appel propre.

### 1.5 Appels sortants

`POST /api/v1/calls` (voir INTEGRATION.md) → `makeCall` via le SDK officiel
`africastalking`. Le `clientRequestId` porte `organizationId:agentId`, ce qui
permet au webhook de retrouver l'agent au décroché.

---

## 2. Twilio (second provider — stub documenté)

Le stub `TwilioTelephonyStub` échoue proprement (`NotDeployedError`) : il ne
simule jamais un appel. Pour l'activer réellement :

1. `npm install twilio`
2. Configurer :
   ```bash
   TELEPHONY_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   ```
3. Remplacer le stub par l'implémentation :
   - `makeCall` : `client.calls.create({ to, from, twiml })` avec un TwiML
     `<Connect><Stream url="wss://votre-instance/media"/></Connect>` ;
   - un **MediaBridge WebSocket** (process Node persistant du conteneur
     Docker, PAS serverless) qui relie les frames audio μ-law 8 kHz de Twilio
     au `VoiceAgentPipeline` (interface `MediaSession` déjà définie dans
     `providers/types.ts`).

C'est la voie recommandée pour la latence < 1,5 s au téléphone : le pipeline
streaming existant s'y branche sans modification.

---

## 3. Vapi (pipeline managé existant — conservé)

L'intégration Vapi historique (e-commerce + prospection) reste fonctionnelle
et inchangée : Vapi gère STT+LLM+TTS+télécom de bout en bout, avec webhooks
signés. Les nouvelles Parties B/C n'y touchent pas — Vapi est une stratégie
« pipeline managé » à côté du pipeline auto-hébergé.

---

## 4. Récapitulatif des variables

```bash
TELEPHONY_PROVIDER=africas-talking   # ou "twilio" (stub)
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
AFRICASTALKING_PHONE_NUMBER=
AFRICASTALKING_CALLBACK_TOKEN=
AFRICASTALKING_INBOUND_AGENT_ID=
# Twilio (une fois le stub remplacé)
# TWILIO_ACCOUNT_SID= / TWILIO_AUTH_TOKEN= / TWILIO_PHONE_NUMBER=
```
