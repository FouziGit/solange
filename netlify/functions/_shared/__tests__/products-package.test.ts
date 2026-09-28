import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import products from "../../products.mts";
import { makeSessionCookie } from "../core.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";

/* /api/products et la taille du colis (D-037) : obligatoire au dépôt,
   jamais de valeur par défaut à l'écriture, FIGÉE ensuite (aucun endpoint
   de modification, un PATCH reçoit le 405 générique) ; en lecture, une
   annonce antérieure sans taille est rendue en « moyen ». Vraie session
   signée, vraies gardes (currentUser, assertCanWrite, rateLimit),
   stockage en mémoire. */

const h = vi.hoisted(() => ({
  stores: (name: string): FakeStore => {
    throw new Error(`store ${name} non préparé`);
  },
}));

vi.mock("@netlify/blobs", () => ({
  getStore: (o: string | { name: string }) =>
    h.stores(typeof o === "string" ? o : o.name),
}));

const VENDEUR = "u_bbbbbbbbbbbb";
const ANCIENNE = "p_ancienne0001";
const PETITE = "p_petite000001";

let prods: FakeStore;
let imgs: FakeStore;
let cookie: string;

type Produit = Record<string, unknown> & { id: string; packageSize?: unknown };

const depot = (over: Record<string, unknown> = {}) => ({
  name: "Veste croisée",
  brand: "Lemaire",
  category: "Femme",
  condition: "Très bon état",
  size: "M",
  priceEUR: 120,
  description: "Portée deux fois.",
  images: [],
  packageSize: "grand",
  ...over,
});

async function appel(
  method: "GET" | "POST" | "PATCH",
  o: { query?: string; body?: unknown } = {},
) {
  const res = await products(
    new Request(`https://solange.test/api/products${o.query ?? ""}`, {
      method,
      headers: {
        cookie,
        origin: "https://solange.test",
        "content-type": "application/json",
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }),
  );
  return {
    status: res.status,
    body: (await res.json()) as {
      error?: string;
      product?: Produit;
      products?: Produit[];
    },
  };
}

/** Annonces du marché (clés p:), hors index. */
const annonces = () =>
  [...prods.entries.keys()].filter((k) => k.startsWith("p:"));

beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", "secret-de-test-assez-long-pour-hs256");
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");

  const stores = fakeStores();
  h.stores = stores;
  prods = stores("products");
  imgs = stores("imgs");
  stores("users").putJSON(`u:${VENDEUR}`, {
    id: VENDEUR,
    email: "lou@exemple.fr",
    handle: "lou.mercier",
    name: "Lou",
  });
  stores("users").put("handle:lou.mercier", VENDEUR);

  // une annonce d'avant D-037 (sans taille) et une « Petit »
  const base = {
    brand: "Acne Studios",
    name: "Tee-shirt",
    priceEUR: 40,
    size: "S",
    condition: "Bon état",
    category: "Femme",
    seller: "lou.mercier",
    sellerId: VENDEUR,
    images: [],
    status: "available",
    createdAt: 1,
  };
  prods.putJSON(`p:${ANCIENNE}`, { ...base, id: ANCIENNE });
  prods.putJSON(`p:${PETITE}`, { ...base, id: PETITE, packageSize: "petit" });
  prods.putJSON("idx", [ANCIENNE, PETITE]);
  prods.writes = [];

  cookie = (await makeSessionCookie(VENDEUR)).split(";")[0];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/products — taille du colis obligatoire", () => {
  it("dépôt avec une taille valide : stockée sur l'annonce et rendue", async () => {
    const r = await appel("POST", { body: depot() });

    expect(r.status).toBe(200);
    expect(r.body.product?.packageSize).toBe("grand");
    const id = r.body.product!.id;
    expect(prods.peek(`p:${id}`)).toMatchObject({
      id,
      packageSize: "grand",
      status: "available",
      sellerId: VENDEUR,
    });
    expect(prods.peek("idx")).toEqual([ANCIENNE, PETITE, id]);
  });

  it.each([["petit"], ["moyen"], ["grand"], ["tres_grand"]])(
    "taille « %s » acceptée telle quelle",
    async (taille) => {
      const r = await appel("POST", { body: depot({ packageSize: taille }) });
      expect(r.status).toBe(200);
      expect(prods.peek(`p:${r.body.product!.id}`)).toMatchObject({
        packageSize: taille,
      });
    },
  );

  it("sans taille : 400, rien n'est écrit (ni annonce, ni index, ni photo)", async () => {
    const { packageSize, ...sansTaille } = depot({
      images: [
        `data:image/png;base64,${Buffer.from("png").toString("base64")}`,
      ],
    });
    void packageSize;
    const r = await appel("POST", { body: sansTaille });

    expect(r).toEqual({
      status: 400,
      body: { error: "Choisis la taille du colis" },
    });
    expect(annonces()).toEqual([`p:${ANCIENNE}`, `p:${PETITE}`]);
    expect(prods.writes).toEqual([]);
    expect(imgs.writes).toEqual([]);
  });

  it.each([
    ["XL"],
    ["Grand"],
    ["très_grand"],
    ["__proto__"],
    ["constructor"],
    [""],
    [42],
    [null],
    [["grand"]],
    [{ id: "grand" }],
  ])("taille invalide %j : 400, rien n'est écrit", async (taille) => {
    const r = await appel("POST", { body: depot({ packageSize: taille }) });
    expect(r).toEqual({
      status: 400,
      body: { error: "Choisis la taille du colis" },
    });
    expect(prods.writes).toEqual([]);
  });
});

