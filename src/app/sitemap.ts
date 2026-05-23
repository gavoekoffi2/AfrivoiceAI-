import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://votre-domaine.com";
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, priority: 1.0 },
    { url: `${siteUrl}/login`, lastModified: now, priority: 0.5 },
    { url: `${siteUrl}/register`, lastModified: now, priority: 0.5 },
    { url: `${siteUrl}/terms`, lastModified: now, priority: 0.3 },
    { url: `${siteUrl}/privacy`, lastModified: now, priority: 0.3 },
  ];
}
