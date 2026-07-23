"use server";

import { randomUUID } from "crypto";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserSession } from "@/lib/auth";
import { getBillingPlan } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import {
  organizationBillingProfiles,
  phoneLines,
} from "@/lib/db/schema";
import { normalizePhoneNumber } from "@/lib/utils";

const requestPhoneLineSchema = z.object({
  name: z.string().trim().min(3).max(80),
  phoneNumber: z.string().trim().min(8).max(24),
  connectionType: z.enum(["sim_gateway", "sip_trunk", "twilio", "telnyx"]),
  provider: z.enum(["moov", "togocom", "sip", "twilio", "telnyx", "other"]),
});

const provisionPhoneLineSchema = z.object({
  lineId: z.string().uuid(),
  vapiPhoneNumberId: z.string().trim().min(8).max(160),
  vapiCredentialId: z.string().trim().max(160).optional(),
});

function isPlatformAdmin(role: string) {
  return role === "super_admin" || role === "admin";
}

export async function requestPhoneLineAction(formData: FormData) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const validated = requestPhoneLineSchema.safeParse({
    name: formData.get("name"),
    phoneNumber: formData.get("phoneNumber"),
    connectionType: formData.get("connectionType"),
    provider: formData.get("provider"),
  });

  if (!validated.success) {
    return { error: "Vérifiez le nom, le numéro et le type de connexion." };
  }

  const phoneNumber = normalizePhoneNumber(validated.data.phoneNumber, "TG");
  if (!phoneNumber) {
    return { error: "Le numéro doit être au format international, par exemple +228XXXXXXXX." };
  }

  const [billingProfile, existingLines] = await Promise.all([
    db.query.organizationBillingProfiles.findFirst({
      where: eq(organizationBillingProfiles.organizationId, session.organizationId),
    }),
    db
      .select({ id: phoneLines.id })
      .from(phoneLines)
      .where(
        and(
          eq(phoneLines.organizationId, session.organizationId),
          ne(phoneLines.status, "disabled")
        )
      ),
  ]);

  const plan = getBillingPlan(billingProfile?.planCode);
  const customerLineCount = Math.max(
    0,
    existingLines.length - 1 // La ligne AfrivoxAI gérée ne consomme pas le quota BYO.
  );
  if (customerLineCount >= plan.phoneLineLimit) {
    return {
      error: `Votre forfait ${plan.name} autorise ${plan.phoneLineLimit} ligne(s) connectée(s).`,
    };
  }

  const reference = `LINE-${randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    const [line] = await db
      .insert(phoneLines)
      .values({
        organizationId: session.organizationId,
        name: validated.data.name,
        phoneNumber,
        connectionType: validated.data.connectionType,
        provider: validated.data.provider,
        status: "pending",
        verificationStatus: "pending",
        verificationMethod:
          validated.data.connectionType === "sim_gateway"
            ? "sim_possession"
            : "provider_ownership",
        externalReference: reference,
        publicConfig: {
          requestedBy: session.id,
          onboarding: "manual_secure_handoff",
        },
      })
      .returning({ id: phoneLines.id });

    revalidatePath("/phone-lines");
    revalidatePath("/admin");
    return { success: true, lineId: line.id, reference };
  } catch (error) {
    console.error("[phone-lines/request]", error);
    return {
      error:
        "Cette ligne est peut-être déjà enregistrée pour votre entreprise. Vérifiez le numéro.",
    };
  }
}

export async function setDefaultPhoneLineAction(lineId: string) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const line = await db.query.phoneLines.findFirst({
    where: and(
      eq(phoneLines.id, lineId),
      eq(phoneLines.organizationId, session.organizationId),
      eq(phoneLines.status, "active"),
      eq(phoneLines.verificationStatus, "verified")
    ),
  });

  if (!line) return { error: "Ligne active et vérifiée introuvable." };

  await db.transaction(async (tx) => {
    await tx
      .update(phoneLines)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(phoneLines.organizationId, session.organizationId));

    await tx
      .update(phoneLines)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(phoneLines.id, lineId),
          eq(phoneLines.organizationId, session.organizationId)
        )
      );
  });

  revalidatePath("/phone-lines");
  revalidatePath("/campaigns");
  return { success: true };
}

export async function disablePhoneLineAction(lineId: string) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const result = await db
    .update(phoneLines)
    .set({ status: "disabled", isDefault: false, updatedAt: new Date() })
    .where(
      and(
        eq(phoneLines.id, lineId),
        eq(phoneLines.organizationId, session.organizationId),
        ne(phoneLines.connectionType, "platform")
      )
    )
    .returning({ id: phoneLines.id });

  if (!result[0]) return { error: "Ligne introuvable ou non désactivable." };
  revalidatePath("/phone-lines");
  return { success: true };
}

export async function provisionPhoneLineAction(formData: FormData) {
  const session = await getUserSession();
  if (!session || !isPlatformAdmin(session.role)) {
    return { error: "Accès administrateur requis." };
  }

  const validated = provisionPhoneLineSchema.safeParse({
    lineId: formData.get("lineId"),
    vapiPhoneNumberId: formData.get("vapiPhoneNumberId"),
    vapiCredentialId: formData.get("vapiCredentialId") || undefined,
  });
  if (!validated.success) return { error: "Identifiants de provisionnement invalides." };

  const result = await db
    .update(phoneLines)
    .set({
      vapiPhoneNumberId: validated.data.vapiPhoneNumberId,
      vapiCredentialId: validated.data.vapiCredentialId ?? null,
      status: "active",
      verificationStatus: "verified",
      lastHealthCheckAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(phoneLines.id, validated.data.lineId))
    .returning({ id: phoneLines.id });

  if (!result[0]) return { error: "Demande de ligne introuvable." };
  revalidatePath("/phone-lines");
  revalidatePath("/admin");
  return { success: true };
}
