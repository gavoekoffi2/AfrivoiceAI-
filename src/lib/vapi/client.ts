import { VapiClient } from "@vapi-ai/server-sdk/Client";
import type { Vapi } from "@vapi-ai/server-sdk";

let vapiInstance: VapiClient | null = null;

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

// Garde-fou coût : un appel ne peut pas dépasser 5 minutes
const MAX_CALL_DURATION_SECONDS = 300;

/**
 * Configuration unique de l'assistant vocal (modèle, voix, transcription).
 * Utilisée par tous les points d'entrée qui lancent un appel, pour éviter
 * les divergences (ex. transcription en anglais sur un chemin de code).
 */
export function buildAssistantConfig(params: {
  systemPrompt: string;
  firstMessage: string;
  endCallMessage: string;
  maxTokens?: number;
}): Vapi.CreateAssistantDto {
  return {
    model: {
      provider: "google",
      model: "gemini-1.5-flash",
      messages: [{ role: "system", content: params.systemPrompt }],
      tools: [{ type: "endCall" }],
      maxTokens: params.maxTokens ?? 300,
      temperature: 0.7,
    },
    voice: {
      provider: "11labs",
      voiceId: process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL",
      // Indispensable pour des appels en français
      model: "eleven_multilingual_v2",
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "fr",
    },
    firstMessage: params.firstMessage,
    endCallMessage: params.endCallMessage,
    maxDurationSeconds: MAX_CALL_DURATION_SECONDS,
    artifactPlan: { recordingEnabled: true },
  };
}

/**
 * Extrait l'identifiant du premier appel créé par l'API Vapi
 * (la réponse peut être un appel unique ou un batch).
 */
export function getCreatedCallId(
  callResponse: Vapi.CallsCreateResponse
): string {
  if ("id" in callResponse) {
    return callResponse.id;
  }

  const firstCreatedCall = callResponse.results[0];
  if (!firstCreatedCall) {
    throw new Error("Vapi n'a retourné aucun appel créé");
  }

  return firstCreatedCall.id;
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

Règles générales :
- Parle uniquement en français
- Sois professionnel, chaleureux, naturel et respectueux
- Évite les formules trop commerciales
- Ne mentionne pas que tu es une IA sauf si on te le demande directement
- Termine l'appel avec l'outil endCall dès que le prochain pas est clair ou que la personne refuse`;
}
