import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orders,
  calls,
  wallets,
  campaigns,
  leads,
  organizations,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getVapiClient,
  generateEcommercePrompt,
  generateProspectingPrompt,
} from "@/lib/vapi/client";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { getUserSession } from "@/lib/auth";
import { normalizePhoneNumber } from "@/lib/utils";
import { verifyInternalSecret } from "@/lib/internal-auth";
import { markWebhookProcessed } from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

type OrderRow = typeof orders.$inferSelect;

export async function POST(req: Request) {
  try {
    const isInternalCall = verifyInternalSecret(
      req.headers.get("x-internal-secret")
    );

    if (isInternalCall) {
      const body = await req.json();
      const { orderId } = body;

      if (!orderId) {
        return NextResponse.json(
          { error: "orderId requis" },
          { status: 400 }
        );
      }

      const orderResult = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      const order = orderResult[0];
      if (!order) {
        return NextResponse.json(
          { error: "Commande introuvable" },
          { status: 404 }
        );
      }

      return await initiateEcommerceCall(order, order.organizationId);
    }

    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rl = rateLimit(`calls:initiate:${session.organizationId}`, 60, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Trop d'appels lancés simultanément." },
        { status: 429 }
      );
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

      const order = orderResult[0];
      if (!order) {
        return NextResponse.json(
          { error: "Commande introuvable" },
          { status: 404 }
        );
      }

      return await initiateEcommerceCall(order, session.organizationId);
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
    logger.error("calls/initiate", "Erreur serveur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

type WalletLockedRow = { balance_fcfa: string };

function firstRow<T>(executeResult: unknown): T | undefined {
  if (Array.isArray(executeResult)) return executeResult[0] as T | undefined;
  const rows = (executeResult as { rows?: unknown[] })?.rows;
  return rows?.[0] as T | undefined;
}

async function checkAndLockWallet(
  organizationId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  // Verrouille la ligne wallet pour éviter les conditions de course
  // (plusieurs appels simultanés ne peuvent pas contourner la vérification de solde).
  const locked = await db.execute(
    sql`SELECT balance_fcfa FROM wallets WHERE organization_id = ${organizationId} FOR UPDATE`
  );
  const row = firstRow<WalletLockedRow>(locked);

  if (!row) {
    return { ok: false, error: "Wallet introuvable", status: 404 };
  }
  if (!hasSufficientBalance(row.balance_fcfa)) {
    return {
      ok: false,
      error: "Solde insuffisant. Rechargez votre wallet.",
      status: 402,
    };
  }
  return { ok: true };
}

async function initiateEcommerceCall(order: OrderRow, organizationId: string) {
  const orgResult = await db
    .select({
      shopName: organizations.shopName,
      name: organizations.name,
      countryCode: organizations.countryCode,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const org = orgResult[0];
  const shopName = org?.shopName ?? org?.name ?? "Notre Boutique";

  // Normalisation stricte — échec explicite si invalide.
  const phoneE164 = normalizePhoneNumber(
    order.customerPhone,
    org?.countryCode || "TG"
  );
  if (!phoneE164) {
    await db
      .update(orders)
      .set({ status: "invalid_phone" })
      .where(eq(orders.id, order.id));
    return NextResponse.json(
      { error: "Numéro de téléphone invalide." },
      { status: 422 }
    );
  }

  // Idempotence : un seul appel lancé par commande, même si webhook rejoué.
  const canLaunch = await markWebhookProcessed({
    provider: "vapi",
    externalId: `order_call_${order.id}`,
    organizationId,
  });
  if (!canLaunch) {
    return NextResponse.json({
      success: true,
      action: "already_launched",
      orderId: order.id,
    });
  }

  // Transaction avec verrouillage de wallet + création de l'appel + mise à jour commande.
  const vapi = getVapiClient();
  const systemPrompt = generateEcommercePrompt({
    customerName: order.customerName,
    shopName,
    orderAmount: order.totalAmount ?? "N/A",
    currency: order.currency,
    address: order.customerAddress ?? "adresse non précisée",
    orderId: order.externalId,
  });

  try {
    // Verrouillage avant l'appel Vapi pour empêcher la double dépense.
    const balanceCheck = await db.transaction(async (tx) => {
      const rows = await tx.execute(
        sql`SELECT balance_fcfa FROM wallets WHERE organization_id = ${organizationId} FOR UPDATE`
      );
      const row = firstRow<WalletLockedRow>(rows);
      if (!row) return { ok: false as const, error: "Wallet introuvable", status: 404 };
      if (!hasSufficientBalance(row.balance_fcfa)) {
        return {
          ok: false as const,
          error: "Solde insuffisant. Rechargez votre wallet.",
          status: 402,
        };
      }
      return { ok: true as const };
    });

    if (!balanceCheck.ok) {
      return NextResponse.json(
        { error: balanceCheck.error },
        { status: balanceCheck.status }
      );
    }

    const callResponse = (await vapi.calls.create({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: {
        number: phoneE164,
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
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
      },
    })) as unknown as { id: string };

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

    logger.info("calls/initiate", "Appel e-commerce lancé", {
      vapiCallId: callResponse.id,
      orderId: order.id,
    });

    return NextResponse.json({
      success: true,
      callId: callResponse.id,
      vapiCallId: callResponse.id,
    });
  } catch (vapiError) {
    logger.error("calls/initiate", "Erreur Vapi (ecommerce)", {
      orderId: order.id,
      error: String(vapiError),
    });
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
  const [leadResult, campaignResult, orgResult] = await Promise.all([
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
    db
      .select({ countryCode: organizations.countryCode })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
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

  if (campaign.status !== "active") {
    return NextResponse.json(
      { error: "La campagne doit être active pour lancer un appel." },
      { status: 409 }
    );
  }

  const phoneE164 = normalizePhoneNumber(
    lead.phone,
    orgResult[0]?.countryCode || "TG"
  );
  if (!phoneE164) {
    await db
      .update(leads)
      .set({ status: "invalid_phone" })
      .where(eq(leads.id, lead.id));
    return NextResponse.json(
      { error: "Numéro de téléphone invalide." },
      { status: 422 }
    );
  }

  const walletCheck = await checkAndLockWallet(organizationId);
  if (!walletCheck.ok) {
    return NextResponse.json(
      { error: walletCheck.error },
      { status: walletCheck.status }
    );
  }

  const systemPrompt = generateProspectingPrompt({
    objective: campaign.objective,
    scriptTemplate: campaign.scriptTemplate,
    leadName: lead.name ?? undefined,
    companyName: lead.company ?? undefined,
  });

  try {
    const vapi = getVapiClient();
    const callResponse = (await vapi.calls.create({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: {
        number: phoneE164,
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
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
      },
    })) as unknown as { id: string };

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

    logger.info("calls/initiate", "Appel prospection lancé", {
      vapiCallId: callResponse.id,
      leadId,
      campaignId,
    });

    return NextResponse.json({ success: true, callId: callResponse.id });
  } catch (vapiError) {
    logger.error("calls/initiate", "Erreur Vapi (prospection)", {
      leadId,
      error: String(vapiError),
    });
    return NextResponse.json(
      { error: "Impossible de lancer l'appel Vapi" },
      { status: 503 }
    );
  }
}
