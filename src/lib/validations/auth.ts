import * as z from "zod";

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: z
    .string()
    .min(6, "Le mot de passe doit faire au moins 6 caractères."),
});

export const registerSchema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: z
    .string()
    .min(8, "Le mot de passe doit faire au moins 8 caractères.")
    .regex(/[A-Z]/, "Doit contenir au moins une majuscule.")
    .regex(/[0-9]/, "Doit contenir au moins un chiffre."),
  organizationName: z
    .string()
    .min(2, "Le nom de l'entreprise doit faire au moins 2 caractères.")
    .max(100, "Le nom est trop long."),
  fullName: z.string().max(100, "Nom complet trop long.").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
