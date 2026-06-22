import type { MetadataRoute } from "next";

const BASE = "https://solange.app";

const routes = [
  "/",
  "/decouvrir",
  "/profil",
  "/messages",
  "/vendre",
  "/premium",
  "/drops",
  "/creer",
  "/favoris",
  "/notifications",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return routes.map((route) => ({
    url: `${BASE}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
