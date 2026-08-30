import { describe, expect, it } from "vitest";
import { extractMentions, sortThreads, unreadCircles } from "../circles";

describe("sortThreads", () => {
  it("épinglés d'abord, puis dernière activité descendante", () => {
    const t = (id: string, last: number, pinned = false) => ({
      id,
      lastActivityAt: last,
      pinned,
    });
    const sorted = sortThreads([
      t("vieux", 10),
      t("récent", 30),
      t("épinglé-vieux", 5, true),
      t("moyen", 20),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([
      "épinglé-vieux",
      "récent",
      "moyen",
      "vieux",
    ]);
  });
});

describe("extractMentions", () => {
  it("détecte, déduplique et ignore l'auteur", () => {
    expect(
      extractMentions(
        "Bravo @lou.archive et @samir.fits — @lou.archive tu confirmes ? @moi",
        "moi",
      ),
    ).toEqual(["lou.archive", "samir.fits"]);
  });
  it("aucune mention → liste vide", () => {
    expect(extractMentions("un texte sans arobase")).toEqual([]);
  });
});

describe("unreadCircles", () => {
  it("ne compte que les cercles rejoints avec activité après la visite", () => {
    expect(
      unreadCircles(
        ["cm1", "cm2", "cm3"],
        { cm1: 100, cm2: 50, cm4: 999 },
        { cm1: 90, cm2: 60 },
      ),
    ).toEqual(["cm1"]); // cm2 vu après ; cm3 sans activité ; cm4 non rejoint
  });
});
