/* Tâche planifiée (toutes les 15 min) — remet à jour les abonnements et
   blocages des membres après un changement d'@handle. Travail au mieux :
   la sécurité (blocage des messages) ne dépend pas de ce balayage.
   Voir _shared/handle-migrate.mts. */
import type { Config } from "@netlify/functions";
import { json } from "./_shared/core.mts";
import { runHandleSweep } from "./_shared/handle-migrate.mts";

export default async () => {
  try {
    const r = await runHandleSweep(20_000);
    return json({ ok: true, ...r });
  } catch (e) {
    console.error("handle_sweep_error", (e as Error).message);
    return json({ ok: false }, 500);
  }
};

export const config: Config = { schedule: "*/15 * * * *" };
