import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Communauté",
  description:
    "Rejoins les cercles SOLANGE : mode, culture, archives et l'impact des rappeurs sur le vestiaire. Des créateurs qui échangent, débattent et partagent leurs trouvailles.",
  alternates: { canonical: "/communaute" },
};

export default function CommunauteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
