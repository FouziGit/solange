# Rapport final — refonte design/de-slop

> Branche `design/de-slop`, ~50 commits atomiques depuis `aed1cf1` (main).
> Chaque affirmation ci-dessous a un diff, une capture ou une mesure.
> **Rien n'a été fusionné dans `main`** : revue puis merge à la main.

## 1. Ce qui a changé, et pourquoi

### Système (Phase 2.4)
- **Tokens** : `--color-danger` (oxblood 2 thèmes), `--radius-stage`,
  `--dur-*` + `DUR`, 3 crans de filets implicites ; ~300 l. de CSS/JSX morts
  purgés (`ProductHotspots`, `ShopHotspots`, `.stage`, keyframes orphelins).
- **Primitives uniques** (doc : `design/composants.md`) : `Sheet` (4 chromes
  fusionnés, Échap + piège de focus + portal), `Button` (5 variantes DA),
  `RailAction` (3 copies fusionnées), `FieldLabel`, `Skeleton`, `Stamp`,
  `ReportSheet`. Solde système : **≈ −600 lignes** pour 7 primitives.

### Les bloquants d'usage (Phase 3)
- Checkout 375 : **débordement +34 px → 0** (`min-w-0` sur les grid items) —
  mesuré en live avant/après.
- Tab bar : surface `.glass-bar` opaque — le contenu ne traverse plus.
- Cause racine d'un CSS cassé en dev : Tailwind v4 scannait `audit/` →
  `@source not`.
- 3 `window.prompt()` de signalement → `ReportSheet` (états complets,
  vérifiée au-dessus de la nav — bug de stacking des transitions de page
  corrigé par portal, screenshots avant/après dans le fil de travail).
- Six états : matrice complète `audit/02-etats.md` ; squelettes fidèles
  (`/membre`, `/notifications`), états vides qui invitent à l'action cœur,
  brouillons `vendre`/`creer` persistés (sessionStorage).

### Identité (Phases 2 & 4)
- **Lexique canonique** : Looks · Pièces · Marché · Cercles · Notifications ·
  Gardées · membre — appliqué nav + pages + metadata (D-006/D-010).
- **Signature** : le **tampon** (`Stamp` — Payée / Déposée / Publié) remplace
  les ronds ✓ génériques ; **N° de passage** sur chaque look (vraie séquence,
  D-011… voir DECISIONS) ; règle des formes carré=commerce/rond=organique
  exécutée (CTA, chips, radius arbitraires → tokens).
- Motion discipliné : AuthScreen 5 effets → 1 geste ; vidéos `/live` jouent
  uniquement visibles ; plancher typo 11 px (90 occurrences corrigées).

## 2. Captures avant/après
`audit/captures/phase0/` (32, état zéro) vs `audit/captures/apres/` (21,
7 écrans cœur × 3 largeurs). Comparaisons parlantes : `checkout-375`
(débordement vs propre), `decouvrir-375` vs `marche-375` (titre Marché,
chips 44 px, barre opaque), `feed-375` (créateur en bas, rail 5 actions,
N° de passage).

## 3. Tests de la Definition of Done — résultats honnêtes

| Test | Avant | Après | Verdict |
|---|---|---|---|
| Flou (`da-tests/`) | Échec — app sombre générique | Structure signature lisible (pill switch + FAB rond + média intégral, aucun autre chrome) ; l'étiquette reste illisible floutée par nature | **Partiel** — la silhouette est distinctive, pas encore l'ADN complet |
| Logo échangé | Échec | Sur `apres-logoswap-marche-375.png`, un bandeau Vinted jure avec la typo display caps + chips carrées + zéro accent couleur | **Amélioré**, à re-juger avec un œil externe |
| 5 secondes / 2 minutes | — | Non testé sur panel réel — hors de portée d'un agent ; parcours invité = 1 tap (« Passer ») → feed | **Non prouvé** (protocole fourni §5) |
| Action cœur ≤ 1 tap | ✓ | Feed au lancement ; `+` central → vendre/publier en 1 tap | ✓ |
| Six états | trous partout | matrice remplie, 3 manques consignés | ✓ (avec dette listée) |
| Primitives uniques / balayages | — | liste noire copy 0 · console.log 0 · TODO 0 · `any` 0 · doublons 0 · unused-imports 0 · `red-*` 0 · prompt() 0 · rounded arbitraires : 1 justifié (`rounded-[50%]` génératif) · hex inline : exceptions justifiées (générateurs OG/icônes edge, themeColor, dégradés média) | ✓ |
| Clavier | — | Sheets : Échap + piège Tab ; média feed opérable (Entrée/Espace) ; le reste = éléments natifs + `:focus-visible` global. Parcours complets non rejoués au clavier pas-à-pas | **Partiel** |
| Perf (budget LCP<2 s, perf≥90) | non mesuré | **gate 88 · feed 80 · marché 76** (Lighthouse mobile, CPU×4, slow-4G, local `next start`) ; CLS 0 partout, TBT ≤ 40 ms ; images −54 % (5,2→2,4 Mo) | **✗ budget non tenu** — cause : pages données en full-CSR (hydratation avant contenu) + posters vidéo lourds. Plan §5.1 |
| Régressions | — | tsc 0 · lint 0 erreur · 15/15 tests · build 63 routes à CHAQUE lot ; aucun test modifié | ✓ |

## 4. Décisions et alternatives écartées
Voir `DECISIONS.md` (D-001 → D-010) : registre tu, lexique, formes, pas de
couleur d'accent, tests DA à l'état zéro, switch Looks|Pièces…

## 5. Reste à faire, par priorité

1. **Perf structurelle (le point ✗)** : rendre la grille du Marché en Server
   Components + streaming (la page est aujourd'hui 100 % client) ; posters
   vidéo → AVIF ≤ 60 Ko ; `next/image` sur les grilles. Objectif LCP < 2,5 s
   réaliste ensuite. Chantier ~2-3 jours, sans changement d'API.
2. Passe copy mot-à-mot restante (typographie française systématique —
   espaces insécables, « … » — et chasse aux formulations molles écran par
   écran ; l'inventaire Phase 0 §6 est la base).
3. Migration des CTA restants vers `Button` (écrans secondaires), résorption
   `ProductTile`→`ProductCard` (/membre).
4. Échecs réseau silencieux (matrice §3) ; squelette des sections profil.
5. Découpe des fichiers massifs (messages 550 l., StreamsView 530 l.) —
   mécanique, sans urgence.
6. Test 5 secondes / 2 minutes sur 3 personnes réelles (protocole : ouvrir
   la prod, chronomètre, « dis ce que fait l'app » puis « achète une pièce »).

## 6. Idées non implémentées (interdites par le brief, à discuter)
- « Depuis ta dernière visite » (résumé à l'ouverture) — déclencheur de
  rétention naturel, nécessite un horodatage de session côté client.
- Reprise exacte de position dans le feed entre sessions.
- Toast global unique (aujourd'hui : l'écran montre le résultat — un vrai
  besoin n'a pas émergé).
- Analytics produit (aucun tracking aujourd'hui) : à décider explicitement.

## 7. Environnement de vérification
Local `next start` (build prod). Les fonctions Netlify ne tournent pas en
local : les écrans membres réels (notifications pleines, inbox) ont été
vérifiés en code + via la prod des lots précédents. `?e2e=1` (équivalent
« Passer », mode invité) sert d'entrée d'outillage pour Lighthouse/captures.
