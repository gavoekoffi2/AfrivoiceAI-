import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          });
          supabaseResponse.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          });
          supabaseResponse.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const protectedRoutes = [
    "/",
    "/admin",
    "/agents",
    "/e-commerce",
    "/campaigns",
    "/calls",
    "/wallet",
    "/settings",
    "/voice-cloning",
    "/african-voices",
    "/lead-databases",
  ];
  const isProtectedPage = protectedRoutes.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`)
  );

  // Protection des routes applicatives
  if (isProtectedPage && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Routes API portant leur PROPRE authentification (pas de session Supabase) :
  // - /api/webhooks/*  : signatures HMAC des fournisseurs
  // - /api/v1/*        : clés API par organisation (API publique)
  // - /api/widget/*    : clé publique + allowlist domaines + token éphémère
  // - /api/telephony/* : token de callback télécom dédié
  const selfAuthenticatedApi =
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/widget/") ||
    pathname.startsWith("/api/telephony/");

  // Protection des routes API à session
  if (pathname.startsWith("/api/") && !selfAuthenticatedApi && !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Redirection des utilisateurs connectés loin des pages d'auth
  if ((pathname === "/login" || pathname === "/register") && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
