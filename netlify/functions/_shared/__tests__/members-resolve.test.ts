import { describe, expect, it } from "vitest";
import type { UserStoreLike } from "../users.mts";
import {
  AUTHOR,
  MEMBERS_CONCURRENCY,
  MEMBERS_MAX,
  mapLimit,
  resolveMembers,
  withMembers,
} from "../members.mts";
import { DELETED_HANDLE } from "../../../../src/lib/handle.ts";

/* Pseudo, nom et photo d'un auteur se relisent sur son compte à chaque
   lecture d'une page. Cette relecture ne doit ni exposer le compte (e-mail,
   consentement, Stripe, anciens handles), ni faire d'un compte absent
   autre chose qu'un « Membre supprimé », ni partir en centaines de
   lectures simultanées. On la joue contre un faux store en mémoire qui
   compte ses lectures. */

const uid = (n: number) => `u_${n.toString(16).padStart(12, "0")}`;

function compte(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: uid(n),
    email: `membre${n}@exemple.fr`,
    handle: `membre.${n}`,
    name: `Membre ${n}`,
    legal: { version: 1, at: 1_700_000_000_000 },
    role: "admin",
    stripeAccountId: "acct_1Secret",
    handleHistory: [{ h: `ancien.${n}`, at: 1, redirectUntil: 0 }],
    avatar: "/api/img/i_0123456789ab",
    ...extra,
  };
}

/** Faux store `users`, en lecture seule. Chaque lecture attend un peu,
    pour que les lectures lancées ensemble se chevauchent vraiment. */
function fauxUsers(comptes: Record<string, unknown>[]) {
  const parId = new Map(comptes.map((c) => [String(c.id), c]));
  const stats = { lectures: 0, enCours: 0, maxEnCours: 0 };
  const users: UserStoreLike = {
    async getWithMetadata(k) {
      stats.lectures++;
      stats.enCours++;
      stats.maxEnCours = Math.max(stats.maxEnCours, stats.enCours);
      await new Promise((r) => setTimeout(r, 2));
      stats.enCours--;
      const c = parId.get(k.replace(/^u:/, ""));
      return c ? { data: structuredClone(c), etag: `"${k}"` } : null;
    },
    async setJSON() {
      throw new Error("la résolution n'écrit jamais");
    },
    async get() {
      throw new Error("la résolution ne lit que u:<id>");
    },
  };
  return { users, stats };
}

describe("resolveMembers — compte absent", () => {
  it("un compte absent vaut null (supprimé), un compte présent sa fiche publique", async () => {
    const { users } = fauxUsers([compte(1)]);
    const map = await resolveMembers([uid(1), uid(2)], { users });
    expect(map.get(uid(1))).toEqual({
      id: uid(1),
      handle: "membre.1",
      name: "Membre 1",
      avatar: "/api/img/i_0123456789ab",
    });
    expect(map.has(uid(2))).toBe(true);
    expect(map.get(uid(2))).toBeNull();
  });

  it("une valeur qui n'est pas un id de compte n'est ni lue ni déclarée supprimée", async () => {
    const { users, stats } = fauxUsers([compte(1)]);
    const map = await resolveMembers([uid(1), uid(1), "", "lou.archive"], {
      users,
    });
    expect(stats.lectures).toBe(1); // doublon lu une fois
    expect([...map.keys()]).toEqual([uid(1)]);
  });
});

describe("resolveMembers — projection", () => {
  it("n'expose jamais e-mail, consentement, rôle, compte Stripe ni anciens handles", async () => {
    const { users } = fauxUsers([compte(1), compte(2)]);
    const map = await resolveMembers([uid(1), uid(2)], { users });
    for (const m of map.values()) {
      expect(Object.keys(m ?? {}).sort()).toEqual([
        "avatar",
        "handle",
        "id",
        "name",
      ]);
    }
    const sortie = JSON.stringify([...map.values()]);
    expect(sortie).not.toContain("@exemple.fr");
    expect(sortie).not.toContain("acct_");
    expect(sortie).not.toContain("ancien.");
    expect(sortie).not.toContain("admin");
  });

  it("une photo masquée par la modération ne sort pas", async () => {
    const { users } = fauxUsers([compte(1, { avatarHidden: true })]);
    const map = await resolveMembers([uid(1)], { users });
    expect(map.get(uid(1))?.avatar).toBeNull();
  });
});

