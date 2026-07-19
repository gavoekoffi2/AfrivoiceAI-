import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { normalizeStoreDomain } from "@/lib/store-domain";

const updateSettingsSchema = z.object({
  shopName: z.string().min(1).max(100).optional(),
  name: z.string().min(2).max(100).optional(),
  storeDomain: z.string().max(255).optional(),
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

    const body = await req.json();
    const validated = updateSettingsSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Données invalides" },
        { status: 400 }
      );
    }

    const { storeDomain, ...rest } = validated.data;
    const updatePayload: Record<string, unknown> = { ...rest };

    if (storeDomain !== undefined) {
      if (storeDomain.trim() === "") {
        updatePayload.storeDomain = null;
      } else {
        const normalized = normalizeStoreDomain(storeDomain);
        if (!normalized) {
          return NextResponse.json(
            { error: "Domaine de boutique invalide" },
            { status: 400 }
          );
        }
        updatePayload.storeDomain = normalized;
      }
    }

    const updated = await db
      .update(organizations)
      .set(updatePayload)
      .where(eq(organizations.id, session.organizationId))
      .returning();

    return NextResponse.json({ organization: updated[0] });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Ce domaine de boutique est déjà utilisé par un autre compte." },
        { status: 409 }
      );
    }
    console.error("[settings] PATCH Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
