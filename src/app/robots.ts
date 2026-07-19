import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://afrivoxai.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/campaigns",
          "/calls",
          "/wallet",
          "/settings",
          "/lead-databases",
          "/voice-cloning",
          "/african-voices",
          "/admin",
          "/e-commerce",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
