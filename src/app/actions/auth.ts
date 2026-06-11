"use server";

import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, users, wallets } from "@/lib/db/schema";
import { getRegistrationErrorMessage } from "@/lib/auth-errors";
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

  const serviceSupabase = createSupabaseServiceClient();

  const { data, error } = await serviceSupabase.auth.admin.createUser({
    email: validated.data.email,
    password: validated.data.password,
    email_confirm: true,
    user_metadata: {
      organization_name: validated.data.organizationName,
    },
  });

  if (error) {
    return { error: getRegistrationErrorMessage(error.message) };
  }

  if (!data.user) {
    return { error: "Impossible de créer le compte. Réessayez." };
  }

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
    await serviceSupabase.auth.admin.deleteUser(data.user.id);
    return {
      error:
        "Le compte n'a pas pu être initialisé. Réessayez dans quelques instants.",
    };
  }

  const supabase = createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (signInError) {
    console.error("[auth/register] Connexion automatique impossible:", signInError);
    return {
      success: true,
      message:
        "Compte créé. Vous pouvez maintenant vous connecter avec votre email et mot de passe.",
    };
  }

  redirect("/dashboard");
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
