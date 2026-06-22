import type { Metadata } from "next";

const title = "Messages";
const description =
  "Ta boîte de réception SOLANGE. Négocie, organise l'envoi et discute avec acheteurs et vendeurs.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/messages" },
  openGraph: { title, description, url: "/messages" },
};

const BASE = "https://solange.app";

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
    { "@type": "ListItem", position: 2, name: title, item: `${BASE}/messages` },
  ],
};

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
