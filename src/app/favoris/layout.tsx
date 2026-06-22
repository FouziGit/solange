import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favoris",
  description:
    "Ta sélection : les pièces enregistrées et les vendeurs que tu suis sur Solange.",
};

export default function FavorisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
