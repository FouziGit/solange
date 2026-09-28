/* Émission des événements de commande (lot 1) — UN SEUL module, plusieurs
   canaux (cloche + email aujourd'hui, push web au lot 3 : il se branchera
   ICI, pas ailleurs). Chaque événement porte un lien profond vers
   /commande/[id]. Vendeur seed (sellerId null) : pas de destinataire.
   D-037 : suivi et protection dans « Expédiée », dernier rappel à J+12,
   virement au vendeur, colis perdu (indemnisation lue dans CARRIERS). */
import { APP_URL, pushNotif, sendEmail, userEmail } from "./core.mts";
import { escapeHtml } from "../../../src/lib/guards.ts";
import { carrierOfOrder } from "../../../src/lib/shipping.ts";
import { BUYER_PROTECTION_TEXT } from "../../../src/lib/payout.ts";

type OrderLike = {
  id: string;
  buyerId: string;
  buyerHandle: string;
  sellerId: string | null;
  sellerHandle: string;
  brand: string;
  name: string;
  netSellerEUR?: number;
  shipment?: { tracking?: string };
  shippingMethodId?: string;
  shippingMethod?: string;
  /** Démonstration : aucun paiement réel à protéger (CGV art. 2). */
  simulated?: boolean;
};

export type OrderEventKind =
  | "expediee"
  | "recue"
  | "terminee"
  | "annulee"
  | "litige"
  | "remind_ship"
  | "remind_receive"
  | "remind_receive_last"
  | "verse"
  | "colis_perdu";

/** 25 → « 25 € », 98.5 → « 98,50 € ». */
const eur = (n: number) =>
  n.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }) + " €";

/** « Marque — Nom », échappé : ce sont des champs saisis par le vendeur. */
const piece = (o: OrderLike) =>
  `${escapeHtml(o.brand)} — ${escapeHtml(o.name)}`;

const P = (html: string) =>
  `<p style="font-size:14px;color:#b8b3a8;margin:12px 0 0">${html}</p>`;

type Texte = string | ((o: OrderLike) => string);

/** Destinataires + textes, dans la voix DA (tu, verbe, pas d'excuse). */
const EVENTS: Record<
  OrderEventKind,
  {
    toBuyer?: Texte; // texte cloche acheteur
    toSeller?: Texte; // texte cloche vendeur
    subject: string;
    body: (o: OrderLike) => string;
  }
