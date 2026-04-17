"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { organizations, users, wallets, notifications } from "@/lib/db/schema";
import { generateSlug } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

function getClientIp(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

async function generateUniqueSlug(base: string): Promise<string> {
  let slug = generateSlug(base) || `org-${Date.now().toString(36)}`;
  let attempt = 0;
  while (attempt < 10) {
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (existing.length === 0) return slug;
    attempt += 1;
    slug = `${generateSlug(base)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function registerAction(formData: FormData) {
  const ip = getClientIp();
  const rl = rateLimit(`auth:register:${ip}`, 5, 60 * 60_000);
  if (!rl.success) {
    return {
      error: "Trop d'inscriptions depuis votre IP. Réessayez plus tard.",
    };
  }

  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    organizationName: formData.get("organizationName") as string,
    fullName: (formData.get("fullName") as string) ?? "",
  };

  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      data: {
        organization_name: validated.data.organizationName,
        full_name: validated.data.fullName,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Cette adresse email est déjà utilisée." };
    }
    return { error: error.message };
  }

  const authUser = data.user;
  if (!authUser) {
    return {
      success: true,
      message: "Vérifiez votre email pour confirmer votre compte.",
    };
  }

  // Création atomique de l'organisation + utilisateur + wallet
  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (existing.length === 0) {
      const slug = await generateUniqueSlug(validated.data.organizationName);

      await db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({
            name: validated.data.organizationName,
            slug,
          })
          .returning();

        await tx.insert(users).values({
          id: authUser.id,
          organizationId: org.id,
          email: validated.data.email,
          fullName: validated.data.fullName || null,
          role: "owner",
        });

        await tx.insert(wallets).values({
          organizationId: org.id,
          balanceFcfa: "0",
        });

        await tx.insert(notifications).values({
          organizationId: org.id,
          userId: authUser.id,
          type: "system",
          title: "Bienvenue sur AfrivoiceAI",
          body: "Complétez votre onboarding pour lancer vos premiers appels IA.",
          link: "/dashboard/onboarding",
        });
      });
    }
  } catch (err) {
    logger.error("auth/register", "Provisioning error", { error: String(err) });
    // Rollback: supprimer l'utilisateur Supabase pour ne pas bloquer un réessai
    try {
      const admin = createSupabaseServiceClient();
      await admin.auth.admin.deleteUser(authUser.id);
    } catch (rollbackErr) {
      logger.error("auth/register", "Rollback failed", {
        error: String(rollbackErr),
      });
    }
    return {
      error:
        "Erreur lors de la création de votre compte. Veuillez réessayer.",
    };
  }

  redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
  const ip = getClientIp();
  const email = (formData.get("email") as string) ?? "";
  const rlIp = rateLimit(`auth:login:ip:${ip}`, 10, 15 * 60_000);
  const rlEmail = rateLimit(
    `auth:login:email:${email.toLowerCase()}`,
    5,
    15 * 60_000
  );
  if (!rlIp.success || !rlEmail.success) {
    return {
      error: "Trop de tentatives. Réessayez dans quelques minutes.",
    };
  }

  const rawData = {
    email,
    password: formData.get("password") as string,
  };

  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
