import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || "c1domefa@gmail.com";
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) throw new Error("SUPER_ADMIN_PASSWORD manquant.");

  const { createSupabaseServiceClient } = await import("../src/lib/supabase/server");
  const { db } = await import("../src/lib/db");
  const { organizations, users, wallets } = await import("../src/lib/db/schema");
  const { generateSlug } = await import("../src/lib/utils");
  const { eq } = await import("drizzle-orm");

  const supabase = createSupabaseServiceClient();
  const normalizedEmail = email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });

  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    await db.update(users).set({
      role: "super_admin",
      subscriptionPlan: "enterprise",
      subscriptionExpiresAt: null,
      isActive: true,
      adminPermissions: null,
    }).where(eq(users.id, existing.id));
    console.log(JSON.stringify({ status: "updated", email: normalizedEmail }));
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { organization_name: "Super Administration AfrivoiceAI" },
  });
  if (error || !data.user) throw new Error(error?.message || "Création Supabase impossible.");

  try {
    await db.transaction(async (tx) => {
      const orgName = "Super Administration AfrivoiceAI";
      const [organization] = await tx.insert(organizations).values({
        name: orgName,
        slug: `${generateSlug(orgName)}-${data.user!.id.slice(0, 8)}`,
        shopName: orgName,
      }).returning();
      await tx.insert(users).values({
        id: data.user!.id,
        organizationId: organization.id,
        email: normalizedEmail,
        role: "super_admin",
        subscriptionPlan: "enterprise",
        subscriptionExpiresAt: null,
        isActive: true,
        adminPermissions: null,
      });
      await tx.insert(wallets).values({ organizationId: organization.id, balanceFcfa: "0" });
    });
    console.log(JSON.stringify({ status: "created", email: normalizedEmail }));
  } catch (error) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
