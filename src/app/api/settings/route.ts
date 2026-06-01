import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as z from "zod";

// Données propres à l'organisation connectée : jamais mises en cache.
export const dynamic = "force-dynamic";

const updateSettingsSchema = z.object({
  // shopName peut être vidé (chaîne vide) pour le réinitialiser.
  shopName: z.string().max(100).optional(),
  name: z.string().min(2).max(100).optional(),
  // Domaine boutique normalisé (sans protocole ni slash final) ; "" => null
  // (null requis pour ne pas violer la contrainte unique entre organisations).
  shopDomain: z
    .string()
    .max(255)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const cleaned = v
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .toLowerCase();
      return cleaned === "" ? null : cleaned;
    }),
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

    try {
      const updated = await db
        .update(organizations)
        .set(validated.data)
        .where(eq(organizations.id, session.organizationId))
        .returning();

      return NextResponse.json({ organization: updated[0] });
    } catch (dbError) {
      // Violation de contrainte unique (domaine déjà associé à une autre org).
      if (
        dbError instanceof Error &&
        /duplicate key|unique/i.test(dbError.message)
      ) {
        return NextResponse.json(
          { error: "Ce domaine de boutique est déjà utilisé." },
          { status: 409 }
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error("[settings] PATCH Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
