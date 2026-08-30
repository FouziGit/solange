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

## Phase 2

- **D-005 — Registre : tu.** Majorité écrasante de l'existant + public Gen Z.
  Alternative écartée : vouvoiement (aurait exigé de réécrire ~90 % des
  chaînes pour un gain de distance non voulu par la marque).
- **D-006 — Lexique canonique tranché** : pièce · look · Marché · Cercles ·
  Notifications · Gardées · membre. Onglet feed renommé « Looks ».
  Alternatives écartées : « Défilé » (trop littéral), garder « Feed »
  (générique, anglicisme non-mode), « Favoris » (entre en collision avec
  Suivre/le cœur du like).
- **D-007 — Règle des formes : carré = commerce, rond = organique** ;
  `--radius-stage` (28px) tokenisé pour le cadre feed desktop et les sheets.
  Alternative écartée : tout-carré intégral (tuait le rail glass et les
  avatars, seuls éléments « vivants » posés sur le média).
- **D-008 — Tests DA à l'état zéro : ÉCHEC documenté** (flou + logo échangé,
  `audit/captures/da-tests/`). La signature « étiquette + tampon » (§9 DA.md)
  est la réponse ; re-test obligatoire en Phase 6.
- **D-009 — Pas de couleur d'accent.** La différenciation vient des objets du
  vestiaire (étiquette, cintre, tampon, N°), pas d'une teinte. Seul ajout
  chromatique : `--c-danger` oxblood désaturé (remplace les red-* Tailwind du
  profil). Alternative écartée : accent terracotta/acide (tics catalogués).
- **D-010 — Switch du home : « Looks | Pièces ».** Le lexique D-006 tue
  « Boutique », mais nommer le 2e mode « Marché » aurait donné deux
  destinations différentes (switch du home vs onglet /decouvrir) sous un même
  nom. Le switch nomme donc le TYPE DE CONTENU (looks / pièces — l'objet
  canonique), la nav nomme le LIEU (Marché). Icône du mode pièces : le cintre.
