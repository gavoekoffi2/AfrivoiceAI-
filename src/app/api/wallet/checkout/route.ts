import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession } from "@/lib/auth";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountFcfa: z
    .number()
    .min(1000, "Montant minimum 1 000 FCFA")
    .max(10_000_000, "Montant maximum 10 000 000 FCFA"),
});

/**
 * Crée une session Stripe Checkout pour recharger le wallet.
 * Le montant est en FCFA mais Stripe gère en EUR (conversion via exchange rate).
 */
export async function POST(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Le paiement par carte n'est pas configuré." },
      { status: 503 }
    );
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`checkout:${session.id}:${ip}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  }

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const exchangeRate = parseFloat(
    process.env.EXCHANGE_RATE_USD_TO_FCFA ?? "600"
  );
  // FCFA → USD → cents
  const amountUsdCents = Math.round((body.amountFcfa / exchangeRate) * 100);

  const stripe = getStripeClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Recharge wallet AfrivoiceAI",
            description: `${body.amountFcfa.toLocaleString("fr-TG")} FCFA de crédits d'appels`,
          },
          unit_amount: amountUsdCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/dashboard/wallet?stripe=success`,
    cancel_url: `${siteUrl}/dashboard/wallet?stripe=cancelled`,
    metadata: {
      organizationId: session.organizationId,
      amountFcfa: body.amountFcfa.toString(),
      userId: session.id,
    },
    customer_email: session.email,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
