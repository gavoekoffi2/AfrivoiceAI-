"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
import { provisionNewOrganization } from "@/lib/db/provisioning";
import { redirect } from "next/navigation";

export async function registerAction(formData: FormData) {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    organizationName: formData.get("organizationName") as string,
  };

  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      error: validated.error.errors[0].message,
    };
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      data: {
        organization_name: validated.data.organizationName,
      },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "Cette adresse email est déjà utilisée." };
    }
    return { error: error.message };
  }

  // Cas Supabase anti-énumération : un utilisateur existant renvoie un `user`
  // sans `identities`. On ne provisionne pas et on reste neutre.
  if (!data.user || (data.user.identities?.length ?? 0) === 0) {
    return {
      success: true,
      message:
        "Si cette adresse n'est pas déjà utilisée, vous recevrez un email de confirmation.",
    };
  }

  // Provisionner l'organisation + l'utilisateur applicatif + le wallet.
  // Sans cette étape, getUserSession() renverrait toujours null et le
  // tableau de bord serait inaccessible.
  try {
    await provisionNewOrganization({
      userId: data.user.id,
      email: validated.data.email,
      organizationName: validated.data.organizationName,
    });
  } catch (provisionError) {
    console.error("[auth] Échec du provisioning de l'organisation:", provisionError);
    return {
      error:
        "Votre compte a été créé mais son initialisation a échoué. Contactez le support.",
    };
  }

  // Session active immédiatement (confirmation email désactivée) → dashboard.
  if (data.session) {
    redirect("/dashboard");
  }

  // Sinon, confirmation d'email requise.
  return {
    success: true,
    message: "Vérifiez votre email pour confirmer votre compte, puis connectez-vous.",
  };
}

export async function loginAction(formData: FormData) {
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

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  // Auto-réparation : garantit que l'utilisateur possède bien une organisation
  // (cas d'un compte créé avant le provisioning, ou d'un échec précédent).
  // Sans cela, getUserSession() renverrait null et provoquerait une boucle
  // de redirection /login ↔ /dashboard. Idempotent.
  if (data.user) {
    const orgName =
      (data.user.user_metadata?.organization_name as string | undefined) ||
      data.user.email?.split("@")[0] ||
      "Mon organisation";
    try {
      await provisionNewOrganization({
        userId: data.user.id,
        email: data.user.email ?? validated.data.email,
        organizationName: orgName,
      });
    } catch (provisionError) {
      console.error("[auth] Auto-réparation du provisioning échouée:", provisionError);
      return {
        error:
          "Connexion réussie mais l'initialisation du compte a échoué. Réessayez ou contactez le support.",
      };
    }
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
