import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Créer",
  description:
    "Compose un look éditorial shoppable : médias, légende, pièces taguées. Publie-le dans le feed Solange.",
};

export default function CreerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
