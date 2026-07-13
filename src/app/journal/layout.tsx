import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Le magazine SOLANGE. Focus maisons, vestiaires thématiques et entretiens avec les curatrices et curateurs de la seconde main.",
};

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
