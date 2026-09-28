/* Application d'une transition de commande (lot 1) — LE seul endroit qui
   écrit un changement de statut. Utilisé par order-transition.mts (actions
   membres), orders-cron.mts (automatismes), admin.mts et le webhook
   Stripe ; toute la validation vient de src/lib/order-state.

   ÉCRITURE CONDITIONNELLE (D-037) : la commande est relue avec son etag et
   réécrite seulement si personne ne l'a modifiée entre-temps. Un conflit
   sans effet de bord renvoie 409 ; un conflit APRÈS un remboursement (l'argent a
   bougé) impose l'annulation et prévient les administrateurs — la pièce
   n'est remise en vente, et les parties prévenues, que si le concurrent
   n'a pas changé le statut (une pièce expédiée entre-temps reste vendue,
   l'équipe s'en occupe). Le versement
   au vendeur part après le passage à `terminee`, sans jamais bloquer la
   transition. */
import { store } from "./core.mts";
import { rembourser } from "./stripe.mts";
import { libererReservation } from "./order-paid.mts";
import { emitOrderEvent, type OrderEventKind } from "./order-events.mts";
import { alerterAdmins } from "./admin-alert.mts";
import {
  nextStatus,
  normalizeStatus,
  type OrderAction,
  type OrderHistoryEntry,
  type OrderRole,
  type OrderStatus,
} from "../../../src/lib/order-state.ts";
import { validateTracking } from "../../../src/lib/shipping.ts";
import type { OrderPayout } from "../../../src/lib/payout.ts";

export type BankDispute = {
  id?: string;
  reason?: string;
  amount?: number;
  at: number;
  status?: string;
  closedAt?: number;
};

export type OrderRecord = {
  id: string;
  buyerId: string;
  buyerHandle: string;
  productId: string;
  brand: string;
  name: string;
  sellerHandle: string;
  sellerId: string | null;
  priceEUR: number;
  totalEUR: number;
  status: string;
  createdAt: number;
  history?: OrderHistoryEntry[];
  shipment?: { carrier?: string; tracking?: string; at: number };
  dispute?: { reason: string; note?: string; at: number };
  cancelReason?: string;
  /** Preuve d'acceptation des CGV au moment de la commande (version du
      socle + horodatage). Absente sur les commandes antérieures à sa mise
      en place — c'est un fait, pas une acceptation implicite. */
  cgv?: { version: number; at: number };
  paidAt?: number;
  shippedAt?: number;
  remindShipAt?: number;
  remindReceiveAt?: number;
  /** Dernier rappel acheteur (J+12), D-037. */
  remindReceiveLastAt?: number;
  simulated?: boolean;
  paymentIntentId?: string;
  refundId?: string;
  refundedAt?: number;
  sellerCents?: number;
  netSellerEUR?: number;
  /* ---- D-037 : commandes créées après le chantier ---- */
  packageSize?: string;
  shippingMethodId?: string;
  shippingMethod?: string;
  /** Posé sur toute nouvelle commande : versement PAR COMMANDE à la
      livraison. Absent : commande antérieure, aucun versement par commande. */
  payoutMode?: "manual";
  /** Compte de DESTINATION du transfert, figé à la création (réel). */
  sellerStripeAccountId?: string;
  payout?: OrderPayout;
  lostParcel?: { at: number; by: "admin" };
  refundAfterPayout?: { at: number };
  /** Contestation bancaire (payment-webhook) : suspend le versement.
      Close sur une issue défavorable (`lost`…), elle reste en place (le
      virement reste suspendu) avec `status` et `closedAt`. */
  bankDispute?: BankDispute;
  /** Contestation close en faveur du vendeur (`won`, `warning_closed`) :
      archivée ici, elle ne suspend plus rien. */
  bankDisputeClosed?: BankDispute;
  disputeAlertAt?: number;
  [k: string]: unknown;
};

const CONFLIT = "Commande modifiée entre-temps — réessaie";

export type PatchResult =
  | { ok: true; order: OrderRecord }
  | { ok: false; reason: "missing" | "conflict" };

/** Réécrit `o:<id>` par écriture conditionnelle (etag), comme updateUser
    pour les comptes. `fn` reçoit une copie de la version fraîche et rend
    la nouvelle ; null : on n'écrit rien et on rend la version fraîche.
    Sans etag, on n'écrit pas à l'aveugle : c'est un conflit. */
