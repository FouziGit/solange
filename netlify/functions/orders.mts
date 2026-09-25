/* /api/orders
   POST → crée une commande (paiement SIMULÉ, assumé) : le serveur recalcule
   TOUS les montants depuis sa propre table de prix, marque la pièce vendue
   (anti double-vente) et persiste la commande. GET → mes commandes.
   Corrige : montants côté serveur, protection au centime, machine à états
   minimale disponible→vendu (audit §5.4/5.5). */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  newId,
  currentUser,
  sameOrigin,
  readJson,
  APP_URL,
} from "./_shared/core.mts";
import { SEED_CATALOG } from "./_shared/seed-catalog.mts";
import { capturePayment } from "./_shared/payment.mts";
import { paymentsLive, stripe } from "./_shared/stripe.mts";
import {
  libererReservation,
  onOrderPaid,
  type OrderPaye,
} from "./_shared/order-paid.mts";
import {
  montants,
  sellerPayable,
  PRIX_MAX_EUR,
} from "../../src/lib/payments.ts";
import { toCents, toEur } from "../../src/lib/fees.ts";

/** Durée pendant laquelle une pièce reste réservée à un acheteur qui paie.
    C'est aussi la durée de vie de la session Stripe (minimum imposé :
    30 minutes). Passé ce délai, la pièce redevient disponible. */
const RESERVATION_MS = 30 * 60_000;
import type { OrderRecord } from "./_shared/order-core.mts";
import { normalizeStatus } from "../../src/lib/order-state.ts";
import { isPayableAmount, isValidId, lookupOwn } from "../../src/lib/guards.ts";
import {
  buildSaleConsent,
  saleAcceptanceIsValid,
} from "../../src/lib/legal-consent.ts";
import { validateRelay } from "../../src/lib/shipping.ts";

const SHIPPING_EUR = 4.9;
/* Barème transporteur — miroir du front (src/lib/shipping.ts). */
const SHIP: Record<string, { price: number; carrier: string }> = {
  mondial_relay: { price: 3.9, carrier: "Mondial Relay" },
  point_relais: { price: 4.5, carrier: "Point Relais" },
  chronopost: { price: 6.9, carrier: "Chronopost" },
};

