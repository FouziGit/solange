import { beforeEach, describe, expect, it, vi } from "vitest";
import me from "../../me.mts";
import social from "../../social.mts";
import type { UserRecord } from "../core.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";

/* Abonnements et blocages après un changement d'@identifiant, joués de
   bout en bout (POST /api/social puis GET /api/me). Une relation vise la
   personne : avec ou sans renvoi, les listes nouées AVANT le changement
   passent au nouveau handle (on garde ses abonnés, et un membre bloqué
   ne réapparaît pas). Sans renvoi, un ancien handle ne peut plus être
   AJOUTÉ : « jean.dupont » ne doit jamais faire découvrir « lou.mercier »
   à quelqu'un qui ne le suivait pas. */

const h = vi.hoisted(() => ({
  id: "u_ba9876543210",
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
  pushNotif: async () => {},
}));

const MOI = h.id;
const RENOMME = "u_0123456789ab";
const DAY = 86_400_000;

let users: FakeStore;
let hmig: FakeStore;
let socialStore: FakeStore;

/** jean.dupont est devenu lou.mercier hier, avec ou sans renvoi. */
function renomme(redirect: boolean) {
  const at = Date.now() - DAY;
  users.putJSON(`u:${RENOMME}`, {
    id: RENOMME,
    email: "jean.dupont@exemple.fr",
    handle: "lou.mercier",
    name: "Lou Mercier",
    handleChangedAt: at,
    handleHistory: [
      { h: "jean.dupont", at, redirectUntil: redirect ? at + 30 * DAY : 0 },
    ],
  } satisfies UserRecord);
  users.put("handle:jean.dupont", RENOMME);
  users.put("handle:lou.mercier", RENOMME);
  hmig.putJSON("log", [
    {
      from: "jean.dupont",
      to: "lou.mercier",
      at,
      ...(redirect ? { redirect: true } : {}),
    },
  ]);
}

async function post(kind: string, id: string, on = true) {
  return social(
    new Request("https://solange.test/api/social", {
      method: "POST",
      body: JSON.stringify({ kind, id, on }),
    }),
  );
}

async function toggle(kind: string, id: string) {
  expect((await post(kind, id)).status).toBe(200);
}

async function hydrate() {
  const res = await me(new Request("https://solange.test/api/me"));
  const text = await res.text();
  return {
    text,
    social: (JSON.parse(text) as { social: Record<string, string[]> }).social,
  };
}

beforeEach(() => {
  h.stores = fakeStores();
  users = h.stores("users");
  hmig = h.stores("hmig");
  socialStore = h.stores("social");
  users.putJSON(`u:${MOI}`, {
    id: MOI,
    email: "maya@exemple.fr",
    handle: "maya.paris",
    name: "Maya",
  } satisfies UserRecord);
});

describe("sans renvoi : l'ancien handle ne mène jamais au nouveau", () => {
  beforeEach(() => renomme(false));

  it("suivre ou bloquer l'ancien handle masqué : refusé, rien n'est enregistré", async () => {
    const f = await post("follows", "jean.dupont");
    const b = await post("blocked", "Jean.Dupont");
    expect(f.status).toBe(404);
    expect(b.status).toBe(404);
    expect(socialStore.peek(`s:${MOI}`)).toBeNull();
    const r = await hydrate();
    expect(r.text).not.toContain("lou.mercier");
  });

  it("suivre le NOUVEAU handle reste possible", async () => {
    await toggle("follows", "lou.mercier");
    expect((await hydrate()).social.follows).toEqual(["lou.mercier"]);
  });

  it("les abonnements et blocages noués avant le changement le suivent", async () => {
    socialStore.putJSON(`s:${MOI}`, {
      follows: ["jean.dupont"],
      blocked: ["jean.dupont"],
    });
    const r = await hydrate();
    expect(r.social.follows).toEqual(["lou.mercier"]);
    expect(r.social.blocked).toEqual(["lou.mercier"]);
    expect(socialStore.peek(`s:${MOI}`)).toEqual({
      follows: ["lou.mercier"],
      blocked: ["lou.mercier"],
    });
  });

  it("retirer l'ancien handle d'une liste existante fonctionne", async () => {
    socialStore.putJSON(`s:${MOI}`, { follows: ["jean.dupont"] });
    expect((await post("follows", "jean.dupont", false)).status).toBe(200);
    expect((await hydrate()).social.follows).toEqual([]);
  });
});

describe("avec renvoi : abonnements et blocages suivent le membre", () => {
  beforeEach(() => renomme(true));

  it("l'ancien handle est rangé sous le nouveau", async () => {
    await toggle("follows", "jean.dupont");
    const r = await hydrate();
    expect(r.social.follows).toEqual(["lou.mercier"]);
  });

  it("une liste déjà enregistrée passe au nouveau handle", async () => {
    socialStore.putJSON(`s:${MOI}`, { blocked: ["jean.dupont"] });
    const r = await hydrate();
    expect(r.social.blocked).toEqual(["lou.mercier"]);
    expect(socialStore.peek(`s:${MOI}`)).toEqual({ blocked: ["lou.mercier"] });
  });
});
