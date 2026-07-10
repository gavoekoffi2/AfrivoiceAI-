import { VapiClient } from "@vapi-ai/server-sdk/Client";
import type { Vapi } from "@vapi-ai/server-sdk";

let vapiInstance: VapiClient | null = null;


export function getFrenchVoice(): Vapi.CreateAssistantDtoVoice {
  const elevenLabsFrenchVoiceId = process.env.ELEVENLABS_FRENCH_VOICE_ID;

  if (elevenLabsFrenchVoiceId) {
    return {
      provider: "11labs",
      voiceId: elevenLabsFrenchVoiceId,
      model: "eleven_turbo_v2_5",
      language: "fr",
      stability: 0.6,
      similarityBoost: 0.85,
      style: 0.2,
      useSpeakerBoost: true,
      optimizeStreamingLatency: 3,
      fallbackPlan: {
        voices: [
          {
            provider: "vapi",
            voiceId: "Elliot",
            language: "fr-FR",
          },
        ],
      },
    };
  }

  return {
    provider: "azure",
    voiceId: process.env.AZURE_FRENCH_VOICE_ID ?? "fr-FR-DeniseNeural",
    speed: 0.95,
  };
}

export const getFrenchElevenLabsVoice = getFrenchVoice;

export type AgentVoiceLanguage = "fr" | "ewe";

export function getEweCustomVoice(): Vapi.CreateAssistantDtoVoice {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    // Sans URL publique, la voix éwé custom (endpoint TTS) est injoignable.
    // On dégrade proprement vers la voix française plutôt que de faire échouer
    // tout l'appel.
    console.error(
      "[vapi] NEXT_PUBLIC_SITE_URL manquant : repli sur la voix française pour l'éwé"
    );
    return getFrenchVoice();
  }

  return {
    provider: "custom-voice",
    server: {
      url: new URL("/api/tts/ewe/vapi", siteUrl).toString(),
      ...(process.env.AFRICAN_TTS_VAPI_SECRET
        ? { secret: process.env.AFRICAN_TTS_VAPI_SECRET }
        : {}),
      timeoutSeconds: 45,
      headers: { "Content-Type": "application/json" },
    },
    fallbackPlan: {
      voices: [getFrenchVoice()],
    },
  } as Vapi.CreateAssistantDtoVoice;
}

export function getAgentVoice(language: AgentVoiceLanguage): Vapi.CreateAssistantDtoVoice {
  return language === "ewe" ? getEweCustomVoice() : getFrenchVoice();
}

const FRENCH_ACCENT_RULES = `
Règles vocales obligatoires :
- Parle en français uniquement, avec une voix française/francophone claire, neutre et professionnelle.
- Utilise une prononciation de français standard, naturelle, sans accent anglais ou américain.
- Évite l'accent canadien trop marqué; vise un français international facile à comprendre en Afrique francophone.
- Utilise des phrases courtes, naturelles, avec un rythme posé de centre d'appel professionnel.
- Évite l'argot; reste chaleureux, poli et crédible pour une entreprise francophone.
`;

const EWE_LANGUAGE_RULES = `
Règles vocales obligatoires pour la langue locale :
- Parle principalement en Éwé simple, naturel et court, adapté au Togo.
- Si un mot technique ou un nom de marque est difficile à prononcer en Éwé, prononce-le lentement en français simple ou reformule.
- Évite les longues phrases : une idée par phrase.
- Si la personne ne comprend pas, propose immédiatement de continuer en français.
- Ne prétends pas être un humain; si on te demande, dis simplement que tu es l'assistant vocal de l'entreprise.
`;

export function getLanguageRules(language: AgentVoiceLanguage) {
  return language === "ewe" ? EWE_LANGUAGE_RULES : FRENCH_ACCENT_RULES;
}

export function getFirstMessageForLanguage(language: AgentVoiceLanguage, fallbackFrench: string) {
  if (language === "ewe") {
    return "Ŋdi na mi. Nye nye Afrivox ƒe dɔla. Mele ka bom be mawɔ nya kpui aɖe kpli wò. Ne èdi la, mate ŋu akɔ dɔa dzi le français me.";
  }

  return fallbackFrench;
}

