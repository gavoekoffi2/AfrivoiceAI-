import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

const updateSettingsSchema = z.object({
  shopName: z.string().min(1).max(100).optional(),
  name: z.string().min(2).max(100).optional(),
  countryCode: z
    .string()
    .length(2)
    .transform((v) => v.toUpperCase())
    .optional(),
  timezone: z.string().min(3).max(64).optional(),
  shopifyDomain: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : v))
    .refine((v) => !v || domainRegex.test(v), {
      message: "Domaine Shopify invalide",
    }),
  woocommerceDomain: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : v))
    .refine((v) => !v || domainRegex.test(v), {
      message: "Domaine WooCommerce invalide",
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
    logger.error("settings", "GET erreur", { error: String(error) });
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
        {
          error:
            validated.error.errors[0]?.message ?? "Données invalides",
        },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = {
      ...validated.data,
      updatedAt: new Date(),
    };
    if (validated.data.shopifyDomain === "") patch.shopifyDomain = null;
    if (validated.data.woocommerceDomain === "")
      patch.woocommerceDomain = null;

    try {
      const updated = await db
        .update(organizations)
        .set(patch)
        .where(eq(organizations.id, session.organizationId))
        .returning();
      revalidatePath("/dashboard/settings");
      revalidatePath("/dashboard");
      return NextResponse.json({ organization: updated[0] });
    } catch (err) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code === "23505") {
        return NextResponse.json(
          {
            error:
              "Ce domaine est déjà associé à une autre organisation.",
          },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    logger.error("settings", "PATCH erreur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