describe("GET /api/products — taille rendue, « moyen » par défaut", () => {
  it("liste : annonce antérieure → « moyen », les autres inchangées", async () => {
    const r = await appel("GET");
    expect(r.status).toBe(200);
    const parId = Object.fromEntries(
      (r.body.products ?? []).map((p) => [p.id, p.packageSize]),
    );
    expect(parId).toEqual({ [ANCIENNE]: "moyen", [PETITE]: "petit" });
    // lecture seule : aucune migration écrite
    expect(prods.writes).toEqual([]);
    expect(prods.peek(`p:${ANCIENNE}`)).not.toHaveProperty("packageSize");
  });

  it("mes annonces (?mine=1) : même règle", async () => {
    const r = await appel("GET", { query: "?mine=1" });
    expect(
      Object.fromEntries(
        (r.body.products ?? []).map((p) => [p.id, p.packageSize]),
      ),
    ).toEqual({ [ANCIENNE]: "moyen", [PETITE]: "petit" });
  });

  it("une annonce (?id=) : « moyen » si absente, la sienne sinon", async () => {
    const a = await appel("GET", { query: `?id=${ANCIENNE}` });
    expect(a.status).toBe(200);
    expect(a.body.product?.packageSize).toBe("moyen");
    const b = await appel("GET", { query: `?id=${PETITE}` });
    expect(b.body.product?.packageSize).toBe("petit");
  });

  it("taille corrompue en base : rendue « moyen »", async () => {
    prods.putJSON(`p:${PETITE}`, {
      ...(prods.peek(`p:${PETITE}`) as object),
      packageSize: "__proto__",
    });
    const r = await appel("GET", { query: `?id=${PETITE}` });
    expect(r.body.product?.packageSize).toBe("moyen");
  });
});

describe("taille FIGÉE après le dépôt", () => {
  it("PATCH : 405, l'annonce ne change pas", async () => {
    const avant = prods.peek(`p:${PETITE}`);
    for (const query of ["", `?id=${PETITE}`]) {
      const r = await appel("PATCH", {
        query,
        body: { id: PETITE, packageSize: "tres_grand" },
      });
      expect(r).toEqual({
        status: 405,
        body: { error: "Méthode non autorisée" },
      });
    }
    expect(prods.peek(`p:${PETITE}`)).toEqual(avant);
    expect(prods.writes).toEqual([]);
  });

  it("un second POST ne modifie pas une annonce existante : il en crée une autre", async () => {
    const avant = prods.peek(`p:${PETITE}`);
    const r = await appel("POST", {
      body: depot({ id: PETITE, packageSize: "tres_grand" }),
    });
    expect(r.status).toBe(200);
    expect(r.body.product?.id).not.toBe(PETITE);
    expect(prods.peek(`p:${PETITE}`)).toEqual(avant);
  });
});
