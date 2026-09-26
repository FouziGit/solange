/* Changements d'@handle : journal et balayage des listes sociales.

   Les abonnements et blocages (`social` / `s:<id>`) sont indexés par
   handle. Quand un membre change le sien, les listes des autres gardent
   l'ancien. Si le membre a choisi le renvoi public, trois mécanismes les
   remettent à jour ; sans renvoi, elles gardent l'ancien, qui ne mène plus
   nulle part. Aucun n'est une condition de sécurité (le blocage compare
   aussi les anciens handles) :
   - social.mts applique le journal avant de modifier une liste ;
   - me.mts l'applique à la liste du membre à chaque hydratation ;
   - la tâche planifiée handle-migrate balaie les `s:*` des autres.

   Store `hmig` :
   - `log`   : RenameEntry[] des 30 derniers jours, écrit en CAS ;
   - `state` : curseur du balayage (dernière clé `s:` traitée), borne
               `upTo` du passage en cours, changements qu'il couvre
               (`covered`) et bail `leaseUntil`. */
import {
  applyRenames,
  pruneRenameLog,
  type RenameEntry,
} from "../../../src/lib/handle.ts";
import { store } from "./core.mts";

/** Ce que le journal et le balayage utilisent d'un store Blobs. */
export type MigrateStoreLike = {
  getWithMetadata(
    k: string,
    o: { type: "json" },
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    k: string,
    v: unknown,
    o?: { onlyIfMatch?: string; onlyIfNew?: boolean },
  ): Promise<{ modified: boolean }>;
  list(o: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
};

type SweepState = {
  cursor: string | null;
  upTo: number;
  covered: string[];
  leaseUntil: number;
};

const LOG = "log";
const STATE = "state";
const LEASE_MARGIN_MS = 5_000;
const SAVE_EVERY = 50;

/** Écriture conditionnelle d'un document JSON : `mutate` reçoit la valeur
    fraîche (null si absente) et rend la nouvelle, ou null pour renoncer.
    Rend la valeur écrite, ou null (renoncement, conflits répétés, ou
    document sans etag : on n'écrit pas à l'aveugle). */
async function casJSON<T>(
  st: MigrateStoreLike,
  key: string,
  mutate: (cur: unknown) => T | null,
  tries = 3,
): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    const cur = await st.getWithMetadata(key, { type: "json" });
    if (cur && !cur.etag) return null;
    const next = mutate(cur ? cur.data : null);
    if (next === null) return null;
    const res = await st.setJSON(
      key,
      next,
      cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true },
    );
    if (res.modified) return next;
  }
  return null;
}

function isEntry(e: unknown): e is RenameEntry {
  if (!e || typeof e !== "object") return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.from === "string" &&
    typeof r.to === "string" &&
    typeof r.at === "number"
  );
}

const asLog = (v: unknown): RenameEntry[] =>
  Array.isArray(v) ? v.filter(isEntry) : [];

/** Identité d'une entrée du journal, gardée dans `state.covered`. */
const entryKey = (e: RenameEntry) => `${e.from}>${e.to}@${e.at}`;

function asState(v: unknown): SweepState {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    cursor: typeof s.cursor === "string" ? s.cursor : null,
    upTo: typeof s.upTo === "number" ? s.upTo : 0,
    covered: Array.isArray(s.covered)
      ? s.covered.filter((k): k is string => typeof k === "string")
      : [],
    leaseUntil: typeof s.leaseUntil === "number" ? s.leaseUntil : 0,
  };
}

/** Journal des changements des 30 derniers jours, déjà élagué. */
export async function readRenameLog(
  hmig: MigrateStoreLike = store("hmig"),
): Promise<RenameEntry[]> {
  const cur = await hmig.getWithMetadata(LOG, { type: "json" });
  return pruneRenameLog(asLog(cur?.data), Date.now());
}

/** Ajoute un changement au journal (CAS, 3 essais) et élague au passage.
    `redirect` : le membre a choisi le renvoi public de l'ancien handle. */
export async function appendRename(
  e: { from: string; to: string; at: number; redirect?: boolean },
  hmig: MigrateStoreLike = store("hmig"),
): Promise<void> {
  const entry: RenameEntry = {
    from: e.from,
    to: e.to,
    at: e.at,
    ...(e.redirect === true ? { redirect: true } : {}),
  };
  const written = await casJSON<RenameEntry[]>(hmig, LOG, (cur) => [
    ...pruneRenameLog(asLog(cur), Date.now()),
    entry,
  ]);
  if (!written) console.error("rename_log_conflict");
}

