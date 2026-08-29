import type { MetadataRoute } from "next";

/** PWA — « Ajouter à l'écran d'accueil » : SOLANGE se lance plein écran
    comme une app native, sans App Store. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SOLANGE",
    short_name: "SOLANGE",
    description:
      "Mode de seconde main — feed, boutique, communauté. Beta de démonstration.",
    id: "/",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0d0e",
    theme_color: "#0d0d0e",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
