# OpenVoice adapter service — contrat minimal

Ce dossier documente le microservice à déployer sur un serveur GPU/CPU séparé.
AfrivoxAI appelle ce service via `OPENVOICE_API_URL`.

## Endpoints nécessaires

- `GET /health` → retourne `{"ok": true}` quand OpenVoice est prêt.
- `POST /clone` → reçoit `profileId`, `referenceAudioUrl`, `text`, `language`, `callbackUrl`.

## Pourquoi pas directement dans Netlify ?

OpenVoice charge des modèles audio lourds et peut nécessiter GPU/ffmpeg/storage temporaire. Netlify/serverless n’est pas adapté pour un moteur vocal long-running.

## Exemple de réponse rapide

```json
{
  "status": "training",
  "message": "Job accepted"
}
```

Puis callback :

```json
{
  "profileId": "uuid",
  "status": "ready",
  "voiceId": "openvoice_uuid",
  "previewAudioUrl": "https://.../preview.wav",
  "message": "OpenVoice completed"
}
```

## Variables côté service

```bash
OPENVOICE_SERVICE_API_KEY=...
OPENVOICE_CALLBACK_SECRET=...
AFRIVOICEAI_CALLBACK_URL=https://votre-site/api/voice-cloning/openvoice/callback
STORAGE_BUCKET=...
```

## Étapes de production

1. Déployer OpenVoice V2 officiel sur VPS/GPU.
2. Ajouter un petit wrapper FastAPI avec `/health` et `/clone`.
3. Stocker les previews générées dans Supabase Storage/S3.
4. Appeler le callback AfrivoxAI avec `OPENVOICE_CALLBACK_SECRET`.
5. Configurer dans AfrivoxAI : `OPENVOICE_API_URL`, `OPENVOICE_API_KEY`, `OPENVOICE_CALLBACK_SECRET`.
