import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import {
  initiateEcommerceCall,
  initiateProspectingCall,
  type InitiateResult,
} from "@/lib/calls/initiate";

function resultToResponse(result: InitiateResult) {
  if (result.ok) {
    return NextResponse.json({
      success: true,
      callId: result.callId,
      vapiCallId: result.callId,
    });
  }

  const statusByCode: Record<typeof result.code, number> = {
    insufficient_balance: 402,
    not_found: 404,
    vapi_error: 503,
  };

  return NextResponse.json(
    { error: result.message },
    { status: statusByCode[result.code] }
  );
}

export async function POST(req: Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

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

      const result = await initiateEcommerceCall(
        orderResult[0],
        session.organizationId
      );
      return resultToResponse(result);
    }

    if (body.leadId && body.campaignId) {
      const result = await initiateProspectingCall(
        body.leadId,
        body.campaignId,
        session.organizationId
      );
      return resultToResponse(result);
    }

    return NextResponse.json(
      {
        error: "Paramètres invalides : orderId ou (leadId + campaignId) requis",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[calls/initiate] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
