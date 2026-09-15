import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    /* Les 23 fonctions Netlify étaient hors de la suite : « 110 tests
       verts » ne disait rien de la santé du backend. Elles ont désormais
       un endroit où poser leurs tests. */
    include: [
      "src/**/__tests__/**/*.test.ts",
      "netlify/**/__tests__/**/*.test.ts",
    ],
  },
});
