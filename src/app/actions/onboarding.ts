"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

const COUNTRY_CODES = [
  "TG",
  "BJ",
  "CI",
  "SN",
  "ML",
  "BF",
  "NE",
  "CM",
  "GA",
  "CG",
  "CD",
  "FR",
] as const;

const onboardingSchema = z.object({
  shopName: z.string().trim().min(2, "Nom de boutique requis").max(100),
  countryCode: z.enum(COUNTRY_CODES),
  timezone: z.string().trim().min(3).max(64),
  shopifyDomain: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
  woocommerceDomain: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
});

export async function completeOnboardingAction(formData: FormData) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const parsed = onboardingSchema.safeParse({
    shopName: formData.get("shopName"),
    countryCode: formData.get("countryCode"),
    timezone: formData.get("timezone"),
    shopifyDomain: formData.get("shopifyDomain") || undefined,
    woocommerceDomain: formData.get("woocommerceDomain") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  try {
    await db
      .update(organizations)
      .set({
        shopName: parsed.data.shopName,
        countryCode: parsed.data.countryCode,
        timezone: parsed.data.timezone,
        shopifyDomain: parsed.data.shopifyDomain || null,
        woocommerceDomain: parsed.data.woocommerceDomain || null,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, session.organizationId));

    revalidatePath("/dashboard");
    logger.info("onboarding", "Completed", {
      organizationId: session.organizationId,
    });
    return { success: true };
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code;
    if (code === "23505") {
      return {
        error:
          "Ce domaine est déjà utilisé par une autre organisation.",
      };
    }
    logger.error("onboarding", "Erreur", { error: String(err) });
    return { error: "Erreur lors de la finalisation de l'onboarding." };
  }
}
