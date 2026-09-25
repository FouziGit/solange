import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NO_ANNOUNCEMENT,
  announce,
  createAnnouncer,
  enqueue,
  regionText,
} from "../announce";

const NBSP = " ";

describe("enqueue — file sans vide ni doublon", () => {
  it("ajoute un message, espaces normalisés", () => {
    expect(enqueue([], "  Annonce   en ligne ")).toEqual(["Annonce en ligne"]);
  });

  it("ignore un message vide ou blanc", () => {
    expect(enqueue(["Copié"], "")).toEqual(["Copié"]);
    expect(enqueue(["Copié"], "   ")).toEqual(["Copié"]);
  });

  it("ignore un doublon déjà en attente", () => {
    expect(enqueue(["Copié"], "Copié")).toEqual(["Copié"]);
    expect(enqueue(["Copié"], " Copié ")).toEqual(["Copié"]);
  });

  it("ne modifie pas la file reçue", () => {
    const q = ["A"];
    enqueue(q, "B");
    expect(q).toEqual(["A"]);
  });
});

describe("regionText — ce que lit le lecteur d'écran", () => {
  it("un message seul est posé tel quel", () => {
    expect(regionText("", ["Copié"])).toBe("Copié");
  });

  it("plusieurs messages deviennent des phrases distinctes", () => {
    expect(regionText("", ["Photo retirée", "3 photos restantes."])).toBe(
      "Photo retirée. 3 photos restantes.",
    );
  });

  it("le même texte qu'affiché change quand même, pour être relu", () => {
    expect(regionText("Copié", ["Copié"])).toBe(`Copié${NBSP}`);
    expect(regionText(`Copié${NBSP}`, ["Copié"])).toBe("Copié");
  });

  it("une file vide ne produit rien", () => {
    expect(regionText("Copié", [])).toBe("");
  });
});

describe("createAnnouncer — regroupement, doublons, effacement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("n'écrit qu'après le délai de regroupement, et prévient les abonnés", () => {
    const a = createAnnouncer({ flushDelay: 100 });
    const listener = vi.fn();
    a.subscribe(listener);
    a.announce("Annonce en ligne");
    expect(a.getSnapshot()).toEqual(NO_ANNOUNCEMENT);
    vi.advanceTimersByTime(100);
    expect(a.getSnapshot()).toEqual({
      polite: "Annonce en ligne",
      assertive: "",
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("deux annonces identiques du même instant ne sont lues qu'une fois", () => {
    const a = createAnnouncer({ flushDelay: 100 });
    const listener = vi.fn();
    a.subscribe(listener);
    a.announce("Copié");
    a.announce("Copié");
    vi.advanceTimersByTime(100);
    expect(a.getSnapshot().polite).toBe("Copié");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("des annonces distinctes du même instant sont regroupées, dans l'ordre", () => {
    const a = createAnnouncer({ flushDelay: 100 });
    a.announce("Photo retirée");
    a.announce("Ajoute des photos");
    vi.advanceTimersByTime(100);
    expect(a.getSnapshot().polite).toBe("Photo retirée. Ajoute des photos.");
  });

  it("le même message annoncé plus tard est relu", () => {
    const a = createAnnouncer({ flushDelay: 100, clearDelay: 7000 });
    a.announce("Copié");
    vi.advanceTimersByTime(100);
    const first = a.getSnapshot().polite;
    a.announce("Copié");
    vi.advanceTimersByTime(100);
    expect(a.getSnapshot().polite).not.toBe(first);
    expect(a.getSnapshot().polite.trim()).toBe("Copié");
  });

  it("poli et assertif ont chacun leur région", () => {
    const a = createAnnouncer({ flushDelay: 100 });
    a.announce("Annonce en ligne");
    a.announce("Message non envoyé", "assertive");
    vi.advanceTimersByTime(100);
    expect(a.getSnapshot()).toEqual({
      polite: "Annonce en ligne",
      assertive: "Message non envoyé",
    });
  });

  it("le texte s'efface après le délai, et le délai repart à chaque annonce", () => {
    const a = createAnnouncer({ flushDelay: 100, clearDelay: 7000 });
    a.announce("Premier");
    vi.advanceTimersByTime(100 + 6000);
    a.announce("Second");
    vi.advanceTimersByTime(100 + 6000);
    expect(a.getSnapshot().polite).toBe("Second");
    vi.advanceTimersByTime(1000);
    expect(a.getSnapshot().polite).toBe("");
  });

  it("un message vide n'écrit rien", () => {
    const a = createAnnouncer({ flushDelay: 100 });
    const listener = vi.fn();
    a.subscribe(listener);
    a.announce("  ");
    vi.advanceTimersByTime(1000);
    expect(listener).not.toHaveBeenCalled();
    expect(a.getSnapshot()).toEqual(NO_ANNOUNCEMENT);
  });

  it("un abonné désinscrit n'est plus prévenu", () => {
    const a = createAnnouncer({ flushDelay: 100 });
    const listener = vi.fn();
    const off = a.subscribe(listener);
    off();
    a.announce("Copié");
    vi.advanceTimersByTime(100);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("announce — sans effet côté serveur", () => {
  it("ne programme rien hors navigateur", () => {
    vi.useFakeTimers();
    announce("Copié");
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
