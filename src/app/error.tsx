"use client";

import { PageShell } from "@/components/ui/PageShell";
import { LogoMark } from "@/components/chrome/Brandmark";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell marginWord="Incident" className="grid place-items-center">
      <div className="flex max-w-md flex-col items-center text-center">
        <LogoMark variant="white" className="mb-8 size-12 opacity-90" />
        <span className="overline text-[11px] text-ash">Erreur</span>
        <h1 className="font-editorial mt-4 text-4xl font-semibold tracking-tight text-bone md:text-5xl">
          Quelque chose s’est cassé
        </h1>
        <span className="mt-5 h-px w-12 bg-bone/25" />
        <p className="mt-5 text-[14px] leading-relaxed text-ash">
          Une erreur inattendue est survenue de notre côté. Tu peux réessayer —
          la plupart du temps, ça repart.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-[11px] text-ash/70">
            réf. {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          data-cursor="link"
          className="mt-8 rounded-none bg-bone px-6 py-3 text-sm font-semibold text-ink transition-transform active:scale-95"
        >
          Réessayer
        </button>
      </div>
    </PageShell>
  );
}
