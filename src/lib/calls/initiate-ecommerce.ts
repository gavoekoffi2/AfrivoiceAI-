import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { orders, calls, wallets, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getVapiClient,
  generateEcommercePrompt,
  getFrenchElevenLabsVoice,
  getVapiWebhookServer,
} from "@/lib/vapi/client";
import { hasSufficientBalance } from "@/lib/utils/billing";
import type { Vapi } from "@vapi-ai/server-sdk";

export type EcommerceCallResult =
  | { ok: true; vapiCallId: string }
  | { ok: false; status: number; error: string; details?: string };

function getCreatedCallId(callResponse: Vapi.CallsCreateResponse): string {
  if ("id" in callResponse) {
    return callResponse.id;
  }

  const firstCreatedCall = callResponse.results[0];
  if (!firstCreatedCall) {
    throw new Error("Vapi n'a retourné aucun appel créé");
  }

  return firstCreatedCall.id;
}

export function summarizeCallStartError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 600);
  }

  if (typeof error === "string") {
    return error.slice(0, 600);
  }

  try {
    return JSON.stringify(error).slice(0, 600);
  } catch {
    return "Erreur inconnue au lancement de l'appel";
  }
}

export function createLocalFailedCallId(): string {
  return `local_failed_${randomUUID()}`;
}

/**
 * Lance l'appel de confirmation e-commerce pour une commande.
 * Utilisé par l'API dashboard ET directement par les webhooks
 * Shopify/WooCommerce (pas d'appel HTTP interne).
 */
export async function startEcommerceConfirmationCall(
  order: typeof orders.$inferSelect,
  organizationId: string
): Promise<EcommerceCallResult> {
  // 1. Vérifier le solde du wallet
  const walletResult = await db
    .select()
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);

  const wallet = walletResult[0];
  if (!wallet || !hasSufficientBalance(wallet.balanceFcfa)) {
    return {
      ok: false,
      status: 402,
      error: "Solde insuffisant. Rechargez votre wallet.",
    };
  }

  // 2. Récupérer le nom de la boutique
  const orgResult = await db
    .select({ shopName: organizations.shopName, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const shopName =
    orgResult[0]?.shopName ?? orgResult[0]?.name ?? "Notre Boutique";

  // 3. Générer le prompt système
  const systemPrompt = generateEcommercePrompt({
    customerName: order.customerName,
    shopName,
    orderAmount: order.totalAmount ?? "N/A",
    currency: order.currency,
    address: order.customerAddress ?? "adresse non précisée",
    orderId: order.externalId,
  });

  try {
    const vapi = getVapiClient();

    // 4. Lancer l'appel via Vapi
    const callResponse = await vapi.calls.create({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: {
        number: order.customerPhone,
        name: order.customerName,
      },
      assistant: {
        server: getVapiWebhookServer(),
        model: {
          provider: "google",
          model: "gemini-1.5-flash",
          messages: [{ role: "system", content: systemPrompt }],
          tools: [{ type: "endCall" }],
          maxTokens: 250,
          temperature: 0.7,
        },
        voice: getFrenchElevenLabsVoice(),
        firstMessage: `Bonjour ${order.customerName}, c'est Amina de la boutique ${shopName}. Je vous appelle pour confirmer votre commande. Avez-vous quelques instants ?`,
        endCallMessage: "Merci beaucoup. Je vous souhaite une excellente journée.",
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
      },
    });
    const vapiCallId = getCreatedCallId(callResponse);

    // 5. Enregistrer l'appel + mettre à jour le statut de la commande
    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId,
        orderId: order.id,
        type: "ecommerce_confirmation",
        status: "queued",
      });

      await tx
        .update(orders)
        .set({ status: "calling" })
        .where(eq(orders.id, order.id));
    });

    console.log(
      `[calls/ecommerce] Appel lancé: ${vapiCallId} pour commande ${order.id}`
    );

    return { ok: true, vapiCallId };
  } catch (vapiError) {
    console.error("[calls/ecommerce] Erreur Vapi:", vapiError);
    const errorSummary = summarizeCallStartError(vapiError);

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId: createLocalFailedCallId(),
        orderId: order.id,
        type: "ecommerce_confirmation",
        status: "failed",
        summary: `Échec lancement Vapi : ${errorSummary}`,
        endedReason: "vapi_create_failed",
      });

      await tx
        .update(orders)
        .set({ status: "pending" })
        .where(eq(orders.id, order.id));
    });

    return {
      ok: false,
      status: 503,
      error: "Impossible de lancer l'appel via Vapi",
      details:
        "L'échec a été enregistré dans l'historique des appels avec le statut failed.",
    };
  }
}
