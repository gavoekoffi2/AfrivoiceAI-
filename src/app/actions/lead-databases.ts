"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  campaigns,
  leadDatabasePurchases,
  leadDatabaseRecords,
  leadDatabases,
  leads,
  transactions,
  wallets,
} from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { normalizePhoneNumber } from "@/lib/utils";

function formatProspectNotes(record: typeof leadDatabaseRecords.$inferSelect) {
  const parts = [
    record.outreachAngle ? `Angle: ${record.outreachAngle}` : null,
    record.recommendedOffer ? `Offre recommandée: ${record.recommendedOffer}` : null,
    record.aiCallScript ? `Script IA: ${record.aiCallScript}` : null,
    record.sourceName || record.sourceUrl
      ? `Source publique: ${[record.sourceName, record.sourceUrl].filter(Boolean).join(" - ")}`
      : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export async function purchaseLeadDatabaseAction(databaseId: string) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const [database] = await db
    .select()
    .from(leadDatabases)
    .where(and(eq(leadDatabases.id, databaseId), eq(leadDatabases.isPublished, true)))
    .limit(1);

  if (!database) return { error: "Base introuvable ou non publiée." };

  if (isSuperAdmin(session)) {
    revalidatePath("/lead-databases");
    return { success: true, alreadyPurchased: true };
  }

  const existingPurchase = await db.query.leadDatabasePurchases.findFirst({
    where: and(
      eq(leadDatabasePurchases.organizationId, session.organizationId),
      eq(leadDatabasePurchases.databaseId, databaseId)
    ),
  });

  if (existingPurchase) {
    return { success: true, alreadyPurchased: true };
  }

  const price = Number(database.priceFcfa ?? 0);

  try {
    await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.organizationId, session.organizationId))
        .limit(1);

      if (!wallet) throw new Error("Wallet introuvable.");

      const balance = Number(wallet.balanceFcfa ?? 0);
      if (price > 0 && balance < price) {
        throw new Error(
          `Solde insuffisant. Prix: ${price.toLocaleString("fr-FR")} FCFA, solde: ${balance.toLocaleString("fr-FR")} FCFA.`
        );
      }

      if (price > 0) {
        await tx
          .update(wallets)
          .set({
            balanceFcfa: sql`${wallets.balanceFcfa} - ${price}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));

        await tx.insert(transactions).values({
          walletId: wallet.id,
          type: "lead_database_purchase",
          amountFcfa: `-${price}`,
          description: `Achat base prospects: ${database.name}`,
          metadata: { databaseId: database.id, databaseName: database.name },
        });
      }

      await tx.insert(leadDatabasePurchases).values({
        organizationId: session.organizationId,
        databaseId,
        amountFcfa: String(price),
        accessLevel: "full",
        exportAllowed: true,
        campaignAllowed: true,
      });
    });

    revalidatePath("/lead-databases");
    return { success: true };
  } catch (error) {
    console.error("[lead-databases] Achat impossible:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Erreur serveur pendant l'achat de la base.",
    };
  }
}

export async function createCampaignFromLeadDatabaseAction(formData: FormData) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const databaseId = String(formData.get("databaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const voiceLanguage = formData.get("voiceLanguage") === "ewe" ? "ewe" : "fr";

  if (!databaseId || !name || !objective) {
    return { error: "Nom de campagne, objectif et base requis." };
  }

  const purchase = await db.query.leadDatabasePurchases.findFirst({
    where: and(
      eq(leadDatabasePurchases.organizationId, session.organizationId),
      eq(leadDatabasePurchases.databaseId, databaseId),
      eq(leadDatabasePurchases.campaignAllowed, true)
    ),
  });

  if (!purchase && !isSuperAdmin(session)) {
    return { error: "Vous devez acheter cette base avant de créer une campagne." };
  }

  const [database] = await db
    .select()
    .from(leadDatabases)
    .where(eq(leadDatabases.id, databaseId))
    .limit(1);

  if (!database) return { error: "Base introuvable." };

  const records = await db
    .select()
    .from(leadDatabaseRecords)
    .where(eq(leadDatabaseRecords.databaseId, databaseId))
    .limit(500);

  const usableRecords = records
    .map((record) => ({
      record,
      phone: record.phone ? normalizePhoneNumber(record.phone, database.country) : null,
    }))
    .filter((item) => item.phone?.startsWith("+"));

  if (usableRecords.length === 0) {
    return { error: "Cette base ne contient aucun numéro exploitable pour une campagne d'appels." };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [campaign] = await tx
        .insert(campaigns)
        .values({
          organizationId: session.organizationId,
          name,
          objective,
          scriptTemplate: `Tu es l'assistant AfrivoxAI. Objectif: ${objective}. Utilise un ton professionnel, court et respectueux. Si le prospect refuse, remercie et termine proprement. Base source: ${database.name}.`,
          voiceLanguage,
          status: "draft",
          totalLeads: 0,
        })
        .returning();

      const phones = usableRecords.map((item) => item.phone!);
      const uniqueByPhone = Array.from(new Map(usableRecords.map((item) => [item.phone!, item])).values());

      const existingPhones = phones.length
        ? await tx
            .select({ phone: leads.phone })
            .from(leads)
            .where(
              and(
                eq(leads.organizationId, session.organizationId),
                eq(leads.campaignId, campaign.id),
                inArray(leads.phone, phones)
              )
            )
        : [];

      const existingSet = new Set(existingPhones.map((lead) => lead.phone));
      const toInsert = uniqueByPhone
        .filter((item) => !existingSet.has(item.phone!))
        .map(({ record, phone }) => ({
          organizationId: session.organizationId,
          campaignId: campaign.id,
          name: record.contactName ?? record.companyName,
          company: record.companyName,
          phone: phone!,
          email: record.email,
          status: "new" as const,
          notes: formatProspectNotes(record),
        }));

      if (toInsert.length > 0) {
        await tx.insert(leads).values(toInsert);
        await tx
          .update(campaigns)
          .set({ totalLeads: toInsert.length })
          .where(eq(campaigns.id, campaign.id));
      }

      return { campaignId: campaign.id, count: toInsert.length };
    });

    revalidatePath("/lead-databases");
    revalidatePath("/campaigns");
    return { success: true, ...result };
  } catch (error) {
    console.error("[lead-databases] Création campagne impossible:", error);
    return { error: "Erreur serveur pendant la création de campagne." };
  }
}
