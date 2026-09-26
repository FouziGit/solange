import { beforeEach, describe, expect, it, vi } from "vitest";
import admin from "../../admin.mts";
import type { UserRecord } from "../core.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";

/* Masquer et rétablir la photo d'un membre signalé, joués de bout en bout
   sur des stores en mémoire. Le cas surveillé : le membre retire sa photo
   pendant que la modération la déplace. Son effacement peut passer entre
   la lecture et l'écriture du déplacement ; la photo ne doit alors ni
   redevenir publique (/api/img), ni rester en quarantaine sans compte
   pour la réclamer. */

const h = vi.hoisted(() => ({
  admin: "u_aaaaaaaaaaaa",
  stores: (name: string): FakeStore => {
    throw new Error(`store ${name} non préparé`);
  },
}));

vi.mock("../core.mts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../core.mts")>()),
  store: (name: string) => h.stores(name),
  currentUser: async () => h.stores("users").peek(`u:${h.admin}`),
  pushNotif: async () => {},
}));
vi.mock("@netlify/functions", () => ({ purgeCache: async () => {} }));

const MEMBRE = "u_0123456789ab";
const PHOTO = "/api/img/i_cccccccccccc";
const IMG = "i_cccccccccccc";

let users: FakeStore;
let imgs: FakeStore;
let quarantine: FakeStore;

const membre = (extra: Partial<UserRecord> = {}): UserRecord => ({
  id: MEMBRE,
  email: "jean.dupont@exemple.fr",
  handle: "jean.dupont",
  name: "Jean Dupont",
  ...extra,
});

async function act(action: "hide" | "unhide") {
  const res = await admin(
    new Request("https://solange.test/api/admin", {
      method: "POST",
      body: JSON.stringify({ op: "act", action, reportId: "r1" }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

/** Le membre retire sa photo (DELETE /api/me/avatar) juste avant que
    `store` reçoive le fichier déplacé. */
function retraitPendantLeDeplacement(dest: FakeStore) {
  let concurrent = true;
  dest.beforeWrite = () => {
    if (!concurrent) return;
    concurrent = false;
    users.putJSON(`u:${MEMBRE}`, membre({ avatarLocked: true }));
    imgs.entries.delete(IMG);
    quarantine.entries.delete(IMG);
  };
}

beforeEach(() => {
  h.stores = fakeStores();
  users = h.stores("users");
  imgs = h.stores("imgs");
  quarantine = h.stores("imgs-q");
  users.putJSON(`u:${h.admin}`, {
    id: h.admin,
    email: "equipe@exemple.fr",
    handle: "equipe",
    name: "Équipe",
    role: "admin",
  } satisfies UserRecord);
  users.put("handle:jean.dupont", MEMBRE);
  h.stores("reports").putJSON("r:r1", {
    id: "r1",
    targetType: "user",
    targetId: "jean.dupont",
    targetUserId: MEMBRE,
    reason: "photo",
    reporterId: "u_bbbbbbbbbbbb",
    reporterHandle: "maya.paris",
    status: "open",
    at: 1,
  });
});

describe("masquer la photo d'un membre", () => {
  beforeEach(() => {
    users.putJSON(`u:${MEMBRE}`, membre({ avatar: PHOTO }));
    imgs.put(IMG, new ArrayBuffer(4), { kind: "avatar" });
  });

  it("la photo passe en quarantaine, le compte est verrouillé", async () => {
    expect(await act("hide")).toEqual({
      status: 200,
      body: { ok: true, applied: true },
    });
    expect(imgs.peek(IMG)).toBeNull();
    expect(quarantine.entries.has(IMG)).toBe(true);
    expect(users.peek(`u:${MEMBRE}`)).toEqual(
      membre({ avatar: PHOTO, avatarHidden: true, avatarLocked: true }),
    );
  });

  it("retirée par le membre pendant le masquage : rien ne reste en quarantaine", async () => {
    retraitPendantLeDeplacement(quarantine);
    await act("hide");
    expect(imgs.entries.has(IMG)).toBe(false);
    expect(quarantine.entries.has(IMG)).toBe(false);
  });
});

describe("rétablir la photo d'un membre", () => {
  beforeEach(() => {
    users.putJSON(
      `u:${MEMBRE}`,
      membre({ avatar: PHOTO, avatarHidden: true, avatarLocked: true }),
    );
    quarantine.put(IMG, new ArrayBuffer(4), { kind: "avatar" });
  });

  it("la photo est de nouveau servie, masque et verrou levés", async () => {
    expect(await act("unhide")).toEqual({
      status: 200,
      body: { ok: true, applied: true },
    });
    expect(imgs.entries.has(IMG)).toBe(true);
    expect(quarantine.entries.has(IMG)).toBe(false);
    expect(users.peek(`u:${MEMBRE}`)).toEqual(
      membre({ avatar: PHOTO, avatarHidden: false, avatarLocked: false }),
    );
  });

  it("retirée par le membre pendant le rétablissement : elle ne redevient pas publique", async () => {
    retraitPendantLeDeplacement(imgs);
    await act("unhide");
    expect(imgs.entries.has(IMG)).toBe(false);
    expect(quarantine.entries.has(IMG)).toBe(false);
    expect((users.peek(`u:${MEMBRE}`) as UserRecord).avatar).toBeUndefined();
  });
});
