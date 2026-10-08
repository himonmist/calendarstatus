import type { MetadataRoute } from "next";
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/book-training", "/manage", "/custom-request"].map(p => ({ url: `${site}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.8 }));
}
