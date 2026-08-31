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

## Phase 6

- **D-011 — Bypass d'outillage `?e2e=1`** sur AuthGate (== bouton « Passer »,
  mode invité) : Lighthouse/Playwright ne savent pas poser de localStorage
  simplement. N'ouvre RIEN de plus qu'un tap utilisateur. Alternative
  écartée : instrumenter Lighthouse via un user-flow scripté (poids outillage
  disproportionné).
- **D-012 — Images recompressées à la source** (41 JPEG, 5,2 → 2,4 Mo, q72
  max 1200px) plutôt que next/image immédiat : gain identique côté octets
  sans toucher au pipeline de rendu ; next/image reste au plan (rapport §5.1).
- **D-013 — Budget perf NON tenu, assumé** : gate 88 / feed 80 / marché 76.
  La cause est structurelle (pages données full-CSR) ; le correctif (RSC +
  streaming) dépasse le « pas de big-bang » de cette passe — planifié en
  premier du reste-à-faire au lieu d'être maquillé.

## Brief 2 — Lot 0

- **D-014 — Primitive `TogglePill`** : le balayage lot 0 a montré que les
  CTA restants étaient à 70 % le même objet — un toggle social (Suivre,
  Rejoindre, Me prévenir, Réserver) réécrit 9 fois avec 9 géométries.
  `Button` ne modélise pas d'état pressé ; plutôt que de le surcharger d'un
  6ᵉ variant, une primitive dédiée avec `aria-pressed`/`role="switch"`.
  off = bloc renversé (l'invite), on = filet posé — la version inversée de
  Live (on = bloc plein) est normalisée à ce sens unique. Alternative
  écartée : prop `pressed` sur Button (mélange deux grammaires — l'action à
  sens unique et l'état réversible — et casse la règle « un seul bloc
  renversé = l'action primaire » en rendant le renversement ambigu).

## Brief 2 — Lot 1

- **D-016 — Délais du cycle de commande** : rappel vendeur J+3, annulation
  auto J+7 (repère Vinted — le comportement que le public cible connaît),
  rappel acheteur J+7 après expédition, clôture auto J+14 (pas de suivi
  transporteur réel en beta → 2× le délai postal courant). Les commandes sur
  pièces SEED (vendeur fictif, `sellerId null` — dont les commandes réelles
  historiques) sont HORS cycle et hors cron : rien à expédier, et
  l'annulation auto aurait remis en vente des pièces réellement achetées.
  Alternative écartée : marquer ces commandes « terminées » d'office
  (mensonge d'état).
- **D-017 — `/commande/[id]` en rendu client assumé** : les données vivent
  derrière un cookie httpOnly lu par les Netlify Functions (Blobs n'est
  accessible qu'à elles) ; un RSC dynamique ouvrirait un 2ᵉ chemin d'accès
  aux données à sécuriser en double. La page respecte l'esprit de D-013 :
  UN fetch, squelette DA, zéro cascade. D-013 vise les pages de contenu
  public (gate/feed/marché) — les écrans membres restent client.

## Brief 2 — Lot 3

- **D-020 — Web Push sans dépendance, mais PROUVÉ.** Le réflexe serait
  d'ajouter `web-push`. Or `jose` est déjà au projet (sessions) et couvre
  la moitié VAPID (JWT ES256), et WebCrypto couvre RFC 8291 (ECDH P-256 →
  HKDF → AES-128-GCM). Le vrai risque du fait-maison — une crypto
  subtilement fausse — est levé par un test qui rejoue le **vecteur
  officiel du RFC 8291 §5** : mêmes clés, même sel, sortie identique octet
  pour octet (`src/lib/__tests__/webpush.test.ts`). Une dépendance non
  testée serait un acte de foi ; un vecteur officiel est une preuve.
  Alternative écartée : `web-push` (+4 dépendances transitives dans le
  bundle des functions pour du code qu'on peut vérifier en 5 lignes de
  test).
- **D-021 — Anti-spam en trois règles, la cloche comme filet.** Plafond de
  8 push/heure, regroupement des événements de même type sur 10 min
  (« 3 personnes ont aimé ta pièce », même `tag` → le système REMPLACE la
  notification au lieu d'empiler), heures calmes 22 h → 8 m (heure de
  Paris). Un push refusé n'est JAMAIS un événement perdu : la cloche est
  écrite avant, toujours. Alternative écartée : un compteur global par
  type (aurait laissé passer 7 types × 8 = 56 notifications par heure).
- **D-022 — Le service worker ne fait QUE du push.** Aucune mise en cache :
  la stratégie de cache est une décision de performance qui appartient au
  Lot 6, et un cache mal réglé servirait du contenu périmé (prix, statut
  de commande) — le pire bug possible sur un marketplace.
- **D-023 — Le drapeau, c'est l'absence de clés.** Sans
  `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `sendPush` ne fait rien et l'UI
  n'affiche AUCUN réglage (plutôt que d'exposer un interrupteur qui ne
  ferait rien). Le lot est donc déployé éteint par construction, sans
  variable de drapeau supplémentaire à gérer.

## Brief 2 — Lot 2

- **D-018 — Épinglage réservé au rôle `admin`.** Le brief donne l'épinglage
  « au créateur du Cercle », mais les animateurs des Cercles seed sont des
  personas fictifs sans compte. Les vrais animateurs sont Nouh et Youssef :
  l'endpoint `pin` est prêt et vérifie `role === "admin"` sur le compte
  (403 pour tous tant que le script du Lot 4 n'a pas attribué le rôle).
  Alternative écartée : un champ « hostEmail » par Cercle (2ᵉ source de
  vérité des rôles).
- **D-019 — Fraîcheur par revalidation discrète, pas de temps réel.** Le
  stack n'a aucune infra websocket/SSE ; les fils revalident en silence
  toutes les 30 s quand l'écran est ouvert, sans saut de mise en page
  (comparaison par id). Alternative écartée : ajouter Pusher/Ably (nouvelle
  dépendance + compte tiers, interdit sans justification forte).
- Le compteur « en ligne » mock des Cercles est SUPPRIMÉ (engagement
  fabriqué) ; « discussions » devient le compte réel de fils.

- **D-015 — Échecs réseau : bandeau inline, pas de Toast global.** Le
  pattern erreur (cause + remède + Réessayer) se pose DANS l'écran concerné
  (bandeau au Marché/Messages, chip sur le feed) ; le besoin d'un Toast
  global n'a toujours pas émergé (composants.md §À venir). L'envoi de
  message échoué fait exception : rollback de l'optimiste + texte restitué
  dans le champ + feedback local existant de l'écran.
