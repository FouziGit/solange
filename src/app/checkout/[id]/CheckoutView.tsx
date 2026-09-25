"use client";

import { Button } from "@/components/ui/Button";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { CatalogItem } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { api, type ApiOrder } from "@/lib/api";
import { usePaymentsMode, retryPaymentsMode } from "@/lib/use-payments-mode";
import { PageShell } from "@/components/ui/PageShell";
import { Stamp } from "@/components/ui/Stamp";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { imgItem } from "@/lib/img";
import { euro, gradientFor } from "@/lib/utils";
import { montants } from "@/lib/payments";
import { toCents, toEur } from "@/lib/fees";
import {
  SHIP_OPTIONS,
  shipOption,
  relayAddressLine,
  relayLabelFor,
  type ShipMethodId,
  type RelayChoice,
} from "@/lib/shipping";
import { RelayPicker } from "@/components/checkout/RelayPicker";
import {
  ArrowLeft,
  Lock,
  Card,
  Bag,
  Verified,
  Pin,
  ChevronRight,
  Check,
} from "@/components/chrome/icons";

type Step = "form" | "processing" | "done";

/** Ce qui manque pour payer : texte d'aide, erreur, champ à rejoindre. */
type Blocker = {
  key: "relay" | "address" | "cgv" | "login";
  hint: string;
  error: string;
  target: string;
};

/** « a, b et c » */
const joinFr = (parts: string[]) =>
  parts.length < 2
    ? parts.join("")
    : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;

/* Valeurs de démo figées — le formulaire ne peut JAMAIS recevoir
   une vraie carte : tous les champs sont readOnly. */
const DEMO_CARD = "4242 4242 4242 4242";

/** Référence d'une commande de démonstration (invité, rien n'est
    sauvegardé). Hors du composant : le compilateur React refuse un appel
    impur dans le corps d'un composant, même dans un gestionnaire. */