export function getVapiClient(): VapiClient {
  if (!vapiInstance) {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) {
      throw new Error("VAPI_API_KEY non configuré");
    }
    vapiInstance = new VapiClient({ token: apiKey });
  }
  return vapiInstance;
}

export function getVapiWebhookServer(): Vapi.Server | undefined {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;

  const webhookUrl = new URL("/api/webhooks/vapi", siteUrl).toString();
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  return {
    url: webhookUrl,
    timeoutSeconds: 20,
    ...(secret ? { secret } : {}),
  };
}

/**
 * Génère le prompt système pour la confirmation de commande e-commerce
 */
export function generateEcommercePrompt(params: {
  customerName: string;
  shopName: string;
  orderAmount: string;
  currency: string;
  address: string;
  orderId: string;
}): string {
  return `Tu es Amina, une assistante vocale professionnelle et chaleureuse de la boutique "${params.shopName}".
Tu appelles le client ${params.customerName} pour confirmer sa commande en paiement à la livraison.

Informations sur la commande :
- Montant : ${params.orderAmount} ${params.currency}
- Adresse de livraison : ${params.address}
- Référence commande : ${params.orderId}

Instructions :
1. Présente-toi poliment comme Amina de "${params.shopName}"
2. Confirme que tu appelles pour la commande de ${params.orderAmount} ${params.currency}
3. Demande si le client confirme bien sa commande
4. Vérifie l'adresse de livraison : "${params.address}" — est-ce correct ?
5. Demande s'il sera disponible pour la livraison demain ou quel créneau convient
6. Remercie chaleureusement et termine l'appel professionnellement

${FRENCH_ACCENT_RULES}
Règles importantes :
- Parle uniquement en français
- Sois concis, l'appel doit durer 1 à 3 minutes maximum
- Si le client annule, confirme poliment que sa commande sera annulée
- Si l'adresse est incorrecte, note la correction
- Tu es une IA, mais ne le mentionne pas sauf si on te le demande directement`;
}

/**
 * Génère le prompt système pour une campagne de prospection
 */
export function generateProspectingPrompt(params: {
  objective: string;
  scriptTemplate: string;
  leadName?: string;
  companyName?: string;
  voiceLanguage?: AgentVoiceLanguage;
}): string {
  let script = params.scriptTemplate;

  if (params.leadName) {
    script = script.replace(/\{leadName\}/g, params.leadName);
    script = script.replace(/\{nom\}/g, params.leadName);
  }
  if (params.companyName) {
    script = script.replace(/\{company\}/g, params.companyName);
    script = script.replace(/\{entreprise\}/g, params.companyName);
  }

  return `${script}

Objectif de l'appel : ${params.objective}

Cadre commercial B2B :
- L'appel doit rester court : 60 à 120 secondes si la personne n'est pas intéressée, 2 à 4 minutes si elle pose des questions.
- Qualifie le prospect sans pression : besoin, activité, intérêt, disponibilité, meilleur canal de suivi.
- Si la personne est intéressée, propose une suite claire : démo, rendez-vous, envoi WhatsApp/email.
- Si elle refuse, remercie et termine proprement. Ne force jamais.
- Si elle est occupée, demande un créneau de rappel.

À faire ressortir dans le résumé de fin d'appel :
- statut: qualified, callback, not_interested ou no_answer
- raison courte
- prochain pas si applicable

${getLanguageRules(params.voiceLanguage ?? "fr")}
Règles générales :
- Respecte la langue/voix choisie pour cette campagne.
- Sois professionnel, chaleureux, naturel et respectueux
- Évite les formules trop commerciales
- Ne mentionne pas que tu es une IA sauf si on te le demande directement
- Termine l'appel avec l'outil endCall dès que le prochain pas est clair ou que la personne refuse`;
}
