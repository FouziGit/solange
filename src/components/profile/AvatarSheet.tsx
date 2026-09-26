"use client";

import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/chrome/Avatar";
import { api, prepareAvatar, type SessionUser } from "@/lib/api";
import { announce } from "@/lib/announce";
import { useStore } from "@/lib/store";

const READ_ERROR =
  "Impossible de lire cette photo. Essaie avec une autre (JPEG ou PNG).";

/* Pendant un traitement, les boutons restent focalisables
   (aria-disabled + garde) : désactivé sous le doigt, un bouton renvoie le
   focus sur <body> et VoiceOver repart du haut. */
const WAIT = "aria-disabled:cursor-wait aria-disabled:opacity-60";

/** Ce que la feuille propose, sans contrôle mort. Photo masquée par la
    modération et encore gardée : on ne peut que la retirer. Verrou posé
    et photo déjà retirée : plus rien à faire, seulement l'expliquer. */
export function avatarControls(
  user: Pick<SessionUser, "avatar" | "avatarHidden" | "avatarLocked">,
  hasPreview: boolean,
): {
  notice: "info" | "hidden" | "locked";
  choose: boolean;
  save: boolean;
  remove: boolean;
} {
  const locked = user.avatarLocked === true;
  const stored = Boolean(user.avatar) || user.avatarHidden === true;
  return {
    notice: !locked ? "info" : user.avatarHidden ? "hidden" : "locked",
    choose: !locked,
    save: !locked && hasPreview,
    remove: stored && !hasPreview,
  };
}

/**
 * Photo de profil du membre connecté : choisir, voir l'aperçu, enregistrer,
 * retirer. La photo est recadrée dans le navigateur (prepareAvatar), puis
 * nettoyée par le serveur. Une photo masquée par la modération ne peut
 * qu'être retirée.
 */
export function AvatarSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, refreshSession } = useStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"read" | "save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const errorId = `${uid}-erreur`;

  if (!user) return null;
  const controls = avatarControls(user, preview !== null);
  const name = user.name || user.handle;

  const close = () => {
    onClose();
    // remise à zéro après l'animation de sortie
    setTimeout(() => {
      setPreview(null);
      setError(null);
    }, 300);
  };

  const pick = () => {
    if (busy !== null) return;
    fileRef.current?.click();
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy !== null) return;
    setError(null);
    setBusy("read");
    try {
      setPreview(await prepareAvatar(file));
      announce("Aperçu prêt. Enregistre pour l'utiliser.");
    } catch {
      setError(READ_ERROR);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!preview || busy !== null) return;
    setBusy("save");
    setError(null);
    const res = await api.setAvatar(preview);
    if (!res.ok && res.status === 403) {
      /* Photo masquée entre-temps par la modération, ou compte suspendu :
         la session relue remet la feuille dans son état, sans
         « Enregistrer » voué au même refus. Le bouton disparaît sous le
         doigt : le focus va au message. */
      await refreshSession();
      flushSync(() => {
        setPreview(null);
        setBusy(null);
        setError(res.error);
      });
      document.getElementById(errorId)?.focus();
      return;
    }
    if (!res.ok) {
      setBusy(null);
      setError(res.error);
      return;
    }
    announce("Photo modifiée");
    await refreshSession();
    setBusy(null);
    close();
  }

  async function remove() {
    if (busy !== null) return;
    setBusy("remove");
    setError(null);
    const res = await api.removeAvatar();
    if (!res.ok) {
      setBusy(null);
      setError(res.error);
      return;
    }
    announce("Photo retirée");
    await refreshSession();
    setBusy(null);
    close();
  }

  return (
    <Sheet open={open} onClose={close} eyebrow="Profil" title="Photo de profil">
      <div className="flex flex-col items-center gap-4 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        {/* sans `capture` : galerie OU appareil photo, au choix du membre */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => void onFile(e)}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />

        {preview ? (
          <span role="img" aria-label="Aperçu de ta nouvelle photo de profil">
            <Avatar
              name={name}
              seed={user.id}
              src={preview}
              className="size-32 text-7xl ring-2 ring-ink"
              decorative
            />
          </span>
        ) : (
          <Avatar
            name={name}
            seed={user.id}
            src={user.avatar ?? null}
            className="size-32 text-7xl ring-2 ring-ink"
          />
        )}

        {controls.notice === "info" ? (
          <p className="text-center text-[12px] leading-relaxed text-ash">
            Recadrée en carré. La position et les autres informations cachées
            dans la photo sont retirées.
          </p>
        ) : (
          <p className="text-center text-[13px] leading-relaxed text-bone/85">
            {controls.notice === "hidden"
              ? "Ta photo a été masquée par la modération."
              : "Tu ne peux pas publier de nouvelle photo pour l'instant."}
          </p>
        )}

        {error && (
          <p
            id={errorId}
            role="alert"
            tabIndex={-1}
            className="text-center text-[12.5px] text-danger"
          >
            {error}
          </p>
        )}

        {/* ordre fixe des emplacements : « Choisir » garde le focus quand
            l'aperçu apparaît au retour du sélecteur */}
        <div className="flex w-full flex-col gap-2">
          {controls.save && (
            <Button
              onClick={() => void save()}
              aria-disabled={busy !== null || undefined}
              className={WAIT}
            >
              {busy === "save" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          )}
          {controls.choose && (
            <Button
              variant="outline"
              onClick={pick}
              aria-disabled={busy !== null || undefined}
              className={WAIT}
            >
              {busy === "read"
                ? "Traitement…"
                : preview
                  ? "Choisir une autre photo"
                  : "Choisir une photo"}
            </Button>
          )}
          {controls.remove && (
            <Button
              variant="outline"
              onClick={() => void remove()}
              aria-disabled={busy !== null || undefined}
              className={WAIT}
            >
              {busy === "remove" ? "Retrait…" : "Retirer la photo"}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
