import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DELETED_HANDLE,
  HANDLE_COOLDOWN_MS,
  HANDLE_PENDING_TTL_MS,
  HANDLE_REDIRECT_MS,
  RENAME_LOG_TTL_MS,
  RESERVED_HANDLES,
  applyRenames,
  canChangeHandle,
  checkHandleChange,
  formatHandleDate,
  handleBaseFromEmail,
  handlesOf,
  isBlockedBy,
  isReservedHandle,
  nextHandleChangeAt,
  nextHandleHistory,
  normalizeHandle,
  profileRedirect,
  pruneRenameLog,
  publicHandleTarget,
  publicRenames,
  shouldReleaseReservation,
  validateHandle,
  type HandleOwner,
  type RenameEntry,
} from "../handle";
import { PORTRAIT_SEEDS } from "../img";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 26, 12);

const member = (over: Partial<HandleOwner> = {}): HandleOwner => ({
  id: "u_0123456789ab",
  handle: "jean.dupont",
  ...over,
});

const root = (p: string) =>
  fileURLToPath(new URL(`../../../${p}`, import.meta.url));

describe("normalizeHandle — une seule forme pour une saisie", () => {
  it("retire les espaces, le @ initial et les majuscules", () => {
    expect(normalizeHandle("  @Lou.Archive ")).toBe("lou.archive");
  });
  it("ne retire qu'un seul @", () => {
    expect(normalizeHandle("@@lou")).toBe("@lou");
  });
  it("ce qui n'est pas une chaîne donne une chaîne vide", () => {
    for (const v of [null, undefined, 42, {}, ["lou"]])
      expect(normalizeHandle(v)).toBe("");
  });
});

describe("validateHandle — ce qu'un membre peut choisir", () => {
  it("2 et 20 caractères passent, 1 et 21 non", () => {
    expect(validateHandle("ab").ok).toBe(true);
    expect(validateHandle("a".repeat(20)).ok).toBe(true);
    expect(validateHandle("a").ok).toBe(false);
    expect(validateHandle("a".repeat(21)).ok).toBe(false);
  });

  it("la saisie est normalisée avant d'être jugée", () => {
    expect(validateHandle("@Lou.Mercier")).toEqual({
      ok: true,
      value: "lou.mercier",
    });
  });

  it("refuse un séparateur au bord, deux séparateurs, un accent, une espace", () => {
    for (const v of [".x", "x-", "_ab", "a..b", "a._b", "a-_b", "é", "a b"])
      expect(validateHandle(v).ok, v).toBe(false);
  });

  it("un caractère interdit reçoit le message qui dit quoi utiliser", () => {
    expect(validateHandle("lou!")).toEqual({
      ok: false,
      message:
        "Utilise seulement des lettres minuscules, des chiffres, le point, le tiret ou le tiret bas.",
    });
  });

  it("refuse chaque identifiant réservé, et la forme de repli membre-…", () => {
    for (const h of RESERVED_HANDLES)
      expect(validateHandle(h), h).toEqual({
        ok: false,
        message: "Cet identifiant est réservé. Choisis-en un autre.",
      });
    expect(validateHandle("membre-abc").ok).toBe(false);
    expect(isReservedHandle(DELETED_HANDLE)).toBe(true);
  });

  it("tout identifiant accepté est capturé en entier par une mention", () => {
    for (const v of ["lou.mercier", "a-b_c.d", "x9"]) {
      const r = validateHandle(v);
      expect(r.ok).toBe(true);
      const m = `salut @${v}, tu vends ?`.match(/@([a-z0-9][a-z0-9._-]{1,30})/i);
      expect(m?.[1]).toBe(v);
    }
  });
});

