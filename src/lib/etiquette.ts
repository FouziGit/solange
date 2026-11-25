/* ============================================================
   SOLANGE — l'étiquette (DA §9) : ce qu'elle compte et ce qu'elle dit.
   Règles PURES, testées dans src/lib/__tests__/etiquette.test.ts.
   ============================================================ */

import { pluriel } from "./marche";
import { conditions } from "./taxonomie";
import { euro } from "./utils";

/** Crans pleins pour un état de taxonomie.conditions : 4 (Neuf avec
    étiquette) à 1 (Bon état). 0 pour un libellé inconnu : aucun cran. */
export function niveauEtat(etat: string): number {
  const position = conditions.findIndex((c) => c === etat.trim());
  return position < 0 ? 0 : conditions.length - position;
}

/** 6 -> « N°07 ». Position dans le fil, à partir de zéro. */
export function numeroPassage(index: number): string {
  return `N°${String(index + 1).padStart(2, "0")}`;
}

/** 1 -> « 1 pièce », 3 -> « 3 pièces ». */
export const nPieces = (n: number) => pluriel(n, "pièce");

/** Ce que lit un lecteur d'écran : « Taille 43, 290 € » ;
    sans prix : « Taille 42, vendue ». */
export function libellePiece(p: { size: string; priceEUR?: number }): string {
  return `Taille ${p.size}, ${p.priceEUR == null ? "vendue" : euro(p.priceEUR)}`;
}

/** « Look numéro 7 » ; avec des pièces, l'étiquette est un bouton et son nom
    commence par le texte affiché (WCAG 2.5.3) : « N°07, 1 pièce : voir la
    pièce du look » ou « N°07, 3 pièces : voir les pièces du look ». */
export function libelleLook(index: number, pieces = 0): string {
  const look = `Look numéro ${index + 1}`;
  if (pieces < 1) return look;
  return `${numeroPassage(index)}, ${nPieces(pieces)} : voir ${pieces > 1 ? "les pièces" : "la pièce"} du look`;
}

/** Ce qui remplace « Acheter » quand la pièce ne s'achète pas ; `null` : elle
    s'achète. Une seule règle pour la fiche et le fil « Pièces ». */
export function etatAchat(p: {
  sold: boolean;
  reserved?: boolean;
  mine?: boolean;
}): "Vendue" | "Paiement en cours" | "Ta pièce" | null {
  if (p.sold) return "Vendue";
  if (p.reserved) return "Paiement en cours";
  return p.mine ? "Ta pièce" : null;
}
