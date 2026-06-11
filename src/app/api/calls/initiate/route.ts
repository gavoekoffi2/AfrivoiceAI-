import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import {
  initiateOrderCall,
  initiateLeadCallById,
  initiateTestCall,
} from "@/lib/calls/initiate";

export async function POST(req: Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

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

      const result = await initiateOrderCall(orderResult[0]);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }
      return NextResponse.json({
        success: true,
        callId: result.vapiCallId,
        vapiCallId: result.vapiCallId,
      });
    }

    if (body.testPhone) {
      const result = await initiateTestCall({
        organizationId: session.organizationId,
        phone: String(body.testPhone),
        name: typeof body.name === "string" ? body.name : undefined,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }
      return NextResponse.json({ success: true, callId: result.vapiCallId });
    }

    if (body.leadId && body.campaignId) {
      const result = await initiateLeadCallById(
        body.leadId,
        body.campaignId,
        session.organizationId
      );
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }
      return NextResponse.json({ success: true, callId: result.vapiCallId });
    }

    return NextResponse.json(
      {
        error:
          "Paramètres invalides : orderId, testPhone ou (leadId + campaignId) requis",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[calls/initiate] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