export default async (req: Request) => {
  const user = await currentUser(req);

  if (req.method === "GET") {
    if (!user) return json({ orders: [] });
    const url = new URL(req.url);

    // ?id=X → UNE commande, acheteur ou vendeur uniquement (404 sinon —
    // ne pas confirmer l'existence à un tiers). Statut normalisé en lecture.
    const oneId = url.searchParams.get("id");
    if (oneId) {
      const o = (await store("orders").get(`o:${oneId}`, {
        type: "json",
      })) as OrderRecord | null;
      if (!o || (o.buyerId !== user.id && o.sellerId !== user.id))
        return bad("Commande inconnue", 404);
      // L'adresse de livraison à domicile n'appartient qu'aux deux parties
      // de CETTE commande — c'est déjà le périmètre de cette lecture.
      return json({
        order: {
          ...o,
          status: normalizeStatus(o.status),
          role: o.sellerId === user.id ? "seller" : "buyer",
        },
      });
    }

    // ?sales=1 → les VENTES du membre (commandes sur ses annonces)
    const asSales = url.searchParams.get("sales") === "1";
    const key = asSales ? `sales:${user.id}` : `u:${user.id}`;
    const ids =
      ((await store("orders").get(key, { type: "json" })) as string[]) ?? [];
    const orders: unknown[] = [];
    for (const oid of ids.slice(-30).reverse()) {
      const o = (await store("orders").get(`o:${oid}`, {
        type: "json",
      })) as OrderRecord | null;
      if (o) orders.push({ ...o, status: normalizeStatus(o.status) });
    }
    return json({ orders });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  if (!user) return bad("Connecte-toi pour acheter", 401);

  const b = await readJson<{
    productId?: string;
    shippingMethod?: string;
    relayLabel?: string;
    address?: { name?: string; line?: string; postal?: string; city?: string };
    acceptCgv?: boolean;
  }>(req);
  const pid = (b?.productId ?? "").trim();
  if (!isValidId(pid)) return bad("Article manquant");

  /* Acceptation des CGV pour CETTE vente. Vérifiée ici, pas seulement à
     l'écran : une commande sans acceptation ne serait opposable à
     personne. Elle est horodatée sur la commande juste en dessous. */
  if (!saleAcceptanceIsValid(b))
    return bad("Accepte les conditions de vente pour commander", 400);
  const method = (b?.shippingMethod ?? "").trim();
  const shipSel = lookupOwn(SHIP, method, {
    price: SHIPPING_EUR,
    carrier: "Livraison suivie",
  });
  /* Point relais : obligatoire en Mondial Relay / Point Relais (le
     vendeur doit savoir où déposer le colis), 160 caractères au plus
     (nom, adresse, code postal, ville). Même règle qu'au paiement. */
  const relayCheck = validateRelay(method, b?.relayLabel);
  if (!relayCheck.ok) return bad(relayCheck.error, 400);
  const relayLabel = relayCheck.label;

  // Livraison à domicile (Chronopost) : adresse requise, validée serveur.
  // En point relais, l'adresse du relais fait foi — rien d'autre n'est stocké.
  const isHome = method === "chronopost";
  const addr = b?.address;
  const field = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const address = isHome
    ? {
        name: field(addr?.name, 80),
        line: field(addr?.line, 120),
        postal: field(addr?.postal, 10),
        city: field(addr?.city, 60),
      }
    : undefined;
  if (
    isHome &&
    (!address?.name || !address.line || !address.postal || !address.city)
  )
    return bad("Complète l'adresse de livraison");

  const products = store("products");
  // Source de vérité prix : annonce membre (Blobs) ou catalogue seed serveur.
  const record = (await products.get(`p:${pid}`, { type: "json" })) as {
    priceEUR: number;
    brand: string;
    name: string;
    seller: string;
    sellerId?: string;
    status: string;
  } | null;
  const seedItem = SEED_CATALOG[pid];
  if (!record && !seedItem) return bad("Article inconnu", 404);

  const item = record ?? {
    ...seedItem!,
    status: "available",
    sellerId: undefined,
  };
  if (item.status !== "available")
    return bad("Cette pièce vient d'être vendue", 409);
  // lot 4 : une pièce masquée par la modération ne s'achète plus
  if ((item as { hidden?: boolean }).hidden)
    return bad("Cette pièce n'est plus disponible", 409);
  if (record && record.sellerId === user.id)
    return bad("Tu ne peux pas acheter ta propre annonce", 403);

  const live = paymentsLive();

  /* Paiement réel : seule une annonce MEMBRE s'achète. Une pièce du
     catalogue de démonstration n'a pas de vendeur à payer — l'accepter
     produisait jusqu'ici une commande gelée à vie (blocage 1 de l'audit). */
  if (live && !record?.sellerId)
    return bad("Cette pièce n'est pas en vente", 409);

  let sellerAccount: string | null = null;
  if (live && record?.sellerId) {
    const seller = (await store("users").get(`u:${record.sellerId}`, {
      type: "json",
    })) as { stripeAccountId?: string } | null;
    sellerAccount = seller?.stripeAccountId ?? null;
    // état vérifié CHEZ STRIPE au moment de l'achat, pas depuis un cache
    const acct = sellerAccount
      ? await stripe()!
          .accounts.retrieve(sellerAccount)
          .catch(() => null)
      : null;
    if (!sellerPayable(acct))
      return bad(
        "Le vendeur n'a pas encore activé ses paiements — la pièce n'est pas achetable pour l'instant",
        409,
      );
  }

  /* Plafond déclaré à Stripe : une annonce déposée avant qu'il existe, ou
     modifiée à la main, ne doit pas pouvoir se payer au-dessus. */
  if (live && item.priceEUR > PRIX_MAX_EUR)
    return bad("Cette pièce dépasse le prix maximum accepté au paiement", 409);

  /* Tous les montants en centimes entiers, calculés à UN endroit
     (src/lib/payments.ts). Le taux de commission est gelé sur la commande. */
  const priceCents = toCents(item.priceEUR);
  const shippingCents = toCents(shipSel.price);
  const m = montants(priceCents, shippingCents);
  const total = toEur(m.totalCents);
  if (!isPayableAmount(total)) return bad("Montant de commande invalide", 400);

  const shippingLabel = relayLabel
    ? `${shipSel.carrier} · ${relayLabel}`
    : shipSel.carrier;
  const orderId = newId("o");
  const now = Date.now();

  /* Réservation ATOMIQUE de la pièce (écriture conditionnelle sur l'etag).
     Deux acheteurs qui cliquent en même temps : un seul réserve, l'autre
     reçoit un 409. L'ancien verrou « relire puis écrire » laissait passer
     les deux, ce qui ne coûtait rien en simulé et coûterait un
     remboursement en réel. */
  if (record) {
    const cur = await products.getWithMetadata(`p:${pid}`, { type: "json" });
    const d = (cur?.data ?? null) as Record<string, unknown> | null;
    const reservationPerimee =
      d?.status === "reserved" &&
      typeof d.reservedUntil === "number" &&
      d.reservedUntil < now;
    if (!d || (d.status !== "available" && !reservationPerimee))
      return bad(
        d?.status === "reserved"
          ? "Quelqu'un est en train de payer cette pièce — réessaie dans quelques minutes"
          : "Cette pièce vient d'être vendue",
        409,
      );
    const res = await products.setJSON(
      `p:${pid}`,
      {
        ...d,
        status: "reserved",
        reservedBy: orderId,
        reservedUntil: now + RESERVATION_MS,
      },
      { onlyIfMatch: cur!.etag },
    );
    if (!res.modified)
      return bad("Cette pièce vient d'être prise — réessaie", 409);
  }

  const order = {
    id: orderId,
    buyerId: user.id,
    buyerHandle: user.handle,
    productId: pid,
    brand: item.brand,
    name: item.name,
    sellerHandle: item.seller,
    sellerId: record?.sellerId ?? null,
    priceEUR: toEur(m.priceCents),
    protectionEUR: toEur(m.serviceCents),
    shippingEUR: toEur(m.shippingCents),
    totalEUR: total,
    totalCents: m.totalCents,
    applicationFeeCents: m.applicationFeeCents,
    sellerCents: m.sellerCents,
    shippingMethod: shipSel.carrier,
    shippingLabel,
    address, // domicile uniquement, sinon undefined
    commissionRate: m.rateBps / 10_000,
    commissionRateBps: m.rateBps,
    commissionEUR: toEur(m.commissionCents),
    netSellerEUR: toEur(m.sellerCents),
    status: live ? "en_attente" : "payee",
    /* preuve d'acceptation des CGV, propre à cette vente */
    cgv: buildSaleConsent(now),
    history: [
      {
        at: now,
        by: user.id,
        from: "creee",
        to: live ? "en_attente" : "payee",
      },
    ],
    simulated: !live,
    createdAt: now,
  } as Record<string, unknown> & { id: string };

  const orders = store("orders");
  await orders.setJSON(`o:${orderId}`, order);
  const mine =
    ((await orders.get(`u:${user.id}`, { type: "json" })) as string[]) ?? [];
  mine.push(orderId);
  await orders.setJSON(`u:${user.id}`, mine);

  /* ---------- paiement réel : session Stripe Checkout ---------- */
  if (live && sellerAccount) {
    try {
      const session = await stripe()!.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: user.email,
          locale: "fr",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: m.priceCents,
                product_data: {
                  name: `${item.brand} — ${item.name}`.slice(0, 250),
                },
              },
            },
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: m.serviceCents,
                product_data: { name: "Frais de service acheteur" },
              },
            },
            ...(m.shippingCents > 0
              ? [
                  {
                    quantity: 1,
                    price_data: {
                      currency: "eur",
                      unit_amount: m.shippingCents,
                      product_data: { name: `Livraison — ${shipSel.carrier}` },
                    },
                  },
                ]
              : []),
          ],
          payment_intent_data: {
            // destination charge : la part du vendeur part sur SON compte
            transfer_data: { destination: sellerAccount },
            application_fee_amount: m.applicationFeeCents,
            description:
              `SOLANGE ${orderId} — ${item.brand} ${item.name}`.slice(0, 350),
            statement_descriptor_suffix: "SOLANGE",
            metadata: { orderId },
          },
          metadata: { orderId },
          client_reference_id: orderId,
          // la pièce ne reste pas bloquée si l'acheteur abandonne
          expires_at: Math.floor((now + RESERVATION_MS) / 1000),
          success_url: `${APP_URL}/commande/${orderId}?paiement=ok`,
          cancel_url: `${APP_URL}/checkout/${pid}?paiement=annule`,
        },
        { idempotencyKey: `checkout-${orderId}` },
      );
      await orders.setJSON(`o:${orderId}`, {
        ...order,
        checkoutSessionId: session.id,
      });
      return json({ ok: true, order, checkoutUrl: session.url });
    } catch (e) {
      /* Stripe a refusé de créer la session : on défait la réservation et
         la commande, plutôt que de laisser une pièce bloquée 30 minutes
         par une commande qui n'aboutira jamais. */
      console.error("checkout_session_error", (e as Error).message);
      await libererReservation(pid, orderId);
      await orders.setJSON(`o:${orderId}`, {
        ...order,
        status: "annulee",
        cancelReason: "Session de paiement impossible à créer",
      });
      return bad("Le paiement n'a pas pu être initié — réessaie", 502);
    }
  }

  /* ---------- paiement simulé : capture instantanée ---------- */
  const pay = await capturePayment({
    id: orderId,
    totalEUR: total,
    buyerId: user.id,
  });
  if (!pay.ok) {
    if (record) await libererReservation(pid, orderId);
    return bad(pay.error, 402);
  }
  await orders.setJSON(`o:${orderId}`, { ...order, paymentRef: pay.reference });

  if (record) {
    await onOrderPaid(order as unknown as OrderPaye);
  } else {
    // pièce seed (simulé uniquement) : shadow record, comme avant
    await products.setJSON(`p:${pid}`, {
      ...seedItem!,
      id: pid,
      status: "sold",
      shadow: true,
      soldAt: Date.now(),
    });
    const sold =
      ((await products.get("sold-seeds", { type: "json" })) as string[]) ?? [];
    if (!sold.includes(pid)) {
      sold.push(pid);
      await products.setJSON("sold-seeds", sold);
    }
  }

  return json({ ok: true, order });
};

export const config: Config = { path: "/api/orders" };
