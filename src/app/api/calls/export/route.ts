import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calls, leads, orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return new Response("Non autorisé", { status: 401 });
  }

  const rows = await db
    .select({
      id: calls.id,
      vapiCallId: calls.vapiCallId,
      type: calls.type,
      status: calls.status,
      outcome: calls.outcome,
      durationSeconds: calls.durationSeconds,
      costFcfa: calls.costFcfa,
      costUsd: calls.costUsd,
      summary: calls.summary,
      endedReason: calls.endedReason,
      createdAt: calls.createdAt,
      orderCustomer: orders.customerName,
      orderPhone: orders.customerPhone,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(calls)
    .leftJoin(orders, eq(calls.orderId, orders.id))
    .leftJoin(leads, eq(calls.leadId, leads.id))
    .where(eq(calls.organizationId, session.organizationId))
    .orderBy(desc(calls.createdAt))
    .limit(10_000);

  const headers = [
    "id",
    "vapi_call_id",
    "type",
    "status",
    "outcome",
    "duration_seconds",
    "cost_fcfa",
    "cost_usd",
    "contact_name",
    "contact_phone",
    "summary",
    "ended_reason",
    "created_at",
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.vapiCallId,
        r.type,
        r.status,
        r.outcome,
        r.durationSeconds,
        r.costFcfa,
        r.costUsd,
        r.orderCustomer ?? r.leadName ?? "",
        r.orderPhone ?? r.leadPhone ?? "",
        r.summary,
        r.endedReason,
        r.createdAt.toISOString(),
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  const filename = `afrivoice-calls-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
