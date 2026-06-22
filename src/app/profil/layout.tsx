import type { Metadata } from "next";

const title = "Profil";
const description =
  "Ta vitrine SOLANGE : pièces à vendre, looks publiés et favoris. Curateur seconde main.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/profil" },
  openGraph: { title, description, url: "/profil" },
};

const BASE = "https://solange.app";

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
    { "@type": "ListItem", position: 2, name: title, item: `${BASE}/profil` },
  ],
};

export default function ProfilLayout({
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
