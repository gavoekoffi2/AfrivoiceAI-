"use server";

import { createCampaignSchema } from "@/lib/validations/campaign";
import { db } from "@/lib/db";
import { campaigns, leads } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { normalizePhoneNumber } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

const MAX_LEADS_PER_IMPORT = 5000;

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
    console.error("[campaigns] Erreur création:", error);
    return { error: "Erreur serveur lors de la création de la campagne." };
  }
}

export async function updateCampaignStatusAction(
  campaignId: string,
  status: "draft" | "active" | "paused" | "completed"
) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  try {
    await db
      .update(campaigns)
      .set({ status })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, session.organizationId)
        )
      );

    revalidatePath("/dashboard/campaigns");
    return { success: true };
  } catch (error) {
    console.error("[campaigns] Erreur mise à jour statut:", error);
    return { error: "Erreur serveur." };
  }
}

export async function importLeadsFromCsvAction(
  campaignId: string,
  leadsData: Array<{ name?: string; phone: string; company?: string; email?: string }>
) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  // Vérifier que la campagne appartient à l'organisation
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.organizationId, session.organizationId)
    ),
  });

  if (!campaign) return { error: "Campagne introuvable." };

  if (!Array.isArray(leadsData) || leadsData.length === 0) {
    return { error: "Aucun lead à importer." };
  }
  if (leadsData.length > MAX_LEADS_PER_IMPORT) {
    return {
      error: `Trop de leads (max ${MAX_LEADS_PER_IMPORT.toLocaleString("fr-FR")} par import).`,
    };
  }

  // Validation/normalisation côté serveur (ne jamais faire confiance au client).
  const seen = new Set<string>();
  const leadsToInsert = leadsData
    .map((lead) => {
      const phone = normalizePhoneNumber(String(lead.phone ?? ""), "TG");
      if (!phone || seen.has(phone)) return null;
      seen.add(phone);
      return {
        campaignId,
        organizationId: session.organizationId,
        name: lead.name?.toString().slice(0, 200) || null,
        phone,
        company: lead.company?.toString().slice(0, 200) || null,
        email: lead.email?.toString().slice(0, 200) || null,
        status: "new" as const,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (leadsToInsert.length === 0) {
    return { error: "Aucun numéro de téléphone valide trouvé." };
  }

  try {
    await db.insert(leads).values(leadsToInsert);

    // Mettre à jour le total des leads (uniquement les leads réellement insérés)
    await db
      .update(campaigns)
      .set({ totalLeads: campaign.totalLeads + leadsToInsert.length })
      .where(eq(campaigns.id, campaignId));

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { success: true, count: leadsToInsert.length };
  } catch (error) {
    console.error("[campaigns] Erreur import leads:", error);
    return { error: "Erreur lors de l'import des leads." };
  }
}
