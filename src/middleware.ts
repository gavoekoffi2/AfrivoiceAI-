import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/e-commerce",
  "/campaigns",
  "/calls",
  "/wallet",
  "/settings",
  "/lead-databases",
  "/voice-cloning",
  "/african-voices",
  "/admin",
];

const AUTH_PAGES = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail-closed : sans configuration Supabase, personne n'est considéré
  // comme connecté (les pages protégées redirigent vers /login) mais les
  // pages publiques restent servies.
  let user: { id: string } | null = null;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
    });

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      user = authUser;
    } catch (error) {
      console.error("[middleware] Vérification de session impossible:", error);
    }
  } else {
    console.error(
      "[middleware] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquants — accès authentifié désactivé"
    );
  }

  const pathname = request.nextUrl.pathname;

  const isProtectedPage = PROTECTED_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Protection des routes applicatives
  if (isProtectedPage && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Routes API appelées par des services externes : elles vérifient
  // leur propre secret (HMAC / Bearer) dans le handler.
  const isExternallyAuthenticatedApi =
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/health") ||
    pathname === "/api/tts/ewe/vapi" ||
    pathname === "/api/voice-cloning/openvoice/callback";

  // Protection des routes API internes
  if (pathname.startsWith("/api/") && !isExternallyAuthenticatedApi && !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Redirection des utilisateurs connectés loin des pages d'auth
  if (AUTH_PAGES.includes(pathname) && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|mp4|wav)$).*)",
  ],
};
