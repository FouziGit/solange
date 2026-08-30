import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales du site de démonstration SOLANGE : éditeur, contact, hébergement et données personnelles.",
};

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-bone/10 bg-coal/40 p-5">
      <h2 className="overline text-[11px] text-ash">{label}</h2>
      <div className="mt-2 text-[13.5px] leading-relaxed text-bone/85">
        {children}
      </div>
    </section>
  );
}

export default function MentionsLegalesPage() {
  return (
    <PageShell marginWord="Mentions">
      <div className="mx-auto w-full max-w-xl">
        <p className="overline text-[11px] text-ash">SOLANGE</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-bone md:text-4xl">
          Mentions légales
        </h1>

        <div className="mt-8 space-y-4">
          <Section label="Éditeur">
            <p>
              SOLANGE — projet en développement porté par Nouh Benzidane et
              Youssef Ayari.
            </p>
          </Section>

          <Section label="Contact">
            <p>
              <a
                href="mailto:solange@nouhbenzidane.fr"
                className="inline-flex min-h-11 items-center text-bone underline underline-offset-4 transition-colors hover:text-bone/70"
              >
                solange@nouhbenzidane.fr
              </a>
            </p>
          </Section>

          <Section label="Hébergement">
            <p>Netlify, Inc., 512 2nd Street, San Francisco, CA, États-Unis.</p>
          </Section>

          <Section label="Site de démonstration">
            <p>
              Les transactions sont simulées, aucun paiement réel n&apos;est
              encaissé.
            </p>
          </Section>

          <Section label="Données">
            <p>
              Email de connexion uniquement, utilisé pour
              l&apos;authentification ; suppression sur demande au contact
              ci-dessus.
            </p>
          </Section>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[12px] text-ash underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            ← Retour à l&apos;accueil
          </Link>
          <Link
            href="/confidentialite"
            className="inline-flex min-h-11 items-center text-[12px] text-ash underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            Confidentialité
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
