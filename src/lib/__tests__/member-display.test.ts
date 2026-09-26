import { describe, expect, it } from "vitest";
import { DELETED_HANDLE } from "../handle";
import { PORTRAIT_SEEDS } from "../img";
import type { PublicMember } from "../members";
import {
  authorAvatar,
  conversationPeer,
  followedCards,
  followedToLookUp,
  hasProfile,
  memberFor,
  modActionLabel,
  photoModAction,
  type DemoCreator,
  type MembersLookup,
} from "../member-display";

const ID = "u_0123456789ab";
const PHOTO = "/api/img/i_aaaaaaaaaaaa";

describe("authorAvatar — la graine est le compte, pas le pseudo", () => {
  it("un auteur connu : graine = id, sa photo", () => {
    expect(authorAvatar(ID, "lou.mercier", PHOTO)).toEqual({
      seed: ID,
      src: PHOTO,
    });
  });

  it("sans photo : initiales (null), jamais le portrait de démo", () => {
    expect(authorAvatar(ID, "lou.mercier", undefined).src).toBeNull();
    expect(authorAvatar(ID, "lou.mercier", null).src).toBeNull();
  });

  it("changer d'@identifiant ne change pas la graine du dégradé", () => {
    expect(authorAvatar(ID, "ancien", null).seed).toBe(
      authorAvatar(ID, "nouveau", null).seed,
    );
  });

  /* Un pseudo égal à une graine de portrait (compte ancien, ou contenu de
     démo) ne doit jamais faire apparaître le visage d'un créateur. */
  it("sans id : graine = handle, et src null même pour une graine de portrait", () => {
    const portrait = [...PORTRAIT_SEEDS][0];
    expect(authorAvatar("", portrait, PHOTO)).toEqual({
      seed: portrait,
      src: null,
    });
    expect(authorAvatar(undefined, portrait, undefined).src).toBeNull();
  });
});

describe("hasProfile — pas de lien vers un compte supprimé", () => {
  it("un membre a un profil", () => {
    expect(hasProfile("lou.mercier")).toBe(true);
  });

  it("le compte supprimé et le handle vide n'en ont pas", () => {
    expect(hasProfile(DELETED_HANDLE)).toBe(false);
    expect(hasProfile("")).toBe(false);
  });
});

describe("conversationPeer — l'interlocuteur dépend de mon rôle", () => {
  const conv = {
    buyerId: "u_bbbbbbbbbbbb",
    buyerHandle: "acheteuse",
    buyerAvatar: PHOTO,
    sellerId: "u_ssssssssssss",
    sellerHandle: "vendeur",
    sellerAvatar: null,
  };

  it("je vends : l'autre est l'acheteur", () => {
    expect(conversationPeer({ ...conv, role: "seller" })).toEqual({
      id: "u_bbbbbbbbbbbb",
      handle: "acheteuse",
      avatar: PHOTO,
    });
  });

  it("j'achète : l'autre est le vendeur", () => {
    expect(conversationPeer({ ...conv, role: "buyer" })).toEqual({
      id: "u_ssssssssssss",
      handle: "vendeur",
      avatar: null,
    });
  });

  it("vendeur de démo (sans compte) : id null, pas de photo", () => {
    expect(
      conversationPeer({
        ...conv,
        role: "buyer",
        sellerId: null,
        sellerAvatar: undefined,
      }),
    ).toEqual({ id: null, handle: "vendeur", avatar: null });
  });
});

const lou: PublicMember = {
  id: ID,
  handle: "lou.mercier",
  name: "Lou Mercier",
  avatar: PHOTO,
};

describe("memberFor — lecture de la réponse de /api/members", () => {
  it("retrouve le membre quelle que soit la saisie", () => {
    const members = { "lou.mercier": lou };
    expect(memberFor(members, "lou.mercier")).toBe(lou);
    expect(memberFor(members, " @Lou.Mercier")).toBe(lou);
  });

  it("un handle absent donne null", () => {
    expect(memberFor({ "lou.mercier": lou }, "maya")).toBeNull();
  });

  it("une clé héritée d'Object n'est pas un membre", () => {
    expect(memberFor({}, "constructor")).toBeNull();
    expect(memberFor({}, "__proto__")).toBeNull();
  });
});

