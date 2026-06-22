import type { Metadata } from "next";

const title = "Vendre";
const description =
  "Mets une pièce en vente en moins d'une minute. Commission légère, tu fixes ton prix.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/vendre" },
  openGraph: { title, description, url: "/vendre" },
};

const BASE = "https://solange.app";

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
    { "@type": "ListItem", position: 2, name: title, item: `${BASE}/vendre` },
  ],
};

export default function VendreLayout({
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
