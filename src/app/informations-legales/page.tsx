import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_DOCS } from "@/lib/legal";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Informations légales",
  description:
    "Mentions légales, conditions d'utilisation et de vente, confidentialité, cookies, modération et accès des mineurs.",
};

/* Point d'accès unique aux sept documents. Il existe parce que
   l'article 6-III de la LCEN demande un accès « facile, direct et
   permanent » : deux liens enfouis dans un onglet de profil ne le
   satisfaisaient pas. Lié depuis le profil ET depuis l'écran
   d'inscription, donc atteignable sans compte. */
export default function InformationsLegalesPage() {
  return (
    <PageShell marginWord="Légal">
      <div className="mx-auto w-full max-w-2xl">
        <p className="etiquette text-[11px] text-ash">SOLANGE</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-bone md:text-4xl">
          Informations légales
        </h1>
        <p className="mt-4 max-w-prose text-[14px] leading-relaxed text-bone/75">
          Les documents qui encadrent le service. Le service fonctionne en
          version d&apos;essai : les paiements y sont simulés, aucune somme
          n&apos;est débitée et aucune vente n&apos;est réellement conclue.
        </p>

        <ul className="mt-8 flex flex-col gap-px overflow-hidden rounded-2xl border border-bone/10 bg-bone/10">
          {LEGAL_DOCS.map((d) => (
            <li key={d.slug}>
              <Link
                href={d.href}
                data-cursor="link"
                className="flex flex-col gap-1 bg-coal/60 px-5 py-4 transition-colors hover:bg-coal/90"
              >
                <span className="text-[14.5px] font-semibold text-bone">
                  {d.title}
                </span>
                <span className="text-[12.5px] leading-snug text-ash">
                  {d.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[12.5px] leading-relaxed text-ash">
          Une question sur l&apos;un de ces documents, ou une demande concernant
          tes données&nbsp;:{" "}
          <a
            href="mailto:solange@nouhbenzidane.fr"
            className="text-bone underline underline-offset-4 transition-colors hover:text-bone/70"
          >
            solange@nouhbenzidane.fr
          </a>
        </p>
      </div>
    </PageShell>
  );
}
