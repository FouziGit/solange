/* ============================================================
   SOLANGE — JSON-LD serialization helper
   Stringifies structured data for inline <script type="application/ld+json">
   while escaping "<" so a value can never break out of the script tag
   (defends against "</script>" injection in any string field).
   ============================================================ */

export function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
