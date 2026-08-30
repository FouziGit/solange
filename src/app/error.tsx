"use client";

import { Button } from "@/components/ui/Button";
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
        <p className="mt-5 text-[14px] leading-relaxed text-ash">
          Une erreur inattendue est survenue de notre côté. Tu peux réessayer —
          la plupart du temps, ça repart.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-[11px] text-ash/70">
            réf. {error.digest}
          </p>
        )}
        <Button onClick={() => reset()} className="mt-8">
          Réessayer
        </Button>
      </div>
    </PageShell>
  );
}
