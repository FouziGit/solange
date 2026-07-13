import type { Metadata } from "next";

const title = "Live";
const description =
  "Le shopping en direct de Solange : les vendeuses et vendeurs présentent leurs pièces de seconde main en live, tu commentes et tu achètes en temps réel.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/live" },
  openGraph: { title, description, url: "/live" },
};

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
