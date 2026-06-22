import { drops } from "@/lib/mock";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { DropsView } from "./DropsView";

export default function DropsPage() {
  return (
    <PageShell marginWord="Drops">
      <PageHeader
        eyebrow="Partenariats"
        title="Drops"
        subtitle="Ventes en direct et collaborations exclusives. Curateurs, friperies et maisons d'archive lèvent le rideau sur leurs pièces rares."
      />
      <DropsView drops={drops} />
    </PageShell>
  );
}
