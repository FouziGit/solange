import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";

export default function NotFound() {
  return (
    <PageShell marginWord="Égarée" className="grid place-items-center">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="font-editorial text-[5.5rem] italic leading-none text-bone/85 md:text-[8rem]">
          404
        </span>
        <span className="mt-4 h-px w-12 bg-bone/25" />
        <h1 className="font-editorial mt-6 text-3xl font-semibold tracking-tight text-bone md:text-4xl">
          Page introuvable
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-ash">
          Cette pièce a quitté la vitrine. Le lien est peut-être périmé, ou la
          page a été déplacée.
        </p>
        <Link
          href="/"
          data-cursor="link"
          className="mt-8 rounded-full bg-bone px-6 py-3 text-sm font-semibold text-ink transition-transform active:scale-95"
        >
          Retour à l’accueil
        </Link>
      </div>
    </PageShell>
  );
}
