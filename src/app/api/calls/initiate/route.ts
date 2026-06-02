import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, calls, wallets, campaigns, leads, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  createVapiCall,
  generateEcommercePrompt,
  generateProspectingPrompt,
} from "@/lib/vapi/client";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { getUserSession } from "@/lib/auth";
import { verifyInternalSecret } from "@/lib/webhooks/trigger-call";
import { normalizePhoneNumber } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    // Vérifier l'authentification (via session OU appel interne signé)
    const isInternalCall = verifyInternalSecret(
      req.headers.get("x-internal-secret")
    );

    if (isInternalCall) {
      // Appel depuis le webhook Shopify — récupérer l'org depuis la commande
      const body = await req.json();
      const { orderId } = body;

      const orderResult = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!orderResult[0]) {
        return NextResponse.json(
          { error: "Commande introuvable" },
          { status: 404 }
        );
      }

      return await initiateEcommerceCall(
        orderResult[0],
        orderResult[0].organizationId
      );
    }

    // Appel authentifié depuis le dashboard
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();

    if (body.orderId) {
      const orderResult = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, body.orderId),
            eq(orders.organizationId, session.organizationId)
          )
        )
        .limit(1);

      if (!orderResult[0]) {
        return NextResponse.json(
          { error: "Commande introuvable" },
          { status: 404 }
        );
      }

      return await initiateEcommerceCall(orderResult[0], session.organizationId);
    }

    if (body.leadId && body.campaignId) {
      return await initiateProspectingCall(
        body.leadId,
        body.campaignId,
        session.organizationId
      );
    }

    return NextResponse.json(
      {
        error:
          "Paramètres invalides : orderId ou (leadId + campaignId) requis",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[calls/initiate] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

async function initiateEcommerceCall(
  order: typeof orders.$inferSelect,
  organizationId: string
) {
  // 0. Empêcher un double appel (idempotence) si la commande est déjà en cours
  // d'appel ou déjà confirmée.
  if (order.status === "calling" || order.status === "confirmed") {
    return NextResponse.json(
      {
        error:
          "Un appel est déjà en cours ou la commande est déjà confirmée.",
      },
      { status: 409 }
    );
  }

  // 1. Vérifier le solde du wallet
  const walletResult = await db
    .select()
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);

  const wallet = walletResult[0];
  if (!wallet || !hasSufficientBalance(wallet.balanceFcfa)) {
    return NextResponse.json(
      { error: "Solde insuffisant. Rechargez votre wallet." },
      { status: 402 }
    );
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
    // 4. Lancer l'appel via Vapi
    const callResponse = await createVapiCall({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: {
        number: order.customerPhone,
        name: order.customerName,
      },
      assistant: {
        model: {
          provider: "google",
          model: "gemini-1.5-flash",
          messages: [{ role: "system", content: systemPrompt }],
          maxTokens: 250,
          temperature: 0.7,
        },
        voice: {
          provider: "11labs",
          voiceId:
            process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL",
        },
        firstMessage: `Bonjour ${order.customerName}, c'est Amina de la boutique ${shopName}. Je vous appelle pour confirmer votre commande. Avez-vous quelques instants ?`,
        maxDurationSeconds: 300,
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
      },
    });

    // 5. Enregistrer l'appel + mettre à jour le statut de la commande
    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId: callResponse.id,
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
      `[calls/initiate] Appel e-commerce lancé: ${callResponse.id} pour commande ${order.id}`
    );

    return NextResponse.json({
      success: true,
      callId: callResponse.id,
      vapiCallId: callResponse.id,
    });
  } catch (vapiError) {
    console.error("[calls/initiate] Erreur Vapi:", vapiError);
    // Réinitialiser le statut de la commande
    await db
      .update(orders)
      .set({ status: "pending" })
      .where(eq(orders.id, order.id));

    return NextResponse.json(
      { error: "Impossible de lancer l'appel via Vapi" },
      { status: 503 }
    );
  }
}

async function initiateProspectingCall(
  leadId: string,
  campaignId: string,
  organizationId: string
) {
  // Vérifier le solde
  const walletResult = await db
    .select()
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);

  if (
    !walletResult[0] ||
    !hasSufficientBalance(walletResult[0].balanceFcfa)
  ) {
    return NextResponse.json({ error: "Solde insuffisant." }, { status: 402 });
  }

  // Récupérer le lead et la campagne
  const [leadResult, campaignResult] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(
        and(eq(leads.id, leadId), eq(leads.organizationId, organizationId))
      )
      .limit(1),
    db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, organizationId)
        )
      )
      .limit(1),
  ]);

  const lead = leadResult[0];
  const campaign = campaignResult[0];

  if (!lead || !campaign) {
    return NextResponse.json(
      { error: "Lead ou campagne introuvable" },
      { status: 404 }
    );
  }

  const phone = normalizePhoneNumber(lead.phone, "TG") ?? lead.phone;

  const systemPrompt = generateProspectingPrompt({
    objective: campaign.objective,
    scriptTemplate: campaign.scriptTemplate,
    leadName: lead.name ?? undefined,
    companyName: lead.company ?? undefined,
  });

  try {
    const callResponse = await createVapiCall({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: {
        number: phone,
        name: lead.name ?? undefined,
      },
      assistant: {
        model: {
          provider: "google",
          model: "gemini-1.5-flash",
          messages: [{ role: "system", content: systemPrompt }],
          maxTokens: 300,
          temperature: 0.7,
        },
        voice: {
          provider: "11labs",
          voiceId:
            process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL",
        },
        firstMessage: lead.name
          ? `Bonjour ${lead.name}, comment allez-vous ?`
          : "Bonjour, comment allez-vous ?",
        maxDurationSeconds: 300,
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
      },
    });

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId: callResponse.id,
        leadId,
        type: "prospecting",
        status: "queued",
      });

      await tx
        .update(leads)
        .set({ status: "called" })
        .where(eq(leads.id, leadId));
    });

    return NextResponse.json({ success: true, callId: callResponse.id });
  } catch (vapiError) {
    console.error("[calls/initiate/prospecting] Erreur Vapi:", vapiError);
    return NextResponse.json(
      { error: "Impossible de lancer l'appel Vapi" },
      { status: 503 }
    );
  }
}
