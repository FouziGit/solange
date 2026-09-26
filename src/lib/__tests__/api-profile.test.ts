import { afterEach, describe, expect, it, vi } from "vitest";
import { MEMBERS_BATCH, api, memberBatches, prepareAvatar } from "../api";
import { AVATAR_PX, AVATAR_QUALITY } from "../avatar";

/* Client du profil : codes d'erreur du serveur, lecture des membres par
   lots, préparation de la photo. fetch et le canvas sont remplacés par
   des doublures : on vérifie ce que le client envoie et ce qu'il rend. */

type Call = { url: string; init?: RequestInit };

function stubFetch(
  reply: (url: string, init?: RequestInit) => { status: number; body: unknown },
): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = reply(url, init);
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const member = (h: string) => ({
  id: `u_${"0".repeat(12)}`,
  handle: h,
  name: h,
  avatar: null,
});

describe("request — un refus garde sa raison", () => {
  it("cooldown : le code et la date du prochain changement arrivent à l'écran", async () => {
    stubFetch(() => ({
      status: 409,
      body: {
        error: "Tu pourras changer d'identifiant à partir du 1 janvier 2027.",
        code: "cooldown",
        nextHandleChangeAt: 1_798_758_000_000,
      },
    }));
    const res = await api.changeHandle("lou", false);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(409);
    expect(res.code).toBe("cooldown");
    expect(res.error).toContain("1 janvier 2027");
    expect(res.body).toMatchObject({ nextHandleChangeAt: 1_798_758_000_000 });
  });

  it("un refus sans code (ex. compte suspendu) n'en invente pas", async () => {
    stubFetch(() => ({ status: 403, body: { error: "Compte suspendu" } }));
    const res = await api.setAvatar("data:image/jpeg;base64,AAAA");
    expect(res).toMatchObject({
      ok: false,
      status: 403,
      error: "Compte suspendu",
    });
    if (!res.ok) expect(res.code).toBeUndefined();
  });

  it("un code qui n'est pas une chaîne est ignoré", async () => {
    stubFetch(() => ({ status: 409, body: { error: "x", code: 42 } }));
    const res = await api.changeHandle("lou", false);
    if (!res.ok) expect(res.code).toBeUndefined();
  });

  it("hors ligne : statut 0, sans code", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const res = await api.removeAvatar();
    expect(res).toEqual({
      ok: false,
      error: "Hors ligne ou serveur indisponible",
      status: 0,
    });
  });
});

describe("changeHandle, setAvatar, removeAvatar — ce qui part au serveur", () => {
  it("changeHandle envoie le handle et le choix du renvoi", async () => {
    const calls = stubFetch(() => ({
      status: 200,
      body: {
        ok: true,
        handle: "lou",
        handleChangedAt: 1,
        nextHandleChangeAt: 2,
      },
    }));
    await api.changeHandle("lou", true);
    expect(calls[0].url).toBe("/api/me/handle");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      handle: "lou",
      redirect: true,
    });
  });

  it("setAvatar envoie la data URL ; removeAvatar est un DELETE sans corps", async () => {
    const calls = stubFetch(() => ({ status: 200, body: { ok: true } }));
    await api.setAvatar("data:image/jpeg;base64,AAAA");
    await api.removeAvatar();
    expect(calls[0]).toMatchObject({ url: "/api/me/avatar" });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      image: "data:image/jpeg;base64,AAAA",
    });
    expect(calls[1].url).toBe("/api/me/avatar");
    expect(calls[1].init?.method).toBe("DELETE");
    expect(calls[1].init?.body).toBeUndefined();
  });
});

describe("memberBatches — ce que le serveur saura lire", () => {
  it("normalise comme le serveur et retire les doublons", () => {
    expect(memberBatches(["@Lou.Mercier", " lou.mercier ", "Maya"])).toEqual([
      ["lou.mercier", "maya"],
    ]);
  });

  it("n'envoie pas ce qui ne peut pas être un handle", () => {
    expect(memberBatches(["", "@", "a b", "é", "x".repeat(31), "ok"])).toEqual([
      ["ok"],
    ]);
  });

  it("découpe par lots de 50", () => {
    const hs = Array.from({ length: 120 }, (_, i) => `m${i}`);
    const lots = memberBatches(hs);
    expect(MEMBERS_BATCH).toBe(50);
    expect(lots.map((l) => l.length)).toEqual([50, 50, 20]);
    expect(lots.flat()).toEqual(hs);
  });

  it("rien à lire : aucun lot", () => {
    expect(memberBatches([])).toEqual([]);
  });
});

