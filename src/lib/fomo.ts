/* ============================================================
   SOLANGE — relance sur les pièces gardées.

   L'idée : quelqu'un qui a gardé une pièce veut savoir si elle commence à
   plaire. C'est une information réelle et utile — et c'est ce qui fait
   décider.

   La ligne qu'on ne franchit pas : on n'invente AUCUN chiffre. Pas de
   « 12 personnes regardent cette pièce », pas de compte à rebours
   fabriqué, pas de « bientôt épuisé » sur une pièce unique qui l'est par
   définition. On dit le nombre vrai de j'aime, ou on ne dit rien. Un
   chiffre gonflé se repère, et le jour où il se repère c'est toute l'app
   qu'on cesse de croire.

   Le rythme : on ne relance qu'aux PALIERS, jamais à chaque j'aime. Une
   pièce qui passe de 4 à 5 j'aime ne mérite pas une notification ; une
   pièce qui atteint 10 en mérite une, et une seule.
   ============================================================ */

/** Paliers de relance. Choisis pour être rares : franchir 3, puis 10, puis
    25 dans la vie d'une pièce, c'est au plus une poignée de notifications.
    Le premier palier est à 3 et non à 1 : un seul j'aime ne dit rien. */
export const PALIERS = [3, 10, 25, 50, 100] as const;

/** Le palier atteint par un compte de j'aime, ou 0 si aucun. */
export function palierAtteint(likes: number): number {
  let p = 0;
  for (const seuil of PALIERS) if (likes >= seuil) p = seuil;
  return p;
}

/** Faut-il relancer ? Oui seulement si un NOUVEAU palier est franchi
    depuis la dernière relance envoyée pour cette pièce. */
export function doitRelancer(
  likes: number,
  dernierPalierNotifie: number,
): boolean {
  const p = palierAtteint(likes);
  return p > 0 && p > dernierPalierNotifie;
}

/** Le texte de la notification. Il porte le chiffre réel et rien d'autre :
    pas d'urgence inventée, pas de « dépêche-toi ». */
export function texteRelance(
  marque: string,
  nom: string,
  likes: number,
): string {
  const piece = `${marque} ${nom}`.trim();
  return likes <= 1
    ? `${piece}, gardée par toi, commence à plaire.`
    : `${piece} plaît : ${likes} personnes l'ont aimée.`;
}

/** Qui prévenir pour une pièce : celles et ceux qui l'ont gardée, sauf son
    propre vendeur — on ne relance personne sur sa propre annonce. */
export function destinataires(
  gardeursParPiece: Map<string, string[]>,
  pieceId: string,
  vendeurId: string | null | undefined,
): string[] {
  return (gardeursParPiece.get(pieceId) ?? []).filter((u) => u !== vendeurId);
}
