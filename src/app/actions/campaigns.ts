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
    voiceLanguage: (formData.get("voiceLanguage") as string) || "fr",
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
        voiceLanguage: validated.data.voiceLanguage,
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

type LeadInput = {
  name?: string;
  phone: string;
  company?: string;
  email?: string;
  notes?: string;
};

const DEFAULT_QUICK_CALL_OBJECTIVE =
  "Tester AfrivoxAI sur quelques numéros, qualifier l'intérêt et proposer une démonstration.";

const DEFAULT_QUICK_CALL_SCRIPT =
  "Tu es l'agent vocal AfrivoxAI. Salue poliment, explique en moins de 20 secondes que l'appel sert à présenter un assistant IA capable de gérer des appels clients, demande si la personne est intéressée par une démonstration, puis termine proprement en remerciant.";

function cleanOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned : undefined;
}

function parseQuickCallNumbers(rawNumbers: string): LeadInput[] {
  return rawNumbers
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [phonePart, namePart, companyPart] = line
        .split(/[;,]/)
        .map((part) => part.trim());

      return {
        phone: phonePart,
        name: cleanOptional(namePart),
        company: cleanOptional(companyPart),
        notes: "Ajouté via lancement d'appel rapide",
      };
    });
}

async function addLeadsToCampaign(campaignId: string, leadsData: LeadInput[]) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  if (leadsData.length === 0) {
    return { error: "Aucun lead valide à importer." };
  }

  if (leadsData.length > 500) {
    return { error: "Import limité à 500 leads par envoi pour éviter les abus." };
  }

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
        name: cleanOptional(lead.name),
        phone: normalizePhoneNumber(lead.phone, "TG") ?? lead.phone.trim(),
        company: cleanOptional(lead.company),
        email: cleanOptional(lead.email),
        notes: cleanOptional(lead.notes),
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
        notes: lead.notes,
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
    revalidatePath("/campaigns");
    return {
      success: true,
      count: leadsToInsert.length,
      skipped: leadsData.length - leadsToInsert.length,
    };
  } catch (error) {
    console.error("[campaigns] Erreur ajout leads:", error);
    return { error: "Erreur lors de l'ajout des leads." };
  }
}

export async function addManualLeadAction(
  campaignId: string,
  formData: FormData
) {
  const phone = cleanOptional(formData.get("phone"));
  if (!phone) return { error: "Le numéro de téléphone est obligatoire." };

  return addLeadsToCampaign(campaignId, [
    {
      name: cleanOptional(formData.get("name")),
      phone,
      company: cleanOptional(formData.get("company")),
      email: cleanOptional(formData.get("email")),
      notes: cleanOptional(formData.get("notes")),
    },
  ]);
}

export async function importLeadsFromCsvAction(
  campaignId: string,
  leadsData: Array<{ name?: string; phone: string; company?: string; email?: string }>
) {
  return addLeadsToCampaign(campaignId, leadsData);
}

export async function createQuickCallCampaignAction(formData: FormData) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const rawNumbers = cleanOptional(formData.get("numbers"));
  if (!rawNumbers) {
    return { error: "Ajoutez au moins un numéro à appeler." };
  }

  const requestedLeads = parseQuickCallNumbers(rawNumbers);
  if (requestedLeads.length === 0) {
    return { error: "Aucun numéro valide détecté." };
  }

  if (requestedLeads.length > 20) {
    return {
      error:
        "Le lancement rapide est limité à 20 numéros. Pour plus de volume, créez une campagne classique ou importez un CSV.",
    };
  }

  const normalizedLeads = requestedLeads
    .map((lead) => ({
      name: cleanOptional(lead.name),
      phone: normalizePhoneNumber(lead.phone, "TG") ?? lead.phone.trim(),
      company: cleanOptional(lead.company),
      email: cleanOptional(lead.email),
      notes: cleanOptional(lead.notes),
    }))
    .filter((lead) => lead.phone.startsWith("+"));

  if (normalizedLeads.length === 0) {
    return {
      error:
        "Aucun numéro international valide. Utilisez +228..., +1..., etc. Les numéros togolais locaux sont convertis automatiquement.",
    };
  }

  const uniqueLeads = Array.from(
    new Map(normalizedLeads.map((lead) => [lead.phone, lead])).values()
  );

  const now = new Date();
  const name =
    cleanOptional(formData.get("name")) ??
    `Test appel rapide - ${now.toLocaleDateString("fr-TG")}`;
  const objective =
    cleanOptional(formData.get("objective")) ?? DEFAULT_QUICK_CALL_OBJECTIVE;
  const scriptTemplate =
    cleanOptional(formData.get("scriptTemplate")) ?? DEFAULT_QUICK_CALL_SCRIPT;
  const launchNow = formData.get("launchNow") === "on";

  try {
    const [campaign] = await db.transaction(async (tx) => {
      const created = await tx
        .insert(campaigns)
        .values({
          organizationId: session.organizationId,
          name,
          objective,
          scriptTemplate,
          voiceLanguage: "fr",
          status: launchNow ? "active" : "draft",
          totalLeads: uniqueLeads.length,
        })
        .returning();

      await tx.insert(leads).values(
        uniqueLeads.map((lead) => ({
          campaignId: created[0].id,
          organizationId: session.organizationId,
          name: lead.name,
          phone: lead.phone,
          company: lead.company,
          email: lead.email,
          notes: lead.notes,
          status: "new" as const,
        }))
      );

      return created;
    });

    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${campaign.id}`);

    return {
      success: true,
      campaignId: campaign.id,
      count: uniqueLeads.length,
      launchReady: launchNow,
    };
  } catch (error) {
    console.error("[campaigns/quick-call] Erreur création:", error);
    return { error: "Erreur serveur lors de la création du test rapide." };
  }
}
