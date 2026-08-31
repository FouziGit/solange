"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { LEGAL_DOCS, MIN_AGE } from "@/lib/legal";
import { acceptanceKind, needsAcceptance } from "@/lib/legal-consent";
import { Button } from "@/components/ui/Button";

/* ============================================================
   SOLANGE — (ré)acceptation des conditions pour un membre connecté.

   Deux cas, et le texte n'est pas le même :
   - « first » : le compte a été créé avant que l'acceptation existe.
     Personne n'a donc jamais rien accepté — c'est le cas de TOUS les
     comptes actuels, et c'est exactement ce que ce dispositif corrige.
   - « update » : le socle a changé (LEGAL_VERSION incrémentée). Les CGU
     promettent trente jours de préavis avant l'entrée en vigueur : cet
     écran arrive donc après ce préavis, pas à sa place.

   L'écran ne se ferme pas d'un geste — c'est un consentement, pas une
   notification — mais il laisse deux issues honnêtes : lire les documents
   (les liens fonctionnent, la page légale n'est pas couverte) et se
   déconnecter. On ne piège personne dans un mur.
   ============================================================ */
export function LegalGate({ children }: { children: React.ReactNode }) {
  const { user, refreshSession } = useStore();
  const pathname = usePathname();
  const [accepted, setAccepted] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const legalPage =
    pathname === "/informations-legales" ||
    LEGAL_DOCS.some((d) => d.href === pathname);

  // Visiteur sans compte : rien à accepter, il n'a conclu aucun contrat.
  if (!user || !needsAcceptance(user.legal) || legalPage)
    return <>{children}</>;

  const first = acceptanceKind(user.legal) === "first";

  const submit = async () => {
    if (!accepted || !age || busy) return;
    setBusy(true);
    setError(null);
    const res = await api.acceptLegal();
    if (!res.ok) {
      setBusy(false);
      setError("L'enregistrement a échoué. Réessaie.");
      return;
    }
    await refreshSession();
    setBusy(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-gate-title"
      className="theme-dark fixed inset-0 z-[110] overflow-y-auto bg-noir text-bone"
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-7 py-12">
        <p className="etiquette text-[11px] text-ash">
          {first ? "Avant de continuer" : "Nos conditions ont changé"}
        </p>
        <h1
          id="legal-gate-title"
          className="mt-2 font-display text-2xl font-bold tracking-tight text-bone"
        >
          {first ? "On te demande ton accord" : "Un mot avant de reprendre"}
        </h1>

        <p className="mt-4 text-[13.5px] leading-relaxed text-bone/80">
          {first
            ? "Ton compte a été créé avant qu'on mette ces documents en place. On te demande donc ton accord maintenant, une fois."
            : "On a mis à jour nos conditions. Prends le temps de les lire, puis dis-nous que tu es d'accord."}
        </p>

        <p className="mt-3 text-[12.5px] leading-relaxed text-ash">
          Rappel : les paiements sont simulés. Aucune somme n&apos;est débitée
          et aucune vente n&apos;est réellement conclue.
        </p>

        <div className="mt-7 flex flex-col gap-4 border-t border-bone/10 pt-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-bone"
            />
            <span className="text-[13px] leading-relaxed text-bone/85">
              J&apos;accepte les{" "}
              <Link
                href="/cgu"
                className="text-bone underline underline-offset-4"
              >
                conditions d&apos;utilisation
              </Link>
              , les{" "}
              <Link
                href="/cgv"
                className="text-bone underline underline-offset-4"
              >
                conditions de vente
              </Link>{" "}
              et j&apos;ai lu la{" "}
              <Link
                href="/confidentialite"
                className="text-bone underline underline-offset-4"
              >
                politique de confidentialité
              </Link>
              .
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={age}
              onChange={(e) => setAge(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-bone"
            />
            <span className="text-[13px] leading-relaxed text-bone/85">
              Je déclare avoir {MIN_AGE} ans ou plus.
            </span>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[12.5px] text-danger">
            {error}
          </p>
        )}

        <Button
          className="mt-7"
          disabled={!accepted || !age || busy}
          onClick={() => void submit()}
        >
          {busy ? "Enregistrement…" : "Accepter et continuer"}
        </Button>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link
            href="/informations-legales"
            data-cursor="link"
            className="inline-flex min-h-11 items-center text-[12px] text-ash transition-colors hover:text-bone"
          >
            Lire tous les documents
          </Link>
          <button
            type="button"
            onClick={() => void api.logout().then(() => location.reload())}
            className="inline-flex min-h-11 items-center text-[12px] text-ash transition-colors hover:text-bone"
          >
            Me déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
