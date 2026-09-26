import { beforeEach, describe, expect, it } from "vitest";
import {
  appendRename,
  readRenameLog,
  renameSocial,
  runHandleSweep,
} from "../handle-migrate.mts";
import { FakeStore } from "./fake-blobs";

/* Quand un membre change d'@handle, les abonnements et blocages des
   autres gardent l'ancien. S'il a choisi le renvoi, le journal
   `hmig/log` et le balayage planifié les remettent à jour ; on vérifie
   qu'ils le font sans rien perdre et sans jamais écrire deux fois la même
   chose. Sans renvoi, rien ne relie l'ancien handle au nouveau. */

const DAY = 86_400_000;
const T0 = Date.now();
/** Changement avec renvoi public. */
const renomme = (from: string, to: string, at = T0 - 1000) => ({
  from,
  to,
  at,
  redirect: true,
});
/** Changement sans renvoi (le choix par défaut). */
const discret = (from: string, to: string, at = T0 - 1000) => ({
  from,
  to,
  at,
});

describe("renameSocial — abonnements et blocages suivent le handle actuel", () => {
  const log = [renomme("jean.dupont", "lou.mercier")];

  it("follows et blocked passent au nouveau handle, le reste est intact", () => {
    const r = renameSocial(
      {
        follows: ["jean.dupont", "maya"],
        blocked: ["Jean.Dupont"],
        liked: ["jean.dupont"],
        saved: ["p_1"],
      },
      log,
    );
    expect(r.changed).toBe(true);
    expect(r.state).toEqual({
      follows: ["lou.mercier", "maya"],
      blocked: ["lou.mercier"],
      liked: ["jean.dupont"], // des ids d'annonces, pas des handles
      saved: ["p_1"],
    });
  });

  it("rien à changer : pas de réécriture", () => {
    const r = renameSocial({ follows: ["maya"], blocked: [] }, log);
    expect(r.changed).toBe(false);
  });

  it("une valeur qui n'est pas du texte est retirée", () => {
    const r = renameSocial({ follows: ["maya", 42, null] }, log);
    expect(r).toEqual({ state: { follows: ["maya"] }, changed: true });
  });

  it("changement sans renvoi : les listes suivent aussi la personne", () => {
    // on garde ses abonnés, et un membre bloqué ne réapparaît pas
    const r = renameSocial(
      { follows: ["jean.dupont"], blocked: ["jean.dupont"] },
      [discret("jean.dupont", "lou.mercier")],
    );
    expect(r).toEqual({
      state: { follows: ["lou.mercier"], blocked: ["lou.mercier"] },
      changed: true,
    });
  });
});

describe("journal des changements — élagué à 30 jours, écrit en CAS", () => {
  let hmig: FakeStore;
  beforeEach(() => {
    hmig = new FakeStore();
  });

  it("premier changement : le journal est créé", async () => {
    await appendRename(renomme("a1", "b1"), hmig);
    expect(await readRenameLog(hmig)).toEqual([renomme("a1", "b1")]);
  });

  it("sans renvoi, l'entrée n'en porte pas la marque", async () => {
    await appendRename({ ...discret("a1", "b1"), redirect: false }, hmig);
    expect(hmig.peek("log")).toEqual([discret("a1", "b1")]);
  });

  it("chaque ajout élague ce qui a plus de 30 jours", async () => {
    hmig.putJSON("log", [renomme("vieux", "neuf", T0 - 31 * DAY)]);
    await appendRename(renomme("a1", "b1"), hmig);
    expect(hmig.peek("log")).toEqual([renomme("a1", "b1")]);
  });

  it("un ajout concurrent n'écrase pas l'autre", async () => {
    let concurrent = true;
    hmig.putJSON("log", []);
    hmig.beforeWrite = () => {
      if (!concurrent) return;
      concurrent = false;
      hmig.putJSON("log", [renomme("x1", "y1")]);
    };
    await appendRename(renomme("a1", "b1"), hmig);
    expect(hmig.peek("log")).toEqual([
      renomme("x1", "y1"),
      renomme("a1", "b1"),
    ]);
  });

  it("la lecture ignore les entrées abîmées et les trop vieilles", async () => {
    hmig.putJSON("log", [
      renomme("a1", "b1"),
      { from: "x" },
      renomme("vieux", "neuf", T0 - 31 * DAY),
    ]);
    expect(await readRenameLog(hmig)).toEqual([renomme("a1", "b1")]);
  });
});

