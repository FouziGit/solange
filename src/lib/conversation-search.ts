/* Messagerie : recherche dans la liste des fils et auteur des bulles,
   sans DOM (testé dans __tests__/conversation-search.test.ts). */
import type { Message } from "@/lib/mock";

/** Casse, accents et espaces en trop ignorés : « Élodie » = « elodie ». */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Fils dont le nom affiché ou le @handle contient la saisie. Un « @ » tapé
    en tête est toléré. Saisie vide : la liste telle quelle. */
export function filterConversations<T extends { name: string; handle: string }>(
  convs: readonly T[],
  query: string,
): readonly T[] {
  const q = fold(query).replace(/^@+/, "");
  if (!q) return convs;
  return convs.filter((c) => fold(`${c.name} ${c.handle}`).includes(q));
}

/** Phrase lue par le lecteur d'écran après une recherche. */
export function searchResultsLabel(count: number): string {
  if (count === 0) return "Aucune conversation trouvée";
  return count === 1
    ? "1 conversation trouvée"
    : `${count} conversations trouvées`;
}

/** Préfixe (masqué à l'écran) qui dit qui parle dans une bulle du fil :
    l'alignement et la couleur ne se lisent pas. */
export function speakerPrefix(from: Message["from"], handle: string): string {
  return from === "me" ? "Toi : " : `@${handle} : `;
}

/** Le fil annoncé « actuel » (aria-current) dans la liste : seulement
    celui que la personne a OUVERT. Sans sélection, un fil de repli
    s'affiche en desktop, mais sur mobile la liste est seule à l'écran :
    y annoncer une conversation « actuelle » était faux, y compris juste
    après « Retour ». */
export function isOpenConversation(
  id: string,
  selectedId: string | null,
): boolean {
  return selectedId !== null && id === selectedId;
}