describe("réserves — personne ne prend le nom ou le visage d'un créateur de démo", () => {
  it("chaque portrait de /public/img/people a sa graine réservée, et inversement", () => {
    const files = readdirSync(root("public/img/people"))
      .filter((f) => f.endsWith(".jpg"))
      .map((f) => f.slice(0, -4));
    expect(files.length).toBeGreaterThan(0); // le dossier est bien lu
    expect(new Set(files)).toEqual(new Set(PORTRAIT_SEEDS));
    for (const seed of files) expect(isReservedHandle(seed), seed).toBe(true);
  });

  it("chaque handle et chaque graine de mock.ts sont réservés", () => {
    const src = readFileSync(root("src/lib/mock.ts"), "utf8");
    const found = [...src.matchAll(/\b(?:handle|seed): "([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(found.length).toBeGreaterThan(0);
    for (const h of found) expect(isReservedHandle(h), h).toBe(true);
  });

  it("chaque vendeur du catalogue seed est réservé", () => {
    const src = readFileSync(
      root("netlify/functions/_shared/seed-catalog.mts"),
      "utf8",
    );
    const found = [...src.matchAll(/\bseller: "([^"]+)"/g)].map((m) => m[1]);
    expect(found.length).toBeGreaterThan(0);
    for (const h of found) expect(isReservedHandle(h), h).toBe(true);
  });
});

describe("handleBaseFromEmail — le pseudo proposé à l'inscription", () => {
  it("garde lettres, chiffres et séparateurs de la partie locale", () => {
    expect(handleBaseFromEmail("Jean.Dupont+x@a.fr")).toBe("jean.dupontx");
  });
  it("une partie locale vide donne « membre »", () => {
    expect(handleBaseFromEmail("@a.fr")).toBe("membre");
  });
  it("coupe à 20 caractères", () => {
    expect(handleBaseFromEmail(`${"a".repeat(25)}@a.fr`)).toBe("a".repeat(20));
  });
});

describe("délai de 90 jours", () => {
  it("sans date, le premier changement est libre", () => {
    expect(canChangeHandle(undefined, NOW)).toBe(true);
    expect(canChangeHandle(null, NOW)).toBe(true);
    expect(nextHandleChangeAt(undefined)).toBeNull();
  });
  it("bloqué jusqu'à la dernière milliseconde, libre à l'échéance pile", () => {
    const next = NOW + HANDLE_COOLDOWN_MS;
    expect(nextHandleChangeAt(NOW)).toBe(next);
    expect(canChangeHandle(NOW, next - 1)).toBe(false);
    expect(canChangeHandle(NOW, next)).toBe(true);
  });
  it("la date s'écrit à l'heure de Paris, pas à celle du serveur", () => {
    // 23 h 30 UTC le 31 décembre : déjà le 1er janvier à Paris
    expect(formatHandleDate(Date.UTC(2026, 11, 31, 23, 30))).toBe(
      "1 janvier 2027",
    );
  });
});

describe("checkHandleChange — le contrôle rejoué au moment d'écrire", () => {
  it("accepte un identifiant libre et valide", () => {
    expect(checkHandleChange(member(), "lou.mercier", NOW)).toEqual({
      ok: true,
      reclaim: false,
    });
  });

  it("same : c'est déjà le sien", () => {
    expect(checkHandleChange(member(), "jean.dupont", NOW)).toMatchObject({
      ok: false,
      status: 400,
      code: "same",
    });
  });

  it("invalid : format refusé, réservé, ou valeur non normalisée", () => {
    for (const v of ["a", "admin", "membre-abc", "Lou.Mercier", "@lou"])
      expect(checkHandleChange(member(), v, NOW), v).toMatchObject({
        ok: false,
        status: 400,
        code: "invalid",
      });
  });

  it("blocked : un compte suspendu ou banni ne change pas d'identifiant", () => {
    const suspendu = member({ suspendedUntil: NOW + DAY });
    expect(checkHandleChange(suspendu, "lou.mercier", NOW)).toMatchObject({
      ok: false,
      status: 403,
      code: "blocked",
    });
    expect(
      checkHandleChange(member({ banned: true }), "lou.mercier", NOW),
    ).toMatchObject({ ok: false, status: 403, code: "blocked" });
  });

  it("cooldown : donne la date du prochain changement possible", () => {
    const last = Date.UTC(2026, 8, 1, 10);
    const r = checkHandleChange(
      member({ handleChangedAt: last }),
      "lou.mercier",
      NOW,
    );
    expect(r).toEqual({
      ok: false,
      status: 409,
      code: "cooldown",
      message: "Tu pourras changer d'identifiant à partir du 30 novembre 2026.",
      nextHandleChangeAt: last + HANDLE_COOLDOWN_MS,
    });
  });

  it("pending : un changement frais bloque, un verrou de plus de 60 s non", () => {
    const pendingHandle = { h: "autre", token: "hp_1", at: NOW - 1000 };
    expect(
      checkHandleChange(member({ pendingHandle }), "lou.mercier", NOW),
    ).toMatchObject({ ok: false, status: 409, code: "pending" });
    const vieux = { ...pendingHandle, at: NOW - HANDLE_PENDING_TTL_MS - 1 };
    expect(
      checkHandleChange(member({ pendingHandle: vieux }), "lou.mercier", NOW),
    ).toEqual({ ok: true, reclaim: false });
  });

  it("reprendre un ancien handle, même réservé ou de repli, est permis", () => {
    const rec = member({
      handleHistory: [
        { h: "membre-0123456789ab", at: NOW - 200 * DAY, redirectUntil: 0 },
        { h: "support", at: NOW - 100 * DAY, redirectUntil: 0 },
      ],
    });
    expect(checkHandleChange(rec, "membre-0123456789ab", NOW)).toEqual({
      ok: true,
      reclaim: true,
    });
    expect(checkHandleChange(rec, "support", NOW)).toEqual({
      ok: true,
      reclaim: true,
    });
  });

  it("la reprise respecte quand même le délai", () => {
    const rec = member({
      handleChangedAt: NOW - DAY,
      handleHistory: [{ h: "ancien", at: NOW - DAY, redirectUntil: 0 }],
    });
    expect(checkHandleChange(rec, "ancien", NOW)).toMatchObject({
      code: "cooldown",
    });
  });
});

describe("shouldReleaseReservation — régression du double envoi", () => {
  /* R1 et R2 changent le même membre vers v. R1 a fini : v est devenu son
     handle. Si l'annulation de R2 effaçait `handle:v`, n'importe qui
     pourrait reprendre l'identifiant que ce membre porte. */
  it("jamais quand v est devenu le handle du membre", () => {
    expect(shouldReleaseReservation(member({ handle: "v.nouveau" }), "v.nouveau")).toBe(
      false,
    );
  });
  it("jamais quand v est un de ses anciens handles", () => {
    const rec = member({
      handleHistory: [{ h: "v.nouveau", at: NOW, redirectUntil: 0 }],
    });
    expect(shouldReleaseReservation(rec, "v.nouveau")).toBe(false);
  });
  it("jamais quand v est son changement en cours", () => {
    const rec = member({ pendingHandle: { h: "v.nouveau", token: "hp_2", at: NOW } });
    expect(shouldReleaseReservation(rec, "v.nouveau")).toBe(false);
  });
  it("jamais sans enregistrement relu", () => {
    expect(shouldReleaseReservation(null, "v.nouveau")).toBe(false);
  });
  it("oui pour une réservation orpheline, laissée par une coupure", () => {
    expect(shouldReleaseReservation(member(), "v.nouveau")).toBe(true);
  });
});

describe("publicHandleTarget — réserver un handle n'est pas le rendre public", () => {
  const changedAt = NOW;
  const rec = member({
    handle: "lou.mercier",
    handleHistory: [
      { h: "jean.dupont", at: changedAt, redirectUntil: changedAt + HANDLE_REDIRECT_MS },
      { h: "prive", at: changedAt - 200 * DAY, redirectUntil: 0 },
    ],
  });

  it("le handle actuel est le profil canonique", () => {
    expect(publicHandleTarget(rec, "lou.mercier", NOW)).toBe("canonical");
  });
  it("l'ancien renvoie pendant la fenêtre choisie", () => {
    expect(publicHandleTarget(rec, "jean.dupont", changedAt + 29 * DAY)).toBe(
      "redirect",
    );
  });
  it("puis ne mène plus nulle part", () => {
    expect(publicHandleTarget(rec, "jean.dupont", changedAt + 31 * DAY)).toBe(
      "hidden",
    );
  });
  it("sans renvoi choisi, l'ancien ne mène jamais au profil", () => {
    expect(publicHandleTarget(rec, "prive", NOW)).toBe("hidden");
  });
  it("un handle inconnu du compte non plus", () => {
    expect(publicHandleTarget(rec, "quelquun", NOW)).toBe("hidden");
  });
});

describe("isBlockedBy — le contournement de blocage par changement d'identifiant", () => {
  const sender = member({
    handle: "nouveau.nom",
    handleHistory: [{ h: "lou.archive", at: NOW, redirectUntil: 0 }],
  });

  it("bloqué sous son ancien handle : toujours bloqué", () => {
    expect(isBlockedBy(["lou.archive"], sender)).toBe(true);
  });
  it("la casse de la liste ne sauve pas l'expéditeur", () => {
    expect(isBlockedBy(["Lou.Archive"], sender)).toBe(true);
    expect(isBlockedBy(["@NOUVEAU.nom"], sender)).toBe(true);
  });
  it("personne d'autre n'est bloqué par erreur", () => {
    expect(isBlockedBy(["quelquun"], sender)).toBe(false);
    expect(isBlockedBy([], sender)).toBe(false);
    expect(isBlockedBy(undefined, sender)).toBe(false);
  });
});

describe("applyRenames — abonnements et blocages suivent le membre", () => {
  const e = (from: string, to: string, at: number): RenameEntry => ({
    from,
    to,
    at,
  });

  it("suit une chaîne de changements", () => {
    const log = [e("a", "b", 1), e("b", "c", 2)];
    expect(applyRenames(["a", "x"], log)).toEqual({
      list: ["c", "x"],
      changed: true,
    });
  });

  it("applique le journal dans l'ordre chronologique, pas dans l'ordre stocké", () => {
    const log = [e("b", "c", 2), e("a", "b", 1)];
    expect(applyRenames(["a"], log).list).toEqual(["c"]);
  });

  it("un aller-retour A→B→A ramène à A", () => {
    const log = [e("a", "b", 1), e("b", "a", 2)];
    expect(applyRenames(["a"], log)).toEqual({ list: ["a"], changed: false });
    expect(applyRenames(["b"], log)).toEqual({ list: ["a"], changed: true });
  });

  it("rejouer le journal ne change plus rien", () => {
    const log = [e("a", "b", 1), e("b", "c", 2), e("x", "y", 3)];
    const once = applyRenames(["a", "x", "z"], log);
    expect(applyRenames(once.list, log)).toEqual({
      list: once.list,
      changed: false,
    });
  });

  it("ne garde qu'une entrée quand l'ancien et le nouveau y étaient", () => {
    expect(applyRenames(["a", "b"], [e("a", "b", 1)])).toEqual({
      list: ["b"],
      changed: true,
    });
  });

  it("canonicalise la casse", () => {
    expect(applyRenames(["Lou.Archive"], [])).toEqual({
      list: ["lou.archive"],
      changed: true,
    });
  });
});

describe("publicRenames — seuls les changements avec renvoi se suivent", () => {
  it("écarte les changements sans renvoi, marque absente comprise", () => {
    const avec: RenameEntry = { from: "a", to: "b", at: 1, redirect: true };
    const log: RenameEntry[] = [
      avec,
      { from: "c", to: "d", at: 2, redirect: false },
      { from: "e", to: "f", at: 3 },
    ];
    expect(publicRenames(log)).toEqual([avec]);
  });
});

describe("journal des changements", () => {
  it("n'en garde que 30 jours", () => {
    const log: RenameEntry[] = [
      { from: "a", to: "b", at: NOW - RENAME_LOG_TTL_MS },
      { from: "c", to: "d", at: NOW - RENAME_LOG_TTL_MS + 1 },
    ];
    expect(pruneRenameLog(log, NOW)).toEqual([log[1]]);
  });
});

describe("nextHandleHistory", () => {
  it("l'ancien y entre avec son renvoi, ou sans", () => {
    expect(nextHandleHistory(undefined, "a", "b", NOW, true)).toEqual([
      { h: "a", at: NOW, redirectUntil: NOW + HANDLE_REDIRECT_MS },
    ]);
    expect(nextHandleHistory(undefined, "a", "b", NOW, false)).toEqual([
      { h: "a", at: NOW, redirectUntil: 0 },
    ]);
  });

  it("sans doublon, et le nouveau handle n'y figure jamais", () => {
    const history = [
      { h: "b", at: 1, redirectUntil: 0 },
      { h: "a", at: 2, redirectUntil: 0 },
      { h: "c", at: 3, redirectUntil: 0 },
      { h: "c", at: 4, redirectUntil: 0 },
    ];
    const next = nextHandleHistory(history, "a", "b", NOW, false);
    const hs = next.map((x) => x.h);
    expect(hs).not.toContain("b");
    expect(new Set(hs).size).toBe(hs.length);
    expect(hs).toEqual(["c", "a"]);
    expect(handlesOf({ handle: "b", handleHistory: next })).toEqual(
      new Set(["b", "c", "a"]),
    );
  });
});

describe("profileRedirect — le profil s'affiche sous son handle actuel", () => {
  it("rien à faire quand on y est déjà, casse comprise", () => {
    expect(profileRedirect("Lou.Mercier", "lou.mercier")).toBeNull();
  });
  it("renvoie vers le handle actuel", () => {
    expect(profileRedirect("jean.dupont", "lou.mercier")).toBe(
      "/membre/lou.mercier",
    );
  });
});
