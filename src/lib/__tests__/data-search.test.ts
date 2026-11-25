import { describe, expect, it } from "vitest";
import { searchAll } from "@/lib/data";
import { articles } from "@/lib/journal";

describe("searchAll", () => {
  /* L'onglet « Looks » du Marché affiche `content` tel quel : un article du
     Journal qui s'y glisserait serait listé comme un look. Le titre est pris
     dans le Journal lui-même, pas dans la vitrine de démonstration. */
  it("ne rend jamais un article du Journal dans les contenus", () => {
    const { title } = articles[0];
    const ids = searchAll(title).content.map((h) => h.id);
    expect(ids.filter((id) => articles.some((a) => a.id === id))).toEqual([]);
  });
});
