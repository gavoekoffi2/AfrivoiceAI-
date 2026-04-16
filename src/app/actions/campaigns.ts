"use server";

import { createCampaignSchema } from "@/lib/validations/campaign";
import { db } from "@/lib/db";
import { campaigns, leads } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

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

  try {
    const leadsToInsert = leadsData.map((lead) => ({
      campaignId,
      organizationId: session.organizationId,
      name: lead.name,
      phone: lead.phone,
      company: lead.company,
      email: lead.email,
      status: "new" as const,
    }));

    await db.insert(leads).values(leadsToInsert);

    // Mettre à jour le total des leads
    await db
      .update(campaigns)
      .set({ totalLeads: campaign.totalLeads + leadsData.length })
      .where(eq(campaigns.id, campaignId));

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { success: true, count: leadsData.length };
  } catch (error) {
    console.error("[campaigns] Erreur import leads:", error);
    return { error: "Erreur lors de l'import des leads." };
  }
}
