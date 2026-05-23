import * as z from "zod";

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  shopName: z.string().min(1).max(80).optional().nullable(),
  shopifyDomain: z
    .string()
    .regex(/^[a-z0-9.-]+\.myshopify\.com$|^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domaine invalide")
    .optional()
    .nullable(),
  woocommerceDomain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domaine invalide")
    .optional()
    .nullable(),
  lowBalanceThresholdFcfa: z
    .number()
    .min(0)
    .max(10_000_000)
    .optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
