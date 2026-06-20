# OpenVoice V2 pour AfrivoiceAI

## Décision produit

Moteur principal retenu : **OpenVoice V2** (`myshell-ai/OpenVoice`).

Pourquoi :

- licence MIT, utilisable commercialement ;
- support du français ;
- clonage vocal instantané ;
- intégration plus simple qu’un moteur lourd type CosyVoice/GPT-SoVITS ;
- adapté au MVP AfrivoiceAI : upload audio → profil voix → aperçu → utilisation future dans campagnes.

Chatterbox reste le moteur secondaire à tester pour comparer la qualité française.

## Architecture implémentée côté plateforme

La plateforme ne lance pas OpenVoice directement dans Netlify/serverless. Le clonage voix doit tourner dans un service séparé GPU/CPU long-running.

Variables d’environnement côté AfrivoiceAI :

```bash
OPENVOICE_API_URL=https://votre-service-openvoice.example.com
OPENVOICE_API_KEY=secret-optionnel-pour-appeler-le-service
OPENVOICE_CALLBACK_SECRET=secret-pour-callback-service-vers-afrivoiceai
NEXT_PUBLIC_SITE_URL=https://votre-site-afrivoiceai.netlify.app
```

Flux :

1. L’utilisateur crée un profil dans `/voice-cloning`.
2. Il confirme le consentement.
3. Il ajoute une URL audio de référence `.wav` ou `.mp3`.
4. Il clique sur **Générer OpenVoice**.
5. AfrivoiceAI appelle `POST {OPENVOICE_API_URL}/clone`.
6. Le service retourne immédiatement un statut ou rappelle AfrivoiceAI sur :
   `/api/voice-cloning/openvoice/callback`.
7. La plateforme sauvegarde : statut, ID voix externe, URL d’aperçu audio.

## Contrat attendu du service OpenVoice

### Healthcheck

```http
GET /health
Authorization: Bearer $OPENVOICE_API_KEY
```

Réponse attendue : HTTP 200 si le service est prêt.

### Génération

```http
POST /clone
Authorization: Bearer $OPENVOICE_API_KEY
Content-Type: application/json
```

Payload :

```json
{
  "profileId": "uuid",
  "name": "Voix commerciale",
  "referenceAudioUrl": "https://.../sample.wav",
  "text": "Bonjour, je suis votre assistant AfrivoiceAI...",
  "language": "fr",
  "callbackUrl": "https://site/api/voice-cloning/openvoice/callback"
}
```

Réponse synchrone possible :

```json
{
  "status": "ready",
  "voiceId": "openvoice_xxx",
  "previewAudioUrl": "https://.../preview.wav",
  "message": "Voice generated"
}
```

Ou réponse asynchrone :

```json
{
  "status": "training",
  "message": "Job accepted"
}
```

### Callback vers AfrivoiceAI

```http
POST /api/voice-cloning/openvoice/callback
Authorization: Bearer $OPENVOICE_CALLBACK_SECRET
Content-Type: application/json
```

Payload :

```json
{
  "profileId": "uuid",
  "status": "ready",
  "voiceId": "openvoice_xxx",
  "previewAudioUrl": "https://.../preview.wav",
  "message": "OpenVoice completed"
}
```

## Notes de sécurité

- Ne jamais cloner une voix sans consentement explicite.
- Ne jamais afficher les secrets API dans l’interface.
- Stocker les audios de référence et les previews dans un bucket privé ou signé.
- Ajouter plus tard une validation durée/format audio : idéalement 10 à 30 secondes, voix claire, peu de bruit.

## Prochaine étape technique

Déployer un petit service GPU OpenVoice V2 avec FastAPI qui expose `/health` et `/clone`, puis configurer `OPENVOICE_API_URL` dans Netlify.
