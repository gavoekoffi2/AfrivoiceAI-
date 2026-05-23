/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "https", hostname: "storage.vapi.ai" },
      { protocol: "https", hostname: "**.elevenlabs.io" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ?? "",
      ].filter(Boolean),
    },
  },
};

export default nextConfig;
