/* ============================================================
   SOLANGE — commission : SOURCE UNIQUE, en centiemes entiers.

   Pourquoi ce module existe. Le barème vivait en DEUX exemplaires —
   src/lib/utils.ts pour l'affichage, netlify/functions/_shared/seed-catalog.mts
   pour le calcul serveur. Deux copies d'une règle qui décide de combien
   d'argent revient à qui : la première divergence aurait été silencieuse et
   payante. Le fichier order-state.ts avait déjà tranché ce débat pour les
   statuts de commande ; on applique la même règle à l'argent.

   Pourquoi des centimes entiers. Un prix en euros est un flottant, et
   0,1 + 0,2 ne fait pas 0,3 en JavaScript. Tout PSP raisonne en plus petite
   unité monétaire, en entiers. On adopte la même unité au plus tôt : la
   conversion euros → centimes se fait UNE fois, à la création de la commande,
   et le centime devient ensuite la seule vérité.

   Règle d'arrondi : UN SEUL Math.round, sur la commission. La part vendeur
   est la soustraction — jamais un second arrondi, sinon commission + part
   vendeur peut ne plus égaler le total, d'un centime, une fois sur trois.
   ============================================================ */

/** Un palier : à partir de ce montant (centimes, inclus), ce taux s'applique. */
type Palier = { aPartirDeCents: number; bps: number };

/* Taux en points de base (bps) : 400 bps = 4 %. Des entiers, pour que la
   grille elle-même n'introduise aucun flottant. Du plus cher au moins cher :
   le premier palier atteint gagne. */
const PALIERS: Palier[] = [
  { aPartirDeCents: 100_000, bps: 200 }, // 1 000 € et plus → 2 %
  { aPartirDeCents: 50_000, bps: 250 }, //    500 € et plus → 2,5 %
  { aPartirDeCents: 20_000, bps: 350 }, //    200 € et plus → 3,5 %
  { aPartirDeCents: 0, bps: 400 }, //      en dessous → 4 %
];

/** Taux applicable, en points de base. */
export function feeRateBps(amountCents: number): number {
  const c = Math.max(0, Math.trunc(amountCents));
  for (const p of PALIERS) if (c >= p.aPartirDeCents) return p.bps;
  return PALIERS[PALIERS.length - 1].bps;
}

export type Repartition = {
  /** Assiette, en centimes. */
  amountCents: number;
  /** Taux appliqué, en points de base — à GELER sur la commande : un
      changement de grille ne doit toucher aucune commande en vol. */
  rateBps: number;
  /** Commission SOLANGE, en centimes. */
  feeCents: number;
  /** Ce qui revient au vendeur, en centimes. feeCents + sellerCents === amountCents. */
  sellerCents: number;
};

/** Répartit un montant entre commission et vendeur. Le seul endroit du code
    où un arrondi de commission a le droit d'exister. */
export function splitFee(
  amountCents: number,
  rateBpsOverride?: number,
): Repartition {
  const amount = Math.max(0, Math.trunc(amountCents));
  const rateBps = rateBpsOverride ?? feeRateBps(amount);
  const feeCents = Math.round((amount * rateBps) / 10_000);
  return {
    amountCents: amount,
    rateBps,
    feeCents,
    sellerCents: amount - feeCents,
  };
}

/* ---- passerelles euros, pour l'affichage uniquement ---- */

/** Conversion euros → centimes. À n'appeler QU'UNE fois par commande, à sa
    création : ensuite, c'est le centime qui fait foi. */
export function toCents(eur: number): number {
  return Math.round(eur * 100);
}

export function toEur(cents: number): number {
  return cents / 100;
}

/** Taux en fraction (0,04) — pour l'affichage « 4 % ». */
export function feeRate(amountEur: number): number {
  return feeRateBps(toCents(amountEur)) / 10_000;
}
