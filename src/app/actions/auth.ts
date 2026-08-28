"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizationBillingProfiles,
  organizations,
  users,
  wallets,
} from "@/lib/db/schema";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
import { getRegistrationErrorMessage } from "@/lib/auth-errors";
import { generateSlug } from "@/lib/utils";
import {
  createAuthSession,
  destroyAuthSession,
} from "@/lib/auth-local";
import { hashPassword, verifyPassword } from "@/lib/auth-crypto";

function isDemoAuthMode() {
  return process.env.AFRIVOXAI_DEMO_AUTH === "true";
}

export async function registerAction(formData: FormData) {
  const rawData = {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    organizationName: String(formData.get("organizationName") ?? "").trim(),
  };

  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  if (isDemoAuthMode()) redirect("/dashboard");

  const existing = await db.query.users.findFirst({
    where: eq(users.email, validated.data.email),
  });
  if (existing) return { error: "Un compte existe déjà avec cet email." };

  const password = await hashPassword(validated.data.password);
  const userId = randomUUID();
  const slug = `${generateSlug(validated.data.organizationName)}-${userId.slice(0, 8)}`;

  try {
    await db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({
          name: validated.data.organizationName,
          slug,
          shopName: validated.data.organizationName,
        })
        .returning();

      await tx.insert(users).values({
        id: userId,
        organizationId: organization.id,
        email: validated.data.email,
        passwordHash: password.hash,
        passwordSalt: password.salt,
        passwordResetRequired: false,
        role: "owner",
      });

      await tx.insert(wallets).values({
        organizationId: organization.id,
        balanceFcfa: "0",
      });

      await tx.insert(organizationBillingProfiles).values({
        organizationId: organization.id,
      });
    });
  } catch (error) {
    console.error("[auth/register] Erreur création compte local:", error);
    return { error: getRegistrationErrorMessage(error instanceof Error ? error.message : "") };
  }

  await createAuthSession(userId);
  redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
  const rawData = {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };

  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) return { error: validated.error.errors[0].message };

  if (isDemoAuthMode()) redirect("/dashboard");

  const user = await db.query.users.findFirst({
    where: eq(users.email, validated.data.email),
  });

  if (!user || !user.isActive) return { error: "Email ou mot de passe incorrect." };
  if (!user.passwordHash || !user.passwordSalt) {
    return {
      error: "Ce compte doit définir un nouveau mot de passe avant la première connexion.",
    };
  }

  const valid = await verifyPassword(
    validated.data.password,
    user.passwordSalt,
    user.passwordHash
  );
  if (!valid) return { error: "Email ou mot de passe incorrect." };

  await createAuthSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroyAuthSession();
  redirect("/login");
}
