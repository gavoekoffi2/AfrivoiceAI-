# DATASETS.md — Ressources à licence commerciale confirmée

> Cahier des charges, Partie A. **Contrainte non négociable** : le système ne
> doit utiliser QUE des ressources dont l'usage **commercial gratuit** est
> **explicitement confirmé** (CC0, CC-BY, CC-BY-SA, Apache-2.0, MIT). Toute
> ressource en **CC-BY-NC**, « research only », ou à licence ambiguë est
> **exclue** (voir §3).
>
> Chaque licence ci-dessous a été vérifiée sur la source (pages Hugging
> Face / GitHub / site du projet), pas supposée. Dernière vérification :
> **2026-07-10**. Une licence peut changer : **re-vérifier avant mise en
> production** et conserver une copie du fichier `LICENSE` de chaque ressource.

Légende fiabilité : 🟢 confirmée et sans ambiguïté · 🟡 commerciale mais avec
condition à respecter (attribution / share-alike) · 🔵 permissive mais couverture
linguistique/qualité à valider pour la production.

---

## 1. Ressources RETENUES (usage commercial confirmé)

### 1.1 Reconnaissance vocale (STT / ASR)

| Ressource | Langues | Type | Licence | Source | Fiabilité |
|---|---|---|---|---|---|
| **OpenAI Whisper** (large-v3, etc.) | ~100 langues (dont haoussa, yoruba, swahili — qualité variable en africain) | Modèle ASR | **MIT** | github.com/openai/whisper | 🟢 |
| **faster-whisper** (SYSTRAN, CTranslate2) | idem Whisper | Runtime ASR optimisé (streaming, low-latency) | **MIT** | github.com/SYSTRAN/faster-whisper | 🟢 |
| **Mozilla Common Voice** | 100+ langues, dont **haoussa** ; yoruba en cours | Dataset audio+texte (entraînement/fine-tuning ASR/TTS) | **CC0** (domaine public) | commonvoice.mozilla.org | 🟡 (voir note CV) |

**Note Whisper** : MIT sur le code **et** les poids → OK commercial, y compris
inférence auto-hébergée et fine-tuning. Idéal pour le `SpeechToTextProvider` en
streaming (faster-whisper). La qualité brute sur langues africaines peu dotées
est inégale → prévoir fine-tuning sur données commerciales (BibleTTS, Common
Voice) et/ou fallback FR.

**Note Common Voice (CV)** : CC0 = usage commercial libre. **Réserve honnête** :
(a) CC0 n'engage que Mozilla, pas d'éventuels droits de tiers dans les
enregistrements ; (b) la couverture des langues africaines visées (éwé, etc.)
reste **mince**. À utiliser comme **données de fine-tuning**, pas comme garantie
de qualité production. Conserver le hash de version du dataset utilisé.

### 1.2 Synthèse vocale (TTS)

| Ressource | Langues | Type | Licence | Source | Fiabilité |
|---|---|---|---|---|---|
| **OpenVoice V2** (MyShell/MIT) | multilingue + clonage de tonalité (EN, FR, ES, ZH, JA, KO natifs) | Modèle TTS / clonage voix | **MIT** (depuis avril 2024) | github.com/myshell-ai/OpenVoice | 🟢 |
| **BibleTTS** | **Éwé, Haoussa, Yoruba**, Akuapem/Asante Twi, Chichewa, Kikuyu, Lingala, Luganda, Luo | Corpus TTS studio 48 kHz (~86 h/langue) | **CC-BY-SA 4.0** | github.com/masakhane-io/bibleTTS · masakhane.io/bibleTTS | 🟡 |
| **Kokoro-82M** (hexgrad) | anglais + quelques langues ; modèle léger 82M | Modèle TTS | **Apache-2.0** | huggingface.co/hexgrad/Kokoro-82M | 🔵 |
| **Piper** (rhasspy, version MIT archivée) | multi-langues (voix communautaires, licences par voix à vérifier) | Moteur TTS local rapide | **MIT** (dépôt `rhasspy/piper` archivé) | github.com/rhasspy/piper | 🟡 |

