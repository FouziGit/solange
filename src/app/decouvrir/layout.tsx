import type { Metadata } from "next";
import { catalog } from "@/lib/mock";

const title = "Découvrir";
const description =
  "Le moteur de recherche de la mode de seconde main. Marques, styles, archives : filtre, chine, achète.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/decouvrir" },
  openGraph: { title, description, url: "/decouvrir" },
};

const BASE = "https://solange.app";

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Marketplace SOLANGE",
  numberOfItems: catalog.length,
  itemListElement: catalog.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Product",
      name: `${item.brand} ${item.name}`,
      brand: { "@type": "Brand", name: item.brand },
      category: item.category,
      offers: {
        "@type": "Offer",
        price: item.priceEUR,
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        itemCondition:
          item.condition === "Neuf avec étiquette"
            ? "https://schema.org/NewCondition"
            : "https://schema.org/UsedCondition",
      },
    },
  })),
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
    {
      "@type": "ListItem",
      position: 2,
      name: title,
      item: `${BASE}/decouvrir`,
    },
  ],
};

export default function DecouvrirLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
