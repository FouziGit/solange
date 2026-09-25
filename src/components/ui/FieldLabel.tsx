/**
 * Label de champ de formulaire — l'étiquette au-dessus de chaque saisie.
 * Primitive unique (remplace les deux copies locales de /vendre et /creer).
 * 11px = plancher de l'échelle typographique (DA §1).
 *
 * - `htmlFor` : rend un vrai <label> relié au champ (`const id = useId()`,
 *   `<FieldLabel htmlFor={id}>` + `<input id={id}>`) — c'est ce que lisent
 *   VoiceOver et Contrôle vocal (« Toucher Code postal »).
 * - sans `htmlFor` : <span> comme avant, pour titrer un groupe (Chips,
 *   photos). `id` permet alors de le citer :
 *   `<div role="radiogroup" aria-labelledby={id}>`.
 */
export function FieldLabel({
  children,
  htmlFor,
  id,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  id?: string;
}) {
  const className = "etiquette mb-2 block text-[11px] text-ash";
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className={className}>
      {children}
    </label>
  ) : (
    <span id={id} className={className}>
      {children}
    </span>
  );
}