**Note BibleTTS** — **pièce maîtresse pour l'africain** : c'est, à ce jour, le
corpus TTS **studio, haute-fidélité, commercialement exploitable** couvrant
directement **éwé, haoussa, yoruba**. Licence **CC-BY-SA 4.0** → commercial OK
**à deux conditions** : (a) **attribution** de la source ; (b) **share-alike** —
si l'on redistribue une œuvre dérivée du *dataset*, elle doit rester sous
CC-BY-SA. Un **modèle TTS entraîné** sur ces données est généralement considéré
comme utilisable commercialement, mais le partage du modèle dérivé doit
respecter le share-alike du dataset → **documenter l'attribution** et **isoler**
tout artefact dérivé. À faire valider juridiquement avant diffusion externe du
modèle.

**Note Piper** : le dépôt historique `rhasspy/piper` (**MIT**) est **archivé
(oct. 2025)** ; le fork maintenu `OHF-Voice/piper1-gpl` est **GPL-3.0**. Pour
rester en licence permissive, épingler la version MIT archivée. **Attention** :
chaque **voix** Piper a sa propre licence — vérifier voix par voix (certaines
sont dérivées de datasets non commerciaux).

### 1.3 Cerveau conversationnel (LLM) & Traduction

| Ressource | Rôle | Licence / modèle commercial | Source | Fiabilité |
|---|---|---|---|---|
| **Claude API** (Haiku 4.5 / Sonnet 4.6 / Fable 5 / Opus 4.8) | LLM (dialogue, intention) **et** traduction FR↔langue locale | **API commerciale payante** (pas « gratuite » mais commercialement licite) | anthropic.com | 🟢 |
| **Google Gemini** (déjà intégré) | LLM alternatif via provider | API commerciale payante | ai.google.dev | 🟢 |

**Point de vigilance traduction** : il **n'existe pas** de modèle **open ET
gratuit ET commercial** fiable pour la traduction de ces langues africaines —
les meilleurs (NLLB-200, Meta MMS-MT, MAFAND-MT) sont tous **CC-BY-NC** (exclus,
§3). La voie commerciale retenue est donc la **traduction par LLM** (Claude), via
l'interface `TranslationProvider`. Un provider NLLB reste possible **en stub
désactivé** (documenté « non-commercial — ne pas activer en production »).

> **Distinction importante** « gratuit » vs « commercialement licite » : Whisper,
> OpenVoice, BibleTTS, Common Voice sont **gratuits ET commerciaux**. Claude/Gemini
> sont **payants mais commercialement licites** — ils ne violent aucune contrainte
> de licence ; ils ont un coût d'usage, à distinguer d'une interdiction juridique.

---

## 2. Cartographie ressource → composant du pipeline

| Composant (Partie B/C) | Ressource commerciale retenue | Repli / note |
|---|---|---|
| `SpeechToTextProvider` | faster-whisper (MIT), fine-tuné sur Common Voice/BibleTTS | Vapi/Deepgram (managé, payant) comme alternative |
| `LLMProvider` | Claude (Haiku/Sonnet défaut, Fable/Opus premium) | Gemini |
| `TranslationProvider` | Claude (LLM-based) | stub NLLB **désactivé** (NC) |
| `TextToSpeechProvider` | OpenVoice V2 (MIT) + voix entraînées sur BibleTTS (éwé/haoussa/yoruba) | Kokoro/Piper (MIT/Apache), 11labs (managé) |
| Données d'entraînement TTS africain | **BibleTTS** (CC-BY-SA) + Common Voice (CC0) | — |

---

## 3. Ressources REJETÉES (non conformes — usage commercial interdit ou non confirmé)

> Listées explicitement pour tracer la décision et **éviter toute réintroduction
> accidentelle**. À ne PAS utiliser dans la voie de production.

