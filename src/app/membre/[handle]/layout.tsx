import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Membre",
  description:
    "Profil public d'un membre SOLANGE : annonces en vente et posts publiés.",
};

export default function MembreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
