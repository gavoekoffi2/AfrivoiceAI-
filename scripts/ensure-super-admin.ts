import { loadEnvConfig } from "@next/env";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

loadEnvConfig(process.cwd());

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || "c1domefa@gmail.com").toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) throw new Error("SUPER_ADMIN_PASSWORD manquant.");

  const { db } = await import("../src/lib/db");
  const { organizations, users, wallets, organizationBillingProfiles } = await import("../src/lib/db/schema");
  const { generateSlug } = await import("../src/lib/utils");
  const { hashPassword } = await import("../src/lib/auth-crypto");

  const passwordData = await hashPassword(password);
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (existing) {
    await db.update(users).set({
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      passwordResetRequired: false,
      role: "super_admin",
      subscriptionPlan: "enterprise",
      subscriptionExpiresAt: null,
      isActive: true,
      adminPermissions: null,
    }).where(eq(users.id, existing.id));
    console.log(JSON.stringify({ status: "updated", email }));
    return;
  }

  const userId = randomUUID();
  const orgName = "Super Administration AfrivoxAI";
  await db.transaction(async (tx) => {
    const [organization] = await tx.insert(organizations).values({
      name: orgName,
      slug: `${generateSlug(orgName)}-${userId.slice(0, 8)}`,
      shopName: orgName,
    }).returning();
    await tx.insert(users).values({
      id: userId,
      organizationId: organization.id,
      email,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      passwordResetRequired: false,
      role: "super_admin",
      subscriptionPlan: "enterprise",
      subscriptionExpiresAt: null,
      isActive: true,
      adminPermissions: null,
    });
    await tx.insert(wallets).values({ organizationId: organization.id, balanceFcfa: "0" });
    await tx.insert(organizationBillingProfiles).values({ organizationId: organization.id });
  });
  console.log(JSON.stringify({ status: "created", email }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Erreur serveur");
  process.exit(1);
});
