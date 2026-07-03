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
        "127.0.0.1:3000",
        "afrivoxai.com",
        "www.afrivoxai.com",
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ?? "",
      ].filter(Boolean),
    },
  },
};

module.exports = nextConfig;
