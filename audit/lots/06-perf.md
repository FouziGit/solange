# Lot 6 — Performance (D-013)

## Objectif du brief

≥ 90 en performance mobile sur les trois pages mesurées.
**Objectif NON atteint : 87 / 78 / 81.** Ce qui suit dit exactement
pourquoi, avec les mesures.

## Mesures (prod déployée, mobile émulé, CPU ×4, 4G bridée, 3 passes, médiane)

| Page                  | Avant | Après  | LCP           | Poids              |
| --------------------- | ----- | ------ | ------------- | ------------------ |
| Gate (`/`)            | 86    | **87** | 3,5 s → 3,8 s | 414 → 475 Ko       |
| Feed (`/?e2e=1`)      | 73    | **78** | 5,4 s → 4,9 s | 2066 → **1578 Ko** |
| Marché (`/decouvrir`) | 80    | **81** | 4,7 s → 4,4 s | 1535 → 1601 Ko     |

Variance des passes du feed : 77 / 78 / 85 — le réseau réel introduit du
bruit qu'une mesure locale n'a pas. La médiane est retenue, pas le
meilleur score.

## Ce qui a été corrigé

1. **Les vidéos du feed pesaient 5,4 Mo.** Recompressées en 960p CRF 30
   (H.264, faststart conservé) : **2,3 Mo, −57 %**, sans perte visible à
   la taille d'affichage (comparaison d'images extraites avant/après).
2. **Toutes les cartes chargeaient leur vidéo**, y compris hors écran. Le
   `src` n'est plus posé que sur la carte visible ou voisine, et
   `preload="metadata"` est réservé à la carte active.
3. **L'image d'attente de la première carte — l'élément LCP — n'était
   demandée qu'après l'hydratation.** Mesuré : « Load Delay » de
   **6 499 ms**. Un `<link rel="preload">` sur la page du feed le ramène à
   **328 ms** (et le temps de chargement de 1 629 ms à 178 ms).
   Ce préchargement est posé sur la page du feed et NON dans le layout :
   la première version, globale, faisait payer 62 Ko à des pages qui n'en
   avaient aucun usage.

## Ce qui reste, et pourquoi ces correctifs ne peuvent pas l'atteindre

Après le préchargement, la décomposition du LCP du feed devient :

```
TTFB            469 ms
Load Delay      328 ms   ← corrigé (était 6 499 ms)
Load Time       178 ms   ← corrigé (était 1 629 ms)
Render Delay  10 145 ms  ← TOUT le reste est ici
```

**L'image est prête en moins d'une seconde et ne peut pas peindre.** Elle
attend que React s'hydrate, parce que l'élément qui la porte n'existe pas
dans le HTML servi : il est créé par le JavaScript.

C'est la confirmation **mesurée** de D-013 — mais la formulation d'origine
(« les pages chargent leurs données en client ») désignait la mauvaise
cause. Le vrai problème n'est pas d'où viennent les données : c'est que
**le DOM du premier écran n'existe pas dans le HTML serveur**. `AuthGate`
est un composant client qui, pendant le rendu serveur, ne peut pas savoir
si la personne a déjà passé l'accueil (le drapeau est en `localStorage`) —
il rend donc le splash, et rien d'autre.

## Le correctif restant, précisément

Déplacer le drapeau d'onboarding de `localStorage` vers un **cookie**. Le
serveur saurait alors qui il sert et pourrait rendre le vrai premier écran
dans le HTML. Le `Render Delay` s'effondrerait, et 90 serait atteignable.

Ce n'est pas fait ici parce que cela touche le chemin d'authentification
(la partie la plus sensible de l'app) et méritait sa propre passe avec ses
propres preuves, plutôt qu'une modification de fin de chantier.

## Écart d'outillage à connaître — D-031

`next start` en local sert **245 Ko de `next-devtools`** qui n'existent PAS
dans la prod déployée (vérifié : 0 occurrence). Toute mesure locale est
donc pessimiste d'environ un quart du JavaScript, et les scores locaux
(73/63/69) ne sont pas comparables aux scores réels (86/73/80). **Les
mesures qui comptent se prennent sur la prod.** C'est ce qui explique
l'écart avec la mesure d'origine du rapport v1, prise en local.
