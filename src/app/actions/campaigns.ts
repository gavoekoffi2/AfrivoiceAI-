"use server";

import { createCampaignSchema } from "@/lib/validations/campaign";
import { db } from "@/lib/db";
import { campaigns, leads, organizations } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { normalizePhoneNumber } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function createCampaignAction(formData: FormData) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const rawData = {
    name: formData.get("name") as string,
    objective: formData.get("objective") as string,
    scriptTemplate: formData.get("scriptTemplate") as string,
  };

  const validated = createCampaignSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      error: "Données invalides",
      details: validated.error.flatten(),
    };
  }

  try {
    const result = await db
      .insert(campaigns)
      .values({
        organizationId: session.organizationId,
        name: validated.data.name,
        objective: validated.data.objective,
        scriptTemplate: validated.data.scriptTemplate,
        status: "draft",
      })
      .returning();

    revalidatePath("/dashboard/campaigns");
    return { success: true, campaign: result[0] };
  } catch (error) {
    logger.error("campaigns", "Erreur création", { error: String(error) });
    return { error: "Erreur serveur lors de la création de la campagne." };
  }
}

const ALLOWED_STATUSES = ["draft", "active", "paused", "completed"] as const;
type CampaignStatus = (typeof ALLOWED_STATUSES)[number];

export async function updateCampaignStatusAction(
  campaignId: string,
  status: CampaignStatus
) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };
  if (!ALLOWED_STATUSES.includes(status)) {
    return { error: "Statut invalide." };
  }

  try {
    const existing = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, session.organizationId)
        )
      )
      .limit(1);

    const campaign = existing[0];
    if (!campaign) return { error: "Campagne introuvable." };

    // Règle d'activation : ne pas laisser activer une campagne sans leads.
    if (status === "active" && campaign.totalLeads <= 0) {
      return {
        error:
          "Importez au moins un lead (CSV) avant d'activer cette campagne.",
      };
    }

    await db
      .update(campaigns)
      .set({ status, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    revalidatePath("/dashboard/campaigns");
    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { success: true, status };
  } catch (error) {
    logger.error("campaigns", "Erreur mise à jour statut", {
      error: String(error),
    });
    return { error: "Erreur serveur." };
  }
}

export async function importLeadsFromCsvAction(
  campaignId: string,
  leadsData: Array<{
    name?: string;
    phone: string;
    company?: string;
    email?: string;
  }>
) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  if (!Array.isArray(leadsData) || leadsData.length === 0) {
    return { error: "Aucun lead à importer." };
  }
  if (leadsData.length > 10_000) {
    return { error: "Maximum 10 000 leads par import." };
  }

  const [campaignRow, orgRow] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, session.organizationId)
        )
      )
      .limit(1),
    db
      .select({ countryCode: organizations.countryCode })
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1),
  ]);

  const campaign = campaignRow[0];
  if (!campaign) return { error: "Campagne introuvable." };

  const countryCode = orgRow[0]?.countryCode || "TG";

  const normalized = leadsData
    .map((lead) => {
      const phoneE164 = normalizePhoneNumber(lead.phone ?? "", countryCode);
      return phoneE164
        ? {
            campaignId,
            organizationId: session.organizationId,
            name: lead.name?.trim() || null,
            phone: phoneE164,
            company: lead.company?.trim() || null,
            email: lead.email?.trim() || null,
            status: "new" as const,
          }
        : null;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const rejected = leadsData.length - normalized.length;
  if (normalized.length === 0) {
    return {
      error: "Aucun numéro valide trouvé dans le fichier.",
      rejected,
    };
  }

  try {
    // Dédup côté DB : onConflictDoNothing sur (campaignId, phone).
    const inserted = await db
      .insert(leads)
      .values(normalized)
      .onConflictDoNothing({
        target: [leads.campaignId, leads.phone],
      })
      .returning({ id: leads.id });

    if (inserted.length > 0) {
      await db
        .update(campaigns)
        .set({
          totalLeads: sql`${campaigns.totalLeads} + ${inserted.length}`,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
    }

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return {
      success: true,
      imported: inserted.length,
      duplicates: normalized.length - inserted.length,
      rejected,
    };
  } catch (error) {
    logger.error("campaigns", "Erreur import leads", {
      campaignId,
      error: String(error),
    });
    return { error: "Erreur lors de l'import des leads." };
  }
}
