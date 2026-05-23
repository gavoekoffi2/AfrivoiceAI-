import { VapiClient } from "@vapi-ai/server-sdk";
import { requireEnv } from "@/lib/utils/env";
import { withRetry } from "@/lib/utils/retry";

type VapiInstance = InstanceType<typeof VapiClient>;
type CreateCallPayload = Parameters<VapiInstance["calls"]["create"]>[0];
// La SDK Vapi accepte plus de champs qu'elle n'en type strictement
// (endCallFunctionEnabled, recordingEnabled, tools sur model, etc.).
// On utilise un type laxiste à ce niveau et on caste dans createCall.
type AssistantConfig = Record<string, unknown>;

let vapiInstance: VapiInstance | null = null;

export function getVapiClient(): VapiInstance {
  if (!vapiInstance) {
    const apiKey = requireEnv("VAPI_API_KEY");
    vapiInstance = new VapiClient({ token: apiKey });
  }
  return vapiInstance;
}

/**
 * Prompt e-commerce — confirme une commande COD.
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

Instructions de conversation :
1. Présente-toi poliment comme Amina de "${params.shopName}".
2. Confirme que tu appelles pour la commande de ${params.orderAmount} ${params.currency}.
3. Demande au client s'il confirme bien sa commande.
4. Vérifie l'adresse de livraison : "${params.address}" — est-ce correct ?
5. Demande s'il sera disponible pour la livraison demain ou quel créneau lui convient.
6. À la fin de l'appel, AVANT de raccrocher, tu DOIS appeler l'outil "recordOrderOutcome" avec le résultat exact de la conversation.
7. Remercie chaleureusement et termine l'appel professionnellement.

Règles importantes :
- Parle uniquement en français, ton chaleureux et naturel.
- Sois concis, l'appel doit durer 1 à 3 minutes maximum.
- Si le client annule, confirme poliment que sa commande sera annulée.
- Si l'adresse est incorrecte, note la correction.
- Si tu tombes sur une messagerie vocale, ne laisse pas de message et appelle l'outil "recordOrderOutcome" avec outcome="voicemail" puis raccroche.
- Tu es une IA, mais ne le mentionne pas sauf si on te le demande directement.`;
}

/**
 * Prompt prospection.
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

À la fin de l'appel, AVANT de raccrocher, tu DOIS appeler l'outil "recordProspectingOutcome" avec le résultat exact de la conversation.

Si tu tombes sur une messagerie vocale, ne laisse pas de message, appelle "recordProspectingOutcome" avec outcome="voicemail" puis raccroche.

Règles générales :
- Parle en français, sois professionnel et respectueux.
- Si la personne n'est pas disponible, propose de rappeler.
- Ne sois pas insistant si la personne refuse clairement.
- Sois naturel, évite les formules trop commerciales.`;
}

/**
 * Tool Vapi pour récupérer un résultat structuré à la fin d'un appel
 * e-commerce, plus fiable que l'analyse par mots-clés.
 */
export const ECOMMERCE_OUTCOME_TOOL = {
  type: "function" as const,
  function: {
    name: "recordOrderOutcome",
    description:
      "Enregistre le résultat de la conversation. À appeler obligatoirement avant de raccrocher.",
    parameters: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          enum: ["confirmed", "cancelled", "no_answer", "voicemail", "callback_requested"],
          description: "Issue de la conversation",
        },
        confidence: {
          type: "number",
          description: "Confiance dans la classification, entre 0 et 1",
        },
        address_correction: {
          type: "string",
          description: "Nouvelle adresse fournie par le client, si modifiée",
        },
        delivery_slot: {
          type: "string",
          description: "Créneau de livraison demandé par le client",
        },
        notes: {
          type: "string",
          description: "Notes additionnelles importantes",
        },
      },
      required: ["outcome"],
    },
  },
};

export const PROSPECTING_OUTCOME_TOOL = {
  type: "function" as const,
  function: {
    name: "recordProspectingOutcome",
    description:
      "Enregistre le résultat de l'appel de prospection. À appeler obligatoirement avant de raccrocher.",
    parameters: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          enum: [
            "qualified",
            "not_interested",
            "callback_requested",
            "no_answer",
            "voicemail",
            "wrong_number",
          ],
          description: "Issue de la conversation",
        },
        confidence: {
          type: "number",
          description: "Confiance entre 0 et 1",
        },
        callback_at: {
          type: "string",
          description: "Date/heure de rappel demandée (ISO 8601)",
        },
        notes: {
          type: "string",
          description: "Notes importantes sur le lead",
        },
      },
      required: ["outcome"],
    },
  },
};

/**
 * Construit la config Vapi d'un assistant.
 */
export function buildAssistantConfig(params: {
  systemPrompt: string;
  firstMessage: string;
  outcomeTool: typeof ECOMMERCE_OUTCOME_TOOL | typeof PROSPECTING_OUTCOME_TOOL;
  voiceId?: string;
  maxTokens?: number;
}): AssistantConfig {
  return {
    model: {
      provider: "google",
      model: "gemini-1.5-flash",
      messages: [{ role: "system", content: params.systemPrompt }],
      maxTokens: params.maxTokens ?? 280,
      temperature: 0.7,
      tools: [params.outcomeTool],
    },
    voice: {
      provider: "11labs",
      voiceId:
        params.voiceId ??
        process.env.ELEVENLABS_VOICE_ID ??
        "EXAVITQu4vr4xnSDxMaL",
    },
    firstMessage: params.firstMessage,
    endCallFunctionEnabled: true,
    endCallPhrases: ["au revoir", "bonne journée", "merci, au revoir"],
    recordingEnabled: true,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 300, // 5 min max — protection contre les appels infinis coûteux
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "fr",
    },
    voicemailDetection: {
      provider: "twilio",
      voicemailDetectionTypes: ["machine_end_beep", "machine_end_silence"],
      enabled: true,
      machineDetectionTimeout: 15,
    },
  } as AssistantConfig;
}

/**
 * Crée un appel Vapi avec retry automatique sur erreurs transitoires.
 */
export async function createVapiCallWithRetry(
  payload: CreateCallPayload
): Promise<{ id: string }> {
  const vapi = getVapiClient();
  return withRetry(
    async () => {
      const res = await vapi.calls.create(payload);
      // L'API retourne soit Call (single) soit CallBatchResponse (multiple).
      // On gère explicitement le cas single (le seul utilisé ici).
      if ("id" in res) {
        return { id: res.id };
      }
      // batch : on prend le premier
      const first = res.results?.[0];
      if (!first) {
        throw new Error("Vapi n'a retourné aucun appel");
      }
      return { id: first.id };
    },
    { retries: 2 }
  );
}
