import { VapiClient, Vapi } from "@vapi-ai/server-sdk";

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
 * Crée un appel sortant via Vapi et renvoie l'objet `Call` typé.
 *
 * `calls.create` renvoie une union `Call | CallBatchResponse`. Comme nous
 * créons toujours un appel unique (et non un batch), on restreint le type au
 * `Call` afin d'accéder de façon sûre à `id`, `status`, etc.
 */
export async function createVapiCall(
  request: Vapi.CreateCallDto
): Promise<Vapi.Call> {
  const response = await getVapiClient().calls.create(request);
  return response as Vapi.Call;
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

Règles générales :
- Parle en français, sois professionnel et respectueux
- Si la personne n'est pas disponible, propose de rappeler
- Ne sois pas insistant si la personne refuse clairement
- Sois naturel et évite les formules trop commerciales`;
}
