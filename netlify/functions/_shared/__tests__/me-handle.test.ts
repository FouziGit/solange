import { beforeEach, describe, expect, it, vi } from "vitest";
import deleteAccount from "../../account-delete.mts";
import changeHandle from "../../me-handle.mts";
import type { UserRecord } from "../core.mts";
import { HANDLE_TOMBSTONE } from "../users.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";

/* POST /api/me/handle et la suppression de compte, joués de bout en bout
   sur des stores en mémoire. La règle vérifiée partout : un handle ne
   change jamais de propriétaire. Il reste au membre (alias), ou devient
   une pierre tombale, et une annulation ne libère jamais un handle
   encore utilisé (le défaut CRITICAL du double envoi). */

const h = vi.hoisted(() => ({
  id: "u_0123456789ab",
  stores: (name: string): FakeStore => {
    throw new Error(`store ${name} non préparé`);
  },
}));

vi.mock("../core.mts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../core.mts")>()),
  store: (name: string) => h.stores(name),
  currentUser: async () => h.stores("users").peek(`u:${h.id}`),
  assertCanWrite: async () => null,
  rateLimit: async () => true,
}));
vi.mock("@netlify/functions", () => ({ purgeCache: async () => {} }));

const ID = h.id;
const AUTRE = "u_ba9876543210";
const DAY = 86_400_000;

let users: FakeStore;
let hmig: FakeStore;

const compte = (extra: Partial<UserRecord> = {}): UserRecord => ({
  id: ID,
  email: "jean.dupont@exemple.fr",
  handle: "jean.dupont",
  name: "Jean Dupont",
  ...extra,
});
const record = () => users.peek(`u:${ID}`) as UserRecord;

