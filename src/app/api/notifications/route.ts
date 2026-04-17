import { NextResponse } from "next/server";
import { desc, eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.organizationId, session.organizationId))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  const unread = rows.filter((n) => !n.read).length;
  return NextResponse.json({ notifications: rows, unread });
}

export async function PATCH(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const markAll = body.all === true;

  if (markAll) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.organizationId, session.organizationId));
  } else if (ids.length > 0) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.organizationId, session.organizationId),
          inArray(notifications.id, ids)
        )
      );
  } else {
    return NextResponse.json({ error: "Aucun id fourni" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
