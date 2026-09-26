"use client";

import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { GlassInput } from "@/components/ui/GlassInput";
import { api, type ApiResult, type SessionUser } from "@/lib/api";
import { announce } from "@/lib/announce";
import { useStore } from "@/lib/store";
import {
  HANDLE_COOLDOWN_MS,
  formatHandleDate,
  normalizeHandle,
  validateHandle,
} from "@/lib/handle";

/** Étape 1, dans le navigateur : les règles de format, sauf pour un ancien
    identifiant du membre, qui reste à lui quelles que soient les règles
    d'aujourd'hui. Le serveur tranche de toute façon. */
export function checkNewHandle(
  raw: unknown,
  current: Pick<SessionUser, "handle" | "formerHandles">,
): { ok: true; value: string } | { ok: false; message: string } {
  const v = normalizeHandle(raw);
  if (v === current.handle.toLowerCase())
    return { ok: false, message: "C'est déjà ton identifiant." };
  if (v && (current.formerHandles ?? []).some((h) => normalizeHandle(h) === v))
    return { ok: true, value: v };
  return validateHandle(v);
}

/** Suite à donner à la réponse du serveur : terminé, retour au champ
    (identifiant pris ou refusé), fermeture (délai de 90 jours pas écoulé),
    ou nouvel essai depuis la confirmation. */
export type HandleOutcome =
  | { kind: "done"; handle: string }
  | { kind: "edit"; message: string }
  | { kind: "close"; message: string }
  | { kind: "retry"; message: string };

export function handleOutcome(
  res: ApiResult<{ handle: string }>,
  asked: string,
): HandleOutcome {
  if (res.ok) return { kind: "done", handle: res.data.handle || asked };
  switch (res.code) {
    case "taken":
    case "invalid":
    case "same":
      return { kind: "edit", message: res.error };
    case "cooldown":
      return { kind: "close", message: res.error };
    default:
      return { kind: "retry", message: res.error };
  }
}

const WAIT = "aria-disabled:cursor-wait aria-disabled:opacity-60";

/**
 * Changer d'@identifiant, en deux temps : le choix (étape 1), puis la
 * confirmation qui rappelle le délai de 90 jours (étape 2). L'ancien
 * identifiant reste attaché au compte ; le renvoi public vers le nouveau
 * profil est un choix, décoché par défaut.
 */
export function HandleSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, refreshSession, refreshPosts } = useStore();
  const uid = useId();
  const ids = {
    input: `${uid}-identifiant`,
    help: `${uid}-aide`,
    error: `${uid}-erreur`,
    redirect: `${uid}-renvoi`,
    question: `${uid}-question`,
  };
  const [step, setStep] = useState<1 | 2>(1);
  const [value, setValue] = useState("");
  const [target, setTarget] = useState("");
  // date affichée à l'étape 2, fixée au moment où on y passe
  const [until, setUntil] = useState(0);
  const [redirect, setRedirect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const old = user.handle;

  /* Ce qui a le focus disparaît au changement d'étape : le focus va à ce
     qui le remplace, sinon il retombe sur <body>. */
  const swapThenFocus = (update: () => void, targetId: string) => {
    flushSync(update);
    document.getElementById(targetId)?.focus();
  };

  const close = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setValue("");
      setTarget("");
      setRedirect(false);
      setError(null);
    }, 300);
  };

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    const r = checkNewHandle(value, user);
    if (!r.ok) {
      // rendu avant le focus : le champ est lu avec son erreur
      swapThenFocus(() => setError(r.message), ids.input);
      return;
    }
    swapThenFocus(() => {
      setError(null);
      setTarget(r.value);
      setUntil(Date.now() + HANDLE_COOLDOWN_MS);
      setStep(2);
    }, ids.question);
  };

  const back = () => {
    if (busy) return;
    swapThenFocus(() => {
      setStep(1);
      setError(null);
    }, ids.input);
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const out = handleOutcome(await api.changeHandle(target, redirect), target);
    if (out.kind === "done") {
      announce(`Identifiant changé : @${out.handle}`);
      await refreshSession();
      void refreshPosts();
      setBusy(false);
      close();
      return;
    }
    setBusy(false);
    if (out.kind === "edit") {
      swapThenFocus(() => {
        setStep(1);
        setError(out.message);
      }, ids.input);
    } else if (out.kind === "close") {
      // la date reste écrite sur le profil une fois la feuille fermée
      announce(out.message, "assertive");
      await refreshSession();
      close();
    } else {
      setError(out.message);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow="Profil"
      title="Changer d'identifiant"
    >
      <div className="overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        {step === 1 ? (
          <form noValidate onSubmit={next} className="flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor={ids.input}>Nouvel identifiant</FieldLabel>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-ash"
                >
                  @
                </span>
                <GlassInput
                  id={ids.input}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  maxLength={32}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={
                    error ? `${ids.error} ${ids.help}` : ids.help
                  }
                  className="pl-8 text-base"
                />
              </div>
              <p id={ids.help} className="mt-2 text-[11.5px] text-ash">
                2 à 20 caractères : lettres minuscules, chiffres, point, tiret,
                tiret bas.
              </p>
            </div>

            <div>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                <input
                  type="checkbox"
                  checked={redirect}
                  onChange={(e) => setRedirect(e.target.checked)}
                  aria-describedby={ids.redirect}
                  className="mt-0.5 size-5 shrink-0 accent-bone"
                />
                <span className="text-[13px] leading-relaxed text-bone/85">
                  Rediriger mon ancien @{old} pendant 30 jours
                </span>
              </label>
              <p id={ids.redirect} className="pl-8 text-[11.5px] text-ash">
                Sans renvoi, les liens vers @{old} ne mènent plus à ton profil.
                Les membres qui te suivent te gardent, sous ton nouvel @.
              </p>
            </div>

            {error && (
              <p
                id={ids.error}
                role="alert"
                className="text-[12.5px] text-danger"
              >
                {error}
              </p>
            )}

            <Button type="submit">Continuer</Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p
              id={ids.question}
              tabIndex={-1}
              className="text-[13.5px] leading-relaxed text-bone/85"
            >
              Passer à @{target}&nbsp;? Tu ne pourras plus changer
              d&apos;identifiant avant le {formatHandleDate(until)}.
            </p>
            {error && (
              <p role="alert" className="text-[12.5px] text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => void confirm()}
                aria-disabled={busy || undefined}
                className={WAIT}
              >
                {busy ? "Changement…" : "Changer d'identifiant"}
              </Button>
              <Button
                variant="outline"
                onClick={back}
                aria-disabled={busy || undefined}
                className={WAIT}
              >
                Revenir
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