export async function patchOrder(
  id: string,
  fn: (fresh: OrderRecord) => OrderRecord | null,
): Promise<PatchResult> {
  const orders = store("orders");
  const key = `o:${id}`;
  for (let i = 0; i < 3; i++) {
    const cur = await orders.getWithMetadata(key, { type: "json" });
    const fresh = (cur?.data ?? null) as OrderRecord | null;
    if (!fresh || typeof fresh !== "object")
      return { ok: false, reason: "missing" };
    if (!cur?.etag) return { ok: false, reason: "conflict" };
    const next = fn(structuredClone(fresh));
    if (!next) return { ok: true, order: fresh };
    const res = await orders.setJSON(key, next, { onlyIfMatch: cur.etag });
    if (res.modified) return { ok: true, order: next };
  }
  return { ok: false, reason: "conflict" };
}

/** Remet une pièce en vente (annulation) : annonce membre → available,
    pièce seed → shadow record supprimé + retirée de sold-seeds. */
async function releaseProduct(pid: string) {
  const products = store("products");
  const rec = (await products.get(`p:${pid}`, { type: "json" })) as {
    shadow?: boolean;
    status?: string;
  } | null;
  if (!rec) return;
  if (rec.shadow) {
    await products.delete(`p:${pid}`);
    const sold =
      ((await products.get("sold-seeds", { type: "json" })) as string[]) ?? [];
    if (sold.includes(pid))
      await products.setJSON(
        "sold-seeds",
        sold.filter((s) => s !== pid),
      );
  } else {
    await products.setJSON(`p:${pid}`, {
      ...rec,
      status: "available",
      soldAt: undefined,
    });
  }
}

export type TransitionInput = {
  orderId: string;
  action: OrderAction;
  role: OrderRole;
  by: string; // userId | "system" | "admin"
  carrier?: string;
  tracking?: string;
  /** Litige uniquement : "non_recue" | "non_conforme". */
  reason?: string;
  note?: string;
  /** Admin, resolve_cancel sur un litige « non reçu » : colis perdu. La
      pièce n'est PAS remise en vente, l'acheteur est remboursé. */
  lost?: boolean;
};

export type TransitionResult =
  { ok: true; order: OrderRecord } | { ok: false; error: string; code: number };

