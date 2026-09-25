import { describe, expect, it, vi } from "vitest";
import { intentOnLeave, shouldPlay } from "@/components/feed/MemberVideo";
import {
  photoLabel,
  slideAt,
  wrapSlide,
} from "@/components/feed/CarouselMedia";
import { shareOrCopy } from "@/components/feed/RailAction";

/* Fil Looks / Pièces (lot E) : la logique pure derrière la lecture vidéo,
   le carrousel et le partage. */

describe("shouldPlay — lecture auto vs lecture demandée (VID-2)", () => {
  const base = { active: true, reduce: false, saveData: false } as const;

  it("lit tout seul par défaut, sur la carte active", () => {
    expect(shouldPlay({ ...base, intent: "auto" })).toBe(true);
  });

  it("« Réduire les animations » coupe la lecture AUTO…", () => {
    expect(shouldPlay({ ...base, reduce: true, intent: "auto" })).toBe(false);
  });

  it("… mais pas la lecture demandée", () => {
    expect(shouldPlay({ ...base, reduce: true, intent: "play" })).toBe(true);
  });

  it("l'économiseur de données suit la même règle", () => {
    expect(shouldPlay({ ...base, saveData: true, intent: "auto" })).toBe(
      false,
    );
    expect(shouldPlay({ ...base, saveData: true, intent: "play" })).toBe(true);
  });

  it("une pause demandée l'emporte sur la lecture auto", () => {
    expect(shouldPlay({ ...base, intent: "pause" })).toBe(false);
  });

  it("une carte hors écran ne joue jamais, même demandée", () => {
    expect(shouldPlay({ ...base, active: false, intent: "play" })).toBe(false);
  });
});

describe("intentOnLeave — carte quittée", () => {
  it("une lecture demandée ne redevient pas une lecture auto au retour", () => {
    expect(intentOnLeave("play")).toBe("auto");
  });

  it("une pause reste une pause", () => {
    expect(intentOnLeave("pause")).toBe("pause");
    expect(intentOnLeave("auto")).toBe("auto");
  });

  it("sous « Réduire les animations », revenir sur la carte ne relance rien", () => {
    const back = intentOnLeave("play");
    expect(
      shouldPlay({ active: true, intent: back, reduce: true, saveData: false }),
    ).toBe(false);
  });
});

describe("carrousel — position et libellés (TAC-5, CAR-1)", () => {
  it("déduit la photo du défilement, bornée à la galerie", () => {
    expect(slideAt(0, 375, 4)).toBe(0);
    expect(slideAt(375 * 2 + 10, 375, 4)).toBe(2);
    // rebond élastique d'iOS au-delà des bords
    expect(slideAt(-80, 375, 4)).toBe(0);
    expect(slideAt(375 * 5, 375, 4)).toBe(3);
  });

  it("ne divise jamais par zéro (carte pas encore mesurée)", () => {
    expect(slideAt(120, 0, 4)).toBe(0);
    expect(slideAt(120, 375, 0)).toBe(0);
  });

  it("précédente / suivante bouclent", () => {
    expect(wrapSlide(4, 4)).toBe(0);
    expect(wrapSlide(-1, 4)).toBe(3);
    expect(wrapSlide(2, 4)).toBe(2);
    expect(wrapSlide(1, 0)).toBe(0);
  });

  it("dit « Photo i sur N », jamais une fraction", () => {
    expect(photoLabel(0, 3)).toBe("Photo 1 sur 3");
    expect(photoLabel(2, 3)).toBe("Photo 3 sur 3");
    expect(photoLabel(1, 4)).not.toMatch(/\//);
  });
});

describe("shareOrCopy — Partager n'est plus inerte (SEM-7)", () => {
  const data = { title: "Maison — Pièce", url: "https://solange.test/a/1" };

  it("utilise la feuille de partage native quand elle existe", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    await expect(
      shareOrCopy(data, { share, clipboard: { writeText } }),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("feuille fermée par la personne : ni erreur ni copie", async () => {
    const abort = Object.assign(new Error("annulé"), { name: "AbortError" });
    const writeText = vi.fn();
    const outcome = await shareOrCopy(data, {
      share: vi.fn().mockRejectedValue(abort),
      clipboard: { writeText },
    });
    expect(outcome).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("partage refusé : se rabat sur la copie du lien", async () => {
    const denied = Object.assign(new Error("refusé"), {
      name: "NotAllowedError",
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    const outcome = await shareOrCopy(data, {
      share: vi.fn().mockRejectedValue(denied),
      clipboard: { writeText },
    });
    expect(outcome).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("sans partage natif (Firefox ordinateur) : copie le lien", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(
      shareOrCopy(data, { clipboard: { writeText } }),
    ).resolves.toBe("copied");
  });

  it("respecte canShare quand le navigateur le fournit", async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const outcome = await shareOrCopy(data, {
      share,
      canShare: () => false,
      clipboard: { writeText },
    });
    expect(share).not.toHaveBeenCalled();
    expect(outcome).toBe("copied");
  });

  it("ni partage ni presse-papiers : échec signalé, jamais levé", async () => {
    await expect(shareOrCopy(data, {})).resolves.toBe("failed");
    await expect(
      shareOrCopy(data, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error("x")) },
      }),
    ).resolves.toBe("failed");
  });
});