describe("vendeurs suivis — démo, membres réels, handles introuvables", () => {
  const demo = new Map<string, DemoCreator>([
    [
      "maya.curates",
      {
        handle: "maya.curates",
        name: "Maya",
        seed: "maya-d-55",
        verified: true,
      },
    ],
  ]);
  const suivis = ["maya.curates", "jean.dupont", "disparu"];

  it("on ne demande au serveur que les membres réels, triés, sans doublon", () => {
    expect(
      followedToLookUp([...suivis, "Jean.Dupont", "", "maya.curates"], demo),
    ).toEqual(["disparu", "jean.dupont"]);
  });

  /* La liste part en une seule requête « a,b » : une virgule dans un
     pseudo la couperait en deux. */
  it("ce qui ne peut pas être un handle ne part pas", () => {
    expect(followedToLookUp(["a,b", "é", "x".repeat(31), "ok"], demo)).toEqual([
      "ok",
    ]);
  });

  it("un créateur de démo garde sa fiche et son portrait (src non fourni)", () => {
    const [maya] = followedCards(suivis, demo, null);
    expect(maya).toEqual({
      handle: "maya.curates",
      shown: "maya.curates",
      name: "Maya",
      seed: "maya-d-55",
      verified: true,
      linked: true,
    });
    expect(maya).not.toHaveProperty("src");
  });

  it("tant que la réponse n'est pas là : fiche minimale, lien gardé, pas de portrait", () => {
    const [, jean] = followedCards(suivis, demo, null);
    expect(jean).toEqual({
      handle: "jean.dupont",
      shown: "jean.dupont",
      name: "jean.dupont",
      seed: "jean.dupont",
      src: null,
      linked: true,
    });
  });

  /* Renvoi actif : le serveur répond sous le handle suivi, avec le handle
     actuel dans la fiche. On affiche l'actuel, on garde le suivi tel quel
     pour que « Suivi » retire bien l'entrée de la liste. */
  it("membre trouvé : nom, photo, graine = id et handle actuel", () => {
    const lookup: MembersLookup = {
      asked: new Set(["disparu", "jean.dupont"]),
      members: { "jean.dupont": lou },
      failed: false,
    };
    const [, jean] = followedCards(suivis, demo, lookup);
    expect(jean).toEqual({
      handle: "jean.dupont",
      shown: "lou.mercier",
      name: "Lou Mercier",
      seed: ID,
      src: PHOTO,
      linked: true,
    });
  });

  it("un handle demandé mais absent de la réponse s'affiche sans lien", () => {
    const lookup: MembersLookup = {
      asked: new Set(["disparu", "jean.dupont"]),
      members: { "jean.dupont": lou },
      failed: false,
    };
    const disparu = followedCards(suivis, demo, lookup)[2];
    expect(disparu.linked).toBe(false);
    expect(disparu.shown).toBe("disparu");
    expect(disparu.src).toBeNull();
  });

  it("hors ligne, on ne conclut pas à l'absence : le lien reste", () => {
    const lookup: MembersLookup = {
      asked: new Set(["disparu", "jean.dupont"]),
      members: {},
      failed: true,
    };
    for (const c of followedCards(suivis, demo, lookup))
      expect(c.linked, c.handle).toBe(true);
  });

  it("un suivi ajouté après la réponse n'est pas déclaré introuvable", () => {
    const lookup: MembersLookup = {
      asked: new Set(["jean.dupont"]),
      members: { "jean.dupont": lou },
      failed: false,
    };
    expect(followedCards(["nouveau"], demo, lookup)[0].linked).toBe(true);
  });

  it("un nom vide retombe sur le handle actuel", () => {
    const lookup: MembersLookup = {
      asked: new Set(["jean.dupont"]),
      members: { "jean.dupont": { ...lou, name: "" } },
      failed: false,
    };
    expect(followedCards(["jean.dupont"], demo, lookup)[0].name).toBe(
      "lou.mercier",
    );
  });
});

describe("modération de la photo d'un membre", () => {
  it("sur un membre, masquer et rétablir disent qu'il s'agit de la photo", () => {
    expect(modActionLabel("user", "hide")).toBe("Masquer la photo");
    expect(modActionLabel("user", "unhide")).toBe("Rétablir la photo");
  });

  it("ailleurs, les libellés habituels ; une action inconnue reste lisible", () => {
    expect(modActionLabel("post", "hide")).toBe("Masquer");
    expect(modActionLabel("user", "ban")).toBe("Bannir");
    expect(modActionLabel("user", "constructor")).toBe("constructor");
  });

  const membre = {
    targetType: "user",
    status: "open" as const,
    action: undefined,
    context: { label: "@lou", image: PHOTO },
  };

  it("à traiter, photo visible : on peut la masquer", () => {
    expect(photoModAction(membre)).toBe("hide");
  });

  it("à traiter, sans photo ou déjà masquée : aucun bouton de photo", () => {
    expect(
      photoModAction({ ...membre, context: { label: "@lou" } }),
    ).toBeNull();
    expect(
      photoModAction({ ...membre, context: { label: "@lou", hidden: true } }),
    ).toBeNull();
  });

  it("traité, photo masquée : on peut la rétablir", () => {
    expect(
      photoModAction({
        ...membre,
        status: "done",
        action: "dismiss",
        context: { label: "@lou", hidden: true },
      }),
    ).toBe("unhide");
  });

  /* Le membre a retiré sa photo masquée : plus rien n'est « masqué », mais
     le verrou tient. Sans ce bouton, il ne pourrait plus jamais en publier. */
  it("traité par un masquage, photo retirée depuis : le rétablissement reste possible", () => {
    expect(
      photoModAction({
        ...membre,
        status: "done",
        action: "hide",
        context: { label: "@lou" },
      }),
    ).toBe("unhide");
  });

  it("déjà rétablie : plus de bouton", () => {
    expect(
      photoModAction({
        ...membre,
        status: "done",
        action: "unhide",
        context: { label: "@lou", image: PHOTO },
      }),
    ).toBeNull();
  });

  it("jamais pour une pièce, une publication, un fil ou un message", () => {
    for (const targetType of ["product", "post", "thread", "message"])
      expect(photoModAction({ ...membre, targetType }), targetType).toBeNull();
  });
});
