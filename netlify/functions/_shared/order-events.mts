/* Émission des événements de commande (lot 1) — UN SEUL module, plusieurs
   canaux (cloche + email aujourd'hui, push web au lot 3 : il se branchera
   ICI, pas ailleurs). Chaque événement porte un lien profond vers
   /commande/[id]. Vendeur seed (sellerId null) : pas de destinataire. */
import { APP_URL, pushNotif, sendEmail, userEmail } from "./core.mts";

type OrderLike = {
  id: string;
  buyerId: string;
  buyerHandle: string;
  sellerId: string | null;
  sellerHandle: string;
  brand: string;
  name: string;
};

export type OrderEventKind =
  | "expediee"
  | "recue"
  | "terminee"
  | "annulee"
  | "litige"
  | "remind_ship"
  | "remind_receive";

/** Destinataires + textes, dans la voix DA (tu, verbe, pas d'excuse). */
const EVENTS: Record<
  OrderEventKind,
  {
    toBuyer?: string; // texte cloche acheteur
    toSeller?: string; // texte cloche vendeur
    subject: string;
    body: (o: OrderLike) => string;
  }
> = {
  expediee: {
    toBuyer: "Ta commande est expédiée",
    subject: "Expédiée",
    body: (o) =>
      `<p>@${o.sellerHandle} a expédié <strong>${o.brand} — ${o.name}</strong>. Confirme la réception quand la pièce arrive.</p>`,
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
};

export async function emitOrderEvent(o: OrderLike, kind: OrderEventKind) {
  const ev = EVENTS[kind];
  const link = `/commande/${o.id}`;
  const jobs: Promise<unknown>[] = [];

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
    jobs.push(pushNotif(o.buyerId, { type: "order", text: ev.toBuyer, link }));
    jobs.push(notifyEmail(o.buyerId));
  }
  if (ev.toSeller && o.sellerId) {
    jobs.push(
      pushNotif(o.sellerId, { type: "order", text: ev.toSeller, link }),
    );
    jobs.push(notifyEmail(o.sellerId));
  }
  await Promise.all(jobs);
}
