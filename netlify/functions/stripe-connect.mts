/* /api/stripe/connect — activation des paiements côté VENDEUR.

   GET  → état du compte de paiement du membre connecté.
   POST → crée son compte connecté Stripe s'il n'existe pas, puis renvoie
          un lien d'inscription hébergé par Stripe (vérification d'identité,
          IBAN). SOLANGE ne voit jamais ces informations.

   Compte connecté en Accounts v1 + controller properties (les types
   Standard/Express/Custom sont dépréciés dans la doc Stripe) :
   - fees.payer = application : SOLANGE paie les frais Stripe et se rémunère
     par sa commission ;
   - losses.payments = application : SOLANGE répond d'un solde négatif — c'est
     le prix des destination charges, et c'est ce qui permet de reprendre
     l'argent au vendeur en cas de remboursement ;
   - requirement_collection = stripe + tableau de bord express : Stripe
     collecte et vérifie l'identité, le vendeur a un espace simple.
   Seule capacité demandée : `transfers`, suffisante pour recevoir une
   destination charge sans on_behalf_of. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  currentUser,
  sameOrigin,
  rateLimit,
  assertCanWrite,
  APP_URL,
} from "./_shared/core.mts";
import { stripe } from "./_shared/stripe.mts";
import { updateUser } from "./_shared/users.mts";
import { sellerPayable } from "../../src/lib/payments.ts";

export default async (req: Request) => {
  const s = stripe();
  if (!s) return json({ enabled: false });

  const user = await currentUser(req);
  if (!user) return bad("Connexion requise", 401);

  const users = store("users");
  const rec = (await users.get(`u:${user.id}`, { type: "json" })) as Record<
    string,
    unknown
  > | null;
  if (!rec) return bad("Compte introuvable", 404);
  const accountId =
    typeof rec.stripeAccountId === "string" ? rec.stripeAccountId : null;

  if (req.method === "GET") {
    if (!accountId) return json({ enabled: true, status: "absent" });
    const acct = await s.accounts.retrieve(accountId);
    const payable = sellerPayable(acct);
    // cache du dernier état connu : /api/orders le lit sans rappeler Stripe
    if (rec.stripePayable !== payable)
      await updateUser(user.id, (r) => ({ ...r, stripePayable: payable }));
    return json({
      enabled: true,
      status: payable
        ? "actif"
        : acct.details_submitted
          ? "verification"
          : "incomplet",
      payable,
    });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const blocked = await assertCanWrite(user);
  if (blocked) return blocked;
  if (!(await rateLimit(`connect:${user.id}`, 20, 3_600_000)))
    return bad("Trop de tentatives — réessaie dans un moment", 429);

  let id = accountId;
  if (!id) {
    const acct = await s.accounts.create(
      {
        country: "FR",
        email: user.email,
        business_type: "individual",
        controller: {
          fees: { payer: "application" },
          losses: { payments: "application" },
          requirement_collection: "stripe",
          stripe_dashboard: { type: "express" },
        },
        capabilities: { transfers: { requested: true } },
        /* Versements HEBDOMADAIRES vers la banque du vendeur, plutôt que
           quotidiens. Avec une destination charge, la part du vendeur est
           sur son solde Stripe dès le paiement ; tant qu'elle n'est pas
           partie vers sa banque, un remboursement peut la reprendre
           (reverse_transfer). Une semaine de marge couvre l'annulation
           d'office à J+7 et la plupart des litiges. */
        settings: {
          payouts: {
            schedule: { interval: "weekly", weekly_anchor: "friday" },
          },
        },
        business_profile: {
          // le membre vend des vêtements d'occasion, à titre personnel
          mcc: "5931",
          product_description:
            "Vente de vêtements d'occasion entre particuliers sur SOLANGE",
        },
        metadata: { solangeUserId: user.id },
      },
      // une double requête ne crée jamais deux comptes pour le même membre
      { idempotencyKey: `connect-account-${user.id}` },
    );
    id = acct.id;
    /* Sans cet enregistrement, le compte Stripe serait perdu pour nous. La
       clé d'idempotence rend le même compte si le membre réessaie. */
    const saved = await updateUser(user.id, (r) => ({
      ...r,
      stripeAccountId: acct.id,
      stripePayable: false,
    }));
    if (!saved.ok)
      return bad("Ton compte vient d'être modifié. Réessaie.", 409);
  }

  // Lien à usage unique, jamais stocké ni envoyé par e-mail (doc Stripe).
  const link = await s.accountLinks.create({
    account: id,
    type: "account_onboarding",
    refresh_url: `${APP_URL}/profil?paiements=relancer`,
    return_url: `${APP_URL}/profil?paiements=retour`,
    collection_options: { fields: "eventually_due" },
  });
  return json({ enabled: true, url: link.url });
};

export const config: Config = { path: "/api/stripe/connect" };
