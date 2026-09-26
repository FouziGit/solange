import { describe, expect, it, vi } from "vitest";
import { avatarPhoto } from "@/components/chrome/Avatar";
import { avatarControls } from "@/components/profile/AvatarSheet";
import {
  checkNewHandle,
  handleOutcome,
} from "@/components/profile/HandleSheet";
import { sendToggle, withMembership } from "@/lib/store";
import { PORTRAIT_SEEDS } from "../img";

/* Profil côté client : quelle photo poser sur un avatar, ce que la
   feuille photo propose, ce que l'écran d'identifiant accepte avant
   d'appeler le serveur, ce qu'il fait de sa réponse, et l'annulation d'un
   toggle que le serveur a refusé. */

describe("avatarPhoto — un membre réel n'a jamais le visage d'un autre", () => {
  const demo = [...PORTRAIT_SEEDS][0];

  it("la photo du membre quand elle existe", () => {
    expect(avatarPhoto("u_0123456789ab", "/api/img/i_aaaaaaaaaaaa")).toBe(
      "/api/img/i_aaaaaaaaaaaa",
    );
  });

  it("src null : initiales seules, même si la graine a un portrait", () => {
    expect(avatarPhoto(demo, null)).toBeNull();
    expect(avatarPhoto("u_0123456789ab", null)).toBeNull();
  });

  it("src vide : initiales, pas de portrait de démo", () => {
    expect(avatarPhoto(demo, "")).toBeNull();
  });

  it("src absent : le portrait de démo, seulement pour ses graines", () => {
    expect(avatarPhoto(demo, undefined)).toBe(`/img/people/${demo}.jpg`);
    // un pseudo qui ressemble à une graine n'a pas de portrait : pas de 404
    expect(avatarPhoto("lou.mercier", undefined)).toBeNull();
    expect(avatarPhoto("u_0123456789ab", undefined)).toBeNull();
  });
});

describe("avatarControls — la feuille photo n'offre aucun contrôle mort", () => {
  const PHOTO = "/api/img/i_aaaaaaaaaaaa";

  it("sans photo : choisir, puis enregistrer l'aperçu", () => {
    expect(avatarControls({ avatar: null }, false)).toEqual({
      notice: "info",
      choose: true,
      save: false,
      remove: false,
    });
    expect(avatarControls({ avatar: null }, true)).toMatchObject({
      save: true,
      remove: false,
    });
  });

  it("avec photo : la changer ou la retirer", () => {
    expect(avatarControls({ avatar: PHOTO }, false)).toMatchObject({
      choose: true,
      remove: true,
    });
  });

  it("masquée par la modération et encore gardée : seulement la retirer", () => {
    expect(
      avatarControls(
        { avatar: null, avatarHidden: true, avatarLocked: true },
        false,
      ),
    ).toEqual({ notice: "hidden", choose: false, save: false, remove: true });
  });

  it("verrouillée et déjà retirée : aucun bouton, seulement l'explication", () => {
    expect(
      avatarControls(
        { avatar: null, avatarHidden: false, avatarLocked: true },
        false,
      ),
    ).toEqual({ notice: "locked", choose: false, save: false, remove: false });
  });

  it("verrou posé pendant un aperçu : « Enregistrer » disparaît", () => {
    expect(
      avatarControls({ avatar: null, avatarLocked: true }, true).save,
    ).toBe(false);
  });
});

describe("checkNewHandle — l'étape 1, avant le serveur", () => {
  const me = { handle: "jean.dupont" };

  it("normalise la saisie (@, majuscules, espaces)", () => {
    expect(checkNewHandle("  @Lou.Mercier ", me)).toEqual({
      ok: true,
      value: "lou.mercier",
    });
  });

  it("le même identifiant, en casse différente, est refusé", () => {
    expect(checkNewHandle("@Jean.Dupont", me)).toEqual({
      ok: false,
      message: "C'est déjà ton identifiant.",
    });
  });

  it("les règles de format et les réserves s'appliquent", () => {
    for (const v of ["a", ".lou", "lou-", "a..b", "admin", "membre-abc"])
      expect(checkNewHandle(v, me).ok, v).toBe(false);
  });

  it("un ancien identifiant du membre est accepté tel quel, même hors règles", () => {
    const withHistory = {
      handle: "lou",
      formerHandles: ["membre-3fa2c1", "Jean..Dupont"],
    };
    expect(checkNewHandle("membre-3fa2c1", withHistory)).toEqual({
      ok: true,
      value: "membre-3fa2c1",
    });
    expect(checkNewHandle("jean..dupont", withHistory)).toEqual({
      ok: true,
      value: "jean..dupont",
    });
    // l'ancien d'un autre ne passe pas pour autant
    expect(checkNewHandle("membre-999999", withHistory).ok).toBe(false);
  });

  it("vide : refus, jamais un envoi", () => {
    expect(checkNewHandle("", { handle: "lou", formerHandles: [""] }).ok).toBe(
      false,
    );
  });
});

