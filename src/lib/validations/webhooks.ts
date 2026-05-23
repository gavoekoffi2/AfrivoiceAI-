import { z } from "zod";

// --- Shopify ----------------------------------------------------------------
export const shopifyOrderSchema = z.object({
  id: z.union([z.number(), z.string()]).transform((v) => v.toString()),
  total_price: z.string().or(z.number().transform((n) => n.toString())).optional(),
  currency: z.string().optional(),
  gateway: z.string().optional().nullable(),
  financial_status: z.string().optional(),
  customer: z
    .object({
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
      phone: z.string().nullish(),
      email: z.string().nullish(),
    })
    .nullish(),
  shipping_address: z
    .object({
      address1: z.string().nullish(),
      city: z.string().nullish(),
      country: z.string().nullish(),
      phone: z.string().nullish(),
    })
    .nullish(),
  billing_address: z
    .object({
      phone: z.string().nullish(),
    })
    .nullish(),
  note: z.string().nullish(),
});

export type ShopifyOrder = z.infer<typeof shopifyOrderSchema>;

// --- WooCommerce ------------------------------------------------------------
export const woocommerceOrderSchema = z.object({
  id: z.union([z.number(), z.string()]).transform((v) => v.toString()),
  status: z.string().optional(),
  total: z.string().or(z.number().transform((n) => n.toString())).optional(),
  currency: z.string().optional(),
  payment_method: z.string().optional().default(""),
  payment_method_title: z.string().optional().default(""),
  billing: z
    .object({
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
      phone: z.string().nullish(),
      address_1: z.string().nullish(),
      city: z.string().nullish(),
      country: z.string().nullish(),
    })
    .optional(),
  shipping: z
    .object({
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
      phone: z.string().nullish(),
      address_1: z.string().nullish(),
      city: z.string().nullish(),
      country: z.string().nullish(),
    })
    .optional(),
});

export type WoocommerceOrder = z.infer<typeof woocommerceOrderSchema>;

// --- Vapi -------------------------------------------------------------------
const vapiCallSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  cost: z.number().optional(),
  duration: z.number().optional(),
  endedReason: z.string().optional(),
});

const toolCallSchema = z.object({
  toolCallId: z.string().optional(),
  name: z.string().optional(),
  arguments: z.unknown().optional(),
});

export const vapiWebhookSchema = z.object({
  message: z.object({
    type: z.string(),
    call: vapiCallSchema.optional(),
    recordingUrl: z.string().nullish(),
    transcript: z.string().nullish(),
    summary: z.string().nullish(),
    endedReason: z.string().nullish(),
    toolCallList: z.array(toolCallSchema).optional(),
    toolCalls: z.array(toolCallSchema).optional(),
    functionCall: toolCallSchema.optional(),
  }),
});

export type VapiWebhook = z.infer<typeof vapiWebhookSchema>;
