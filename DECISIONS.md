# DECISIONS.md — journal des décisions (design/de-slop)

Chaque entrée : décision, alternative écartée, raison. Relire en début de phase.

## Phase 0

- **D-001 — Branche `design/de-slop`.** Tout le travail de refonte vit sur cette
  branche, commits atomiques. Alternative écartée : travailler sur `main`
  (interdit par le brief, et la CI déploie main en prod à chaque push).
- **D-002 — Captures via `npx playwright` (CLI, cache npx).** Produit de vrais
  fichiers PNG dans `audit/captures/` aux trois largeurs. Aucune dépendance
  ajoutée au repo (ni `package.json` ni lockfile modifiés) : outillage
  éphémère hors périmètre livré. Alternative écartée : le navigateur intégré
  de l'agent (ne produit pas de fichiers) ; ajout de Playwright en devDep
  (inutile : pas de tests E2E existants à étendre, le brief interdit le
  théâtre d'outillage).
- **D-003 — Phase 0 auditée sur la prod (https://solange-beta.netlify.app).**
  `main` == build déployé, donc l'état observé est exactement celui des
  utilisateurs. Parcours en invité (bouton « Passer ») : les écrans membres
  (notifications réelles, mes annonces) sont documentés d'après le code.
  Alternative écartée : dev server local (HMR et cache faussent le ressenti
  perf).
- **D-004 — Gate d'auth contournée pour les captures** en injectant
  `solange:onboarded=1` via `--load-storage` (état localStorage), soit
  exactement l'état d'un visiteur ayant déjà passé l'écran d'accueil une fois.