describe("handleOutcome — la suite selon la réponse du serveur", () => {
  const refus = (code: string | undefined, error = "Message") =>
    ({ ok: false, status: 409, error, code }) as const;

  it("succès : le handle rendu par le serveur", () => {
    expect(handleOutcome({ ok: true, data: { handle: "lou" } }, "LOU")).toEqual(
      { kind: "done", handle: "lou" },
    );
  });

  it("pris, refusé ou identique : retour au champ avec le message", () => {
    for (const code of ["taken", "invalid", "same"])
      expect(handleOutcome(refus(code, "Pris"), "x")).toEqual({
        kind: "edit",
        message: "Pris",
      });
  });

  it("délai pas écoulé : on referme, le message porte la date", () => {
    expect(
      handleOutcome(refus("cooldown", "À partir du 1 janvier 2027."), "x"),
    ).toEqual({ kind: "close", message: "À partir du 1 janvier 2027." });
  });

  it("changement en cours, conflit, limite, hors ligne : nouvel essai", () => {
    for (const code of ["pending", "conflict", "rate", "blocked", undefined])
      expect(handleOutcome(refus(code, "Réessaie."), "x").kind).toBe("retry");
  });
});

describe("withMembership — l'état voulu, pas un basculement", () => {
  it("ajoute ou retire selon `on`", () => {
    expect([...withMembership(new Set(["a"]), "b", true)]).toEqual(["a", "b"]);
    expect([...withMembership(new Set(["a", "b"]), "a", false)]).toEqual(["b"]);
  });

  it("déjà dans l'état voulu : le même Set, rien ne bascule", () => {
    const s = new Set(["a"]);
    expect(withMembership(s, "a", true)).toBe(s);
    expect(withMembership(s, "z", false)).toBe(s);
  });
});

describe("sendToggle — un refus du serveur n'est plus muet", () => {
  it("accepté : rien n'est annulé", async () => {
    const undo = vi.fn();
    const ok = await sendToggle(
      async () => ({ ok: true }),
      undo,
      () => true,
    );
    expect(ok).toBe(true);
    expect(undo).not.toHaveBeenCalled();
  });

  it("refusé : l'écran revient à l'état d'avant", async () => {
    const undo = vi.fn();
    const ok = await sendToggle(
      async () => ({ ok: false }),
      undo,
      () => true,
    );
    expect(ok).toBe(false);
    expect(undo).toHaveBeenCalledOnce();
  });

  it("refusé mais dépassé par un toggle plus récent : c'est lui qui décide", async () => {
    const undo = vi.fn();
    await sendToggle(
      async () => ({ ok: false }),
      undo,
      () => false,
    );
    expect(undo).not.toHaveBeenCalled();
  });

  it("aimer, ne plus aimer, aimer : le premier envoi refusé en dernier ne défait pas le dernier geste", async () => {
    let liked = new Set<string>();
    let last = 0;
    const toggle = (on: boolean, reply: () => Promise<{ ok: boolean }>) => {
      liked = withMembership(liked, "p1", on);
      const n = ++last;
      return sendToggle(
        reply,
        () => (liked = withMembership(liked, "p1", !on)),
        () => last === n,
      );
    };
    let refuse!: (v: { ok: boolean }) => void;
    const first = toggle(true, () => new Promise((r) => (refuse = r)));
    await toggle(false, async () => ({ ok: true }));
    await toggle(true, async () => ({ ok: true }));
    refuse({ ok: false });
    await first;
    expect(liked.has("p1")).toBe(true);
  });
});
