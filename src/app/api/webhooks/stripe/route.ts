import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { wallets, transactions, notifications } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/stripe/client";
import { markWebhookProcessed } from "@/lib/idempotency";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    logger.warn("stripe/webhook", "Signature ou secret manquant");
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    logger.warn("stripe/webhook", "Vérification signature échouée", {
      error: String(err),
    });
    return NextResponse.json(
      { error: "Signature invalide" },
      { status: 400 }
    );
  }

  try {
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true, ignored: event.type });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, action: "unpaid" });
    }

    const organizationId = session.metadata?.organizationId;
    const userId = session.metadata?.userId;
    const amountFcfa = parseInt(session.metadata?.amountFcfa ?? "0", 10);

    if (!organizationId || !amountFcfa || amountFcfa <= 0) {
      logger.error("stripe/webhook", "Metadata incomplètes", {
        sessionId: session.id,
        metadata: session.metadata,
      });
      return NextResponse.json(
        { error: "Metadata incomplètes" },
        { status: 422 }
      );
    }

    const isNew = await markWebhookProcessed({
      provider: "stripe",
      externalId: session.id,
      organizationId,
      payload: session,
    });
    if (!isNew) {
      return NextResponse.json({
        received: true,
        action: "duplicate_ignored",
      });
    }

    const walletResult = await db
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, organizationId))
      .limit(1);

    const wallet = walletResult[0];
    if (!wallet) {
      logger.error("stripe/webhook", "Wallet introuvable", { organizationId });
      return NextResponse.json(
        { error: "Wallet introuvable" },
        { status: 404 }
      );
    }

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        walletId: wallet.id,
        type: "deposit",
        amountFcfa: amountFcfa.toString(),
        description: "Recharge via Stripe",
        status: "completed",
        provider: "stripe",
        providerRef: session.id,
        metadata: {
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
          userId,
        },
      });

      await tx
        .update(wallets)
        .set({
          balanceFcfa: sql`${wallets.balanceFcfa} + ${amountFcfa}`,
          lowBalanceAlertSent: false,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      await tx.insert(notifications).values({
        organizationId,
        type: "system",
        title: "Recharge confirmée",
        body: `${amountFcfa.toLocaleString(
          "fr-FR"
        )} FCFA ajoutés à votre wallet.`,
        link: "/dashboard/wallet",
      });
    });

    logger.info("stripe/webhook", "Recharge enregistrée", {
      organizationId,
      amountFcfa,
      sessionId: session.id,
    });

    return NextResponse.json({ received: true, credited: amountFcfa });
  } catch (error) {
    logger.error("stripe/webhook", "Erreur traitement", {
      error: String(error),
    });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
