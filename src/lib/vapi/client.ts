import { VapiClient } from "@vapi-ai/server-sdk/Client";

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
