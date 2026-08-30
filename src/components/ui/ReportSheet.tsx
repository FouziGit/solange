"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Sheet } from "./Sheet";
import { Button } from "./Button";

type Step = "form" | "sent";

/**
 * Feuille de signalement unique (remplace les window.prompt()). Écrit ce qui
 * s'est passé, propose quoi faire, ne s'excuse pas (DA §8). L'envoi passe par
 * POST /api/report ; succès = état « sent » sobre puis fermeture.
 */
export function ReportSheet({
  open,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "product" | "post" | "user" | "message";
  targetId: string;
  targetLabel: string;
}) {
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    // reset après la sortie d'écran
    setTimeout(() => {
      setStep("form");
      setReason("");
      setError(null);
    }, 300);
  };

  const send = async () => {
    const text = reason.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const res = await api.report(targetType, targetId, text);
    setSending(false);
    if (!res.ok) {
      setError(
        res.status === 401
          ? "Connecte-toi pour signaler."
          : res.status === 429
            ? "Limite de signalements atteinte pour aujourd'hui."
            : "L'envoi a échoué. Réessaie.",
      );
      return;
    }
    setStep("sent");
    setTimeout(close, 1600);
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow="Signaler"
      title={targetLabel}
      maxHeight="70%"
    >
      <div className="flex flex-col gap-4 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        {step === "sent" ? (
          <p aria-live="polite" className="py-6 text-center text-sm text-bone">
            Signalement envoyé. On regarde rapidement.
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-2">
              <span className="overline text-[11px] text-ash">
                Ce qui ne va pas
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={500}
                autoFocus
                placeholder="Contrefaçon, arnaque, contenu déplacé…"
                aria-label="Raison du signalement"
                className="field resize-none text-base"
              />
            </label>
            {error && (
              <p role="alert" className="text-[12.5px] text-danger">
                {error}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                className="flex-1"
                disabled={!reason.trim() || sending}
                onClick={() => void send()}
              >
                {sending ? "Envoi…" : "Signaler"}
              </Button>
              <Button variant="outline" onClick={close}>
                Annuler
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
