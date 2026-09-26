/* POST /api/auth/verify — vérifie l'OTP, crée le compte au premier login,
   pose le cookie de session httpOnly. Max 5 essais par code.

   Enregistre aussi la PREUVE D'ACCEPTATION des conditions : version du
   socle (celle du serveur, jamais celle annoncée par le client) et
   horodatage. Sans elle, rien n'est opposable en cas de litige. Le
   client envoie deux cases distinctes, toutes deux obligatoires. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  sha256,
  newId,
  makeSessionCookie,
  sameOrigin,
  readJson,
  type SessionUser,
  type UserRecord,
} from "./_shared/core.mts";
import { profileFields, updateUser } from "./_shared/users.mts";
import {
  acceptancePayloadIsValid,
  buildConsent,
} from "../../src/lib/legal-consent.ts";
import { LEGAL_VERSION } from "../../src/lib/legal.ts";
import { handleCandidates } from "../../src/lib/guards.ts";
import {
  RESERVED_HANDLES,
  handleBaseFromEmail,
} from "../../src/lib/handle.ts";

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);

  const body = await readJson<{
    email?: string;
    code?: string;
    acceptLegal?: boolean;
    ageDeclared?: boolean;
  }>(req);
  const email = body?.email?.trim().toLowerCase() ?? "";
  const code = (body?.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) return bad("Code invalide");

  // Vérifié AVANT de consommer le code : sinon un refus ici obligerait à
  // redemander un code pour une case oubliée.
  if (!acceptancePayloadIsValid(body))
    return bad(
      "Tu dois accepter les conditions et déclarer ton âge pour continuer.",
      400,
    );

  const otps = store("otps");
  const key = sha256(email);
  const rec = (await otps.get(key, { type: "json" })) as {
    h: string;
    exp: number;
    tries: number;
    sentAt: number;
  } | null;

  if (!rec || Date.now() > rec.exp)
    return bad("Code expiré — redemande un code", 410);
  if (rec.tries >= 5) return bad("Trop d'essais — redemande un code", 429);

  if (sha256(code + key) !== rec.h) {
    await otps.setJSON(key, { ...rec, tries: rec.tries + 1 });
    return bad("Code incorrect", 401);
  }
  await otps.delete(key);

  const users = store("users");
  let userId = (await users.get(`email:${key}`, { type: "text" })) as
    string | null;

  if (!userId) {
    userId = newId("u");
    const base = handleBaseFromEmail(email);
    /* Réservation du pseudo par ÉCRITURE CONDITIONNELLE, pas par « je lis
       puis j'écris ». L'ancienne boucle abandonnait après six essais et
       écrivait quand même : elle réattribuait alors un pseudo déjà pris, et
       l'index `handle:` du membre précédent pointait vers le nouveau compte.
       `onlyIfNew` fait trancher le stockage : si la clé existe déjà,
       l'écriture ne passe pas et on essaie la suivante. Le dernier recours
       est l'identifiant du compte, unique par construction. Les handles
       réservés (démo, équipe) sont écartés : `neige-7` ne devient pas
       `neige-77`, le portrait d'un créateur de démonstration. */
    const candidats = handleCandidates(base, userId).filter(
      (c) => !RESERVED_HANDLES.has(c),
    );
    let handle = "";
    for (const c of candidats) {
      const res = await users.set(`handle:${c}`, userId, { onlyIfNew: true });
      if (res.modified) {
        handle = c;
        break;
      }
    }
    if (!handle) return bad("Impossible d'attribuer un pseudonyme", 500);
    const user: SessionUser = {
      id: userId,
      email,
      handle,
      name: base
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    };
    await users.setJSON(`u:${userId}`, {
      ...user,
      legal: buildConsent(Date.now()),
    });
    await users.set(`email:${key}`, userId);
    // `handle:` est déjà posé par la réservation conditionnelle ci-dessus.
  }

  let user = (await users.get(`u:${userId}`, {
    type: "json",
  })) as UserRecord;

  // Compte existant : on enregistre (ou rafraîchit) la preuve, puisque
  // l'acceptation vient d'être recueillie à l'écran. Si l'écriture échoue,
  // la connexion passe quand même : /api/me redemandera l'acceptation.
  if (user.legal?.version !== LEGAL_VERSION) {
    const u = await updateUser(userId, (r) => ({
      ...r,
      legal: buildConsent(Date.now()),
    }));
    if (u.ok) user = u.rec;
  }
  return json(
    {
      ok: true,
      user: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        email: user.email,
        ...profileFields(user),
      },
    },
    200,
    { "set-cookie": await makeSessionCookie(userId) },
  );
};

export const config: Config = { path: "/api/auth/verify" };
