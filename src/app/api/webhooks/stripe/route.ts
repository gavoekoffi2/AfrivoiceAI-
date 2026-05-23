import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import { creditWallet, WalletError } from "@/lib/wallet/service";
import { recordWebhookEvent } from "@/lib/webhooks/idempotency";
import { createLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const log = createLogger("stripe/webhook");

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe désactivé" }, { status: 503 });
  }

  const stripe = getStripeClient();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    log.warn("Signature ou secret manquant");
    return NextResponse.json({ error: "Signature manquante" }, { status: 401 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    log.warn("Signature invalide", { error: String(err) });
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  // On ne traite que les événements actionnables. Les autres types sont
  // accusés réception 200 mais SANS être enregistrés comme "consommés",
  // pour permettre un changement de logique futur.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, action: "ignored_type" });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const organizationId = session.metadata?.organizationId;
  const amountFcfaStr = session.metadata?.amountFcfa;

  // Validation des métadonnées AVANT d'enregistrer l'événement idempotent.
  // Si on enregistrait d'abord, un payload mal formé serait définitivement
  // "consommé" et impossible à rejouer après correction.
  if (!organizationId || !amountFcfaStr) {
    log.error("Métadonnées manquantes sur la session Stripe", {
      sessionId: session.id,
    });
    return NextResponse.json(
      { received: true, action: "invalid_metadata" },
      { status: 200 }
    );
  }

  const amountFcfa = parseFloat(amountFcfaStr);
  if (!Number.isFinite(amountFcfa) || amountFcfa <= 0) {
    log.error("Montant Stripe invalide", { amountFcfaStr, sessionId: session.id });
    return NextResponse.json(
      { received: true, action: "invalid_amount" },
      { status: 200 }
    );
  }

  // Sécurité supplémentaire : vérifier que le paiement est bien réussi
  // (status "paid"), pour ne pas créditer une session annulée.
  if (session.payment_status !== "paid") {
    log.warn("Session non payée — ignorée", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return NextResponse.json({ received: true, action: "not_paid" });
  }

  // Idempotency uniquement sur événements validés
  const { isNew } = await recordWebhookEvent({
    source: "stripe",
    externalEventId: event.id,
    organizationId,
    payload: event as never,
  });
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await creditWallet({
      organizationId,
      amountFcfa,
      type: "deposit",
      description: `Recharge Stripe (${session.id})`,
      externalReference: session.id,
      idempotencyKey: `stripe:${session.id}`,
      metadata: {
        stripeSessionId: session.id,
        paymentIntent: session.payment_intent,
      },
    });

    log.info("Wallet rechargé via Stripe", {
      organizationId,
      amountFcfa,
      sessionId: session.id,
    });
  } catch (err) {
    if (err instanceof WalletError && err.code === "duplicate_transaction") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    log.error("Erreur recharge Stripe", { error: String(err) });
    return NextResponse.json({ error: "Erreur recharge" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