describe("api.members — lots fusionnés", () => {
  it("120 handles : 3 requêtes, une seule réponse", async () => {
    const calls = stubFetch((url) => {
      const hs = new URL(url, "https://x").searchParams
        .get("handles")!
        .split(",");
      return {
        status: 200,
        body: { members: Object.fromEntries(hs.map((h) => [h, member(h)])) },
      };
    });
    const hs = Array.from({ length: 120 }, (_, i) => `m${i}`);
    const res = await api.members(hs);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.url.startsWith("/api/members?handles="))).toBe(
      true,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.data.members)).toHaveLength(120);
    expect(res.data.members.m119.handle).toBe("m119");
  });

  it("aucun handle : aucune requête", async () => {
    const calls = stubFetch(() => ({ status: 500, body: {} }));
    const res = await api.members([]);
    expect(calls).toHaveLength(0);
    expect(res).toEqual({ ok: true, data: { members: {} } });
  });

  it("un lot en échec fait échouer l'ensemble : hors ligne n'est pas « introuvable »", async () => {
    let n = 0;
    stubFetch(() =>
      ++n === 2
        ? { status: 503, body: { error: "Indisponible" } }
        : { status: 200, body: { members: {} } },
    );
    const res = await api.members(
      Array.from({ length: 60 }, (_, i) => `m${i}`),
    );
    expect(res).toMatchObject({
      ok: false,
      status: 503,
      error: "Indisponible",
    });
  });

  it("un handle absent reste absent, même « constructor » ou « __proto__ »", async () => {
    stubFetch(() => ({
      status: 200,
      body: JSON.parse(
        '{"members":{"__proto__":{"id":"u_000000000000","handle":"__proto__","name":"P","avatar":null}}}',
      ),
    }));
    const res = await api.members(["constructor", "__proto__"]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.members.constructor).toBeUndefined();
    expect(Object.keys(res.data.members)).toEqual(["__proto__"]);
    expect(res.data.members["__proto__"].name).toBe("P");
  });
});

/* ---------- prepareAvatar : doublures d'Image et de canvas ---------- */

type Draw = { op: string; args: unknown[] };

function stubCanvas(opts: {
  width: number;
  height: number;
  fail?: "load" | "ctx";
}) {
  const ops: Draw[] = [];
  const revoked: string[] = [];
  const ctx = {
    set fillStyle(v: string) {
      ops.push({ op: "fillStyle", args: [v] });
    },
    fillRect: (...args: unknown[]) => ops.push({ op: "fillRect", args }),
    drawImage: (...args: unknown[]) => ops.push({ op: "drawImage", args }),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (opts.fail === "ctx" ? null : ctx),
    toDataURL: (type: string, q: number) => {
      ops.push({
        op: "toDataURL",
        args: [type, q, canvas.width, canvas.height],
      });
      return "data:image/jpeg;base64,AAAA";
    },
  };
  class FakeImage {
    naturalWidth = opts.width;
    naturalHeight = opts.height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_: string) {
      queueMicrotask(() =>
        opts.fail === "load" ? this.onerror?.() : this.onload?.(),
      );
    }
  }
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((u: string) => {
    revoked.push(u);
  });
  return { ops, revoked };
}

const photo = () => new File([new Uint8Array([1, 2, 3])], "p.png");

describe("prepareAvatar — carré centré, fond crème, JPEG", () => {
  it("4000×3000 : carré de 3000 centré, réduit à 512, sur fond crème", async () => {
    const { ops, revoked } = stubCanvas({ width: 4000, height: 3000 });
    const out = await prepareAvatar(photo());
    expect(out).toBe("data:image/jpeg;base64,AAAA");
    expect(ops).toEqual([
      { op: "fillStyle", args: ["#f4f1ea"] },
      { op: "fillRect", args: [0, 0, AVATAR_PX, AVATAR_PX] },
      {
        op: "drawImage",
        args: [
          expect.anything(),
          500,
          0,
          3000,
          3000,
          0,
          0,
          AVATAR_PX,
          AVATAR_PX,
        ],
      },
      {
        op: "toDataURL",
        args: ["image/jpeg", AVATAR_QUALITY, AVATAR_PX, AVATAR_PX],
      },
    ]);
    expect(revoked).toEqual(["blob:photo"]);
  });

  it("300×200 : jamais agrandie (200 px)", async () => {
    const { ops } = stubCanvas({ width: 300, height: 200 });
    await prepareAvatar(photo());
    expect(ops.find((o) => o.op === "toDataURL")?.args.slice(2)).toEqual([
      200, 200,
    ]);
  });

  it("image illisible : refus, et l'URL temporaire est déjà libérée", async () => {
    const { revoked } = stubCanvas({ width: 10, height: 10, fail: "load" });
    await expect(
      prepareAvatar(photo()).catch((e: Error) => {
        expect(revoked).toEqual(["blob:photo"]);
        throw e;
      }),
    ).rejects.toThrow("image illisible");
  });

  it("canvas indisponible ou image vide : refus, URL libérée", async () => {
    const a = stubCanvas({ width: 10, height: 10, fail: "ctx" });
    await expect(prepareAvatar(photo())).rejects.toThrow();
    expect(a.revoked).toEqual(["blob:photo"]);
    vi.restoreAllMocks();
    const b = stubCanvas({ width: 0, height: 0 });
    await expect(prepareAvatar(photo())).rejects.toThrow();
    expect(b.revoked).toEqual(["blob:photo"]);
  });
});
