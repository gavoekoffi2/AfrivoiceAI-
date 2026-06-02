"use server";

import { createCampaignSchema } from "@/lib/validations/campaign";
import { db } from "@/lib/db";
import { campaigns, leads } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { normalizePhoneNumber } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";

// Plafond d'import par requête (évite les abus / payloads géants).
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

  if (!Array.isArray(leadsData) || leadsData.length === 0) {
    return { error: "Aucun lead à importer." };
  }
  if (leadsData.length > MAX_LEADS_PER_IMPORT) {
    return {
      error: `Trop de leads (max ${MAX_LEADS_PER_IMPORT} par import).`,
    };
  }

  // Vérifier que la campagne appartient à l'organisation
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.organizationId, session.organizationId)
    ),
  });

  if (!campaign) return { error: "Campagne introuvable." };

  // Validation/normalisation côté serveur : on ne fait pas confiance au client.
  const sanitize = (v: string | undefined, max: number) =>
    v?.toString().trim().slice(0, max) || undefined;

  const leadsToInsert = leadsData
    .map((lead) => {
      const phone = normalizePhoneNumber(lead.phone ?? "", "TG");
      if (!phone) return null; // numéro invalide → ignoré
      return {
        campaignId,
        organizationId: session.organizationId,
        name: sanitize(lead.name, 120),
        phone,
        company: sanitize(lead.company, 120),
        email: sanitize(lead.email, 160),
        status: "new" as const,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (leadsToInsert.length === 0) {
    return { error: "Aucun numéro de téléphone valide trouvé." };
  }

  try {
    await db.insert(leads).values(leadsToInsert);

    // Incrément atomique du total des leads (par le nombre réellement inséré)
    await db
      .update(campaigns)
      .set({ totalLeads: sql`${campaigns.totalLeads} + ${leadsToInsert.length}` })
      .where(eq(campaigns.id, campaignId));

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { success: true, count: leadsToInsert.length };
  } catch (error) {
    console.error("[campaigns] Erreur import leads:", error);
    return { error: "Erreur lors de l'import des leads." };
  }
}
