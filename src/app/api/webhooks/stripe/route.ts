import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import { creditWallet, WalletError } from "@/lib/wallet/service";
import { recordWebhookEvent } from "@/lib/webhooks/idempotency";
import { createLogger } from "@/lib/utils/logger";

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

  const { isNew } = await recordWebhookEvent({
    source: "stripe",
    externalEventId: event.id,
    payload: event as never,
  });
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const organizationId = session.metadata?.organizationId;
    const amountFcfaStr = session.metadata?.amountFcfa;

    if (!organizationId || !amountFcfaStr) {
      log.error("Métadonnées manquantes sur la session Stripe", {
        sessionId: session.id,
      });
      return NextResponse.json({ received: true, action: "skipped" });
    }

    const amountFcfa = parseFloat(amountFcfaStr);
    if (!Number.isFinite(amountFcfa) || amountFcfa <= 0) {
      return NextResponse.json({ received: true, action: "invalid_amount" });
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
  }

  return NextResponse.json({ received: true });
}
