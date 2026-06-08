"use server";

import { createCampaignSchema } from "@/lib/validations/campaign";
import { db } from "@/lib/db";
import { campaigns, leads } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { normalizePhoneNumber } from "@/lib/utils";

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

    revalidatePath("/campaigns");
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

    revalidatePath("/campaigns");
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

  if (leadsData.length === 0) {
    return { error: "Aucun lead valide à importer." };
  }

  if (leadsData.length > 500) {
    return { error: "Import limité à 500 leads par envoi pour éviter les abus." };
  }

  // Vérifier que la campagne appartient à l'organisation
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.organizationId, session.organizationId)
    ),
  });

  if (!campaign) return { error: "Campagne introuvable." };

  try {
    const normalizedLeads = leadsData
      .map((lead) => ({
        ...lead,
        phone: normalizePhoneNumber(lead.phone, "TG") ?? lead.phone,
      }))
      .filter((lead) => lead.phone.startsWith("+"));

    if (normalizedLeads.length === 0) {
      return { error: "Aucun numéro de téléphone valide trouvé." };
    }

    const uniqueIncoming = Array.from(
      new Map(normalizedLeads.map((lead) => [lead.phone, lead])).values()
    );

    const existingPhones = await db
      .select({ phone: leads.phone })
      .from(leads)
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(leads.organizationId, session.organizationId),
          inArray(
            leads.phone,
            uniqueIncoming.map((lead) => lead.phone)
          )
        )
      );

    const existingPhoneSet = new Set(existingPhones.map((lead) => lead.phone));
    const leadsToInsert = uniqueIncoming
      .filter((lead) => !existingPhoneSet.has(lead.phone))
      .map((lead) => ({
        campaignId,
        organizationId: session.organizationId,
        name: lead.name,
        phone: lead.phone,
        company: lead.company,
        email: lead.email,
        status: "new" as const,
      }));

    if (leadsToInsert.length === 0) {
      return { success: true, count: 0, skipped: uniqueIncoming.length };
    }

    await db.transaction(async (tx) => {
      await tx.insert(leads).values(leadsToInsert);

      await tx
        .update(campaigns)
        .set({ totalLeads: campaign.totalLeads + leadsToInsert.length })
        .where(eq(campaigns.id, campaignId));
    });

    revalidatePath(`/campaigns/${campaignId}`);
    return {
      success: true,
      count: leadsToInsert.length,
      skipped: leadsData.length - leadsToInsert.length,
    };
  } catch (error) {
    console.error("[campaigns] Erreur import leads:", error);
    return { error: "Erreur lors de l'import des leads." };
  }
}