> = {
  expediee: {
    toBuyer: "Ta commande est expédiée",
    subject: "Expédiée",
    body: (o) => {
      const carrier = carrierOfOrder(o);
      const tracking = o.shipment?.tracking;
      return [
        `<p>@${o.sellerHandle} a expédié <strong>${o.brand} — ${o.name}</strong>. Confirme la réception quand la pièce arrive.</p>`,
        tracking
          ? P(
              `Numéro de suivi : <strong style="color:#f4f1ea">${escapeHtml(tracking)}</strong>`,
            )
          : "",
        /* Page officielle SANS paramètre : le pré-remplissage du numéro
           ne fonctionne pas chez Mondial Relay (vérifié le 28/09/2026). */
        carrier
          ? P(
              `<a href="${carrier.trackingUrl}" style="color:#f4f1ea">Suis ton colis sur la page Suivi de colis de ${carrier.name}</a>`,
            )
          : "",
        o.simulated === true ? "" : P(BUYER_PROTECTION_TEXT),
      ].join("");
    },
  },
  recue: {
    toSeller: "L'acheteur a bien reçu la pièce",
    subject: "Reçue",
    body: (o) =>
      `<p>@${o.buyerHandle} a confirmé la réception de <strong>${o.brand} — ${o.name}</strong>.</p>`,
  },
  terminee: {
    toBuyer: "Commande terminée",
    toSeller: "Vente terminée",
    subject: "Terminée",
    body: (o) =>
      `<p><strong>${o.brand} — ${o.name}</strong> : c'est bouclé.</p>`,
  },
  annulee: {
    toBuyer: "Ta commande est annulée — la pièce est remise en vente",
    toSeller: "La vente est annulée",
    subject: "Annulée",
    body: (o) =>
      `<p><strong>${o.brand} — ${o.name}</strong> : la commande est annulée. La pièce est remise en vente.</p>`,
  },
  litige: {
    toSeller: "L'acheteur signale un problème sur la commande",
    subject: "Problème signalé",
    body: (o) =>
      `<p>@${o.buyerHandle} signale un problème sur <strong>${o.brand} — ${o.name}</strong>. L'équipe va trancher — la commande est gelée d'ici là.</p>`,
  },
  remind_ship: {
    toSeller: "Pense à expédier — la commande sera annulée à J+7",
    subject: "À expédier",
    body: (o) =>
      `<p><strong>${o.brand} — ${o.name}</strong> attend son envoi. Sans expédition sous 7 jours après l'achat, la commande s'annule et la pièce revient en vente.</p>`,
  },
  remind_receive: {
    toBuyer: "Ta pièce est-elle arrivée ? Confirme la réception",
    subject: "Bien reçue ?",
    body: (o) =>
      `<p><strong>${o.brand} — ${o.name}</strong> a été expédiée il y a 7 jours. Confirme la réception, ou signale un problème — sans réponse la commande se clôt à J+14.</p>`,
  },
  /* D-037 : la clôture J+14 PAIE le vendeur sans preuve de livraison.
     Dernière occasion pour l'acheteur de signaler un colis jamais arrivé. */
  remind_receive_last: {
    toBuyer:
      "Dernier rappel : sans signalement de ta part d'ici 2 jours, la commande sera clôturée et le vendeur payé",
    subject: "Tu as bien reçu ta pièce ?",
    body: (o) =>
      `<p><strong>${piece(o)}</strong> a été expédiée il y a 12 jours. Confirme la réception, ou signale un problème : sans signalement de ta part d'ici 2 jours, la commande sera clôturée et le vendeur payé.</p>`,
  },
  verse: {
    toSeller: (o) =>
      typeof o.netSellerEUR === "number"
        ? `Virement envoyé : ${eur(o.netSellerEUR)} partent vers ta banque`
        : "Virement envoyé : ta part est en route vers ta banque",
    subject: "Virement envoyé",
    body: (o) =>
      `<p>Ta part de la vente de <b>${piece(o)}</b> est virée sur ton compte bancaire. Le délai d'arrivée dépend de ta banque.</p>`,
  },
  /* Colis perdu (litige « non reçu » tranché par l'équipe). L'acheteur est
     remboursé ; le vendeur, qui a acheté l'étiquette, est indemnisé PAR LE
     TRANSPORTEUR jusqu'à son plafond — lu dans CARRIERS, jamais écrit ici. */
  colis_perdu: {
    toBuyer: "Colis perdu : tu es intégralement remboursé",
    toSeller: (o) => {
      const carrier = carrierOfOrder(o);
      return carrier
        ? `Colis déclaré perdu — déclare la perte à ${carrier.name}`
        : "Colis déclaré perdu — déclare la perte au transporteur";
    },
    subject: "Colis perdu",
    body: (o) => {
      const carrier = carrierOfOrder(o);
      const tracking = o.shipment?.tracking;
      const numero = tracking
        ? ` avec ton numéro de colis <strong style="color:#f4f1ea">${escapeHtml(tracking)}</strong>`
        : " avec ton numéro de colis";
      const vendeur = carrier
        ? `Vendeur : c'est toi qui as acheté l'étiquette, le contrat de transport est entre toi et ${carrier.name}. Déclare la perte à <a href="${carrier.claimUrl}" style="color:#f4f1ea">leur service client</a>${numero}. ${carrier.name} indique inclure dans son tarif une indemnisation forfaitaire de ${eur(carrier.lossCompensationCents / 100)} en cas de perte confirmée (davantage si tu as pris une assurance complémentaire à la création de l'étiquette), selon ses propres conditions.`
        : `Vendeur : c'est toi qui as acheté l'étiquette, le contrat de transport est entre toi et le transporteur. Déclare la perte à son service client${numero} : il t'indemnise selon ses propres conditions.`;
      return [
        `<p>Le colis de <b>${piece(o)}</b> n'est jamais arrivé. L'équipe a tranché : colis perdu. L'acheteur est intégralement remboursé (prix, frais de service et port) ; la part du vendeur, port compris, est reprise.</p>`,
        P(vendeur),
      ].join("");
    },
  },
};

export async function emitOrderEvent(o: OrderLike, kind: OrderEventKind) {
  const ev = EVENTS[kind];
  const link = `/commande/${o.id}`;
  const jobs: Promise<unknown>[] = [];
  const texte = (t: Texte) => (typeof t === "string" ? t : t(o));

  const notifyEmail = async (uid: string) => {
    const to = await userEmail(uid);
    if (to)
      await sendEmail(
        to,
        `${ev.subject} — ${o.brand} ${o.name}`,
        `${ev.body(o)}
         <p style="margin:16px 0 0"><a href="${APP_URL}${link}" style="color:#f4f1ea">Voir la commande →</a></p>`,
      );
  };

  if (ev.toBuyer) {
    jobs.push(
      pushNotif(o.buyerId, { type: "order", text: texte(ev.toBuyer), link }),
    );
    jobs.push(notifyEmail(o.buyerId));
  }
  if (ev.toSeller && o.sellerId) {
    jobs.push(
      pushNotif(o.sellerId, { type: "order", text: texte(ev.toSeller), link }),
    );
    jobs.push(notifyEmail(o.sellerId));
  }
  await Promise.all(jobs);
}
