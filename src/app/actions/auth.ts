"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, users, wallets } from "@/lib/db/schema";
import { generateSlug } from "@/lib/utils";

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

  if (data.user) {
    const slugBase = generateSlug(validated.data.organizationName);
    const slug = `${slugBase}-${data.user.id.slice(0, 8)}`;

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
          id: data.user!.id,
          organizationId: organization.id,
          email: validated.data.email,
          role: "owner",
        });

        await tx.insert(wallets).values({
          organizationId: organization.id,
          balanceFcfa: "0",
        });
      });
    } catch (dbError) {
      console.error("[auth/register] Erreur création profil DB:", dbError);
      return {
        error:
          "Compte Auth créé, mais l'espace entreprise n'a pas pu être initialisé. Contactez le support.",
      };
    }

    if (data.session) {
      redirect("/");
    }
  }

  return { success: true, message: "Vérifiez votre email pour confirmer votre compte." };
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

  redirect("/");
}

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