async function post(body: unknown) {
  const res = await changeHandle(
    new Request("https://solange.test/api/me/handle", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  h.stores = fakeStores();
  users = h.stores("users");
  hmig = h.stores("hmig");
  users.putJSON(`u:${ID}`, compte());
  users.put("handle:jean.dupont", ID);
});

describe("POST /api/me/handle — changer d'identifiant", () => {
  it("premier changement : bascule, l'ancien reste au membre, sans renvoi public", async () => {
    const r = await post({ handle: " @Lou.Mercier " });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, handle: "lou.mercier" });
    expect(r.body.nextHandleChangeAt - r.body.handleChangedAt).toBe(90 * DAY);

    const rec = record();
    expect(rec.handle).toBe("lou.mercier");
    expect(rec.pendingHandle).toBeUndefined();
    expect(rec.handleHistory).toEqual([
      { h: "jean.dupont", at: r.body.handleChangedAt, redirectUntil: 0 },
    ]);
    expect(users.text("handle:lou.mercier")).toBe(ID);
    expect(users.text("handle:jean.dupont")).toBe(ID);
    expect(hmig.peek("log")).toEqual([
      { from: "jean.dupont", to: "lou.mercier", at: r.body.handleChangedAt },
    ]);
  });

  it("renvoi coché : l'ancien lien mène au profil pendant 30 jours", async () => {
    const r = await post({ handle: "lou.mercier", redirect: true });
    expect(record().handleHistory?.[0].redirectUntil).toBe(
      r.body.handleChangedAt + 30 * DAY,
    );
  });

  it("déjà pris par un autre : 409 taken, verrou retiré, la clé de l'autre intacte", async () => {
    users.put("handle:maya.paris", AUTRE);
    const r = await post({ handle: "maya.paris" });
    expect(r).toMatchObject({ status: 409, body: { code: "taken" } });
    expect(users.text("handle:maya.paris")).toBe(AUTRE);
    expect(record()).toEqual(compte());
  });

  it("pierre tombale d'un compte supprimé : jamais reprise", async () => {
    users.put("handle:ancien.membre", HANDLE_TOMBSTONE);
    const r = await post({ handle: "ancien.membre" });
    expect(r).toMatchObject({ status: 409, body: { code: "taken" } });
    expect(users.text("handle:ancien.membre")).toBe(HANDLE_TOMBSTONE);
  });

  it("double envoi : la seconde requête bute sur le verrou et ne touche à rien", async () => {
    // la première requête a posé son verrou et réservé lou.mercier
    const enCours = { h: "lou.mercier", token: "hp_premiere00", at: Date.now() };
    users.putJSON(`u:${ID}`, compte({ pendingHandle: enCours }));
    users.put("handle:lou.mercier", ID);
    users.writes = [];

    for (const handle of ["lou.mercier", "autre.choix"]) {
      const r = await post({ handle });
      expect(r).toMatchObject({ status: 409, body: { code: "pending" } });
    }
    expect(users.text("handle:lou.mercier")).toBe(ID);
    expect(users.text("handle:autre.choix")).toBeNull();
    expect(users.writes).toEqual([]);
    expect(users.deletes).toEqual([]);
  });

  it("annulation : un handle devenu courant entre-temps n'est jamais rendu", async () => {
    /* Pendant que la requête finalise, une autre (verrou repris après 60 s)
       a déjà fait du même handle l'identifiant du membre. */
    let concurrent = true;
    users.beforeWrite = (k, body) => {
      if (k !== `u:${ID}` || !concurrent) return;
      if (!String(body).includes('"handle":"lou.mercier"')) return;
      concurrent = false;
      users.putJSON(
        `u:${ID}`,
        compte({
          handle: "lou.mercier",
          handleChangedAt: Date.now(),
          handleHistory: [{ h: "jean.dupont", at: Date.now(), redirectUntil: 0 }],
        }),
      );
    };
    const r = await post({ handle: "lou.mercier" });
    expect(r).toMatchObject({ status: 409, body: { code: "conflict" } });
    expect(record().handle).toBe("lou.mercier");
    expect(users.text("handle:lou.mercier")).toBe(ID);
  });

  it("annulation : une réservation que le compte n'utilise pas est rendue", async () => {
    let concurrent = true;
    users.beforeWrite = (k, body) => {
      if (k !== `u:${ID}` || !concurrent) return;
      if (!String(body).includes('"handle":"lou.mercier"')) return;
      concurrent = false;
      users.put("handle:autre.choix", ID);
      users.putJSON(
        `u:${ID}`,
        compte({
          handle: "autre.choix",
          handleChangedAt: Date.now(),
          handleHistory: [{ h: "jean.dupont", at: Date.now(), redirectUntil: 0 }],
        }),
      );
    };
    const r = await post({ handle: "lou.mercier" });
    expect(r).toMatchObject({ status: 409, body: { code: "conflict" } });
    expect(users.text("handle:lou.mercier")).toBeNull();
    expect(users.text("handle:jean.dupont")).toBe(ID);
    expect(users.text("handle:autre.choix")).toBe(ID);
  });

  it("tentative coupée sur un autre handle : sa réservation est rendue", async () => {
    const coupee = { h: "vieux.choix", token: "hp_x", at: Date.now() - 120_000 };
    users.putJSON(`u:${ID}`, compte({ pendingHandle: coupee }));
    users.put("handle:vieux.choix", ID);
    const r = await post({ handle: "lou.mercier" });
    expect(r.status).toBe(200);
    expect(users.text("handle:vieux.choix")).toBeNull();
    expect(users.text("handle:lou.mercier")).toBe(ID);
  });

  it("tentative coupée puis reprise d'un ancien handle : la réservation coupée est rendue", async () => {
    /* La reprise ne pose pas de verrou : sans ce nettoyage, handle:vieux.choix
       resterait au compte sans figurer ni dans son historique ni en
       attente, et échapperait à la pierre tombale de la suppression. */
    users.putJSON(
      `u:${ID}`,
      compte({
        handle: "lou.mercier",
        handleChangedAt: Date.now() - 91 * DAY,
        handleHistory: [{ h: "jean.dupont", at: 1, redirectUntil: 0 }],
        pendingHandle: {
          h: "vieux.choix",
          token: "hp_x",
          at: Date.now() - 120_000,
        },
      }),
    );
    users.put("handle:lou.mercier", ID);
    users.put("handle:vieux.choix", ID);
    const r = await post({ handle: "jean.dupont" });
    expect(r.status).toBe(200);
    expect(record().handle).toBe("jean.dupont");
    expect(record().pendingHandle).toBeUndefined();
    expect(users.text("handle:vieux.choix")).toBeNull();
    expect(users.text("handle:lou.mercier")).toBe(ID);
  });

  it("reste d'une tentative coupée sur le même handle, puis échec : la réservation est rendue", async () => {
    const coupee = { h: "lou.mercier", token: "hp_x", at: Date.now() - 120_000 };
    users.putJSON(`u:${ID}`, compte({ pendingHandle: coupee }));
    users.put("handle:lou.mercier", ID);
    let concurrent = true;
    users.beforeWrite = (k, body) => {
      if (k !== `u:${ID}` || !concurrent) return;
      if (!String(body).includes('"handle":"lou.mercier"')) return;
      concurrent = false;
      users.put("handle:autre.choix", ID);
      users.putJSON(
        `u:${ID}`,
        compte({
          handle: "autre.choix",
          handleChangedAt: Date.now(),
          handleHistory: [{ h: "jean.dupont", at: Date.now(), redirectUntil: 0 }],
        }),
      );
    };
    const r = await post({ handle: "lou.mercier" });
    expect(r).toMatchObject({ status: 409, body: { code: "conflict" } });
    expect(users.text("handle:lou.mercier")).toBeNull();
    expect(users.text("handle:autre.choix")).toBe(ID);
    expect(users.text("handle:jean.dupont")).toBe(ID);
  });

  it("tentative coupée sur le même handle : la réservation déjà à nous est reprise", async () => {
    const coupee = { h: "lou.mercier", token: "hp_x", at: Date.now() - 120_000 };
    users.putJSON(`u:${ID}`, compte({ pendingHandle: coupee }));
    users.put("handle:lou.mercier", ID);
    const r = await post({ handle: "lou.mercier" });
    expect(r.status).toBe(200);
    expect(record().handle).toBe("lou.mercier");
  });

  it("reprise d'un ancien handle, même au format de repli : acceptée", async () => {
    users.putJSON(
      `u:${ID}`,
      compte({
        handle: "lou.mercier",
        handleChangedAt: Date.now() - 91 * DAY,
        handleHistory: [{ h: "membre-0123456789ab", at: 1, redirectUntil: 0 }],
      }),
    );
    users.put("handle:membre-0123456789ab", ID);
    const r = await post({ handle: "membre-0123456789ab" });
    expect(r.status).toBe(200);
    expect(record().handle).toBe("membre-0123456789ab");
    expect(record().handleHistory?.map((a) => a.h)).toEqual(["lou.mercier"]);
  });

  it("ancien handle dont la clé ne mène plus au membre : refusé", async () => {
    users.putJSON(
      `u:${ID}`,
      compte({
        handleHistory: [{ h: "perdu.depuis", at: 1, redirectUntil: 0 }],
      }),
    );
    users.put("handle:perdu.depuis", AUTRE);
    const r = await post({ handle: "perdu.depuis" });
    expect(r).toMatchObject({ status: 409, body: { code: "taken" } });
    expect(record().handle).toBe("jean.dupont");
  });

  it("moins de 90 jours après le précédent : 409 cooldown avec la date", async () => {
    const avant = Date.now() - 10 * DAY;
    users.putJSON(`u:${ID}`, compte({ handleChangedAt: avant }));
    const r = await post({ handle: "lou.mercier" });
    expect(r).toMatchObject({
      status: 409,
      body: { code: "cooldown", nextHandleChangeAt: avant + 90 * DAY },
    });
    expect(users.text("handle:lou.mercier")).toBeNull();
  });

  it("format refusé ou identifiant réservé : 400 invalid, rien de réservé", async () => {
    for (const handle of ["a", "lou..mercier", "admin", "lou.archive", "membre-x"]) {
      const r = await post({ handle });
      expect(r, handle).toMatchObject({
        status: 400,
        body: { code: "invalid" },
      });
    }
    expect(users.writes).toEqual([]);
  });

  it("membre suspendu : 403 blocked", async () => {
    users.putJSON(`u:${ID}`, compte({ suspendedUntil: Date.now() + DAY }));
    const r = await post({ handle: "lou.mercier" });
    expect(r).toMatchObject({ status: 403, body: { code: "blocked" } });
  });
});