export async function applyTransition(
  input: TransitionInput,
): Promise<TransitionResult> {
  /* Expédier sans numéro de suivi n'est plus possible (D-037) : contrôlé
     AVANT toute autre action, rien n'est écrit s'il manque. */
  let tracking: string | undefined;
  if (input.action === "ship") {
    const t = validateTracking(input.tracking);
    if (!t.ok) return { ok: false, error: t.error, code: 400 };
    tracking = t.tracking;
  }

  const orders = store("orders");
  const key = `o:${input.orderId}`;
  // relecture fraîche AVEC etag : un double clic / un cron concurrent voit
  // le statut réel, et l'écriture échoue si quelqu'un est passé entre-temps
  const cur = await orders.getWithMetadata(key, { type: "json" });
  const order = (cur?.data ?? null) as OrderRecord | null;
  if (!order) return { ok: false, error: "Commande inconnue", code: 404 };
  if (!cur?.etag) return { ok: false, error: CONFLIT, code: 409 };
  const etag = cur.etag;

  // Pièce seed (vendeur fictif) : aucun cycle — rien à expédier, personne
  // pour trancher. Protège aussi les commandes réelles historiques.
  if (!order.sellerId)
    return {
      ok: false,
      error: "Commande de démonstration — pas de cycle d'expédition",
      code: 409,
    };

  const from = normalizeStatus(order.status);
  const to = nextStatus(from, input.action, input.role);
  if (!to)
    return {
      ok: false,
      error: `Impossible depuis « ${from} »`,
      code: 409,
    };

  if (
    input.lost &&
    !(
      input.action === "resolve_cancel" &&
      input.role === "admin" &&
      from === "litige" &&
      order.dispute?.reason === "non_recue"
    )
  )
    return {
      ok: false,
      error: "Colis perdu : seulement sur un litige « non reçu »",
      code: 409,
    };

  /* Annuler une commande RÉELLEMENT payée, c'est d'abord rembourser.
     L'argent bouge avant l'état : si le remboursement échoue, la commande
     reste où elle est et l'erreur remonte — on n'affiche jamais
     « annulée » sur une commande dont l'acheteur n'a pas été remboursé.
     `expire` ne rembourse pas : il ne s'applique qu'à `en_attente`, où
     rien n'a été encaissé. */
  const rembourse =
    to === "annulee" &&
    from !== "en_attente" &&
    !order.simulated &&
    typeof order.paymentIntentId === "string";
  let refundId: string | undefined;
  if (rembourse) {
    const r = await rembourser(order);
    if (!r.ok)
      return {
        ok: false,
        error: `Remboursement impossible — ${r.error}`,
        code: 502,
      };
    refundId = r.refundId;
  }
  /* Remboursement APRÈS le virement au vendeur : la reprise de sa part
     rend son solde Stripe négatif, et la plateforme en répond. Toléré
     (l'acheteur doit être remboursé), mais signalé. Sur un conflit
     d'écriture, recalculé sur la version fraîche (imposerAnnulation). */
  const refundAfterPayout =
    refundId !== undefined && order.payout?.status === "envoye";

  const now = Date.now();
  const history: OrderHistoryEntry[] = order.history ?? [
    // commandes d'avant le lot 1 : on reconstitue l'entrée de création
    { at: order.createdAt, by: order.buyerId, from: "creee", to: "payee" },
  ];
  history.push({ at: now, by: input.by, from, to, note: input.note });

  const next: OrderRecord = {
    ...order,
    status: to,
    history,
    ...(refundId ? { refundId, refundedAt: now } : {}),
    ...(refundAfterPayout ? { refundAfterPayout: { at: now } } : {}),
  };
  const events: OrderEventKind[] = [];
  /* Effets sur la pièce : décidés ici, appliqués APRÈS une écriture
     réussie — jamais pour une transition refusée par un conflit. */
  let liberer: "piece" | "reservation" | null = null;

  switch (input.action) {
    case "ship":
      next.shipment = {
        carrier: input.carrier?.slice(0, 40) || order.shippingMethod,
        tracking,
        at: now,
      };
      next.shippedAt = now;
      events.push("expediee");
      break;
    case "cancel":
      next.cancelReason = input.note?.slice(0, 200);
      liberer = "piece";
      events.push("annulee");
      break;
    case "receive": {
      // reçue → clôture immédiate par le système (pas d'avis : rien à attendre)
      history.push({ at: now, by: "system", from: "recue", to: "terminee" });
      next.status = "terminee";
      events.push("recue", "terminee");
      break;
    }
    case "dispute":
      next.dispute = {
        reason: input.reason === "non_conforme" ? "non_conforme" : "non_recue",
        note: input.note?.slice(0, 300),
        at: now,
      };
      events.push("litige");
      break;
    case "close":
      events.push("terminee");
      break;
    case "resolve_cancel":
      if (input.lost) {
        /* Colis perdu : la pièce n'existe plus chez le vendeur, elle reste
           « vendue ». L'événement « annulee » (« remise en vente ») ne
           part pas : « colis_perdu » le remplace. */
        next.lostParcel = { at: now, by: "admin" };
        next.cancelReason = input.note?.trim()
          ? input.note.slice(0, 200)
          : "Colis perdu";
        events.push("colis_perdu");
      } else {
        next.cancelReason = input.note?.slice(0, 200);
        liberer = "piece";
        events.push("annulee");
      }
      break;
    case "resolve_close":
      events.push("terminee");
      break;
    case "pay":
      // Confirmé par Stripe. Les effets de vente (notif « Vendu », e-mail,
      // index) partent de order-paid.mts, appelé par le webhook.
      next.paidAt = now;
      break;
    case "expire":
      // Paiement abandonné ou refusé : rien n'a été encaissé, on rend la
      // pièce — mais seulement si c'est bien CETTE commande qui la tenait.
      next.cancelReason = input.note?.slice(0, 200) ?? "Paiement non abouti";
      liberer = "reservation";
      break;
  }

  let saved: OrderRecord = next;
  /* Effets de la transition (pièce, événements) : appliqués si c'est bien
     elle qui a été écrite, ou si l'annulation imposée remplace le même
     statut que celui qu'elle quittait. */
  let effets = true;
  const w = await orders.setJSON(key, next, { onlyIfMatch: etag });
  if (!w.modified) {
    // Rien n'a bougé : la transition est simplement à refaire.
    if (!refundId) return { ok: false, error: CONFLIT, code: 409 };
    const forced = await imposerAnnulation(
      order.id,
      next,
      refundId,
      input.by,
      now,
      from,
    );
    if (!forced) return { ok: false, error: CONFLIT, code: 409 };
    saved = forced.order;
    effets = forced.previous === from;
  }

  if (effets && liberer === "piece") await releaseProduct(order.productId);
  else if (effets && liberer === "reservation")
    await libererReservation(order.productId, order.id);
  if (refundId !== undefined && saved.refundAfterPayout)
    await alerterAdmins({
      text: `Remboursement après versement — commande ${order.id} : la part vendeur a été reprise sur un solde déjà versé (solde négatif, SOLANGE en répond)`,
      link: "/admin",
      subject: "SOLANGE — remboursement après versement",
    });
  if (effets) for (const ev of events) await emitOrderEvent(saved, ev);

  /* Commande terminée : le vendeur est payé maintenant (D-037). Le
     résultat de la transition ne dépend JAMAIS du versement : un échec
     est noté sur la commande et repris par le cron. */
  if (saved.status === "terminee") {
    try {
      // import différé : casse le cycle payout.mts ↔ order-core.mts
      const { verserVendeur } = await import("./payout.mts");
      const p = await verserVendeur(order.id);
      if (p) saved = { ...saved, payout: p };
    } catch (e) {
      console.error("payout_error", order.id, (e as Error).message);
    }
  }
  return { ok: true, order: saved };
}

