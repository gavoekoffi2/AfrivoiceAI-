import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { depositSchema } from "@/lib/validations/wallet";
import { creditWallet, WalletError } from "@/lib/wallet/service";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { createLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/wallet/deposit");

export async function POST(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`deposit:${session.id}:${ip}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Trop de tentatives — patientez 1 minute" },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const validated = depositSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Données invalides", details: validated.error.flatten() },
      { status: 400 }
    );
  }

  const { amountFcfa, paymentMethod = "manual" } = validated.data;

  // Idempotency optionnelle via header
  const idempotencyKey =
    req.headers.get("idempotency-key") ?? undefined;

  try {
    const { newBalanceFcfa } = await creditWallet({
      organizationId: session.organizationId,
      amountFcfa,
      type: "deposit",
      description: `Recharge du wallet (${paymentMethod})`,
      metadata: { paymentMethod, requestedBy: session.id },
      idempotencyKey,
    });

    log.info("Wallet rechargé", {
      orgId: session.organizationId,
      amount: amountFcfa,
      newBalance: newBalanceFcfa,
    });

    return NextResponse.json({
      success: true,
      newBalanceFcfa,
      message: `${amountFcfa.toLocaleString("fr-TG")} FCFA ajoutés à votre wallet.`,
    });
  } catch (err) {
    if (err instanceof WalletError) {
      const status = err.code === "duplicate_transaction" ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    log.error("Erreur recharge", { error: String(err) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