/** Applique le journal aux abonnements et blocages d'un état social,
    TOUS les changements, avec ou sans renvoi : un abonnement ou un
    blocage vise une personne, pas un pseudo. Sinon, changer d'@ ferait
    perdre ses abonnés, et un membre bloqué qui change d'@ réapparaîtrait
    dans le fil de celui qui l'a bloqué. Aucune fuite : un ancien @ masqué
    ne peut plus être AJOUTÉ à ces listes (social.mts répond « Profil
    inconnu »), donc seules y figurent des relations nouées avant le
    changement. `changed` : il faut réécrire `s:<id>`. */
export function renameSocial(
  state: Record<string, unknown>,
  log: RenameEntry[],
): { state: Record<string, unknown>; changed: boolean } {
  const next = { ...state };
  let changed = false;
  for (const k of ["follows", "blocked"]) {
    const list = state[k];
    if (!Array.isArray(list)) continue;
    const strings = list.filter((x): x is string => typeof x === "string");
    const r = applyRenames(strings, log);
    if (r.changed || strings.length !== list.length) {
      next[k] = r.list;
      changed = true;
    }
  }
  return { state: next, changed };
}

/** Un passage du balayage, dans la limite de `budgetMs`. Reprend au
    curseur laissé par le passage précédent. `done` : la liste a été
    parcourue jusqu'au bout (ou il n'y avait rien à faire). */
export async function runHandleSweep(
  budgetMs: number,
  deps: {
    hmig?: MigrateStoreLike;
    social?: MigrateStoreLike;
    now?: () => number;
  } = {},
): Promise<{ done: boolean; scanned: number }> {
  const hmig = deps.hmig ?? store("hmig");
  const social = deps.social ?? store("social");
  const clock = deps.now ?? Date.now;
  const start = clock();
  const deadline = start + budgetMs;
  const leaseUntil = deadline + LEASE_MARGIN_MS;

  // 1. Bail : un seul balayage à la fois.
  const held = await casJSON<SweepState>(hmig, STATE, (cur) => {
    const s = asState(cur);
    return s.leaseUntil > start ? null : { ...s, leaseUntil };
  });
  if (!held) return { done: false, scanned: 0 };

  /* Écrit l'état seulement si le bail est toujours le nôtre : un passage
     qui aurait dépassé son bail ne recule jamais le curseur d'un autre. */
  const saveState = (patch: Partial<SweepState>) =>
    casJSON<SweepState>(hmig, STATE, (cur) => {
      const s = asState(cur);
      return s.leaseUntil === leaseUntil ? { ...s, ...patch } : null;
    });

  /* 2. Borne du passage : le plus récent changement avec renvoi pas encore
     balayé. `covered` retient ceux qui existaient au départ : seuls eux
     seront marqués balayés. Une entrée ajoutée en cours de route avec un
     `at` plus ancien (horloges, allers-retours de me-handle) n'a pas
     touché les clés déjà passées ; elle attend le passage suivant. */
  const log = pruneRenameLog(
    asLog((await hmig.getWithMetadata(LOG, { type: "json" }))?.data),
    start,
  );
  let { cursor, upTo, covered } = held;
  if (cursor === null) {
    const pending = log.filter((e) => !e.swept);
    if (!pending.length) {
      await saveState({ leaseUntil: 0 });
      return { done: true, scanned: 0 };
    }
    upTo = Math.max(...pending.map((e) => e.at));
    covered = pending.map(entryKey);
  }
  const renames = log.filter((e) => e.at <= upTo);

  // 3-5. Les clés `s:` après le curseur, dans l'ordre.
  const after = cursor;
  const { blobs } = await social.list({ prefix: "s:" });
  const keys = blobs
    .map((b) => b.key)
    .sort()
    .filter((k) => after === null || k > after);
  let scanned = 0;
  for (const key of keys) {
    if (clock() >= deadline) {
      await saveState({ cursor, upTo, covered, leaseUntil: 0 });
      return { done: false, scanned };
    }
    await casJSON<Record<string, unknown>>(social, key, (cur) => {
      if (!cur || typeof cur !== "object") return null;
      const r = renameSocial(cur as Record<string, unknown>, renames);
      return r.changed ? r.state : null;
    });
    cursor = key;
    scanned++;
    if (scanned % SAVE_EVERY === 0)
      await saveState({ cursor, upTo, covered });
  }

  /* 6. Fin de liste : les changements couverts depuis le début du passage
     sont balayés, prochain passage à zéro. */
  const swept = new Set(covered);
  await casJSON<RenameEntry[]>(hmig, LOG, (cur) =>
    pruneRenameLog(asLog(cur), start).map((e) =>
      swept.has(entryKey(e)) ? { ...e, swept: true } : e,
    ),
  );
  await saveState({ cursor: null, upTo: 0, covered: [], leaseUntil: 0 });
  return { done: true, scanned };
}
