/* ============================================================
   SOLANGE — les contrôles d'entrée du serveur, en fonctions pures.

   Pourquoi ce module. Les défauts relevés à l'audit du 1er septembre
   étaient tous dans des expressions d'une ligne enfouies dans des
   fonctions Netlify que la suite de tests ne voyait pas : un accès
   d'objet non borné, un identifiant non validé, un montant jamais
   vérifié, une boucle d'attribution qui abandonnait en écrivant quand
   même. Sortis ici, ils deviennent testables — et ils le sont.

   Rien dans ce fichier ne touche au réseau ni au stockage : ce sont des
   prédicats. Les effets restent dans les fonctions qui les appellent.
   ============================================================ */

/** Identifiants acceptés là où la valeur sert à construire une clé de
    stockage (`p:${pid}`). On borne le jeu de caractères plutôt que de
    faire confiance au client. */
export function isValidId(v: unknown, max = 80): boolean {
  return (
    typeof v === "string" &&
    v.length > 0 &&
    v.length <= max &&
    /^[A-Za-z0-9._:-]+$/.test(v)
  );
}

/** Lecture d'une table de correspondance par une clé venue du client.
    `table[cle]` seul est piégé : « constructor », « __proto__ » et
    « toString » renvoient des membres hérités, dont les champs attendus
    valent undefined — un prix devenait NaN et un total partait à zéro. */
export function lookupOwn<T>(
  table: Record<string, T>,
  key: unknown,
  fallback: T,
): T {
  if (typeof key !== "string" || !Object.hasOwn(table, key)) return fallback;
  return table[key];
}

/** Un montant qu'on s'apprête à faire payer. Aujourd'hui le paiement est
    simulé et un NaN ne coûte rien ; ce contrôle doit exister AVANT la
    bascule vers un vrai prestataire, pas après. */
export function isPayableAmount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/** Les pseudonymes à tenter, dans l'ordre, pour un nouveau compte.
    Le dernier est dérivé de l'identifiant du compte : unique par
    construction, il garantit que l'attribution finit toujours par
    réussir sans jamais écraser le pseudo de quelqu'un d'autre. */
export function handleCandidates(base: string, userId: string): string[] {
  const socle = base || "membre";
  return [
    socle,
    ...Array.from({ length: 8 }, (_, i) => `${socle}${i + 2}`),
    userId.replace(/^u_/, "membre-"),
  ];
}

/** Échappement HTML unique, appliqué à TOUTE valeur d'origine client qui
    atterrit dans un e-mail. Un échappement par endroit s'oublie au
    premier ajout de champ ; celui-ci est le seul. */
export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Un contenu masqué par la modération doit disparaître de TOUTES les
    surfaces, pas seulement de celle où le masquage a été décidé. */
export function isVisible<T extends Record<string, unknown>>(
  rec: T | null | undefined,
): rec is T {
  return !!rec && !rec.hidden && !rec.shadow;
}