/** Écriture perdue APRÈS un remboursement réussi : l'acheteur est
    remboursé, la commande doit le dire. On impose l'annulation sur la
    version fraîche (sans rien d'autre de la transition perdue que ce qui
    décrit l'annulation) et on prévient les administrateurs. Déjà annulée
    par l'écrivain concurrent (même remboursement, même clé
    d'idempotence) : rien à imposer, null.
    Rend aussi le statut remplacé : s'il diffère de celui que quittait la
    transition (pièce expédiée, vente close entre-temps), ses effets
    (remise en vente, événements) ne s'appliquent pas et l'alerte le dit.
    « Remboursement après versement » se lit sur la version FRAÎCHE : un
    virement écrit par le concurrent compte. */
async function imposerAnnulation(
  id: string,
  perdue: OrderRecord,
  refundId: string,
  by: string,
  now: number,
  from: OrderStatus,
): Promise<{ order: OrderRecord; previous: OrderStatus } | null> {
  const etat: { dejaAnnulee: boolean; previous: OrderStatus } = {
    dejaAnnulee: false,
    previous: from,
  };
  const r = await patchOrder(id, (fresh) => {
    const fromFresh: OrderStatus = normalizeStatus(fresh.status);
    etat.previous = fromFresh;
    etat.dejaAnnulee = fromFresh === "annulee";
    if (etat.dejaAnnulee) return null;
    const apresVersement =
      perdue.refundAfterPayout ??
      (fresh.payout?.status === "envoye" ? { at: now } : undefined);
    const history = fresh.history ?? [];
    history.push({
      at: now,
      by,
      from: fromFresh,
      to: "annulee",
      note: "Annulation imposée par le remboursement (conflit d'écriture)",
    });
    return {
      ...fresh,
      status: "annulee",
      refundId,
      refundedAt: now,
      history,
      cancelReason: perdue.cancelReason,
      ...(perdue.lostParcel ? { lostParcel: perdue.lostParcel } : {}),
      ...(apresVersement ? { refundAfterPayout: apresVersement } : {}),
    };
  });
  if (r.ok && etat.dejaAnnulee) return null;
  if (!r.ok) {
    await alerterAdmins({
      text: `Conflit sur la commande ${id} : remboursement effectué (${refundId}) mais état NON mis à jour — à corriger à la main`,
      link: "/admin",
      subject: "SOLANGE — conflit de commande",
    });
    return null;
  }
  const autreStatut = etat.previous !== from;
  await alerterAdmins({
    text: autreStatut
      ? `Conflit sur la commande ${id} : remboursement effectué, annulation imposée alors que la commande était passée en « ${etat.previous} » — pièce NON remise en vente, prévenir l'acheteur et le vendeur`
      : `Conflit sur la commande ${id} : remboursement effectué, annulation imposée`,
    link: "/admin",
    subject: "SOLANGE — conflit de commande",
  });
  return { order: r.order, previous: etat.previous };
}
