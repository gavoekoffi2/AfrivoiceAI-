import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { normalizeDomain } from "@/lib/webhooks/tenant";
import * as z from "zod";

const updateSettingsSchema = z.object({
  shopName: z.string().min(1).max(100).optional(),
  name: z.string().min(2).max(100).optional(),
  // Domaines des boutiques connectées (routage des webhooks). Chaîne vide = effacer.
  shopifyDomain: z.string().max(255).optional(),
  wooDomain: z.string().max(255).optional(),
});

export async function GET() {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1);

    if (!org[0]) {
      return NextResponse.json(
        { error: "Organisation introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ organization: org[0] });
  } catch (error) {
    console.error("[settings] GET Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Seuls les propriétaires/administrateurs peuvent modifier l'organisation.
    if (session.role !== "owner" && session.role !== "admin") {
      return NextResponse.json(
        { error: "Droits insuffisants pour modifier ces paramètres." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = updateSettingsSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    // Construire l'objet de mise à jour uniquement avec les champs fournis.
    const data = validated.data;
    const updateData: Partial<typeof organizations.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.shopName !== undefined) updateData.shopName = data.shopName;
    if (data.shopifyDomain !== undefined) {
      updateData.shopifyDomain = normalizeDomain(data.shopifyDomain);
    }
    if (data.wooDomain !== undefined) {
      updateData.wooDomain = normalizeDomain(data.wooDomain);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Aucune modification fournie." },
        { status: 400 }
      );
    }

    const updated = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, session.organizationId))
      .returning();

    return NextResponse.json({ organization: updated[0] });
  } catch (error) {
    console.error("[settings] PATCH Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
