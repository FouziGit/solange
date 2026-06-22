import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Drops",
  description:
    "Drops en direct et collaborations exclusives sur SOLANGE. Curateurs, friperies et maisons d'archive révèlent leurs pièces rares.",
};

export default function DropsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