function identifiantDemo(): string {
  return "SLG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}
const DEMO_EXP = "12 / 34";
const DEMO_CVC = "123";
const DEMO_NAME = "Démo SOLANGE";

export function CheckoutView({ item }: { item: CatalogItem }) {
  const { addOrder, user, authReady, refreshProducts, refreshSession, isSold } =
    useStore();

  const [step, setStep] = useState<Step>("form");
  const [orderId, setOrderId] = useState("");
  const [serverOrder, setServerOrder] = useState<ApiOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Acceptation des CGV pour cette vente. Non pré-cochée, exigée aussi
     par le serveur (netlify/functions/orders.mts) : la case seule ne
     prouverait rien, c'est l'horodatage sur la commande qui compte. */
  const [cgvAccepted, setCgvAccepted] = useState(false);
  /* Paiement réel ou démonstration ? Tant qu'on ne sait pas (chargement,
     ou pas de réponse), on ne montre ni la fausse carte ni le bouton, et on
     n'affirme rien : afficher « simulé » à quelqu'un qui va payer pour de
     vrai serait pire que d'attendre une demi-seconde. */
  const payments = usePaymentsMode();
  const paiementReel: boolean | null = payments.ready ? payments.live : null;
  const [soldOut, setSoldOut] = useState(false); // 409 pendant le paiement

  // livraison — choisie avant paiement (Vinted-like)
  const [method, setMethod] = useState<ShipMethodId>("mondial_relay");
  /* Le point relais appartient au réseau pour lequel il a été choisi : un
     relais Mondial Relay ne vaut pas pour le réseau Pickup. */
  const [relayPick, setRelayPick] = useState<{
    method: ShipMethodId;
    point: RelayChoice;
  } | null>(null);
  const relay = relayPick?.method === method ? relayPick.point : null;
  const [pickerOpen, setPickerOpen] = useState(false);
  // adresse — domicile (Chronopost) uniquement, revalidée serveur (lot 1)
  const [addrName, setAddrName] = useState("");
  const [addrLine, setAddrLine] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const ship = shipOption(method);
  const needsRelay = ship.relay && !relay;
  const needsAddress =
    !ship.relay &&
    !(
      addrName.trim() &&
      addrLine.trim() &&
      addrPostal.trim() &&
      addrCity.trim()
    );
  const relayLabel = ship.relay && relay ? relayLabelFor(relay) : undefined;
  const shippingLabel = relayLabel
    ? `${ship.carrier} · ${relayLabel}`
    : ship.carrier;

  /* Ce qui empêche de payer ET que l'acheteur peut corriger. Le bouton
     reste atteignable (aria-disabled) : il dit ce qui manque, et un appui
     amène au premier point à corriger. */
  const uid = useId();
  const ids = {
    relay: `${uid}-relais`,
    name: `${uid}-nom`,
    line: `${uid}-adresse`,
    postal: `${uid}-cp`,
    city: `${uid}-ville`,
    cgv: `${uid}-cgv`,
    login: `${uid}-connexion`,
    hint: `${uid}-manque`,
    ship: `${uid}-livraison`,
  };
  const blockers: Blocker[] = [];
  if (needsRelay)
    blockers.push({
      key: "relay",
      hint: `choisis un point relais ${ship.carrier}`,
      error: "Choisis un point relais pour continuer.",
      target: ids.relay,
    });
  if (needsAddress)
    blockers.push({
      key: "address",
      hint: "complète l'adresse de livraison",
      error: "Complète l'adresse de livraison pour continuer.",
      target:
        (
          [
            [addrName, ids.name],
            [addrLine, ids.line],
            [addrPostal, ids.postal],
            [addrCity, ids.city],
          ] as const
        ).find(([v]) => !v.trim())?.[1] ?? ids.name,
    });
  if (!cgvAccepted)
    blockers.push({
      key: "cgv",
      hint: "accepte les conditions de vente",
      error: "Accepte les conditions de vente pour payer.",
      target: ids.cgv,
    });
  /* En paiement réel, un invité ne peut pas payer : il n'y aurait
     personne à qui rattacher la commande, ni à qui rembourser. */
  if (authReady && !user && paiementReel)
    blockers.push({
      key: "login",
      hint: "connecte-toi",
      error: "Connecte-toi pour acheter cette pièce.",
      target: ids.login,
    });
  const [blockedKey, setBlockedKey] = useState<Blocker["key"] | null>(null);
  // l'erreur « il manque… » s'efface d'elle-même une fois corrigée
  const shownError =
    error ?? blockers.find((b) => b.key === blockedKey)?.error ?? null;

  const alreadySold = isSold(item.id);

  /* Commande enregistrée : le bouton Payer, qui avait le focus, disparaît.
     Le titre le reprend, pour que VoiceOver lise la confirmation au lieu
     de repartir du haut de la page. */
  const doneTitleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step === "done") doneTitleRef.current?.focus();
  }, [step]);

  /* Montants calculés par la MÊME fonction que le serveur
     (src/lib/payments.ts). Le client faisait son propre calcul —
     arrondi(5 %) + 0,70 € — quand le serveur prenait 5 % pile : sur une
     pièce à 250 €, la page affichait 267,60 € et le paiement aurait débité
     266,40 €. Un prix affiché doit être le prix payé, au centime. */
  const m = montants(toCents(item.priceEUR), toCents(ship.priceEUR));
  const price = toEur(m.priceCents);
  const protection = toEur(m.serviceCents);
  const shipping = toEur(m.shippingCents);
  const total = toEur(m.totalCents);
  // ce que le vendeur touche SUR LE PRIX (hors port, qu'il reverse au transporteur)
  const net = toEur(m.priceCents - m.commissionCents);
  const ratePct = (m.rateBps / 100).toLocaleString("fr-FR");

  const signIn = () => {
    try {
      localStorage.removeItem("solange:onboarded");
    } catch {
      /* stockage indisponible — la reconnexion suffit */
    }
    location.reload();
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      step !== "form" ||
      soldOut ||
      alreadySold ||
      !authReady ||
      paiementReel === null
    )
      return;
    setError(null);
    const first = blockers[0];
    if (first) {
      setBlockedKey(first.key);
      document.getElementById(first.target)?.focus();
      return;
    }
    setBlockedKey(null);
    setStep("processing");

    /* ---- invité : démo locale, rien n'est sauvegardé ---- */
    if (!user) {
      const id = identifiantDemo();
      setTimeout(() => {
        setOrderId(id);
        addOrder({
          id,
          item,
          protection,
          shipping,
          total,
          last4: "4242",
          shippingLabel,
          date: new Date().toLocaleDateString("fr-FR"),
        });
        setStep("done");
      }, 1700);
      return;
    }

    /* ---- membre connecté : le serveur recalcule tout ---- */
    const res = await api.order(
      item.id,
      method,
      relayLabel,
      ship.relay
        ? undefined
        : {
            name: addrName.trim(),
            line: addrLine.trim(),
            postal: addrPostal.trim(),
            city: addrCity.trim(),
          },
      cgvAccepted,
    );
    if (res.ok && res.data.checkoutUrl) {
      /* Paiement réel : la saisie de carte se fait chez Stripe, sur sa page
         sécurisée. SOLANGE ne voit jamais le numéro. Le retour se fait sur
         la page commande, qui attend la confirmation de la banque. */
      window.location.assign(res.data.checkoutUrl);
      return;
    }
    if (res.ok) {
      const order = res.data.order;
      setServerOrder(order);
      setOrderId(order.id);
      addOrder({
        id: order.id,
        item,
        protection: order.protectionEUR,
        shipping: order.shippingEUR,
        total: order.totalEUR,
        last4: "démo",
        shippingLabel: order.shippingLabel ?? shippingLabel,
        date: new Date().toLocaleDateString("fr-FR"),
      });
      void refreshProducts();
      setStep("done");
      return;
    }
    if (res.status === 409) {
      // le serveur dit pourquoi : vendue, réservée, ou vendeur non activé
      setSoldOut(!/paiements|réessaie/.test(res.error));
      setError(res.error);
      void refreshProducts();
    } else if (res.status === 401) {
      setError("Session expirée — reconnecte-toi pour finaliser la commande.");
      void refreshSession();
    } else {
      setError(res.error);
    }
    setStep("form");
  };

  /* ---------------- success ---------------- */
  if (step === "done") {
    const paidTotal = serverOrder ? serverOrder.totalEUR : total;
    const paidProtection = serverOrder ? serverOrder.protectionEUR : protection;
    const paidShipping = serverOrder ? serverOrder.shippingEUR : shipping;
    const paidPrice = serverOrder ? serverOrder.priceEUR : price;

    return (
      <PageShell>
        <div className="mx-auto max-w-md">
          <div className="flex justify-center">
            <Stamp>Payée</Stamp>
          </div>

          <h1
            ref={doneTitleRef}
            tabIndex={-1}
            className="font-display mt-6 text-center text-3xl font-bold uppercase tracking-tight text-bone"
          >
            Commande enregistrée
          </h1>
          <p className="mt-2 text-center text-[13px] text-ash">
            Commande <span className="text-bone">{orderId}</span> ·{" "}
            {euro(paidTotal)}
            {paiementReel === false && " · paiement simulé"}
          </p>
          {!serverOrder && (
            <p className="mt-1.5 text-center text-[11.5px] text-ash">
              Démo locale (non sauvegardée) — cette commande disparaîtra au
              rechargement.
            </p>
          )}

          <div className="glass mt-7 flex items-center gap-3 rounded-2xl p-3">
            <span
              className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
              style={{ background: gradientFor(item.id) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgItem(item.id)}
                alt={item.name}
                className="size-full object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ash">{item.brand}</p>
              <p className="font-display truncate text-[15px] font-semibold tracking-tight text-bone">
                {item.name}
              </p>
              <p className="mt-0.5 text-[11px] text-ash">
                Taille {item.size} · {item.condition}
              </p>
            </div>
          </div>

          {/* montants (serveur si connecté, locaux en démo invité) */}
          <dl className="mt-4 space-y-2 rounded-2xl border border-bone/10 p-4 text-[13px]">
            <Row label="Article">{euro(paidPrice)}</Row>
            <Row label="Protection acheteur">{euro(paidProtection)}</Row>
            <Row label={`Livraison · ${ship.carrier}`}>
              {euro(paidShipping)}
            </Row>
            {relayLabel && (
              <div className="text-[11.5px] text-ash">
                <dt className="sr-only">Point relais</dt>
                <dd className="flex items-start gap-1.5 break-words">
                  <Pin className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0">{relayLabel}</span>
                </dd>
              </div>
            )}
            {/* filet porté par la ligne Total : un <dl> ne contient que
                des groupes dt/dd */}
            <div className="flex items-center justify-between border-t border-bone/10 pt-1">
              <dt className="font-semibold text-bone">Total</dt>
              <dd className="font-display text-xl font-bold tracking-tight text-bone">
                {euro(paidTotal)}
              </dd>
            </div>
          </dl>

          {paiementReel === false && (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-bone/12 bg-bone/[0.03] px-4 py-3 text-[12.5px] text-ash">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-bone/10">
                <Bag className="size-4 text-bone" />
              </span>
              Paiement simulé — aucun débit réel n&apos;a été effectué.
            </div>
          )}

          <div className="mt-7 flex flex-col gap-3">
            <Button href="/profil" size="lg">
              Voir mes commandes
            </Button>
            <Link
              href="/"
              className="glass rounded-full py-3.5 text-center text-sm font-semibold text-bone transition-colors hover:bg-bone/10"
            >
              Retour au feed
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ---------------- déjà vendue (au chargement) ---------------- */
  if (alreadySold && !soldOut) {
    return (
      <PageShell>
        <Link
          href={`/article/${item.id}`}
          data-cursor="link"
          aria-label="Retour"
          className="glass mb-5 inline-grid size-11 place-items-center rounded-full text-bone transition-transform active:scale-90"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <div className="mx-auto max-w-md">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-bone">
            Déjà vendue
          </h1>
          <p className="mt-2 text-[13px] text-ash">
            Cette pièce a trouvé preneur avant toi — elle n&apos;est plus
            disponible à l&apos;achat.
          </p>

          <div className="glass mt-6 flex items-center gap-3 rounded-2xl p-3 opacity-70">
            <span
              className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
              style={{ background: gradientFor(item.id) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgItem(item.id)}
                alt={item.name}
                className="size-full object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ash">{item.brand}</p>
              <p className="font-display truncate text-[16px] font-semibold tracking-tight text-bone">
                {item.name}
              </p>
              <p className="mt-0.5 text-[11px] text-ash">
                Taille {item.size} · {euro(price)}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-bone/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ash">
              Vendue
            </span>
          </div>

          <div className="mt-7 flex flex-col gap-3">
            <Button href="/" size="lg">
              Retour au feed
            </Button>
            <Link
              href={`/article/${item.id}`}
              className="glass rounded-full py-3.5 text-center text-sm font-semibold text-bone transition-colors hover:bg-bone/10"
            >
              Revoir la pièce
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ---------------- checkout form ---------------- */
  return (
    <PageShell>
      <Link
        href={`/article/${item.id}`}
        data-cursor="link"
        aria-label="Retour"
        className="glass mb-5 inline-grid size-11 place-items-center rounded-full text-bone transition-transform active:scale-90"
      >
        <ArrowLeft className="size-5" />
      </Link>

      <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-bone">
        Paiement
      </h1>

      {/* Bandeau test — honnête : seulement quand le serveur a confirmé
          que rien de réel n'est débité (jamais en paiement réel), ou que la
          clé Stripe est une clé de test. */}
      {(paiementReel === false || payments.test) && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-bone/20 bg-bone/[0.04] px-3.5 py-2.5">
          <span className="rounded-md bg-bone px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink">
            Test
          </span>
          <p className="text-[11.5px] leading-tight text-ash">
            {paiementReel === false ? (
              <>
                Simulation <span className="text-bone">Stripe Connect</span> —
                aucun paiement réel n&apos;est effectué.
              </>
            ) : (
              <>
                <span className="text-bone">Stripe</span> en mode test : paie
                avec une carte de test Stripe.
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)]">
        {/* ---- order summary + livraison (avant le paiement) ---- */}
        <section className="order-1 min-w-0 lg:order-1">
          <div className="glass flex items-center gap-3 rounded-2xl p-3">
            <span
              className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
              style={{ background: gradientFor(item.id) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgItem(item.id)}
                alt={item.name}
                className="size-full object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ash">{item.brand}</p>
              <p className="font-display truncate text-[16px] font-semibold tracking-tight text-bone">
                {item.name}
              </p>
              <p className="mt-0.5 text-[11px] text-ash">
                Taille {item.size} · {item.condition}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-ash">
                Vendu par <span className="text-bone">@{item.seller}</span>
                <Verified className="size-3 text-bone" />
              </p>
            </div>
          </div>

          {/* ---- livraison : choix du transporteur ---- */}
          <div className="mt-4 rounded-2xl border border-bone/10 p-4">
            <p id={ids.ship} className="etiquette mb-3 text-[11px] text-ash">
              Livraison
            </p>
            {/* choix unique : de vrais boutons radio (flèches, « 1 sur 3,
                coché »), posés sur toute la carte et transparents */}
            <div
              role="radiogroup"
              aria-labelledby={ids.ship}
              className="flex flex-col gap-2"
            >
              {SHIP_OPTIONS.map((o) => {
                const on = method === o.id;
                return (
                  <label
                    key={o.id}
                    className={`relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      on
                        ? "border-bone bg-bone/[0.06]"
                        : "border-bone/12 bg-bone/[0.02] hover:border-bone/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name={ids.ship}
                      value={o.id}
                      checked={on}
                      onChange={() => setMethod(o.id)}
                      className="absolute inset-0 size-full cursor-pointer appearance-none rounded-xl"
                    />
                    <span
                      aria-hidden="true"
                      className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                        on ? "border-bone" : "border-bone/30"
                      }`}
                    >
                      {on && <span className="size-2.5 rounded-full bg-bone" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-display block text-[14px] font-semibold tracking-tight text-bone">
                        {o.carrier}
                      </span>
                      <span className="block text-[11.5px] text-ash">
                        {o.label} · {o.eta}
                      </span>
                    </span>
                    <span className="font-display shrink-0 text-[14px] font-bold tabular-nums text-bone">
                      {euro(o.priceEUR)}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* point relais — pour Mondial Relay / Point Relais */}
            {ship.relay && (
              <button
                id={ids.relay}
                type="button"
                onClick={() => setPickerOpen(true)}
                className={`mt-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  relay
                    ? "border-bone/20 bg-bone/[0.03]"
                    : "border-dashed border-bone/40 bg-transparent hover:border-bone/60"
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bone/10 text-bone">
                  <Pin className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  {relay ? (
                    <>
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-bone">
                        <Check className="size-3.5 shrink-0" /> {relay.name}
                      </span>
                      <span className="block break-words text-[11.5px] text-ash">
                        {relayAddressLine(relay)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[13px] font-semibold text-bone">
                      Choisir un point relais
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[12px] font-medium text-ash">
                  {relay ? "Modifier" : ""}
                </span>
                <ChevronRight className="size-4 shrink-0 text-ash" />
              </button>
            )}

            {/* domicile (Chronopost) : adresse requise — le vendeur en aura
                besoin pour expédier (lot 1) ; validée aussi côté serveur */}
            {!ship.relay && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor={ids.name}>Nom complet</FieldLabel>
                  <input
                    id={ids.name}
                    value={addrName}
                    onChange={(e) => setAddrName(e.target.value)}
                    autoComplete="name"
                    className="field w-full"
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor={ids.line}>Adresse</FieldLabel>
                  <input
                    id={ids.line}
                    value={addrLine}
                    onChange={(e) => setAddrLine(e.target.value)}
                    autoComplete="street-address"
                    placeholder="N° et rue"
                    className="field w-full"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={ids.postal}>Code postal</FieldLabel>
                  <input
                    id={ids.postal}
                    value={addrPostal}
                    onChange={(e) => setAddrPostal(e.target.value)}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    className="field w-full"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={ids.city}>Ville</FieldLabel>
                  <input
                    id={ids.city}
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    autoComplete="address-level2"
                    className="field w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* breakdown */}
          <dl className="mt-4 space-y-2 rounded-2xl border border-bone/10 p-4 text-[13px]">
            <Row label="Article">{euro(price)}</Row>
            <Row label="Protection acheteur">{euro(protection)}</Row>
            <Row label={`Livraison · ${ship.carrier}`}>{euro(shipping)}</Row>
            <div className="flex items-center justify-between border-t border-bone/10 pt-1">
              <dt className="font-semibold text-bone">Total</dt>
              <dd className="font-display text-xl font-bold tracking-tight text-bone">
                {euro(total)}
              </dd>
            </div>
          </dl>

          {/* Stripe Connect split */}
          <div className="mt-3 rounded-2xl border border-bone/10 bg-bone/[0.02] p-4">
            <p className="etiquette mb-2 text-[11px] text-ash">
              Répartition · Stripe Connect
            </p>
            <dl>
              <Row label={`Le vendeur reçoit`}>{euro(net)}</Row>
              <Row label={`Commission SOLANGE (${ratePct} %)`}>
                {euro(price - net)}
              </Row>
            </dl>
          </div>
        </section>

        {/* ---- payment card ---- */}
        <section className="order-2 min-w-0 lg:order-2">
          <form
            onSubmit={(e) => void pay(e)}
            className="rounded-3xl border border-bone/12 bg-coal/70 p-5 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-bone">
                <Card className="size-4" /> Carte bancaire
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ash">
                via Stripe
              </span>
            </div>

            {paiementReel ? (
              /* Paiement réel : aucun champ de carte ici. La saisie se fait
                 sur la page Stripe, à l'étape suivante — SOLANGE ne voit ni
                 ne stocke jamais un numéro de carte. */
              <div
                role="note"
                className="mb-1 rounded-xl border border-bone/25 bg-bone/[0.05] px-3.5 py-3"
              >
                <p className="text-[12.5px] font-semibold leading-snug text-bone">
                  Paiement sécurisé par Stripe
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-ash">
                  Tu saisiras ta carte sur la page Stripe à l&apos;étape
                  suivante. Carte bancaire, Apple Pay et Google Pay acceptés.
                  SOLANGE ne voit jamais ton numéro de carte.
                </p>
                {/* durée de la réservation : RESERVATION_MS dans
                    netlify/functions/orders.mts */}
                <p className="mt-1.5 text-[11.5px] leading-snug text-ash">
                  La pièce t&apos;est réservée 30 minutes le temps du paiement.
                </p>
              </div>
            ) : paiementReel === false ? (
              <>
                {/* Encart sécurité — AVANT les champs, très visible. */}
                <div
                  role="note"
                  className="mb-4 rounded-xl border-2 border-bone/50 bg-bone/[0.08] px-3.5 py-3"
                >
                  <p className="text-[12.5px] font-semibold leading-snug text-bone">
                    Paiement simulé — aucun débit.
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ash">
                    N&apos;entre jamais une vraie carte : les champs ci-dessous
                    sont figés sur une carte de démonstration.
                  </p>
                </div>

                <Field label="Numéro de carte">
                  <div className="relative">
                    <input
                      readOnly
                      autoComplete="off"
                      value={DEMO_CARD}
                      className="field pr-14 text-bone/80"
                      aria-label="Numéro de carte (démo, non modifiable)"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-wide text-bone/75">
                      VISA
                    </span>
                  </div>
                </Field>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Expiration">
                    <input
                      readOnly
                      autoComplete="off"
                      value={DEMO_EXP}
                      className="field text-bone/80"
                      aria-label="Date d'expiration (démo, non modifiable)"
                    />
                  </Field>
                  <Field label="CVC">
                    <input
                      readOnly
                      autoComplete="off"
                      value={DEMO_CVC}
                      className="field text-bone/80"
                      aria-label="Cryptogramme CVC (démo, non modifiable)"
                    />
                  </Field>
                </div>

                <Field label="Nom sur la carte" className="mt-3">
                  <input
                    readOnly
                    autoComplete="off"
                    value={DEMO_NAME}
                    className="field text-bone/80"
                    aria-label="Nom sur la carte (démo, non modifiable)"
                  />
                </Field>
              </>
            ) : payments.failed ? (
              /* Pas de réponse : on ne sait pas si le paiement est réel, donc
                 on n'affirme rien et on ne laisse pas payer. */
              <div className="mb-1 rounded-xl border border-bone/25 bg-bone/[0.05] px-3.5 py-3">
                <p className="text-[12.5px] font-semibold leading-snug text-bone">
                  Le paiement n&apos;a pas pu être préparé.
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-ash">
                  Vérifie ta connexion, puis réessaie.
                </p>
                <button
                  type="button"
                  onClick={retryPaymentsMode}
                  className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-full border border-bone/25 px-4 text-[13px] font-semibold text-bone transition-colors active:bg-bone/10"
                >
                  Réessayer
                </button>
              </div>
            ) : null}

            {shownError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-bone/25 bg-bone/[0.05] px-3.5 py-2.5 text-[12.5px] leading-snug text-bone"
              >
                {shownError}
              </div>
            )}

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input
                id={ids.cgv}
                type="checkbox"
                checked={cgvAccepted}
                onChange={(e) => setCgvAccepted(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-bone"
              />
              <span className="text-[12.5px] leading-relaxed text-bone/80">
                J&apos;accepte les{" "}
                <Link
                  href="/cgv"
                  className="text-bone underline underline-offset-4"
                >
                  conditions de vente
                </Link>
                . La vente se conclut avec le vendeur, pas avec SOLANGE
                {paiementReel ? (
                  <>
                    . Le paiement est encaissé par Stripe, et la part du vendeur
                    lui est versée directement.
                  </>
                ) : paiementReel === false ? (
                  <>
                    , et{" "}
                    <span className="font-semibold text-bone">
                      ce paiement est simulé
                    </span>{" "}
                    : aucune somme n&apos;est débitée.
                  </>
                ) : (
                  "."
                )}
              </span>
            </label>

            <Button
              type="submit"
              size="lg"
              disabled={
                step === "processing" ||
                soldOut ||
                !authReady ||
                paiementReel === null
              }
              aria-disabled={blockers.length > 0 || undefined}
              aria-describedby={
                blockers.length > 0 && !soldOut ? ids.hint : undefined
              }
              className="mt-4 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
            >
              <AnimatePresence mode="wait" initial={false}>
                {soldOut ? (
                  <motion.span
                    key="sold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Déjà vendue
                  </motion.span>
                ) : step === "processing" ? (
                  <motion.span
                    key="proc"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                    {paiementReel
                      ? "Ouverture du paiement…"
                      : "Enregistrement…"}
                  </motion.span>
                ) : (
                  <motion.span
                    key="pay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Lock className="size-4" /> Payer {euro(total)}
                    {paiementReel === false ? " (simulé)" : ""}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>

            {/* ce qui manque, lu avec le bouton (aria-describedby) */}
            {blockers.length > 0 && !soldOut && (
              <p
                id={ids.hint}
                className="mt-2 text-center text-[11.5px] text-ash"
              >
                Pour payer, {joinFr(blockers.map((b) => b.hint))}.
              </p>
            )}

            {/* Invité : démo locale (paiement simulé) ou connexion requise. */}
            {authReady && !user && (
              <div className="mt-4 rounded-xl border border-bone/12 bg-bone/[0.03] p-3.5">
                <p className="text-[11.5px] leading-snug text-ash">
                  {paiementReel === false ? (
                    <>
                      Mode invité — la commande sera une{" "}
                      <span className="text-bone">
                        démo locale (non sauvegardée)
                      </span>
                      . Connecte-toi pour l&apos;enregistrer sur ton compte.
                    </>
                  ) : (
                    <>
                      Connecte-toi pour acheter cette pièce : la commande est
                      rattachée à ton compte.
                    </>
                  )}
                </p>
                <button
                  id={ids.login}
                  type="button"
                  onClick={signIn}
                  className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-full border border-bone/25 px-4 text-[13px] font-semibold text-bone transition-colors active:bg-bone/10"
                >
                  Se connecter / créer un compte
                </button>
              </div>
            )}

            {paiementReel === false && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ash">
                <Lock className="size-3" /> Démo — aucune donnée bancaire
                n&apos;est saisie ni transmise
              </p>
            )}
          </form>
        </section>
      </div>

      {/* Paiement réel (ou pas encore confirmé simulé) : jamais de faux
          points relais — saisie depuis le localisateur du transporteur. */}
      <RelayPicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          // retour au bouton « Choisir un point relais », choix fait ou non
          document.getElementById(ids.relay)?.focus();
        }}
        carrier={ship.carrier}
        locator={ship.locator}
        manual={paiementReel !== false}
        selectedId={relay?.id}
        onSelect={(point) => setRelayPick({ method, point })}
      />
    </PageShell>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ash">{label}</dt>
      <dd className="tabular-nums text-bone/90">{children}</dd>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="etiquette mb-1.5 block text-[11px] text-ash">
        {label}
      </span>
      {children}
    </label>
  );
}