describe("runHandleSweep — balayage des listes des autres membres", () => {
  let hmig: FakeStore;
  let social: FakeStore;
  let t: number;
  const now = () => t;
  const sweep = (budget = 20_000) => runHandleSweep(budget, { hmig, social, now });

  beforeEach(() => {
    t = T0;
    hmig = new FakeStore();
    social = new FakeStore();
    hmig.putJSON("log", [renomme("jean.dupont", "lou.mercier")]);
    social.putJSON("s:u_a", { follows: ["jean.dupont"], liked: ["p_1"] });
    social.putJSON("s:u_b", { blocked: ["Jean.Dupont"] });
    social.putJSON("s:u_c", { follows: ["maya"] });
  });

  it("un passage complet : listes renommées, rien d'inutile écrit, entrée balayée", async () => {
    expect(await sweep()).toEqual({ done: true, scanned: 3 });
    expect(social.peek("s:u_a")).toEqual({
      follows: ["lou.mercier"],
      liked: ["p_1"],
    });
    expect(social.peek("s:u_b")).toEqual({ blocked: ["lou.mercier"] });
    expect(social.writes).toEqual(["s:u_a", "s:u_b"]);
    expect(hmig.peek("log")).toEqual([
      { ...renomme("jean.dupont", "lou.mercier"), swept: true },
    ]);
    expect(hmig.peek("state")).toEqual({
      cursor: null,
      upTo: 0,
      covered: [],
      leaseUntil: 0,
    });
  });

  it("changement sans renvoi : balayé comme les autres", async () => {
    hmig.putJSON("log", [discret("jean.dupont", "lou.mercier")]);
    expect(await sweep()).toEqual({ done: true, scanned: 3 });
    expect(social.peek("s:u_a")).toEqual({
      follows: ["lou.mercier"],
      liked: ["p_1"],
    });
    expect(social.peek("s:u_b")).toEqual({ blocked: ["lou.mercier"] });
    expect(hmig.peek("log")).toEqual([
      { ...discret("jean.dupont", "lou.mercier"), swept: true },
    ]);
  });

  it("plus rien à balayer : on sort sans lire les listes", async () => {
    await sweep();
    social.writes = [];
    expect(await sweep()).toEqual({ done: true, scanned: 0 });
    expect(social.writes).toEqual([]);
  });

  it("un autre balayage tient le bail : on n'y touche pas", async () => {
    hmig.putJSON("state", { cursor: null, upTo: 0, leaseUntil: T0 + 1000 });
    expect(await sweep()).toEqual({ done: false, scanned: 0 });
    expect(social.writes).toEqual([]);
    expect(hmig.peek("state")).toEqual({
      cursor: null,
      upTo: 0,
      leaseUntil: T0 + 1000,
    });
  });

  it("un bail expiré est repris", async () => {
    hmig.putJSON("state", { cursor: null, upTo: 0, leaseUntil: T0 - 1 });
    expect(await sweep()).toEqual({ done: true, scanned: 3 });
  });

  it("budget épuisé : le curseur est gardé, le passage suivant reprend après", async () => {
    social.beforeWrite = () => {
      t += 1_000; // chaque écriture « coûte » une seconde
    };
    expect(await sweep(500)).toEqual({ done: false, scanned: 1 });
    expect(hmig.peek("state")).toMatchObject({
      cursor: "s:u_a",
      leaseUntil: 0,
    });
    // pas encore balayée : le passage n'est pas fini
    expect(await readRenameLog(hmig)).toEqual([
      renomme("jean.dupont", "lou.mercier"),
    ]);

    social.beforeWrite = undefined;
    social.writes = [];
    expect(await sweep()).toEqual({ done: true, scanned: 2 });
    expect(social.writes).toEqual(["s:u_b"]);
    expect(social.peek("s:u_b")).toEqual({ blocked: ["lou.mercier"] });
    expect((await readRenameLog(hmig))[0].swept).toBe(true);
  });

  it("un changement arrivé pendant un passage n'est pas marqué balayé à tort", async () => {
    social.beforeWrite = () => {
      t += 1_000;
    };
    await sweep(500);
    social.beforeWrite = undefined;
    await appendRename(renomme("maya", "maya.paris", T0 + 5_000), hmig);

    await sweep(); // termine le passage commencé (borne : l'ancien changement)
    expect(social.peek("s:u_c")).toEqual({ follows: ["maya"] });
    const log = await readRenameLog(hmig);
    expect(log.find((e) => e.to === "maya.paris")?.swept).toBeUndefined();

    await sweep(); // nouveau passage pour le nouveau changement
    expect(social.peek("s:u_c")).toEqual({ follows: ["maya.paris"] });
  });

  it("ajouté en cours de passage avec une date plus ancienne : pas marqué balayé, repris au passage suivant", async () => {
    /* me-handle date le changement avant ses allers-retours : l'entrée A
       peut arriver après B tout en étant plus ancienne. Le passage
       commencé pour B n'a pas appliqué A aux clés déjà traitées. */
    social.putJSON("s:u_a", { follows: ["jean.dupont", "maya"] });
    social.beforeWrite = () => {
      t += 1_000;
    };
    expect(await sweep(500)).toEqual({ done: false, scanned: 1 });
    social.beforeWrite = undefined;
    await appendRename(renomme("maya", "maya.paris", T0 - 2_000), hmig);

    expect(await sweep()).toEqual({ done: true, scanned: 2 });
    let log = await readRenameLog(hmig);
    expect(log.find((e) => e.to === "lou.mercier")?.swept).toBe(true);
    expect(log.find((e) => e.to === "maya.paris")?.swept).toBeUndefined();
    // la clé passée avant l'arrivée de A n'a pas encore suivi A
    expect(social.peek("s:u_a")).toEqual({
      follows: ["lou.mercier", "maya"],
    });

    expect(await sweep()).toEqual({ done: true, scanned: 3 });
    expect(social.peek("s:u_a")).toEqual({
      follows: ["lou.mercier", "maya.paris"],
    });
    expect(social.peek("s:u_c")).toEqual({ follows: ["maya.paris"] });
    log = await readRenameLog(hmig);
    expect(log.every((e) => e.swept)).toBe(true);
  });

  it("une liste modifiée pendant le balayage : on repart du frais, rien n'est perdu", async () => {
    let concurrent = true;
    social.beforeWrite = (k) => {
      if (k !== "s:u_a" || !concurrent) return;
      concurrent = false;
      social.putJSON("s:u_a", { follows: ["jean.dupont", "nouveau"] });
    };
    await sweep();
    expect(social.peek("s:u_a")).toEqual({
      follows: ["lou.mercier", "nouveau"],
    });
  });
});
