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

  // L'espace applicatif vit sous /dashboard ; la landing "/" est publique
  const isProtectedPage = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Protection des routes applicatives
  if (isProtectedPage && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protection des routes API (sauf webhooks entrants et health check)
  const publicApiRoutes = ["/api/webhooks/", "/api/health"];
  if (
    pathname.startsWith("/api/") &&
    !publicApiRoutes.some((route) => pathname.startsWith(route)) &&
    !user
  ) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Redirection des utilisateurs connectés loin des pages d'auth
  if ((pathname === "/login" || pathname === "/register") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
