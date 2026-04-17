import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession } from "@/lib/auth";
import { getStripeClient, fcfaToUsdCents } from "@/lib/stripe/client";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const checkoutSchema = z.object({
  amountFcfa: z
    .number()
    .int()
    .min(1000, "Minimum 1 000 FCFA")
    .max(5_000_000, "Maximum 5 000 000 FCFA"),
});

export async function POST(req: Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rl = rateLimit(`wallet:checkout:${session.id}`, 5, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Trop de demandes, réessayez dans une minute." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Montant invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { amountFcfa } = parsed.data;
    const stripe = getStripeClient();
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Recharge wallet Afrivoice — ${amountFcfa.toLocaleString(
                "fr-FR"
              )} FCFA`,
              description: "Crédits pour appels IA",
            },
            unit_amount: fcfaToUsdCents(amountFcfa),
          },
          quantity: 1,
        },
      ],
      customer_email: session.email,
      metadata: {
        organizationId: session.organizationId,
        userId: session.id,
        amountFcfa: amountFcfa.toString(),
      },
      success_url: `${baseUrl}/dashboard/wallet?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/wallet?canceled=true`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    logger.error("wallet/checkout", "Erreur création session Stripe", {
      error: String(error),
    });
    return NextResponse.json(
      { error: "Impossible de créer la session de paiement." },
      { status: 500 }
    );
  }
}
