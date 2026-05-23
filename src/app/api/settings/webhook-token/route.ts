import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Régénère le webhook_token de l'organisation.
 * À utiliser si le token a été compromis.
 */
export async function POST() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (session.role !== "owner" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Permission insuffisante" },
      { status: 403 }
    );
  }

  const newToken = crypto.randomBytes(32).toString("hex");

  await db
    .update(organizations)
    .set({ webhookToken: newToken, updatedAt: new Date() })
    .where(eq(organizations.id, session.organizationId));

  revalidatePath("/dashboard/settings");
  return NextResponse.json({ success: true, webhookToken: newToken });
}
