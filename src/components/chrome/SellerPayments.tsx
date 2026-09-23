"use client";

/* ============================================================
   SOLANGE — « Recevoir mes paiements », dans /profil.

   Pour être payé, un vendeur doit avoir un compte de paiement Stripe
   vérifié : pièce d'identité et IBAN. Cette vérification se fait CHEZ
   STRIPE, sur sa page ; SOLANGE ne voit jamais ces informations.

   Sans compte actif, ses pièces restent visibles mais ne sont pas
   achetables : Stripe refuserait le paiement. On le lui dit clairement,
   plutôt que de le laisser découvrir qu'aucune vente n'aboutit.

   Absent si le paiement réel n'est pas activé : rien à régler.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

type Etat =
  | { kind: "chargement" }
  | { kind: "off" }
  | { kind: "pret"; status: "absent" | "incomplet" | "verification" | "actif" };

const TEXTE: Record<"absent" | "incomplet" | "verification" | "actif", string> =
  {
    absent:
      "Pour que tes pièces soient achetables, active tes paiements. Stripe te demandera une pièce d'identité et ton IBAN — deux minutes, une seule fois.",
    incomplet:
      "Ton inscription n'est pas terminée. Tant qu'elle ne l'est pas, tes pièces ne sont pas achetables.",
    verification:
      "Stripe vérifie tes informations. Tes pièces deviendront achetables dès que c'est validé.",
    actif:
      "Tes paiements sont actifs. Quand une pièce se vend, ta part arrive sur ton compte Stripe, puis sur ta banque chaque vendredi.",
  };

export function SellerPayments() {
  const [etat, setEtat] = useState<Etat>({ kind: "chargement" });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await api.sellerPayments();
    if (!r.ok || !r.data.enabled) return setEtat({ kind: "off" });
    setEtat({ kind: "pret", status: r.data.status ?? "absent" });
  }, []);

  useEffect(() => {
    queueMicrotask(() => void charger());
  }, [charger]);

  if (etat.kind === "off") return null;
  if (etat.kind === "chargement")
    return (
      <div className="mt-8 md:max-w-md" aria-busy="true">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-3 h-20 w-full" />
      </div>
    );

  const activer = async () => {
    setBusy(true);
    setErreur(null);
    const r = await api.startSellerPayments();
    if (r.ok && r.data.url) {
      window.location.assign(r.data.url);
      return;
    }
    setBusy(false);
    setErreur(r.ok ? "Le lien n'a pas pu être créé. Réessaie." : r.error);
  };

  const actif = etat.status === "actif";

  return (
    <section className="mt-8 md:max-w-md" aria-label="Recevoir mes paiements">
      <p className="etiquette mb-3 text-[11px] text-ash">
        Recevoir mes paiements
      </p>
      <div className="border border-bone/12 p-4">
        <p className="text-[13px] leading-relaxed text-bone/85">
          {TEXTE[etat.status]}
        </p>
        {!actif && (
          <Button
            size="md"
            className="mt-3"
            disabled={busy}
            onClick={() => void activer()}
          >
            {busy
              ? "Ouverture…"
              : etat.status === "absent"
                ? "Activer mes paiements"
                : "Reprendre mon inscription"}
          </Button>
        )}
        {erreur && (
          <p role="alert" className="mt-3 text-[12.5px] text-bone">
            {erreur}
          </p>
        )}
      </div>
    </section>
  );
}
