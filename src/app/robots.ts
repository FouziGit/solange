import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  /* Site de démonstration (annonces fictives) : jamais indexé. */
  if (process.env.NEXT_PUBLIC_DEMO_ANNONCES === "1")
    return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://solange.app/sitemap.xml",
  };
}
