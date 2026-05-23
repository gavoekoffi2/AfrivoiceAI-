import * as z from "zod";

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères."),
});

const strongPassword = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères.")
  .max(128, "Le mot de passe est trop long.")
  .refine((p) => /[A-Z]/.test(p), "Doit contenir au moins une majuscule.")
  .refine((p) => /[a-z]/.test(p), "Doit contenir au moins une minuscule.")
  .refine((p) => /[0-9]/.test(p), "Doit contenir au moins un chiffre.");

export const registerSchema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: strongPassword,
  organizationName: z
    .string()
    .min(2, "Le nom de l'entreprise doit faire au moins 2 caractères.")
    .max(80, "Le nom de l'entreprise est trop long."),
  acceptTerms: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Adresse email invalide."),
});

export const resetPasswordSchema = z.object({
  password: strongPassword,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: strongPassword,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
