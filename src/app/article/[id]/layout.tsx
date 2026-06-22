import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Pièce de seconde main authentifiée sur SOLANGE. Détail produit, taille, état et vendeur vérifié. Achète ou fais une offre.",
};

export default function ArticleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
