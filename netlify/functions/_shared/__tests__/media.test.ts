import { beforeEach, describe, expect, it, vi } from "vitest";
import serveImage from "../../img.mts";
import avatarEndpoint from "../../me-avatar.mts";
import type { UserRecord } from "../core.mts";
import { quarantineImage, restoreImage, storeImages } from "../media.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";

/* Photo de profil de bout en bout, sur des stores en mémoire : envoi,
   nettoyage du JPEG, remplacement, retrait, masquage par la modération,
   et les en-têtes sous lesquels /api/img la sert. */

const h = vi.hoisted(() => ({
  id: "u_0123456789ab",
  purged: [] as string[][],
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
vi.mock("@netlify/functions", () => ({
  purgeCache: async (o: { tags?: string[] }) => {
    h.purged.push(o.tags ?? []);
  },
}));

const ID = h.id;
const ANCIENNE = "/api/img/i_aaaaaaaaaaaa";

/* ---------- un JPEG avec EXIF et position GPS ---------- */

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const seg = (marker: number, payload: number[]) => {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
};
const GPS = ascii("GPS 48.8566N 2.3522E");
const PHOTO = [
  [0xff, 0xd8],
  seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
  seg(0xe1, [...ascii("Exif"), 0, 0, ...GPS]),
  seg(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]),
  seg(0xc0, [8, 0, 16, 0, 16, 1, 1, 0x11, 0]),
  seg(0xc4, [0, 0, 1, ...Array.from({ length: 14 }, () => 0), 0]),
  seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
  [0x12, 0x34, 0x56],
  [0xff, 0xd9],
].flat();
const dataUrl = (bytes: number[], type = "image/jpeg") =>
  `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

function contains(hay: Uint8Array, needle: number[]): boolean {
  for (let i = 0; i + needle.length <= hay.length; i++)
    if (needle.every((x, k) => hay[i + k] === x)) return true;
  return false;
}

/* ---------- appels ---------- */

let users: FakeStore;
let imgs: FakeStore;
let quarantine: FakeStore;

const compte = (extra: Partial<UserRecord> = {}): UserRecord => ({
  id: ID,
  email: "jean.dupont@exemple.fr",
  handle: "jean.dupont",
  name: "Jean Dupont",
  ...extra,
});
const record = () => users.peek(`u:${ID}`) as UserRecord;
const idOf = (path: string) => path.split("/").pop() ?? "";

async function call(method: "POST" | "DELETE", body?: unknown) {
  const res = await avatarEndpoint(
    new Request("https://solange.test/api/me/avatar", {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

const get = (id: string) =>
  serveImage(new Request(`https://solange.test/api/img/${id}`));

beforeEach(() => {
  h.stores = fakeStores();
  h.purged = [];
  users = h.stores("users");
  imgs = h.stores("imgs");
  quarantine = h.stores("imgs-q");
  users.putJSON(`u:${ID}`, compte({ avatar: ANCIENNE }));
  imgs.put("i_aaaaaaaaaaaa", new Uint8Array([1, 2, 3]).buffer, {
    contentType: "image/jpeg",
    kind: "avatar",
  });
});

describe("POST /api/me/avatar — nouvelle photo", () => {
  it("stockée sans EXIF ni GPS, marquée photo de profil ; l'ancienne est effacée", async () => {
    const r = await call("POST", { image: dataUrl(PHOTO) });
    expect(r.status).toBe(200);
    const path = r.body.avatar as string;
    expect(path).toMatch(/^\/api\/img\/i_[a-f0-9]{12}$/);
    expect(record().avatar).toBe(path);

    const e = imgs.entries.get(idOf(path));
    expect(e?.metadata).toEqual({ contentType: "image/jpeg", kind: "avatar" });
    const bytes = new Uint8Array(e?.body as ArrayBuffer);
    expect(contains(bytes, GPS)).toBe(false);
    expect(contains(bytes, ascii("Exif"))).toBe(false);

    expect(imgs.peek("i_aaaaaaaaaaaa")).toBeNull();
    expect(h.purged).toContainEqual(["img-i_aaaaaaaaaaaa"]);
  });

  it("autre format que JPEG, ou JPEG illisible : refusé, rien de stocké", async () => {
    for (const image of [
      dataUrl([0x89, 0x50, 0x4e, 0x47], "image/png"),
      dataUrl([0xff, 0xd8, 0xff, 0xe0, 0x00]),
      "https://exemple.fr/photo.jpg",
      42,
    ]) {
      const r = await call("POST", { image });
      expect(r, String(image)).toEqual({
        status: 400,
        body: { error: "Format de photo non supporté." },
      });
    }
    expect([...imgs.entries.keys()]).toEqual(["i_aaaaaaaaaaaa"]);
  });

  it("trop lourde : refusée", async () => {
    const r = await call("POST", { image: dataUrl(new Array(400_001).fill(0)) });
    expect(r).toEqual({ status: 400, body: { error: "Photo trop lourde." } });
  });

  it("photo masquée par la modération : 403, rien de stocké", async () => {
    users.putJSON(`u:${ID}`, compte({ avatarHidden: true, avatarLocked: true }));
    const r = await call("POST", { image: dataUrl(PHOTO) });
    expect(r.status).toBe(403);
    expect([...imgs.entries.keys()]).toEqual(["i_aaaaaaaaaaaa"]);
  });

  it("masquée pendant l'envoi : 403 et le fichier envoyé est effacé", async () => {
    let concurrent = true;
    users.beforeWrite = () => {
      if (!concurrent) return;
      concurrent = false;
      users.putJSON(`u:${ID}`, compte({ avatar: ANCIENNE, avatarLocked: true }));
    };
    const r = await call("POST", { image: dataUrl(PHOTO) });
    expect(r.status).toBe(403);
    expect([...imgs.entries.keys()]).toEqual(["i_aaaaaaaaaaaa"]);
    expect(record().avatar).toBe(ANCIENNE);
  });
});

describe("DELETE /api/me/avatar — retirer sa photo", () => {
  it("photo retirée du compte et du stockage, cache purgé", async () => {
    const r = await call("DELETE");
    expect(r).toEqual({ status: 200, body: { ok: true, avatar: null } });
    expect(record()).toEqual(compte());
    expect(imgs.peek("i_aaaaaaaaaaaa")).toBeNull();
    expect(h.purged).toContainEqual(["img-i_aaaaaaaaaaaa"]);
  });

  it("photo masquée : effacée de la quarantaine, le verrou reste", async () => {
    users.putJSON(
      `u:${ID}`,
      compte({ avatar: ANCIENNE, avatarHidden: true, avatarLocked: true }),
    );
    expect(await quarantineImage(ANCIENNE)).toBe(true);
    await call("DELETE");
    expect(record()).toEqual(compte({ avatarLocked: true }));
    expect(quarantine.peek("i_aaaaaaaaaaaa")).toBeNull();
  });

  it("aucune photo : rien à écrire", async () => {
    users.putJSON(`u:${ID}`, compte());
    users.writes = [];
    const r = await call("DELETE");
    expect(r.status).toBe(200);
    expect(users.writes).toEqual([]);
  });
});

describe("/api/img — en-têtes et masquage", () => {
  it("photo de profil : une heure dans le navigateur, CDN jusqu'à la purge", async () => {
    const res = await get("i_aaaaaaaaaaaa");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("netlify-cdn-cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("netlify-cache-tag")).toBe("img-i_aaaaaaaaaaaa");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    );
  });

  it("photo d'annonce : cache inchangé", async () => {
    imgs.put("i_cccccccccccc", new ArrayBuffer(3), { contentType: "image/png" });
    const res = await get("i_cccccccccccc");
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("netlify-cdn-cache-control")).toBeNull();
  });

  it("identifiant invalide ou inconnu : 404, toujours sous nosniff", async () => {
    for (const id of ["../x", "i_dddddddddddd"]) {
      const res = await get(id);
      expect(res.status).toBe(404);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("masquée : plus servie, cache purgé ; rétablie : servie de nouveau", async () => {
    expect(await quarantineImage(ANCIENNE)).toBe(true);
    expect((await get("i_aaaaaaaaaaaa")).status).toBe(404);
    expect(quarantine.entries.get("i_aaaaaaaaaaaa")?.metadata).toEqual({
      contentType: "image/jpeg",
      kind: "avatar",
    });
    expect(h.purged).toContainEqual(["img-i_aaaaaaaaaaaa"]);
    // un second masquage ne perd rien
    expect(await quarantineImage(ANCIENNE)).toBe(true);

    expect(await restoreImage(ANCIENNE)).toBe(true);
    expect((await get("i_aaaaaaaaaaaa")).status).toBe(200);
    expect(quarantine.peek("i_aaaaaaaaaaaa")).toBeNull();
  });

  it("un chemin qui n'est pas une photo servie par /api/img n'est jamais touché", async () => {
    expect(await quarantineImage("/api/img/../x")).toBe(false);
    expect(await restoreImage("javascript:alert(1)")).toBe(false);
    expect(imgs.deletes).toEqual([]);
  });
});

describe("storeImages — photos d'annonces et de posts inchangées", () => {
  it("métadonnées limitées au type, comme avant", async () => {
    const r = await storeImages([dataUrl([1, 2, 3], "image/png")], 4);
    expect(r.ok).toBe(true);
    const path = r.ok ? r.paths[0] : "";
    expect(imgs.entries.get(idOf(path))?.metadata).toEqual({
      contentType: "image/png",
    });
  });
});
