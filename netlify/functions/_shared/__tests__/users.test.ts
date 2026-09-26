import { beforeEach, describe, expect, it } from "vitest";
import type { UserRecord } from "../core.mts";
import {
  HANDLE_TOMBSTONE,
  profileFields,
  resolveHandle,
  updateUser,
} from "../users.mts";
import { FakeStore } from "./fake-blobs";

/* `u:<id>` ne se réécrit qu'en écriture conditionnelle. Avant, chaque
   endpoint relisait le compte puis l'écrasait : une photo enregistrée
   pendant l'acceptation des conditions disparaissait sans bruit. */

const ID = "u_0123456789ab";
const KEY = `u:${ID}`;
const PHOTO = "/api/img/i_aaaaaaaaaaaa";
const AUTRE_PHOTO = "/api/img/i_bbbbbbbbbbbb";

const compte = (extra: Partial<UserRecord> = {}): UserRecord => ({
  id: ID,
  email: "jean.dupont@exemple.fr",
  handle: "jean.dupont",
  name: "Jean Dupont",
  ...extra,
});

let users: FakeStore;
beforeEach(() => {
  users = new FakeStore();
  users.putJSON(KEY, compte());
});

describe("updateUser — réécriture conditionnelle de u:<id>", () => {
  it("fusionne sur l'enregistrement frais et rend l'avant / l'après", async () => {
    const r = await updateUser(ID, (u) => ({ ...u, avatar: PHOTO }), {
      users,
    });
    expect(r).toEqual({
      ok: true,
      rec: compte({ avatar: PHOTO }),
      prev: compte(),
    });
    expect(users.peek(KEY)).toEqual(compte({ avatar: PHOTO }));
  });

  it("un autre écrit entre la lecture et l'écriture : on repart du frais et rien n'est perdu", async () => {
    let concurrent = true;
    users.beforeWrite = (k) => {
      if (k !== KEY || !concurrent) return;
      concurrent = false;
      users.putJSON(KEY, compte({ legal: { version: 1, at: 5, age: true } }));
    };
    const r = await updateUser(ID, (u) => ({ ...u, avatar: PHOTO }), {
      users,
    });
    expect(r.ok).toBe(true);
    // la photo ET le consentement écrit entre-temps
    expect(users.peek(KEY)).toEqual(
      compte({ avatar: PHOTO, legal: { version: 1, at: 5, age: true } }),
    );
    // `prev` est l'enregistrement du dernier essai, celui qui a réussi
    if (r.ok) expect(r.prev.legal).toEqual({ version: 1, at: 5, age: true });
  });

  it("trois conflits de suite : `conflict`, aucune écriture", async () => {
    let n = 0;
    users.beforeWrite = (k) => {
      if (k === KEY) users.putJSON(KEY, compte({ avatar: `${n++}` }));
    };
    let essais = 0;
    const r = await updateUser(
      ID,
      (u) => {
        essais++;
        return { ...u, avatar: PHOTO };
      },
      { users },
    );
    expect(r).toEqual({ ok: false, reason: "conflict" });
    expect(essais).toBe(3);
    expect(users.writes).toEqual([]);
  });

  it("sans etag : `conflict`, et on n'écrit pas à l'aveugle", async () => {
    users.withoutEtag = true;
    let appele = false;
    const r = await updateUser(
      ID,
      (u) => {
        appele = true;
        return { ...u, avatar: PHOTO };
      },
      { users },
    );
    expect(r).toEqual({ ok: false, reason: "conflict" });
    expect(appele).toBe(false);
    expect(users.writes).toEqual([]);
    expect(users.peek(KEY)).toEqual(compte());
  });

  it("mutate renonce (null) : `aborted`, rien n'est écrit", async () => {
    const r = await updateUser(ID, () => null, { users });
    expect(r).toEqual({ ok: false, reason: "aborted" });
    expect(users.writes).toEqual([]);
  });

  it("compte absent : `missing`", async () => {
    const r = await updateUser("u_ffffffffffff", (u) => u, { users });
    expect(r).toEqual({ ok: false, reason: "missing" });
  });

  it("mutate reçoit une copie : modifier en place ne fausse pas `prev`", async () => {
    users.putJSON(KEY, compte({ avatar: PHOTO }));
    const r = await updateUser(
      ID,
      (u) => {
        u.avatar = AUTRE_PHOTO;
        return u;
      },
      { users },
    );
    expect(r.ok && r.prev.avatar).toBe(PHOTO);
    expect(r.ok && r.rec.avatar).toBe(AUTRE_PHOTO);
  });
});