describe("resolveMembers — bornes", () => {
  it(`plafond de ${MEMBERS_MAX} comptes : au-delà, rien n'est lu et la valeur stockée reste`, async () => {
    const comptes = Array.from({ length: 150 }, (_, i) => compte(i + 1));
    const { users, stats } = fauxUsers(comptes);
    const posts = comptes.map((c, i) => ({
      id: `l_${i}`,
      authorId: c.id,
      authorHandle: `copie.${i + 1}`,
      authorName: "Copie stockée",
    }));
    const out = await withMembers(posts, [AUTHOR], { users });
    expect(stats.lectures).toBe(MEMBERS_MAX);
    // les 100 premiers de la page sont à jour…
    expect(out[0]).toMatchObject({
      authorHandle: "membre.1",
      authorName: "Membre 1",
      authorAvatar: "/api/img/i_0123456789ab",
    });
    expect(out[99].authorHandle).toBe("membre.100");
    // …les suivants gardent leur copie, sans photo, jamais « supprimé »
    expect(out[100]).toMatchObject({
      authorHandle: "copie.101",
      authorName: "Copie stockée",
      authorAvatar: null,
    });
    expect(out[149].authorHandle).toBe("copie.150");
  });

  it(`au plus ${MEMBERS_CONCURRENCY} lectures simultanées, et elles sont bien parallèles`, async () => {
    const comptes = Array.from({ length: 40 }, (_, i) => compte(i + 1));
    const { users, stats } = fauxUsers(comptes);
    const map = await resolveMembers(
      comptes.map((c) => c.id),
      { users },
    );
    expect(map.size).toBe(40);
    expect(stats.lectures).toBe(40);
    expect(stats.maxEnCours).toBe(MEMBERS_CONCURRENCY);
  });

  it("la limite se règle par appel", async () => {
    const comptes = Array.from({ length: 12 }, (_, i) => compte(i + 1));
    const { users, stats } = fauxUsers(comptes);
    await resolveMembers(
      comptes.map((c) => c.id),
      { users, concurrency: 3, max: 5 },
    );
    expect(stats.lectures).toBe(5);
    expect(stats.maxEnCours).toBe(3);
  });

  it("une page de 30 posts du même auteur : une seule lecture", async () => {
    const { users, stats } = fauxUsers([compte(7)]);
    const posts = Array.from({ length: 30 }, (_, i) => ({
      id: `l_${i}`,
      authorId: uid(7),
      authorHandle: "ancien.7",
      authorName: "Membre 7",
    }));
    const out = await withMembers(posts, [AUTHOR], { users });
    expect(stats.lectures).toBe(1);
    expect(new Set(out.map((p) => p.authorHandle))).toEqual(
      new Set(["membre.7"]),
    );
  });
});

describe("withMembers — une page recouverte", () => {
  it("auteur à jour, compte supprimé, fil anonymisé", async () => {
    const { users } = fauxUsers([compte(1, { handle: "lou.nouveau" })]);
    const page = [
      {
        id: "l_a",
        authorId: uid(1),
        authorHandle: "lou.ancien",
        authorName: "Lou",
      },
      {
        id: "l_b",
        authorId: uid(2),
        authorHandle: "parti",
        authorName: "Parti",
      },
      {
        id: "th_c",
        authorId: "",
        authorHandle: DELETED_HANDLE,
        authorName: "Membre supprimé",
      },
    ];
    const avant = structuredClone(page);
    const [vivant, supprime, anonyme] = await withMembers(page, [AUTHOR], {
      users,
    });
    expect(vivant).toMatchObject({
      authorHandle: "lou.nouveau",
      authorName: "Membre 1",
      authorAvatar: "/api/img/i_0123456789ab",
    });
    expect(supprime).toMatchObject({
      authorId: uid(2),
      authorHandle: DELETED_HANDLE,
      authorName: "Membre supprimé",
      authorAvatar: null,
    });
    expect(anonyme).toEqual({ ...avant[2], authorAvatar: null });
    expect(page).toEqual(avant); // la page lue n'est pas modifiée en place
  });

  it("deux parties recouvertes avec une seule résolution (conversation)", async () => {
    const { users, stats } = fauxUsers([compte(1), compte(2)]);
    const [conv] = await withMembers(
      [
        {
          buyerId: uid(1),
          buyerHandle: "vieux.1",
          sellerId: uid(2),
          sellerHandle: "vieux.2",
        },
      ],
      [
        { id: "buyerId", handle: "buyerHandle", avatar: "buyerAvatar" },
        { id: "sellerId", handle: "sellerHandle", avatar: "sellerAvatar" },
      ],
      { users },
    );
    expect(stats.lectures).toBe(2);
    expect(conv).toMatchObject({
      buyerHandle: "membre.1",
      sellerHandle: "membre.2",
      buyerAvatar: "/api/img/i_0123456789ab",
    });
    expect(conv).not.toHaveProperty("buyerName");
  });
});

describe("mapLimit", () => {
  it("garde l'ordre des éléments, même quand les derniers finissent d'abord", async () => {
    const out = await mapLimit([30, 1, 20, 2], 2, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms * 10;
    });
    expect(out).toEqual([300, 10, 200, 20]);
  });

  it("liste vide : aucun appel", async () => {
    let appels = 0;
    expect(
      await mapLimit([], 10, async () => {
        appels++;
      }),
    ).toEqual([]);
    expect(appels).toBe(0);
  });
});
