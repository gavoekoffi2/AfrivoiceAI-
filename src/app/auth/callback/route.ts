import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionUser } from "@/lib/auth";

/**
 * Endpoint appelé par Supabase après confirmation d'email
 * ou flow OAuth. Échange le code contre une session puis redirige.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "auth_failed")}`
    );
  }

  // Provisionnement défensif
  await provisionUser({
    authUserId: data.user.id,
    email: data.user.email ?? "",
    organizationName:
      (data.user.user_metadata?.organization_name as string | undefined) ??
      (data.user.email ? data.user.email.split("@")[0] : "Mon Organisation"),
  });

  return NextResponse.redirect(`${origin}${next}`);
}
