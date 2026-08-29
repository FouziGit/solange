import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Confidentialité",
  description:
    "Politique de confidentialité de SOLANGE : données collectées, finalités, hébergement, durée de conservation et droits RGPD.",
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
      <h2 className="overline text-[9px] text-ash">{label}</h2>
      <div className="mt-2 text-[13.5px] leading-relaxed text-bone/85">
        {children}
      </div>
    </section>
  );
}

export default function ConfidentialitePage() {
  return (
    <PageShell marginWord="Privé">
      <div className="mx-auto w-full max-w-xl">
        <p className="overline text-[10px] text-ash">SOLANGE</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-bone md:text-4xl">
          Confidentialité
        </h1>

        <div className="mt-8 space-y-4">
          <Section label="Données collectées">
            <ul className="list-disc space-y-1 pl-4">
              <li>Email de connexion</li>
              <li>Contenus publiés (annonces, looks, posts)</li>
              <li>Likes et follows</li>
              <li>Messages échangés avec les autres membres</li>
            </ul>
          </Section>

          <Section label="Finalités">
            <p>
              Ces données servent uniquement au fonctionnement du service :
              connexion, affichage de tes contenus, messagerie. Zéro publicité,
              zéro traceur.
            </p>
          </Section>

          <Section label="Hébergement">
            <p>
              Le site et les données sont hébergés par Netlify, Inc.
              (infrastructure UE/US).
            </p>
          </Section>

          <Section label="Durée de conservation">
            <p>
              Tes données sont conservées jusqu&apos;à la suppression de ton
              compte, puis effacées.
            </p>
          </Section>

          <Section label="Tes droits (RGPD)">
            <p>
              Tu peux supprimer ton compte et toutes tes données en un clic
              depuis ton{" "}
              <Link
                href="/profil"
                className="text-bone underline underline-offset-4 transition-colors hover:text-bone/70"
              >
                profil
              </Link>
              . Pour toute autre demande (accès, rectification), écris à{" "}
              <a
                href="mailto:solange@nouhbenzidane.fr"
                className="text-bone underline underline-offset-4 transition-colors hover:text-bone/70"
              >
                solange@nouhbenzidane.fr
              </a>
              .
            </p>
            <p className="mt-2 text-[12.5px] text-ash">
              Note : après suppression, les conversations restent visibles côté
              autre participant.
            </p>
          </Section>

          <Section label="Beta / démonstration">
            <p>
              SOLANGE est une version de démonstration en développement : les
              transactions sont simulées et aucun paiement réel n&apos;est
              encaissé.
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
            href="/mentions-legales"
            className="inline-flex min-h-11 items-center text-[12px] text-ash underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            Mentions légales
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
