# Clonage de voix open source — recherche et architecture AfriVoiceAI

Date: 2026-06-20

## Objectif produit

Permettre à une organisation de créer une voix personnalisée, avec consentement explicite, puis de proposer cette voix dans les agents d’appel AfrivoiceAI au même titre que les voix françaises ou les voix locales.

Flux cible :

1. L’utilisateur crée un profil vocal.
2. Il confirme qu’il possède les droits/consentements sur la voix.
3. Il fournit un échantillon audio court et propre.
4. Un worker de clonage génère ou référence une voix utilisable.
5. La voix devient sélectionnable dans les campagnes.
6. Vapi appelle notre endpoint Custom TTS ou un fournisseur externe.

## Résultats GitHub vérifiés

### 1. OpenVoice — recommandé pour MVP

- Repo: https://github.com/myshell-ai/OpenVoice
- Stars observées: ~36.7k
- Licence repo: MIT
- README: V1/V2 sous MIT, gratuit pour usage commercial et recherche.
- Points forts:
  - instant voice cloning,
  - cross-lingual voice cloning,
  - licence commerciale claire,
  - bon choix pour transformer une voix TTS de base en timbre personnalisé.
- Limites:
  - c’est surtout un pipeline de clonage/conversion de timbre ; selon la langue, on doit tester naturel/latence.
  - pour les appels temps réel, il faut un service long-running, idéalement GPU.

Verdict: premier choix pour AfriVoiceAI MVP, surtout parce que la licence est claire.

### 2. VoxCPM2 — très prometteur, plus lourd

- Repo: https://github.com/OpenBMB/VoxCPM
- Stars observées: ~30.8k
- Licence repo: Apache-2.0
- README: commercial-ready, Apache-2.0, 30 langues, controllable voice cloning, streaming possible.
- Points forts:
  - TTS + clonage dans un modèle moderne,
  - style/emotion/vitesse contrôlables,
  - streaming annoncé.
- Limites:
  - modèle 2B, probablement besoin GPU sérieux,
  - à valider sur français africain et langues locales.

Verdict: deuxième piste stratégique pour qualité premium et temps réel.

### 3. GPT-SoVITS — bon few-shot, utilisable en labo

- Repo: https://github.com/RVC-Boss/GPT-SoVITS
- Stars observées: ~58.8k
- Licence repo: MIT
- README: zero-shot avec 5 secondes, few-shot avec 1 minute pour meilleure similarité.
- Points forts:
  - très populaire,
  - Docker disponible,
  - qualité potentiellement bonne après petit entraînement.
- Limites:
  - stack plus complexe,
  - plus orienté WebUI/labo que service SaaS multi-tenant prêt à l’emploi,
  - latence à mesurer.

Verdict: bon candidat pour voix premium après entraînement, pas le plus simple pour MVP rapide.

### 4. RVC — conversion vocale plutôt que TTS complet

- Repo: https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
- Stars observées: ~36k
- Licence repo: MIT
- Points forts:
  - train avec <= 10 min de données,
  - très populaire,
  - utile pour convertir une voix source vers la voix cible.
- Limites:
  - pas un TTS autonome ; il faut d’abord générer l’audio avec un TTS source puis convertir.
  - peut ajouter de la latence.

Verdict: intéressant comme couche de conversion vocale, pas comme moteur principal immédiat.

### 5. Coqui TTS / XTTS

- Repo: https://github.com/coqui-ai/TTS
- Stars observées: ~45.5k
- Licence code: MPL-2.0
- Points forts:
  - toolkit mature,
  - XTTS connu pour clonage zero-shot.
- Risques:
  - vérifier séparément la licence des modèles/poids utilisés ; certains modèles type XTTS ont des licences spécifiques, parfois non idéales pour usage commercial direct.
  - projet/écosystème à surveiller.

Verdict: utile techniquement mais pas mon premier choix commercial sans vérification licence modèle exacte.

### 6. F5-TTS / CosyVoice / Fish Speech / Chatterbox / MetaVoice

- F5-TTS: https://github.com/SWivid/F5-TTS — MIT, bon zero-shot, à tester.
- CosyVoice: https://github.com/FunAudioLLM/CosyVoice — Apache-2.0, multilingue, FastAPI mentionné, à tester.
- Fish Speech: https://github.com/fishaudio/fish-speech — qualité élevée mais licence “Fish Audio Research License”, donc prudence commerciale.
- Chatterbox: https://github.com/resemble-ai/chatterbox — MIT, prometteur, à tester avec API/serveur.
- MetaVoice: https://github.com/metavoiceio/metavoice-src — Apache-2.0, surtout voix anglais US/UK, moins prioritaire Afrique/français.

## Recommandation produit AfriVoiceAI

### Phase 1 — Fondations SaaS sécurisées

Déjà initié:

- table `voice_clone_profiles`,
- page `/voice-cloning`,
- création de profils vocaux,
- consentement obligatoire,
- statut du profil (`draft`, `queued`, `training`, `ready`, etc.),
- sélection du moteur cible (`openvoice`, `voxcpm`, `gpt-sovits`, `rvc`, `external`).

### Phase 2 — Worker de génération

Créer un service séparé, pas dans Netlify serverless :

- Docker + FastAPI,
- GPU si disponible,
- endpoints internes:
  - `POST /clone/profiles/{id}/train-or-register`,
  - `POST /tts/custom` pour générer audio depuis `voiceProfileId`,
  - `GET /profiles/{id}/status`.

### Phase 3 — Intégration Vapi

Pour un clone prêt :

- `voice.provider = "custom-voice"`,
- endpoint Vapi : `/api/tts/custom/vapi?voiceProfileId=...`,
- réponse en `pcm_s16le` mono, sample rate demandé,
- fallback voix française ou locale si erreur.

### Phase 4 — Sécurité et consentement

Obligatoire avant production :

- case consentement explicite,
- horodatage et organisation,
- conservation preuve source / notes,
- possibilité de désactiver/supprimer un clone,
- message anti-usurpation : ne pas cloner une voix sans autorisation.

## Décision recommandée maintenant

1. Garder OpenVoice comme moteur MVP prioritaire.
2. Préparer VoxCPM2 comme moteur premium si GPU disponible.
3. Garder GPT-SoVITS comme labo/few-shot pour qualité supérieure.
4. Ne pas vendre Fish Speech tant que licence commerciale non clarifiée.
5. Ne pas intégrer XTTS commercialement tant que la licence exacte du modèle choisi n’est pas validée.
