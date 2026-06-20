"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voiceCloneProfiles } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import { createVoiceCloneProfileSchema } from "@/lib/validations/voice-clones";
import {
  defaultOpenVoicePreviewText,
  requestOpenVoiceClone,
} from "@/lib/voice-cloning/openvoice";

const providerModelMap = {
  openvoice: "myshell-ai/OpenVoice",
  chatterbox: "resemble-ai/chatterbox",
  cosyvoice: "FunAudioLLM/CosyVoice",
  "gpt-sovits": "RVC-Boss/GPT-SoVITS",
  rvc: "RVC-Project/Retrieval-based-Voice-Conversion-WebUI",
  external: "external/provider",
} as const;

export async function createVoiceCloneProfileAction(formData: FormData) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const raw = {
    name: String(formData.get("name") ?? ""),
    provider: String(formData.get("provider") ?? "openvoice"),
    sampleAudioUrl: String(formData.get("sampleAudioUrl") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    consentConfirmed: formData.get("consentConfirmed"),
  };

  const parsed = createVoiceCloneProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().fieldErrors.consentConfirmed?.[0] ?? "Données invalides.",
      details: parsed.error.flatten(),
    };
  }

  const provider = parsed.data.provider;

  try {
    const [profile] = await db
      .insert(voiceCloneProfiles)
      .values({
        organizationId: session.organizationId,
        name: parsed.data.name.trim(),
        provider,
        model: providerModelMap[provider],
        status: parsed.data.sampleAudioUrl ? "queued" : "draft",
        consentConfirmed: true,
        sampleAudioUrl: parsed.data.sampleAudioUrl || null,
        notes: parsed.data.notes?.trim() || null,
        metadata: {
          source: "dashboard",
          safety: "explicit-consent-required",
          nextStep: parsed.data.sampleAudioUrl
            ? "send-to-voice-cloning-worker"
            : "upload-reference-audio",
        },
      })
      .returning();

    revalidatePath("/voice-cloning");
    return { success: true, profile };
  } catch (error) {
    console.error("[voice-clones] profile creation failed", error);
    return { error: "Erreur serveur pendant la création du profil vocal." };
  }
}

export async function generateOpenVoiceCloneAction(profileId: string) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const profile = await db.query.voiceCloneProfiles.findFirst({
    where: and(
      eq(voiceCloneProfiles.id, profileId),
      eq(voiceCloneProfiles.organizationId, session.organizationId)
    ),
  });

  if (!profile) return { error: "Profil vocal introuvable." };
  if (!profile.consentConfirmed) {
    return { error: "Consentement vocal obligatoire avant génération." };
  }
  if (profile.provider !== "openvoice") {
    return { error: "Ce bouton génère uniquement les profils OpenVoice V2." };
  }
  if (!profile.sampleAudioUrl) {
    return { error: "Ajoutez d’abord une URL audio de référence." };
  }

  await db
    .update(voiceCloneProfiles)
    .set({
      status: "training",
      updatedAt: new Date(),
      metadata: {
        ...(typeof profile.metadata === "object" && profile.metadata ? profile.metadata : {}),
        engine: "openvoice-v2",
        requestedAt: new Date().toISOString(),
        previewText: defaultOpenVoicePreviewText(),
      },
    })
    .where(eq(voiceCloneProfiles.id, profile.id));

  try {
    const callbackUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL("/api/voice-cloning/openvoice/callback", process.env.NEXT_PUBLIC_SITE_URL).toString()
      : undefined;

    const result = await requestOpenVoiceClone({
      profileId: profile.id,
      name: profile.name,
      referenceAudioUrl: profile.sampleAudioUrl,
      text: defaultOpenVoicePreviewText(),
      language: "fr",
      callbackUrl,
    });

    const nextStatus = result.status === "ready" ? "ready" : result.status === "failed" ? "failed" : "training";

    await db
      .update(voiceCloneProfiles)
      .set({
        status: nextStatus,
        externalVoiceId: result.voiceId || profile.externalVoiceId,
        metadata: {
          ...(typeof profile.metadata === "object" && profile.metadata ? profile.metadata : {}),
          engine: "openvoice-v2",
          requestedAt: new Date().toISOString(),
          previewText: defaultOpenVoicePreviewText(),
          previewAudioUrl: result.previewAudioUrl,
          serviceMessage: result.message,
          serviceMetadata: result.metadata,
        },
        updatedAt: new Date(),
      })
      .where(eq(voiceCloneProfiles.id, profile.id));

    revalidatePath("/voice-cloning");
    return {
      success: true,
      status: nextStatus,
      previewAudioUrl: result.previewAudioUrl,
      message: result.message || "Génération OpenVoice lancée.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Génération OpenVoice impossible.";
    await db
      .update(voiceCloneProfiles)
      .set({
        status: "queued",
        metadata: {
          ...(typeof profile.metadata === "object" && profile.metadata ? profile.metadata : {}),
          engine: "openvoice-v2",
          pendingReason: "openvoice-service-unavailable",
          lastError: message,
          checkedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(voiceCloneProfiles.id, profile.id));

    revalidatePath("/voice-cloning");
    return { error: message };
  }
}

export async function disableVoiceCloneProfileAction(profileId: string) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  try {
    await db
      .update(voiceCloneProfiles)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(
        and(
          eq(voiceCloneProfiles.id, profileId),
          eq(voiceCloneProfiles.organizationId, session.organizationId)
        )
      );

    revalidatePath("/voice-cloning");
    return { success: true };
  } catch (error) {
    console.error("[voice-clones] disable failed", error);
    return { error: "Erreur serveur." };
  }
}
