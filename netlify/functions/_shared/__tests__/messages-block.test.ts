import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import sendMessage from "../../messages.mts";
import { makeSessionCookie, type UserRecord } from "../core.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";

/* Blocage des messages, joué de bout en bout : vraie session signée,
   vraies gardes (currentUser, assertCanWrite, rateLimit), seul le
   stockage est en mémoire. Changer d'@identifiant ne doit pas permettre
   d'écrire à quelqu'un qui vous a bloqué sous l'ancien : ni dans une
   conversation déjà ouverte, ni par message direct, ni par une annonce.
   Et un ancien handle ne mène publiquement à son titulaire que pendant
   la fenêtre de renvoi qu'il a choisie. */

const h = vi.hoisted(() => ({
  stores: (name: string): FakeStore => {
    throw new Error(`store ${name} non préparé`);
  },
}));

vi.mock("@netlify/blobs", () => ({
  getStore: (o: string | { name: string }) =>
    h.stores(typeof o === "string" ? o : o.name),
}));

const EXP = "u_0123456789ab"; // l'expéditeur, qui a changé d'identifiant
const DEST = "u_ba9876543210"; // la destinataire
const DAY = 86_400_000;
const REFUS = "Ce membre n'accepte pas les messages directs";

let users: FakeStore;
let msgs: FakeStore;
let social: FakeStore;
let notifs: FakeStore;
let cookie: string;
let fetchMock: Mock<typeof fetch>;

const expediteur = (): UserRecord => ({
  id: EXP,
  email: "jean.dupont@exemple.fr",
  handle: "lou.mercier",
  name: "Lou Mercier",
  handleChangedAt: Date.now() - DAY,
  handleHistory: [{ h: "jean.dupont", at: Date.now() - DAY, redirectUntil: 0 }],
});

const destinataire = (extra: Partial<UserRecord> = {}): UserRecord => ({
  id: DEST,
  email: "maya@exemple.fr",
  handle: "maya.paris",
  name: "Maya",
  ...extra,
});

async function post(body: Record<string, unknown>) {
  const res = await sendMessage(
    new Request("https://solange.test/api/messages", {
      method: "POST",
      headers: {
        cookie,
        origin: "https://solange.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ text: "Toujours dispo ?", ...body }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", "secret-de-test-assez-long-pour-hs256");
  // push et paiement réel coupés : aucune clé, rien ne part ailleurs
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  fetchMock = vi.fn<typeof fetch>(
    async () => new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const stores = fakeStores();
  h.stores = stores;
  users = stores("users");
  msgs = stores("msgs");
  social = stores("social");
  notifs = stores("notifs");

  users.putJSON(`u:${EXP}`, expediteur());
  users.put("handle:lou.mercier", EXP);
  users.put("handle:jean.dupont", EXP);
  users.putJSON(`u:${DEST}`, destinataire());
  users.put("handle:maya.paris", DEST);

  cookie = (await makeSessionCookie(EXP)).split(";")[0];
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/messages — bloqué sous un ancien handle", () => {
  beforeEach(() => {
    // bloqué avant le changement, et saisi en casse mixte
    social.putJSON(`s:${DEST}`, { blocked: ["Jean.Dupont"] });
  });

  /* Rien ne doit arriver chez la destinataire : ni message, ni index de
     conversation, ni notification, ni e-mail. */
  function rienDepose(conv: string) {
    expect(msgs.peek(`u:${DEST}`)).toBeNull();
    expect(msgs.writes).toEqual([]);
    expect(notifs.peek(`n:${DEST}`)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    return msgs.peek(`c:${conv}`) as { messages: unknown[] } | null;
  }

  it("conversation déjà ouverte (convId) : 403, le fil reste tel quel", async () => {
    const conv = `${EXP}:p_annonce0001`;
    const ouvert = [{ id: "m_1", fromId: EXP, text: "Bonjour", at: 1 }];
    msgs.putJSON(`c:${conv}`, {
      id: conv,
      buyerId: EXP,
      buyerHandle: "jean.dupont",
      sellerId: DEST,
      sellerHandle: "maya.paris",
      productId: "p_annonce0001",
      itemBrand: "Lemaire",
      itemName: "Veste",
      itemPriceEUR: 120,
      messages: ouvert,
      createdAt: 1,
    });

    const r = await post({ convId: conv });
    expect(r).toEqual({ status: 403, body: { error: REFUS } });
    expect(rienDepose(conv)?.messages).toEqual(ouvert);
  });

  it("message direct (toHandle) : 403, aucune conversation créée", async () => {
    const r = await post({ toHandle: "@Maya.Paris" });
    expect(r).toEqual({ status: 403, body: { error: REFUS } });
    expect(rienDepose(`dm:${[EXP, DEST].sort().join(":")}`)).toBeNull();
  });

  it("par une annonce (productId) : 403, aucune conversation créée", async () => {
    h.stores("products").putJSON("p:p_annonce0002", {
      brand: "Lemaire",
      name: "Pantalon",
      priceEUR: 90,
      seller: "maya.paris",
      sellerId: DEST,
    });
    const r = await post({ productId: "p_annonce0002" });
    expect(r).toEqual({ status: 403, body: { error: REFUS } });
    expect(rienDepose(`${EXP}:p_annonce0002`)).toBeNull();
  });
});

describe("POST /api/messages — message direct vers un ancien handle", () => {
  const dm = `dm:${[EXP, DEST].sort().join(":")}`;

  function ancienHandle(redirectUntil: number) {
    users.putJSON(
      `u:${DEST}`,
      destinataire({
        handleChangedAt: Date.now() - DAY,
        handleHistory: [{ h: "maya.old", at: Date.now() - DAY, redirectUntil }],
      }),
    );
    users.put("handle:maya.old", DEST);
  }

  it("sans renvoi choisi : 404, comme un membre inconnu", async () => {
    ancienHandle(0);
    const r = await post({ toHandle: "maya.old" });
    expect(r).toEqual({ status: 404, body: { error: "Membre introuvable" } });
    expect(msgs.peek(`c:${dm}`)).toBeNull();
    expect(msgs.peek(`u:${DEST}`)).toBeNull();
  });

  it("renvoi expiré : 404", async () => {
    ancienHandle(Date.now() - 1);
    const r = await post({ toHandle: "maya.old" });
    expect(r.status).toBe(404);
    expect(msgs.peek(`c:${dm}`)).toBeNull();
  });

  it("pendant la fenêtre de renvoi : 200, adressé à l'identifiant actuel", async () => {
    ancienHandle(Date.now() + 30 * DAY);
    const r = await post({ toHandle: "@Maya.Old" });
    expect(r.status).toBe(200);
    expect(r.body.conversation).toMatchObject({
      id: dm,
      kind: "dm",
      sellerId: DEST,
      sellerHandle: "maya.paris",
      buyerHandle: "lou.mercier",
    });
    const conv = msgs.peek(`c:${dm}`) as { messages: { fromId: string }[] };
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].fromId).toBe(EXP);
    expect(msgs.peek(`u:${DEST}`)).toEqual([dm]);
    expect(msgs.peek(`u:${EXP}`)).toEqual([dm]);
  });
});
