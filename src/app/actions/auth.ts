"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionUserAndOrg } from "@/lib/auth";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
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

  // Supabase renvoie un `user` avec identities vides quand l'email existe déjà
  // (anti-énumération). On évite alors de créer une organisation orpheline.
  const isExistingUser =
    data.user && (data.user.identities?.length ?? 0) === 0;
  if (isExistingUser) {
    return { error: "Cette adresse email est déjà utilisée." };
  }

  if (data.user) {
    try {
      await provisionUserAndOrg({
        authUserId: data.user.id,
        email: validated.data.email,
        organizationName: validated.data.organizationName,
      });
    } catch (provisionError) {
      console.error("[auth] Échec du provisionnement:", provisionError);
      return {
        error:
          "Compte créé mais initialisation impossible. Contactez le support.",
      };
    }
  }

  // Session immédiate uniquement si la confirmation email est désactivée.
  if (data.session) {
    redirect("/dashboard");
  }

  return {
    success: true,
    message: "Vérifiez votre email pour confirmer votre compte.",
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
