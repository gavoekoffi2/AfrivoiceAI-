import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/terms",
  "/privacy",
];

const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password"]);

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

  // Webhooks publics — pas d'auth
  if (pathname.startsWith("/api/webhooks/") || pathname === "/api/health") {
    return supabaseResponse;
  }

  // Auth callback Supabase
  if (pathname.startsWith("/auth/")) {
    return supabaseResponse;
  }

  // Dashboard : protégé
  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // API : protégée sauf publiques
  if (pathname.startsWith("/api/") && !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Redirection si déjà connecté depuis les pages d'auth ou la landing
  if (user && (AUTH_PATHS.has(pathname) || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
