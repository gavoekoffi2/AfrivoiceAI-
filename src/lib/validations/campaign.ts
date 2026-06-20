import * as z from "zod";

export const createCampaignSchema = z.object({
  name: z
    .string()
    .min(3, "Le nom de la campagne doit faire au moins 3 caractères."),
  objective: z.string().min(10, "L'objectif doit être clairement défini."),
  scriptTemplate: z
    .string()
    .min(50, "Le script (prompt) est trop court. Fournissez plus de contexte."),
  voiceLanguage: z.enum(["fr", "ewe"]).default("fr"),
});

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
