/* ============================================================
   Annonces vocales (VoiceOver, TalkBack, NVDA).

   Une seule paire de régions live pour toute l'app, montée par
   <LiveAnnouncer /> dans layout.tsx et TOUJOURS présente : Safari et
   VoiceOver ne lisent pas une région créée en même temps que son texte
   (le motif « {msg && <div role="status">{msg}</div>} » reste muet).

   Usage, depuis un composant client :
     import { announce } from "@/lib/announce";
     announce("Annonce en ligne");                    // poli : succès, états
     announce("Message non envoyé", "assertive");     // erreurs seulement

   - Les messages d'un même instant (~100 ms) sont regroupés en une
     phrase, sans doublon : deux rendus qui annoncent la même chose ne la
     font pas lire deux fois.
   - Le même message, annoncé plus tard, est relu : le texte de la région
     change quand même (espace insécable final alterné).
   - Le texte s'efface après quelques secondes, pour qu'on ne le retrouve
     pas en balayant la fin de la page.
   - Sans effet côté serveur.
   ============================================================ */

export type Politeness = "polite" | "assertive";
export type Announcements = Readonly<Record<Politeness, string>>;

export const NO_ANNOUNCEMENT: Announcements = { polite: "", assertive: "" };

const NBSP = " ";

/** Ajoute un message à la file : espaces normalisés, ni vide ni doublon. */
export function enqueue(queue: readonly string[], message: string): string[] {
  const m = message.replace(/\s+/g, " ").trim();
  if (!m || queue.includes(m)) return [...queue];
  return [...queue, m];
}

/** Texte à poser dans la région pour ce lot de messages. Identique au
    texte déjà affiché, il ne changerait rien et ne serait pas relu : on
    alterne alors un espace insécable final. */
export function regionText(current: string, queue: readonly string[]): string {
  const text =
    queue.length > 1
      ? queue.map((m) => (/[.!?…:]$/.test(m) ? m : `${m}.`)).join(" ")
      : (queue[0] ?? "");
  if (!text) return "";
  return text === current ? `${text}${NBSP}` : text;
}

type Timer = ReturnType<typeof setTimeout>;

/** Magasin des annonces — exporté pour les tests ; l'app utilise le
    singleton plus bas. */
export function createAnnouncer({
  flushDelay = 100,
  clearDelay = 7000,
}: { flushDelay?: number; clearDelay?: number } = {}) {
  let state: Announcements = NO_ANNOUNCEMENT;
  const queues: Record<Politeness, string[]> = { polite: [], assertive: [] };
  const flushTimers: Partial<Record<Politeness, Timer>> = {};
  const clearTimers: Partial<Record<Politeness, Timer>> = {};
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function flush(p: Politeness) {
    delete flushTimers[p];
    const text = regionText(state[p], queues[p]);
    queues[p] = [];
    if (!text) return;
    state = { ...state, [p]: text };
    emit();
    clearTimeout(clearTimers[p]);
    clearTimers[p] = setTimeout(() => {
      state = { ...state, [p]: "" };
      emit();
    }, clearDelay);
  }

  return {
    announce(message: string, politeness: Politeness = "polite") {
      const next = enqueue(queues[politeness], message);
      if (next.length === queues[politeness].length) return;
      queues[politeness] = next;
      flushTimers[politeness] ??= setTimeout(
        () => flush(politeness),
        flushDelay,
      );
    },
    getSnapshot: (): Announcements => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const announcer = createAnnouncer();

/** Fait lire `message` par le lecteur d'écran. `"assertive"` interrompt
    la lecture en cours : à réserver aux erreurs. */
export function announce(message: string, politeness: Politeness = "polite") {
  if (typeof window === "undefined") return;
  announcer.announce(message, politeness);
}

/** Branchement de <LiveAnnouncer /> (useSyncExternalStore). */
export const subscribeAnnouncements = announcer.subscribe;
export const getAnnouncements = announcer.getSnapshot;
