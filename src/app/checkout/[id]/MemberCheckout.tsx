"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { toDisplayItem, type DisplayItem } from "@/components/ui/ProductCard";
import { PageShell } from "@/components/ui/PageShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckoutView } from "./CheckoutView";

type Etat =
  | { kind: "chargement" }
  | { kind: "introuvable" }
  | { kind: "erreur" }
  | { kind: "pret"; item: DisplayItem };

export function MemberCheckout({ id }: { id: string }) {
  const [etat, setEtat] = useState<Etat>({ kind: "chargement" });

  useEffect(() => {
    let vivant = true;
    void api.product(id).then((r) => {
      if (!vivant) return;
      if (r.ok) setEtat({ kind: "pret", item: toDisplayItem(r.data.product) });
      else setEtat({ kind: r.status === 404 ? "introuvable" : "erreur" });
    });
    return () => {
      vivant = false;
    };
  }, [id]);

  if (etat.kind === "pret") return <CheckoutView item={etat.item} />;

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-md py-16 text-center">
        {etat.kind === "chargement" ? (
          <div aria-busy="true" className="space-y-3">
            <Skeleton className="mx-auto h-5 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <p className="text-[15px] text-bone">
              {etat.kind === "introuvable"
                ? "Cette pièce n'est plus disponible."
                : "La pièce n'a pas pu être chargée."}
            </p>
            <Link
              href="/decouvrir"
              className="mt-4 inline-flex min-h-11 items-center border border-bone/30 px-4 text-[12.5px] font-semibold text-bone"
            >
              Retour au Marché
            </Link>
          </>
        )}
      </div>
    </PageShell>
  );
}