describe("resolveHandle — un handle désigne son titulaire, ou personne", () => {
  it("rend l'id du titulaire, quelle que soit la saisie", async () => {
    users.put("handle:lou.mercier", ID);
    expect(await resolveHandle("lou.mercier", users)).toBe(ID);
    expect(await resolveHandle(" @Lou.Mercier ", users)).toBe(ID);
  });

  it("pierre tombale d'un compte supprimé : personne", async () => {
    users.put("handle:jean.dupont", HANDLE_TOMBSTONE);
    expect(await resolveHandle("jean.dupont", users)).toBeNull();
  });

  it("clé absente, vide ou valeur qui n'est pas un id : personne", async () => {
    users.put("handle:bizarre", "admin");
    expect(await resolveHandle("inconnu", users)).toBeNull();
    expect(await resolveHandle("", users)).toBeNull();
    expect(await resolveHandle("bizarre", users)).toBeNull();
  });
});

describe("profileFields — ce que le membre voit de son propre profil", () => {
  it("premier changement libre : aucune date", () => {
    expect(profileFields(compte())).toEqual({
      avatar: null,
      avatarHidden: false,
      avatarLocked: false,
      handleChangedAt: null,
      nextHandleChangeAt: null,
      formerHandles: [],
    });
  });

  it("anciens identifiants rendus à leur titulaire, même hors des règles actuelles", () => {
    const at = Date.UTC(2026, 0, 1);
    const f = profileFields(
      compte({
        handle: "lou.mercier",
        handleHistory: [
          { h: "membre-3fa2c1", at, redirectUntil: 0 },
          { h: "jean.dupont", at: at + 1, redirectUntil: at + 30 * 86_400_000 },
        ],
      }),
    );
    // seulement les identifiants : ni dates, ni fenêtre de renvoi
    expect(f.formerHandles).toEqual(["membre-3fa2c1", "jean.dupont"]);
  });

  it("prochain changement 90 jours après le dernier", () => {
    const at = Date.UTC(2026, 0, 1);
    expect(profileFields(compte({ handleChangedAt: at }))).toMatchObject({
      handleChangedAt: at,
      nextHandleChangeAt: at + 90 * 86_400_000,
    });
  });

  it("photo masquée par la modération : ni renvoyée, ni oubliée (verrou)", () => {
    const f = profileFields(
      compte({ avatar: PHOTO, avatarHidden: true, avatarLocked: true }),
    );
    expect(f.avatar).toBeNull();
    expect(f.avatarLocked).toBe(true);
    expect(profileFields(compte({ avatar: PHOTO })).avatar).toBe(PHOTO);
  });

  it("photo masquée encore gardée, ou déjà retirée : l'écran sait s'il reste quelque chose à retirer", () => {
    const gardee = profileFields(
      compte({ avatar: PHOTO, avatarHidden: true, avatarLocked: true }),
    );
    expect(gardee.avatarHidden).toBe(true);
    // retirée par le membre : le verrou reste, plus rien à retirer
    const retiree = profileFields(compte({ avatarLocked: true }));
    expect(retiree).toMatchObject({
      avatar: null,
      avatarHidden: false,
      avatarLocked: true,
    });
    expect(profileFields(compte({ avatar: PHOTO })).avatarHidden).toBe(false);
  });

  it("un chemin douteux n'est jamais renvoyé comme photo", () => {
    expect(profileFields(compte({ avatar: "javascript:alert(1)" })).avatar).toBe(
      null,
    );
  });
});
