/* ============================================================
   SOLANGE — analytics seam (no-op)
   Fires nothing in production. In dev it logs to the console so
   instrumented interactions are observable. Swap this body for a
   real provider (Plausible, Segment…) without touching callers.
   ============================================================ */

export function track(event: string, props?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[track]", event, props);
  }
}
