import * as z from "zod";

export const createVoiceCloneProfileSchema = z.object({
  name: z.string().min(3, "Donnez un nom clair au profil vocal."),
  provider: z.enum(["openvoice", "chatterbox", "cosyvoice", "gpt-sovits", "rvc", "external"]).default("openvoice"),
  sampleAudioUrl: z
    .string()
    .url("Ajoutez une URL audio valide, ou laissez vide pour compléter plus tard.")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(1000).optional(),
  consentConfirmed: z.literal("on", {
    errorMap: () => ({ message: "Le consentement explicite est obligatoire." }),
  }),
});

export type CreateVoiceCloneProfileInput = z.infer<typeof createVoiceCloneProfileSchema>;
