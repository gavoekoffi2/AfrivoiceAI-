import * as z from "zod";

export const depositSchema = z.object({
  amountFcfa: z
    .number()
    .min(1000, "Le montant minimum de recharge est de 1 000 FCFA.")
    .max(10000000, "Le montant maximum de recharge est de 10 000 000 FCFA."),
  paymentMethod: z.enum(["mobile_money", "stripe", "manual"]).optional(),
});

export type DepositInput = z.infer<typeof depositSchema>;
