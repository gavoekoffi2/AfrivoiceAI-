"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, users, wallets, transactions, leadDatabasePurchases, leadDatabases } from "@/lib/db/schema";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/utils";
import { isSuperAdmin, PLATFORM_ADMIN_PERMISSIONS, requirePlatformAdmin, SUPER_ADMIN_EMAIL } from "@/lib/admin";

type AdminActionResult = { success?: string; error?: string };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function expirationFromDuration(duration: string) {
  if (!duration || duration === "permanent") return null;
  const days = Number(duration);
  if (!Number.isFinite(days) || days <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function ensureUserProfile({
  email,
  password,
  role,
  organizationName,
}: {
  email: string;
  password?: string;
  role: string;
  organizationName?: string;
}) {
  const normalizedEmail = email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existing) return existing;

  const serviceSupabase = createSupabaseServiceClient();
  const { data, error } = await serviceSupabase.auth.admin.createUser({
    email: normalizedEmail,
    password: password || crypto.randomUUID(),
    email_confirm: true,
    user_metadata: {
      organization_name: organizationName || normalizedEmail.split("@")[0],
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Impossible de créer le compte Supabase.");
  }

  const orgName = organizationName || `Compte ${normalizedEmail}`;
  const slug = `${generateSlug(orgName)}-${data.user.id.slice(0, 8)}`;

  try {
    const [createdUser] = await db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({ name: orgName, slug, shopName: orgName })
        .returning();

      const [profile] = await tx
        .insert(users)
        .values({
          id: data.user!.id,
          organizationId: organization.id,
          email: normalizedEmail,
          role,
          subscriptionPlan: role === "super_admin" ? "enterprise" : "free",
          subscriptionExpiresAt: null,
          isActive: true,
          adminPermissions: role === "admin" ? [...PLATFORM_ADMIN_PERMISSIONS] : null,
        })
        .returning();

      await tx.insert(wallets).values({ organizationId: organization.id, balanceFcfa: "0" });
      return [profile];
    });
    return createdUser;
  } catch (error) {
    await serviceSupabase.auth.admin.deleteUser(data.user.id);
    throw error;
  }
}

export async function grantSubscriptionAction(formData: FormData): Promise<AdminActionResult> {
  await requirePlatformAdmin("subscriptions:manage");

  const email = value(formData, "email").toLowerCase();
  const plan = value(formData, "plan") || "enterprise";
  const duration = value(formData, "duration") || "permanent";
  const role = value(formData, "role") || "owner";
  const organizationName = value(formData, "organizationName") || undefined;
  const initialPassword = value(formData, "initialPassword") || undefined;

  if (!email.includes("@")) return { error: "Email invalide." };
  if (!["free", "pro", "enterprise"].includes(plan)) return { error: "Plan invalide." };
  if (!["super_admin", "admin", "owner", "member"].includes(role)) return { error: "Rôle invalide." };

  try {
    const user = await ensureUserProfile({ email, password: initialPassword, role, organizationName });
    await db
      .update(users)
      .set({
        role,
        subscriptionPlan: plan,
        subscriptionExpiresAt: plan === "free" ? new Date() : expirationFromDuration(duration),
        isActive: true,
        adminPermissions: role === "admin" ? [...PLATFORM_ADMIN_PERMISSIONS] : role === "super_admin" ? null : user.adminPermissions,
      })
      .where(eq(users.id, user.id));

    revalidatePath("/admin");
    revalidatePath("/lead-databases");
    return { success: `Accès mis à jour pour ${email}.` };
  } catch (error) {
    console.error("[admin] grantSubscriptionAction", error);
    return { error: error instanceof Error ? error.message : "Erreur serveur." };
  }
}

export async function updateUserStatusAction(formData: FormData): Promise<AdminActionResult> {
  const session = await requirePlatformAdmin("users:manage");
  const userId = value(formData, "userId");
  const operation = value(formData, "operation");
  if (!userId) return { error: "Utilisateur manquant." };
  if (userId === session.id && operation !== "activate") return { error: "Impossible de bloquer ton propre compte." };

  const patches: Partial<typeof users.$inferInsert> = {};
  if (operation === "activate") patches.isActive = true;
  if (operation === "deactivate") patches.isActive = false;
  if (operation === "make-admin") {
    patches.role = "admin";
    patches.adminPermissions = [...PLATFORM_ADMIN_PERMISSIONS];
  }
  if (operation === "remove-admin") {
    patches.role = "member";
    patches.adminPermissions = null;
  }
  if (!Object.keys(patches).length) return { error: "Opération inconnue." };

  await db.update(users).set(patches).where(eq(users.id, userId));
  revalidatePath("/admin");
  return { success: "Utilisateur mis à jour." };
}

export async function updateAdminPermissionsAction(formData: FormData): Promise<AdminActionResult> {
  await requirePlatformAdmin("admins:manage");
  const userId = value(formData, "userId");
  const permissions = PLATFORM_ADMIN_PERMISSIONS.filter((permission) => formData.get(permission) === "on");
  if (!userId) return { error: "Administrateur manquant." };

  await db
    .update(users)
    .set({ role: "admin", adminPermissions: permissions })
    .where(eq(users.id, userId));
  revalidatePath("/admin");
  return { success: "Permissions sous-admin mises à jour." };
}

export async function manualWalletRechargeAction(formData: FormData): Promise<AdminActionResult> {
  const session = await requirePlatformAdmin("users:manage");
  if (!isSuperAdmin(session)) {
    return { error: "Seul le super administrateur peut créditer manuellement un wallet." };
  }

  const email = value(formData, "email").toLowerCase();
  const amount = Number(value(formData, "amountFcfa"));
  const reason = value(formData, "reason") || "Recharge manuelle super administrateur";

  if (!email.includes("@")) return { error: "Email invalide." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Montant invalide." };
  if (amount > 100000000) return { error: "Montant trop élevé pour une opération manuelle." };

  try {
    const targetUser = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!targetUser) return { error: `Compte introuvable pour ${email}.` };

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, targetUser.organizationId))
      .limit(1);

    if (!wallet) return { error: "Wallet introuvable pour ce compte." };

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        walletId: wallet.id,
        type: "admin_manual_credit",
        amountFcfa: amount.toString(),
        description: reason,
        metadata: {
          operation: "super_admin_manual_recharge",
          targetEmail: email,
          targetUserId: targetUser.id,
          requestedBy: session.id,
          requestedByEmail: session.email,
        },
      });

      await tx
        .update(wallets)
        .set({
          balanceFcfa: sql`${wallets.balanceFcfa} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
    });

    revalidatePath("/admin");
    revalidatePath("/wallet");
    return { success: `${amount.toLocaleString("fr-FR")} FCFA ajoutés au wallet de ${email}.` };
  } catch (error) {
    console.error("[admin] manualWalletRechargeAction", error);
    return { error: error instanceof Error ? error.message : "Erreur serveur." };
  }
}

export async function unlockDatabaseForUserAction(formData: FormData): Promise<AdminActionResult> {
  await requirePlatformAdmin("databases:unlock");
  const email = value(formData, "email").toLowerCase();
  const databaseId = value(formData, "databaseId");
  if (!email.includes("@")) return { error: "Email invalide." };

  try {
    const user = await ensureUserProfile({ email, role: "owner" });
    const databases = databaseId === "all"
      ? await db.select().from(leadDatabases).where(eq(leadDatabases.isPublished, true))
      : await db.select().from(leadDatabases).where(eq(leadDatabases.id, databaseId));

    for (const database of databases) {
      await db
        .insert(leadDatabasePurchases)
        .values({
          organizationId: user.organizationId,
          databaseId: database.id,
          amountFcfa: "0",
          accessLevel: "admin_grant",
          exportAllowed: true,
          campaignAllowed: true,
        })
        .onConflictDoNothing({
          target: [leadDatabasePurchases.organizationId, leadDatabasePurchases.databaseId],
        });
    }

    revalidatePath("/admin");
    revalidatePath("/lead-databases");
    return { success: `${databases.length} base(s) débloquée(s) pour ${email}.` };
  } catch (error) {
    console.error("[admin] unlockDatabaseForUserAction", error);
    return { error: error instanceof Error ? error.message : "Erreur serveur." };
  }
}

export async function ensureFounderSuperAdminAction(formData: FormData): Promise<AdminActionResult> {
  await requirePlatformAdmin("admins:manage");
  const email = (value(formData, "email") || SUPER_ADMIN_EMAIL).toLowerCase();
  const password = value(formData, "password") || undefined;
  try {
    const user = await ensureUserProfile({
      email,
      password,
      role: "super_admin",
      organizationName: "Super Administration AfrivoxAI",
    });
    await db
      .update(users)
      .set({
        role: "super_admin",
        subscriptionPlan: "enterprise",
        subscriptionExpiresAt: null,
        isActive: true,
        adminPermissions: null,
      })
      .where(eq(users.id, user.id));
    revalidatePath("/admin");
    return { success: `Super administrateur confirmé pour ${email}.` };
  } catch (error) {
    console.error("[admin] ensureFounderSuperAdminAction", error);
    return { error: error instanceof Error ? error.message : "Erreur serveur." };
  }
}
