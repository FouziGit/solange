/* ============================================================
   SOLANGE — Web Push sans dépendance (lot 3, D-020)
   RFC 8291 (chiffrement du contenu, aes128gcm) + RFC 8292 (VAPID).
   Tout repose sur WebCrypto (présent côté Node comme côté navigateur)
   et sur `jose`, déjà au projet pour les sessions.

   Preuve d'interopérabilité : le vecteur officiel du RFC 8291 §5 est
   rejoué dans src/lib/__tests__/webpush.test.ts — même clés, même sel,
   même sortie octet pour octet.
   ============================================================ */

import { SignJWT, importJWK } from "jose";

/* ---------- base64url ---------- */

export function b64uToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64u(b: Uint8Array): string {
  let bin = "";
  for (const byte of b) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/* ---------- HKDF (RFC 5869), la forme courte utilisée par RFC 8291 ---------- */

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    key as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    k,
    data as unknown as BufferSource,
  );
  return new Uint8Array(sig);
}

/** Un seul tour d'expansion suffit : toutes les sorties font ≤ 32 octets. */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

/* ---------- clés P-256 ---------- */

/** Point non compressé (0x04 || X || Y) → JWK public. */
function publicJwkFromRaw(raw: Uint8Array): JsonWebKey {
  if (raw.length !== 65 || raw[0] !== 4)
    throw new Error("Clé publique P-256 invalide");
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64u(raw.slice(1, 33)),
    y: bytesToB64u(raw.slice(33, 65)),
  };
}

async function importPublic(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    publicJwkFromRaw(raw),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

/** Scalar privé (32 o) + point public (65 o) → clé ECDH privée. */
async function importPrivate(
  d: Uint8Array,
  pub: Uint8Array,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    { ...publicJwkFromRaw(pub), d: bytesToB64u(d) },
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
}

/* ---------- RFC 8291 : chiffrement du contenu ---------- */

export type Subscription = {
  endpoint: string;
  /** Clé publique du navigateur (base64url, point non compressé). */
  p256dh: string;
  /** Secret d'authentification (base64url, 16 octets). */
  auth: string;
};

/** Injectable UNIQUEMENT par les tests : rejoue le vecteur du RFC. */
export type EncryptOverrides = {
  salt?: Uint8Array;
  senderPrivate?: Uint8Array;
  senderPublic?: Uint8Array;
};

/**
 * Chiffre `payload` pour un abonnement, au format `aes128gcm` :
 * salt(16) ‖ rs(4) ‖ idlen(1) ‖ clé publique éphémère(65) ‖ chiffré.
 */
export async function encryptPayload(
  sub: Pick<Subscription, "p256dh" | "auth">,
  payload: string,
  over: EncryptOverrides = {},
): Promise<Uint8Array> {
  const uaPublic = b64uToBytes(sub.p256dh);
  const authSecret = b64uToBytes(sub.auth);
  const salt = over.salt ?? crypto.getRandomValues(new Uint8Array(16));

  // Clé éphémère de l'expéditeur (« as » dans le RFC).
  let asPublic: Uint8Array;
  let asPrivateKey: CryptoKey;
  if (over.senderPrivate && over.senderPublic) {
    asPublic = over.senderPublic;
    asPrivateKey = await importPrivate(over.senderPrivate, over.senderPublic);
  } else {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair;
    asPublic = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    );
    asPrivateKey = pair.privateKey;
  }

  // Secret partagé ECDH, puis dérivations du RFC 8291 §3.4.
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: await importPublic(uaPublic) },
      asPrivateKey,
      256,
    ),
  );

  const keyInfo = concat(utf8("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  // 0x02 = délimiteur de dernier enregistrement (pas de bourrage).
  const plaintext = concat(utf8(payload), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as unknown as BufferSource, tagLength: 128 },
      aesKey,
      plaintext as unknown as BufferSource,
    ),
  );

  const header = new Uint8Array(5);
  new DataView(header.buffer).setUint32(0, 4096); // taille d'enregistrement
  header[4] = asPublic.length; // 65
  return concat(salt, header, asPublic, ciphertext);
}

/* ---------- RFC 8292 : en-tête VAPID ---------- */

/** `Authorization: vapid t=<jwt>, k=<clé publique>` pour cet endpoint. */
export async function vapidHeader(
  endpoint: string,
  keys: { publicKey: string; privateKey: string; subject: string },
  nowSec: number,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const pub = b64uToBytes(keys.publicKey);
  const jwk = {
    ...publicJwkFromRaw(pub),
    d: keys.privateKey,
    key_ops: ["sign"],
    ext: true,
  } as JsonWebKey;
  const key = await importJWK(jwk, "ES256");

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setAudience(audience)
    // 12 h : bien en deçà du maximum de 24 h imposé par le RFC.
    .setExpirationTime(nowSec + 12 * 3600)
    .setSubject(keys.subject)
    .sign(key);

  return `vapid t=${jwt}, k=${keys.publicKey}`;
}