describe("suppression du compte — chaque handle devient une pierre tombale", () => {
  it("handle actuel, anciens et en cours ; jamais la clé d'un autre", async () => {
    users.putJSON(
      `u:${ID}`,
      compte({
        handle: "lou.mercier",
        handleHistory: [
          { h: "jean.dupont", at: 1, redirectUntil: 0 },
          { h: "repris.par.autre", at: 2, redirectUntil: 0 },
        ],
        pendingHandle: { h: "en.cours", token: "hp_x", at: 3 },
        avatar: "/api/img/i_aaaaaaaaaaaa",
      }),
    );
    users.put("handle:lou.mercier", ID);
    users.put("handle:en.cours", ID);
    users.put("handle:repris.par.autre", AUTRE);
    h.stores("imgs").put("i_aaaaaaaaaaaa", new ArrayBuffer(4));

    const res = await deleteAccount(
      new Request("https://solange.test/api/account/delete", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    for (const k of ["lou.mercier", "jean.dupont", "en.cours"])
      expect(users.text(`handle:${k}`), k).toBe(HANDLE_TOMBSTONE);
    expect(users.text("handle:repris.par.autre")).toBe(AUTRE);
    expect(users.peek(`u:${ID}`)).toBeNull();
    expect(h.stores("imgs").peek("i_aaaaaaaaaaaa")).toBeNull();
  });

  it("photo remplacée pendant la suppression : aucune ne reste publique", async () => {
    /* Un envoi de photo, avec une session encore valide, passe entre la
       lecture du compte et sa suppression : il pose B et efface A. */
    const imgs = h.stores("imgs");
    users.putJSON(`u:${ID}`, compte({ avatar: "/api/img/i_aaaaaaaaaaaa" }));
    imgs.put("i_aaaaaaaaaaaa", new ArrayBuffer(4));
    let concurrent = true;
    users.beforeWrite = () => {
      if (!concurrent) return;
      concurrent = false;
      users.putJSON(`u:${ID}`, compte({ avatar: "/api/img/i_bbbbbbbbbbbb" }));
      imgs.put("i_bbbbbbbbbbbb", new ArrayBuffer(4));
      imgs.entries.delete("i_aaaaaaaaaaaa");
    };

    const res = await deleteAccount(
      new Request("https://solange.test/api/account/delete", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(users.peek(`u:${ID}`)).toBeNull();
    expect([...imgs.entries.keys()]).toEqual([]);
  });
});
