// Types globaux AfrivoiceAI

export type CallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "failed"
  | "no-answer";

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  queued: "En attente",
  ringing: "Sonnerie",
  "in-progress": "En cours",
  completed: "Terminé",
  failed: "Échoué",
  "no-answer": "Sans réponse",
};

export type OrderStatus =
  | "pending"
  | "calling"
  | "confirmed"
  | "cancelled"
  | "no_answer";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  calling: "Appel en cours",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  no_answer: "Sans réponse",
};

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export type LeadStatus =
  | "new"
  | "queueing"
  | "calling"
  | "called"
  | "qualified"
  | "not_interested"
  | "no_answer";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nouveau",
  queueing: "En file d'attente",
  calling: "Appel en cours",
  called: "Appelé",
  qualified: "Qualifié",
  not_interested: "Non intéressé",
  no_answer: "Sans réponse",
};

export type TransactionType =
  | "deposit"
  | "call_cost"
  | "refund"
  | "adjustment";

export type UserRole = "owner" | "admin" | "member";

export type CallType = "ecommerce_confirmation" | "prospecting";

export interface OrganizationStats {
  totalCalls: number;
  confirmedOrders: number;
  confirmationRate: number;
  walletBalance: number;
  activeCampaigns: number;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
}
