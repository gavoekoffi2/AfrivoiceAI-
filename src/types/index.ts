// Types globaux AfrivoiceAI

export type CallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "failed"
  | "no-answer";

export type OrderStatus =
  | "pending"
  | "calling"
  | "confirmed"
  | "cancelled"
  | "no_answer";

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export type LeadStatus =
  | "new"
  | "called"
  | "qualified"
  | "not_interested"
  | "no_answer";

export type TransactionType = "deposit" | "call_cost";

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
