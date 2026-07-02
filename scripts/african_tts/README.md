# African TTS demo

Prototype local pour générer des voix africaines hors du pipeline Vapi.

## Éwé / Togo demo

Modèle utilisé pour démonstration : `facebook/mms-tts-ewe` (Meta MMS-TTS, VITS).

⚠️ Licence du modèle Meta : `cc-by-nc-4.0` — OK pour prototype / démo / investisseurs, pas pour exploitation commerciale directe sans validation juridique ou autre licence.

### Installation isolée

```bash
uv venv .venv-african-tts
uv pip install --python .venv-african-tts/bin/python "transformers>=4.38" "torch" "scipy" "soundfile"
```

### Génération

```bash
.venv-african-tts/bin/python scripts/african_tts/generate_ewe_demo.py \
  --text "Ŋdi na mi. Nye nye AfrivoxAI ƒe gbe ƒe kpɔɖeŋu." \
  --output artifacts/african_tts/ewe_demo.wav
```

Le fichier WAV peut être converti en MP3/OGG avec `ffmpeg` si nécessaire pour l’envoi Telegram.

## Intégration dashboard

- Page : `/african-voices`
- API : `POST /api/tts/ewe/demo`
- Composant : `src/components/shared/african-tts-demo.tsx`

En production, l’API demande une session utilisateur. En développement local elle accepte les requêtes sans session pour faciliter la démonstration. Pour ouvrir volontairement la démo hors session en production, définir `AFRICAN_TTS_DEMO_PUBLIC=true` — à éviter sur un domaine public sans limite de débit, car la génération TTS consomme CPU/RAM.
