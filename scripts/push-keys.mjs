#!/usr/bin/env node
/* Génère une paire de clés VAPID (P-256) pour les notifications push.
   Zéro dépendance — WebCrypto de Node. Les clés ne sont ni écrites sur le
   disque ni commitées : elles s'affichent une fois, à coller dans les
   variables d'environnement Netlify.

   Usage : npm run push:keys                                            */

const b64u = (buf) =>
  Buffer.from(buf).toString("base64url");

const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const publicRaw = await crypto.subtle.exportKey("raw", pair.publicKey);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`
Clés VAPID générées — à poser dans Netlify (scope Functions, contexte
Production), puis à activer. Ne les commite jamais.

  VAPID_PUBLIC_KEY   ${b64u(publicRaw)}
  VAPID_PRIVATE_KEY  ${jwk.d}
  VAPID_SUBJECT      mailto:contact@nouhbenzidane.fr

Commandes prêtes à copier :

  netlify env:set VAPID_PUBLIC_KEY "${b64u(publicRaw)}" --scope functions --context production
  netlify env:set VAPID_PRIVATE_KEY "${jwk.d}" --scope functions --context production
  netlify env:set VAPID_SUBJECT "mailto:contact@nouhbenzidane.fr" --scope functions --context production
`);
