import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/lib/legal";

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
  /* Les documents légaux sont indexables : l'accès « permanent » attendu
     par la LCEN passe aussi par les moteurs, pas seulement par un lien
     interne. */
  "/informations-legales",
  ...LEGAL_DOCS.map((d) => d.href),
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
