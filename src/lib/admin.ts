import { redirect } from "next/navigation";
import { getUserSession, type UserSession } from "@/lib/auth";

export const PLATFORM_ADMIN_PERMISSIONS = [
  "stats:view",
  "users:manage",
  "subscriptions:manage",
  "databases:manage",
  "databases:unlock",
  "admins:manage",
  "settings:manage",
] as const;

export type PlatformAdminPermission = (typeof PLATFORM_ADMIN_PERMISSIONS)[number];

// Configurable via SUPER_ADMIN_EMAIL ; le fallback conserve le compte
// fondateur existant pour ne pas casser les déploiements actuels.
export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ?? "c1domefa@gmail.com"
).toLowerCase();

export function isSuperAdmin(session: Pick<UserSession, "email" | "role"> | null | undefined) {
  return Boolean(
    session &&
      (session.role === "super_admin" || session.email.toLowerCase() === SUPER_ADMIN_EMAIL)
  );
}

export function isPlatformAdmin(session: Pick<UserSession, "email" | "role"> | null | undefined) {
  return Boolean(session && (isSuperAdmin(session) || session.role === "admin"));
}

export function hasAdminPermission(
  session: Pick<UserSession, "email" | "role" | "adminPermissions"> | null | undefined,
  permission: PlatformAdminPermission
) {
  if (!session) return false;
  if (isSuperAdmin(session)) return true;
  if (session.role !== "admin") return false;
  const permissions = Array.isArray(session.adminPermissions)
    ? session.adminPermissions
    : [];
  return permissions.includes(permission);
}

export async function requirePlatformAdmin(permission?: PlatformAdminPermission) {
  const session = await getUserSession();
  if (!session) redirect("/login");
  if (!isPlatformAdmin(session)) redirect("/dashboard");
  if (permission && !hasAdminPermission(session, permission)) redirect("/admin");
  return session;
}

export function effectiveSubscriptionLabel(session: Pick<UserSession, "subscriptionPlan" | "subscriptionExpiresAt" | "role" | "email">) {
  if (isSuperAdmin(session)) return "Enterprise illimité";
  if (session.subscriptionPlan === "free") return "Free";
  if (!session.subscriptionExpiresAt) return `${session.subscriptionPlan} permanent`;
  const expiresAt = new Date(session.subscriptionExpiresAt);
  if (expiresAt.getTime() < Date.now()) return "Free (expiré)";
  return `${session.subscriptionPlan} jusqu'au ${expiresAt.toLocaleDateString("fr-FR")}`;
}
