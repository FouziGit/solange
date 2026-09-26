import { describe, expect, it } from "vitest";
import { DELETED_HANDLE } from "../handle";
import {
  DELETED_MEMBER,
  idsOf,
  overlayMember,
  toPublicMember,
  type MemberMap,
} from "../members";

const ID = "u_0123456789ab";
const PHOTO = "/api/img/i_aaaaaaaaaaaa";

describe("toPublicMember — rien de privé ne sort du compte", () => {
  const compte = {
    id: ID,
    email: "jean.dupont@exemple.fr",
    handle: "lou.mercier",
    name: "Lou",
    avatar: PHOTO,
    legal: { version: 1, at: 1, ageDeclared: true },
    stripeAccountId: "acct_123",
    role: "admin",
    handleHistory: [{ h: "jean.dupont", at: 1, redirectUntil: 0 }],
  };

  it("n'expose que l'id, le handle, le nom et la photo", () => {
    expect(toPublicMember(compte)).toEqual({
      id: ID,
      handle: "lou.mercier",
      name: "Lou",
      avatar: PHOTO,
    });
  });

  it("jamais l'e-mail, le consentement, le compte de paiement, le rôle ni les anciens handles", () => {
    const out = toPublicMember(compte) as Record<string, unknown>;
    for (const k of ["email", "legal", "stripeAccountId", "role", "handleHistory"])
      expect(out, k).not.toHaveProperty(k);
    expect(JSON.stringify(out)).not.toContain("jean.dupont");
  });

  it("une photo masquée par la modération n'est plus servie", () => {
    expect(toPublicMember({ ...compte, avatarHidden: true })?.avatar).toBeNull();
  });

  it("un chemin de photo douteux non plus", () => {
    for (const avatar of ["javascript:alert(1)", "/api/img/../x", "https://x.fr/a.jpg"])
      expect(toPublicMember({ ...compte, avatar })?.avatar, avatar).toBeNull();
  });

  it("pas de compte, pas de membre", () => {
    expect(toPublicMember(null)).toBeNull();
  });
});

describe("overlayMember — le nom affiché suit le compte, pas la copie stockée", () => {
  const F = {
    id: "authorId",
    handle: "authorHandle",
    name: "authorName",
    avatar: "authorAvatar",
  };
  const post = {
    id: "p_1",
    authorId: ID,
    authorHandle: "jean.dupont",
    authorName: "Jean",
  };

  it("recouvre handle, nom et photo avec le compte actuel", () => {
    const map: MemberMap = new Map([
      [ID, { id: ID, handle: "lou.mercier", name: "Lou", avatar: PHOTO }],
    ]);
    expect(overlayMember(post, F, map)).toEqual({
      id: "p_1",
      authorId: ID,
      authorHandle: "lou.mercier",
      authorName: "Lou",
      authorAvatar: PHOTO,
    });
  });

  it("compte supprimé : « Membre supprimé », sans photo ni ancien handle", () => {
    const map: MemberMap = new Map([[ID, null]]);
    expect(overlayMember(post, F, map)).toEqual({
      ...post,
      authorHandle: DELETED_HANDLE,
      authorName: DELETED_MEMBER.name,
      authorAvatar: null,
    });
  });

  it("id non résolu (plafond de lectures) : la copie stockée reste", () => {
    expect(overlayMember(post, F, new Map())).toEqual({
      ...post,
      authorAvatar: null,
    });
  });

  it("auteur sans id (contenu de démo) : la copie stockée reste", () => {
    const demo = { ...post, authorId: "" };
    const map: MemberMap = new Map([["", null]]);
    expect(overlayMember(demo, F, map)).toEqual({ ...demo, authorAvatar: null });
  });

  it("sans champ nom ni photo, seul le handle change (commandes)", () => {
    const order = { id: "o_1", buyerId: ID, buyerHandle: "jean.dupont" };
    const map: MemberMap = new Map([
      [ID, { id: ID, handle: "lou.mercier", name: "Lou", avatar: PHOTO }],
    ]);
    expect(
      overlayMember(order, { id: "buyerId", handle: "buyerHandle" }, map),
    ).toEqual({ id: "o_1", buyerId: ID, buyerHandle: "lou.mercier" });
  });

  it("ne modifie pas l'enregistrement d'origine", () => {
    const copie = { ...post };
    overlayMember(post, F, new Map([[ID, null]]));
    expect(post).toEqual(copie);
  });
});

describe("idsOf", () => {
  it("rassemble les ids d'une page, sans doublon ni vide, dans l'ordre", () => {
    const conv = [
      { buyerId: "u_b", sellerId: "u_a" },
      { buyerId: "u_a", sellerId: "" },
      { buyerId: null, sellerId: 42 },
    ];
    expect(idsOf(conv, ["buyerId", "sellerId"])).toEqual(["u_b", "u_a"]);
  });
});
