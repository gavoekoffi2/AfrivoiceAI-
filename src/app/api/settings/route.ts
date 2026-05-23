import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateOrganizationSchema } from "@/lib/validations/organization";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/settings");

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.organizationId))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: "Organisation introuvable" },
      { status: 404 }
    );
  }

  return NextResponse.json({ organization: org });
}

export async function PATCH(req: Request) {
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const validated = updateOrganizationSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Données invalides", details: validated.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (validated.data.name !== undefined) updateValues.name = validated.data.name;
    if (validated.data.shopName !== undefined)
      updateValues.shopName = validated.data.shopName;
    if (validated.data.shopifyDomain !== undefined)
      updateValues.shopifyDomain = validated.data.shopifyDomain;
    if (validated.data.woocommerceDomain !== undefined)
      updateValues.woocommerceDomain = validated.data.woocommerceDomain;
    if (validated.data.lowBalanceThresholdFcfa !== undefined)
      updateValues.lowBalanceThresholdFcfa =
        validated.data.lowBalanceThresholdFcfa.toFixed(2);

    const [updated] = await db
      .update(organizations)
      .set(updateValues)
      .where(eq(organizations.id, session.organizationId))
      .returning();

    revalidatePath("/dashboard", "layout");
    log.info("Organisation mise à jour", { orgId: session.organizationId });

    return NextResponse.json({ organization: updated });
  } catch (err) {
    log.error("Mise à jour échouée", { error: String(err) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
