"use server";

import { createCampaignSchema } from "@/lib/validations/campaign";
import { db } from "@/lib/db";
import { campaigns, leads } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { normalizePhoneNumber } from "@/lib/utils";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("actions/campaigns");

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
    return { error: validated.error.errors[0]?.message ?? "Données invalides" };
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
  } catch (err) {
    log.error("Création campagne échouée", { error: String(err) });
    return { error: "Erreur serveur lors de la création de la campagne." };
  }
}

export async function updateCampaignAction(
  campaignId: string,
  data: { name?: string; objective?: string; scriptTemplate?: string }
) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  try {
    await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, session.organizationId)
        )
      );

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    revalidatePath("/dashboard/campaigns");
    return { success: true };
  } catch (err) {
    log.error("Mise à jour campagne échouée", { error: String(err) });
    return { error: "Erreur serveur." };
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
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, session.organizationId)
        )
      );

    revalidatePath("/dashboard/campaigns");
    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { success: true };
  } catch (err) {
    log.error("Statut campagne échoué", { error: String(err) });
    return { error: "Erreur serveur." };
  }
}

export async function deleteCampaignAction(campaignId: string) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  try {
    await db
      .delete(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, session.organizationId)
        )
      );
    revalidatePath("/dashboard/campaigns");
    return { success: true };
  } catch (err) {
    log.error("Suppression campagne échouée", { error: String(err) });
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
  if (leadsData.length > MAX_LEADS_PER_IMPORT) {
    return {
      error: `Trop de leads (${leadsData.length}). Maximum ${MAX_LEADS_PER_IMPORT} par import.`,
    };
  }

  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.organizationId, session.organizationId)
    ),
  });
  if (!campaign) return { error: "Campagne introuvable." };

  // Validation et normalisation des leads
  const seen = new Set<string>();
  const validLeads: Array<{
    campaignId: string;
    organizationId: string;
    name: string | null;
    phone: string;
    company: string | null;
    email: string | null;
    status: "new";
  }> = [];

  for (const lead of leadsData) {
    const phone = normalizePhoneNumber(lead.phone, "TG") ?? lead.phone;
    if (!phone || phone.length < 8) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);

    validLeads.push({
      campaignId,
      organizationId: session.organizationId,
      name: lead.name?.trim() || null,
      phone,
      company: lead.company?.trim() || null,
      email: lead.email?.trim() || null,
      status: "new",
    });
  }

  if (validLeads.length === 0) {
    return { error: "Aucun numéro de téléphone valide." };
  }

  try {
    // Insertion par batch pour éviter les énormes requêtes
    const BATCH_SIZE = 500;
    let inserted = 0;
    for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
      const batch = validLeads.slice(i, i + BATCH_SIZE);
      const result = await db.insert(leads).values(batch).returning({ id: leads.id });
      inserted += result.length;
    }

    // Compteur atomique sur la campagne
    await db
      .update(campaigns)
      .set({
        totalLeads: sql`${campaigns.totalLeads} + ${inserted}`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    return { success: true, count: inserted };
  } catch (err) {
    log.error("Import leads échoué", { error: String(err) });
    return { error: "Erreur lors de l'import des leads." };
  }
}

export async function deleteLeadAction(leadId: string) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  try {
    const [deleted] = await db
      .delete(leads)
      .where(
        and(
          eq(leads.id, leadId),
          eq(leads.organizationId, session.organizationId)
        )
      )
      .returning({ campaignId: leads.campaignId });

    if (deleted) {
      await db
        .update(campaigns)
        .set({ totalLeads: sql`${campaigns.totalLeads} - 1` })
        .where(eq(campaigns.id, deleted.campaignId));
      revalidatePath(`/dashboard/campaigns/${deleted.campaignId}`);
    }
    return { success: true };
  } catch (err) {
    log.error("Suppression lead échouée", { error: String(err) });
    return { error: "Erreur serveur." };
  }
}
