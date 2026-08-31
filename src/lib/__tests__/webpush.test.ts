import { describe, expect, it } from "vitest";
import {
  b64uToBytes,
  bytesToB64u,
  encryptPayload,
  vapidHeader,
} from "../webpush";

/* Vecteur officiel du RFC 8291 § 5 « Push Message Encryption Example ».
   C'est LA justification du choix « pas de dépendance » (D-020) : si notre
   chiffrement reproduit ces octets exactement, il est interopérable avec
   tous les services de push. */
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  expectedBody:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("base64url", () => {
  it("fait l'aller-retour sans perte, y compris sans remplissage", () => {
    for (const s of [RFC.salt, RFC.authSecret, RFC.uaPublic]) {
      expect(bytesToB64u(b64uToBytes(s))).toBe(s);
    }
  });
});

describe("encryptPayload — RFC 8291 § 5", () => {
  it("reproduit le vecteur officiel octet pour octet", async () => {
    const body = await encryptPayload(
      { p256dh: RFC.uaPublic, auth: RFC.authSecret },
      RFC.plaintext,
      {
        salt: b64uToBytes(RFC.salt),
        senderPrivate: b64uToBytes(RFC.asPrivate),
        senderPublic: b64uToBytes(RFC.asPublic),
      },
    );
    expect(bytesToB64u(body)).toBe(RFC.expectedBody);
  });

  it("produit un en-tête conforme avec une clé éphémère aléatoire", async () => {
    const body = await encryptPayload(
      { p256dh: RFC.uaPublic, auth: RFC.authSecret },
      "coucou",
    );
    // salt(16) ‖ rs(4) ‖ idlen(1) ‖ clé(65) ‖ chiffré(≥ 17)
    expect(body.length).toBeGreaterThan(16 + 4 + 1 + 65);
    const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
    expect(rs).toBe(4096);
    expect(body[20]).toBe(65); // longueur de la clé publique
    expect(body[21]).toBe(4); // point non compressé
  });

  it("deux chiffrements du même texte diffèrent (sel + clé éphémères)", async () => {
    const sub = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
    const a = await encryptPayload(sub, "même texte");
    const b = await encryptPayload(sub, "même texte");
    expect(bytesToB64u(a)).not.toBe(bytesToB64u(b));
  });
});

describe("vapidHeader — RFC 8292", () => {
  it("signe un JWT ES256 lié à l'origine de l'endpoint", async () => {
    const header = await vapidHeader(
      "https://fcm.googleapis.com/fcm/send/abcdef",
      {
        publicKey: RFC.asPublic,
        privateKey: RFC.asPrivate,
        subject: "mailto:contact@nouhbenzidane.fr",
      },
      1_700_000_000,
    );
    expect(header).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    expect(header).toContain(`k=${RFC.asPublic}`);

    const [, payload] = header.slice(8).split(", ")[0].split(".");
    const claims = JSON.parse(new TextDecoder().decode(b64uToBytes(payload)));
    // l'audience est l'ORIGINE, jamais l'URL complète (fuite d'endpoint)
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:contact@nouhbenzidane.fr");
    expect(claims.exp).toBe(1_700_000_000 + 12 * 3600);
    expect(claims.exp - 1_700_000_000).toBeLessThanOrEqual(24 * 3600);
  });
});
