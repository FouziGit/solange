/**
 * Label de champ de formulaire — l'étiquette au-dessus de chaque saisie.
 * Primitive unique (remplace les deux copies locales de /vendre et /creer).
 * 11px = plancher de l'échelle typographique (DA §1).
 */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="etiquette mb-2 block text-[11px] text-ash">
      {children}
    </span>
  );
}
