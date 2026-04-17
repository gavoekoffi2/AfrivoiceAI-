import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createCampaignSchema } from "@/lib/validations/campaign";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const result = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.organizationId, session.organizationId))
      .orderBy(desc(campaigns.createdAt));

    return NextResponse.json({ campaigns: result });
  } catch (error) {
    logger.error("campaigns", "GET erreur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const validated = createCampaignSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const result = await db
      .insert(campaigns)
      .values({
        organizationId: session.organizationId,
        ...validated.data,
        status: "draft",
      })
      .returning();

    return NextResponse.json({ campaign: result[0] }, { status: 201 });
  } catch (error) {
    logger.error("campaigns", "POST erreur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
