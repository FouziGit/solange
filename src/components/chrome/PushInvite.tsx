"use client";

/* ============================================================
   SOLANGE — invitation aux notifications (lot 3).
   Ne s'affiche JAMAIS au premier lancement : seulement après une
   première action qui compte (pièce aimée, vente, cercle rejoint),
   et au plus une fois par mois si la personne décline.
   Sur iOS hors app installée, l'invitation devient un guide
   d'installation — demander une permission impossible à accorder
   serait du harcèlement inutile.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import {
  pushSupport,
  shouldInvite,
  snoozeInvite,
  subscribeDevice,
  type PushSupport,
} from "@/lib/push-client";
import { api } from "@/lib/api";
import { track } from "@/lib/track";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Bell, Share, Plus } from "@/components/chrome/icons";

export function PushInvite() {
  const { user, authReady } = useStore();
  const [open, setOpen] = useState(false);
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maybeOpen = useCallback(async () => {
    if (!authReady || !user) return;
    const s = pushSupport();
    // rien à proposer : déjà accordé, refusé au niveau navigateur, ou
    // navigateur sans push
    if (s.kind === "granted" || s.kind === "denied" || s.kind === "unsupported")
      return;
    if (!shouldInvite()) return;
    // le serveur a-t-il ses clés ? sinon on ne promet rien (lot éteint)
    const conf = await api.pushConfig();
    if (!conf.ok || !conf.data.enabled || conf.data.subscribed) return;
    setSupport(s);
    setOpen(true);
    track("push_invite_shown", { support: s.kind });
  }, [authReady, user]);

  useEffect(() => {
    // léger différé : l'invitation ne doit pas concurrencer le rendu
    const t = window.setTimeout(() => void maybeOpen(), 1500);
    return () => window.clearTimeout(t);
  }, [maybeOpen]);

  const decline = () => {
    snoozeInvite();
    setOpen(false);
    track("push_invite_declined");
  };

  const accept = async () => {
    setBusy(true);
    setError(null);
    const res = await subscribeDevice();
    setBusy(false);
    if (res.ok) {
      track("push_subscribed");
      setOpen(false);
    } else {
      setError(res.error);
      if (res.denied) setOpen(false); // refus système : on n'insiste pas
    }
  };

  const ios = support?.kind === "ios-install";

  return (
    <Sheet
      open={open}
      onClose={decline}
      eyebrow="Notifications"
      title={ios ? "Installe l'app d'abord" : "Sache-le tout de suite"}
    >
      <div className="flex flex-col gap-4 px-5 py-4 pb-8">
        {ios ? (
          <>
            <p className="text-[13.5px] leading-relaxed text-ash">
              Sur iPhone, les notifications n&apos;existent que si SOLANGE est
              sur ton écran d&apos;accueil. Deux gestes :
            </p>
            <ol className="flex flex-col gap-3">
              <li className="flex items-center gap-3 text-[13.5px] text-bone">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bone/10">
                  <Share className="size-4" />
                </span>
                Touche le bouton Partager, en bas de Safari
              </li>
              <li className="flex items-center gap-3 text-[13.5px] text-bone">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bone/10">
                  <Plus className="size-4" />
                </span>
                Choisis « Sur l&apos;écran d&apos;accueil »
              </li>
            </ol>
            <p className="text-[12px] text-ash">
              Rouvre SOLANGE depuis l&apos;icône, et on te reproposera les
              notifications.
            </p>
            <Button variant="outline" size="lg" onClick={decline}>
              J&apos;ai compris
            </Button>
          </>
        ) : (
          <>
            <p className="text-[13.5px] leading-relaxed text-ash">
              Une pièce vendue, un message, une réponse dans tes Cercles : tu le
              sauras sans ouvrir l&apos;app. Rien la nuit, jamais de publicité,
              et tu choisis ce que tu reçois.
            </p>
            {error && (
              <p role="alert" className="text-[13px] text-bone/85">
                {error}
              </p>
            )}
            <Button size="lg" disabled={busy} onClick={() => void accept()}>
              <Bell className="size-4" />
              {busy ? "Activation…" : "Activer les notifications"}
            </Button>
            <Button variant="ghost" size="sm" onClick={decline}>
              Plus tard
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
