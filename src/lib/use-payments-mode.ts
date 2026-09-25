/* ============================================================
   Paiement réel ou démonstration ?

   const { ready, live, test, failed } = usePaymentsMode();

   - `ready` : le serveur a répondu (GET /api/payments/config).
   - `live`  : une clé Stripe est posée, le paiement est RÉEL.
   - `test`  : c'est une clé de test (paiement réel, carte de test).
   - `failed` : pas de réponse (hors ligne…) ; on ne sait pas.

   Règle : n'afficher « paiement simulé / aucune somme débitée » QUE si
   `ready && !live`. Tant que `ready` est faux (chargement ou échec), ne
   rien affirmer : dire « simulé » à quelqu'un qui va payer pour de vrai
   est pire qu'attendre. Après un échec, retryPaymentsMode() relance la
   question (un nouveau montage du hook aussi).

   Une seule requête pour toute la page, quel que soit le nombre de
   composants abonnés ; la réponse est gardée jusqu'au rechargement.
   ============================================================ */

import { useSyncExternalStore } from "react";
import { api } from "./api";

export type PaymentsMode = Readonly<{
  ready: boolean;
  live: boolean;
  test: boolean;
  failed: boolean;
}>;

export const PAYMENTS_UNKNOWN: PaymentsMode = {
  ready: false,
  live: false,
  test: false,
  failed: false,
};

type Fetcher = () => Promise<
  { ok: true; data: { live: boolean; test: boolean } } | { ok: false }
>;

/** Magasin partagé — exporté pour les tests ; l'app utilise le
    singleton plus bas. */
export function createPaymentsModeStore(fetcher: Fetcher) {
  let state: PaymentsMode = PAYMENTS_UNKNOWN;
  let inflight = false;
  const listeners = new Set<() => void>();

  function load() {
    if (inflight || state.ready) return;
    inflight = true;
    void fetcher()
      .catch(() => ({ ok: false }) as const)
      .then((r) => {
        inflight = false;
        state = r.ok
          ? {
              ready: true,
              live: r.data.live,
              test: r.data.test,
              failed: false,
            }
          : { ...PAYMENTS_UNKNOWN, failed: true };
        listeners.forEach((l) => l());
      });
  }

  return {
    load,
    getSnapshot: (): PaymentsMode => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      load();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const store = createPaymentsModeStore(() => api.paymentsConfig());

/** Mode de paiement, lu une fois pour toute la page. */
export function usePaymentsMode(): PaymentsMode {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => PAYMENTS_UNKNOWN,
  );
}

/** Repose la question après un échec (bouton « Réessayer »). */
export function retryPaymentsMode() {
  store.load();
}
