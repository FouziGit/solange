import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanCards } from "@/components/ui/PlanCards";
import { plans } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Premium",
  description:
    "Supprime les commissions, gagne en visibilité et débloque les ventes aux enchères avec SOLANGE Premium et Pro. Sans engagement, résiliable à tout moment.",
};

/** "4,99 €" -> "4.99" for schema.org price (dot decimal). */
function schemaPrice(price: string): string {
  return price.replace(/[^\d,]/g, "").replace(",", ".") || "0";
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": plans.map((plan) => ({
    "@type": "Product",
    name: `SOLANGE ${plan.name}`,
    description: plan.tagline,
    offers: {
      "@type": "Offer",
      price: schemaPrice(plan.price),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  })),
};

export default function PremiumPage() {
  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        eyebrow="Abonnement"
        title="Premium"
        subtitle="Supprime les commissions, gagne en visibilité, débloque les ventes aux enchères. Sans publicité intrusive — fidèle à l'esprit SOLANGE."
      />

      <PlanCards plans={plans} />

      <p className="mt-8 text-center text-xs text-ash">
        Sans engagement · résiliable à tout moment · paiement sécurisé.
      </p>
    </PageShell>
  );
}
