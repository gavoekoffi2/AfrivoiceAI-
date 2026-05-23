"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/validations/auth";
import { provisionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/utils/rate-limit";
import { headers } from "next/headers";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("actions/auth");

function getClientIpFromHeaders(): string {
  const h = headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function registerAction(formData: FormData) {
  const ip = getClientIpFromHeaders();
  const rl = rateLimit(`register:${ip}`, 5, 5 * 60_000);
  if (!rl.success) {
    return { error: "Trop d'inscriptions depuis cette adresse. Réessayez dans quelques minutes." };
  }

  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    organizationName: formData.get("organizationName") as string,
    acceptTerms: formData.get("acceptTerms") as string | null,
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
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "Cette adresse email est déjà utilisée." };
    }
    log.warn("Erreur inscription Supabase", { error: error.message });
    return { error: error.message };
  }

  // Provisionnement applicatif au cas où le trigger SQL n'est pas en place
  if (data.user) {
    await provisionUser({
      authUserId: data.user.id,
      email: validated.data.email,
      organizationName: validated.data.organizationName,
    });

    if (data.session) {
      redirect("/dashboard");
    }
  }

  return {
    success: true,
    message:
      "Compte créé ! Vérifiez votre boîte email pour confirmer votre adresse.",
  };
}

export async function loginAction(formData: FormData) {
  const ip = getClientIpFromHeaders();
  const rl = rateLimit(`login:${ip}`, 10, 5 * 60_000);
  if (!rl.success) {
    return { error: "Trop de tentatives de connexion. Réessayez dans quelques minutes." };
  }

  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error || !data.user) {
    return { error: "Email ou mot de passe incorrect." };
  }

  // Provisionnement défensif : si la ligne user n'existe pas, on la crée
  await provisionUser({
    authUserId: data.user.id,
    email: data.user.email ?? validated.data.email,
    organizationName:
      (data.user.user_metadata?.organization_name as string | undefined) ??
      validated.data.email.split("@")[0],
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(formData: FormData) {
  const ip = getClientIpFromHeaders();
  const rl = rateLimit(`forgot:${ip}`, 5, 10 * 60_000);
  if (!rl.success) {
    return { error: "Trop de demandes. Réessayez plus tard." };
  }

  const validated = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const supabase = createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // On répond toujours OK pour ne pas leaker l'existence des comptes
  await supabase.auth.resetPasswordForEmail(validated.data.email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  return {
    success: true,
    message:
      "Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.",
  };
}

export async function resetPasswordAction(formData: FormData) {
  const validated = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: validated.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Mot de passe mis à jour." };
}

export async function changePasswordAction(formData: FormData) {
  const validated = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Non autorisé" };

  // Re-vérifier le mot de passe actuel
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: validated.data.currentPassword,
  });
  if (checkError) {
    return { error: "Mot de passe actuel incorrect." };
  }

  const { error } = await supabase.auth.updateUser({
    password: validated.data.newPassword,
  });
  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Mot de passe modifié avec succès." };
}