| Ressource | Type | Licence constatée | Raison du rejet |
|---|---|---|---|
| **Meta MMS-TTS** (`facebook/mms-tts-*`, dont `mms-tts-ewe`) | TTS 1000+ langues | **CC-BY-NC-4.0** | Non-commercial. ⚠️ **Utilisé aujourd'hui dans le prototype éwé** (`scripts/african_tts`, route `tts/ewe/vapi`) → **à retirer de la prod** (bug B11 de l'audit) |
| **Meta MMS-ASR** (`facebook/mms-1b-all`, `mms-1b`) | ASR | **CC-BY-NC-4.0** | Non-commercial |
| **Meta NLLB-200** (toutes tailles) | Traduction 200 langues | **CC-BY-NC-4.0** | Non-commercial |
| **Coqui XTTS v2** | TTS / clonage | **CPML** (Coqui Public Model License, non-commercial) | Non-commercial ; Coqui fermé (janv. 2024) → aucune licence commerciale achetable |
| **Masakhane MAFAND-MT** (dataset) | Traduction | **CC-BY-NC-4.0** | Non-commercial (le code est Apache-2.0, mais le **dataset/poids** est NC) |
| **NaijaVoices** | Corpus voix (yoruba, igbo, haoussa) | **CC-BY-NC-SA-4.0** | Non-commercial par défaut ; commercial seulement via adhésion payante → hors « gratuit » |
| **WAXAL** | Corpus ASR/TTS 24 langues | **Non confirmée** au moment de la vérif | Licence non clairement commerciale → exclu par principe de précaution (contrainte n°2) |
| **ALFFA** (Wolof/Fongbe/Amharic/Swahili) | ASR | **Non confirmée précisément** | À exclure tant que la licence commerciale n'est pas confirmée par fichier `LICENSE` |

---

## 4. Règles d'usage (à appliquer dans le code)

1. **Toute nouvelle ressource** passe par cette checklist avant intégration :
   licence lue à la source · commercial explicitement autorisé · fichier
   `LICENSE` archivé · version/commit épinglé · attribution ajoutée si CC-BY(-SA).
2. **BibleTTS / CC-BY-SA** : maintenir un fichier `ATTRIBUTIONS.md` et isoler les
   artefacts dérivés (share-alike).
3. **Aucune ressource CC-BY-NC** dans la voie de production. Les providers
   correspondants existent uniquement en **stub désactivé et documenté**.
4. **Retirer `mms-tts-ewe`** de la voie de production (remplacer par une voix
   TTS entraînée sur BibleTTS ou OpenVoice) — planifié en Phase A/B de la refonte.

---

## Sources

- Whisper — MIT : <https://github.com/openai/whisper/blob/main/LICENSE>
- faster-whisper — MIT : <https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE>
- Common Voice — CC0 : <https://commonvoice.mozilla.org/> · <https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0>
- OpenVoice V2 — MIT : <https://github.com/myshell-ai/OpenVoice> · <https://huggingface.co/myshell-ai/OpenVoiceV2>
- BibleTTS — CC-BY-SA 4.0 : <https://masakhane.io/bibleTTS> · <https://arxiv.org/abs/2207.03546>
- Kokoro-82M — Apache-2.0 : <https://huggingface.co/hexgrad/Kokoro-82M>
- Piper — MIT (archivé) / GPL-3.0 (fork) : <https://github.com/rhasspy/piper>
- Meta MMS — CC-BY-NC-4.0 : <https://huggingface.co/facebook/mms-tts>
- NLLB-200 — CC-BY-NC-4.0 : <https://huggingface.co/facebook/nllb-200-distilled-600M>
- Coqui XTTS v2 — CPML : <https://huggingface.co/coqui/XTTS-v2/blob/main/LICENSE.txt>
- MAFAND-MT — dataset CC-BY-NC-4.0 : <https://github.com/masakhane-io/lafand-mt>
- NaijaVoices — CC-BY-NC-SA-4.0 : <https://huggingface.co/datasets/naijavoices/naijavoices-dataset>
