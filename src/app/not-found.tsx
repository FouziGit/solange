import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { LogoMark } from "@/components/chrome/Brandmark";

export default function NotFound() {
  return (
    <PageShell marginWord="Égarée" className="grid place-items-center">
      <div className="flex max-w-md flex-col items-center text-center">
        <LogoMark variant="white" className="mb-8 size-12 opacity-90" />
        <span className="font-editorial text-[5.5rem] italic leading-none text-bone/85 md:text-[8rem]">
          404
        </span>
        <h1 className="font-editorial mt-6 text-3xl font-semibold tracking-tight text-bone md:text-4xl">
          Page introuvable
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-ash">
          Cette pièce a quitté la vitrine. Le lien est peut-être périmé, ou la
          page a été déplacée.
        </p>
        <Button href="/" className="mt-8">
          Retour à l’accueil
        </Button>
      </div>
    </PageShell>
  );
}
