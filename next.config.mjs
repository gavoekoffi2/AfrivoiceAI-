/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "storage.vapi.ai",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ?? "",
      ].filter(Boolean),
    },
  },
  async headers() {
    return [
      {
        // En-têtes de sécurité appliqués à toutes les routes (défense en
        // profondeur — fonctionne aussi sans le reverse proxy Nginx).
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
