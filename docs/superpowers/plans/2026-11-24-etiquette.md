# L'étiquette — plan d'implémentation (version finale, critique intégrée)

> **Pour les agents qui exécutent.** Une tâche = un lot. Le lot 1 passe seul et
> en premier. Les lots 2 à 6 passent ensuite en parallèle : leurs fichiers sont
> strictement disjoints, aucun ne touche un fichier d'un autre. Le lot 7 ferme
> le chantier. Les étapes sont des cases à cocher, dans l'ordre. Ce document
> se suffit : tout ce qu'il faut savoir d'un autre lot est écrit au §0.

**But.** Un seul objet, l'étiquette, porte tout ce qui décrit une pièce ou un
look (prix, taille, état, numéro de passage, « Vendue »). On retire ce que la
DA interdit déjà (maillage 3D, pastilles de rabais, fausse urgence,
numérotations décoratives) et on répare les parcours sur téléphone (fil vers
pièce, « Acheter » introuvable, Messages sans entrée, liens morts vers
`/article`).

**Réserve à connaître avant de commencer.** La page `/article/[id]` ne sert
que le catalogue de démonstration (`catalog` vaut `[]` hors
`NEXT_PUBLIC_DEMO_ANNONCES=1`, `src/lib/mock.ts:161`). En production, une
pièce de membre n'a pas de fiche : on l'achète par le bouton « Acheter » de
sa carte. Donc **l'étiquette `fiche` et la barre d'achat ne se voient qu'en
démo**, et les états « Paiement en cours » et « Ta pièce » de la barre ne
sont atteints par aucune donnée réelle aujourd'hui. On les écrit quand même
(la conception les demande), en deux lignes d'affichage, sans autre logique.
Donner une fiche aux pièces de membres est une décision des fondateurs, hors
de ce chantier.

**Architecture.** Un composant `src/components/ui/Etiquette.tsx` à cinq
variantes, nourri par cinq fonctions pures (`src/lib/etiquette.ts`) et trois
jetons de filet. Les écrans le posent ; ils ne redessinent rien.

**Sources qui font foi.** `docs/superpowers/specs/2026-11-24-etiquette-design.md`
(la conception, on ne rouvre pas ses décisions), `design/DA.md`, et
`findings.json` (132 constats ; les identifiants cités ici en viennent).

**Règles communes à tous les lots.**

- Dépôt de travail : `/Users/fouzi/solange-etiquette` uniquement. Jamais
  `/Users/fouzi/solange`.
- Rien sous `netlify/`. Aucune dépendance. Pas de git, pas de serveur, pas de
  déploiement.
- Next 16 : aucun lot n'a besoin d'une API Next nouvelle. Si tu en touches une
  quand même, lis d'abord le guide dans `node_modules/next/dist/docs/`.
- Accessibilité acquise, à ne pas perdre : champs 16 px sur téléphone, cibles
  ≥ 44 px, labels reliés, groupes nommés, annonces par `announce()`,
  « Réduire les animations » respecté, texte secondaire en `text-ash`,
  contrastes ≥ 4,5:1 (texte) et ≥ 3:1 (contour de champ).
- Français, tutoiement, lexique DA §8. Pas de `any`, de `ts-ignore`,
  d'`eslint-disable` nouveau, de test affaibli.
- Vérification de fin de lot (sauf mention contraire) :
  `npm run lint`, `npx tsc --noEmit`, `npx vitest run`. Les lots 2 à 6
  peuvent voir un échec de types venu d'un autre lot en cours : ne corrige
  que tes fichiers, signale le reste.

---

## 0. Contrats communs

### 0.1 Jetons de filet (`src/app/globals.css`)

```css
/* dans @theme inline */
--color-line-hair: var(--line-hair);
--color-line: var(--line);
--color-line-strong: var(--line-strong);

/* hors @theme, après le bloc .theme-dark */
/* Filets : trois crans teintés bone (DA §4). Déclarés aussi sur .theme-dark :
   une variable qui cite var(--c-bone) se résout là où elle est déclarée,
   pas là où elle est lue. */
:root,
.theme-dark {
  --line-hair: color-mix(in srgb, var(--c-bone) 10%, transparent);
  --line: color-mix(in srgb, var(--c-bone) 20%, transparent);
  --line-strong: color-mix(in srgb, var(--c-bone) 45%, transparent);
}

/* après les trois blocs « contraste renforcé » existants */
@media (prefers-contrast: more) {
  :root,
  .theme-dark {
    --line: color-mix(in srgb, var(--c-bone) 40%, transparent);
    --line-strong: color-mix(in srgb, var(--c-bone) 70%, transparent);
  }
}
```

Utilitaires obtenus : `border-line-hair`, `border-line`, `border-line-strong`.
Tout nouveau filet passe par eux. Deux garde-fous :

- `--line-strong` fait 4,1:1 en sombre mais 2,9:1 en clair : c'est un bord
  décoratif. **Jamais** le seul porteur d'un état, **jamais** un contour de
  champ (les champs gardent `--field-border`, garanti à 3:1).
- Les blocs combinés `:root, .theme-dark` ont un prélude que le parseur de
  `a11y-css.test.ts` ne confond pas avec `:root` ni `.theme-dark` : aucun
  test existant ne lira un `color-mix()`.

### 0.2 Fonctions pures

`src/lib/etiquette.ts` (nouveau), testé par `src/lib/__tests__/etiquette.test.ts` :

```ts
import { conditions } from "./taxonomie";
import { euro } from "./utils";

/** Crans pleins pour un état de taxonomie.conditions : 4 (Neuf avec
    étiquette) à 1 (Bon état). 0 pour un libellé inconnu : aucun cran. */
export function niveauEtat(etat: string): number;

/** 6 -> « N°07 ». Position dans le fil, à partir de zéro. */
export function numeroPassage(index: number): string;

/** 1 -> « 1 pièce », 3 -> « 3 pièces ». */
export function nPieces(n: number): string;

/** Ce que lit un lecteur d'écran : « Taille 43, 290 € » ;
    sans prix : « Taille 42, vendue ». */
export function libellePiece(p: { size: string; priceEUR?: number }): string;

/** « Look numéro 7 » ; avec des pièces : « Look numéro 7, voir la pièce »
    ou « Look numéro 7, voir les 3 pièces ». */
export function libelleLook(index: number, pieces?: number): string;
```

`src/lib/utils.ts`, `euro(n: number): string` (signature inchangée) : milliers
groupés et espaces insécables (U+00A0), sans `Intl` pour que le serveur et le
navigateur rendent la même chaîne. `290` donne `290 €`, `5.99` donne
`5,99 €`, `12642` donne `12 642 €` (toutes les espaces sont insécables).

`src/lib/marche.ts` (lot 2) :
`marquesEnVente(pieces: readonly { brand: string; status?: string }[]): string[]`.

`src/lib/nav.ts` (lot 5, nouveau), testé par `src/lib/__tests__/nav.test.ts` :

```ts
import type { ApiNotif } from "./api";

/** /decouvrir, /article/…, /checkout/… : on est au Marché. */
export function dansMarche(pathname: string): boolean;

/** /article/… : la barre d'achat prend la place de la barre d'onglets. */
export function sansBarreOnglets(pathname: string): boolean;

/** Date (horloge du serveur) de la dernière notification de message ;
    0 s'il n'y en a pas. */
export function dernierMessage(
  notifs: readonly Pick<ApiNotif, "type" | "at">[],
): number;

/** Une notification de message non lue, plus récente que `vuA`. */
export function messageNonLu(
  notifs: readonly Pick<ApiNotif, "type" | "read" | "at">[],
  vuA?: number, // défaut 0
): boolean;
```

### 0.3 Le composant `Etiquette`

```tsx
// src/components/ui/Etiquette.tsx
import type { Item } from "@/lib/mock";

type Piece = Pick<Item, "size" | "priceEUR">;

export type EtiquetteProps = { className?: string } & (
  | { variant: "carte" | "barre"; item: Piece }
  | { variant: "vendue"; item: Pick<Item, "size"> }
  | {
      variant: "fiche";
      item: Piece & Pick<Item, "brand" | "name" | "condition">;
      sold?: boolean;
    }
  | { variant: "look"; index: number; pieces?: number; onOpen?: () => void }
);

export function Etiquette(props: EtiquetteProps): React.JSX.Element;
```

Constantes : surface `bg-coal`, texte `text-bone`, bord `border
border-line-strong`, angles vifs, ni ombre ni dégradé ni flou, **aucune
opacité sur l'étiquette ni sur ses textes**. Le talon est à gauche, fermé par
une perforation (`border-r border-dashed border-line-strong`) ; il ne porte
que l'œillet : un anneau à filet (`rounded-full border border-line-strong`)
avec un trou plein `bg-[var(--background)]`. Chiffres : `font-display
font-extrabold tabular-nums`. Libellés : classe `.etiquette text-[11px]
text-ash`. Rien sous 11 px. Pas de numéro de dépôt, pas d'encoches.

| Variante | Élément | Hauteur | Talon / œillet (trou) | Contenu, de gauche à droite | Lecteur d'écran |
|---|---|---|---|---|---|
| `carte` | `div` | 36 px | 20 / 9 (4) | `T. 43` (display 700, 12 px), filet `border-line`, prix calé à droite (display 800, 15 px) | visuel en `aria-hidden`, plus un `sr-only` = `libellePiece(item)` |
| `vendue` | `div` | 36 px | 20 / 9 (4) | `T. 42` en `text-ash`, puis le tampon fixe « VENDUE » à la place du prix (cadre `border-[1.5px] border-bone`, display 800, 11 px, `-rotate-2`). Aucun prix | `sr-only` = `libellePiece({ size })` |
| `barre` | `div` | 52 px | 20 / 9 (4) | prix (display 800, 17 px), filet, `T. 43` | **`aria-hidden` en entier**, pas de `sr-only` : la fiche vient de dire taille et prix |
| `fiche` | `div` | libre | 28 / 18 (8) | `h1` : marque (display 800, 22 px, capitales) puis nom (Hanken 17 px). Dessous, un `dl` à trois cases séparées par `border-line` : TAILLE (display 800, 22 px), ÉTAT (crans + mot en 13,5 px), PRIX (display 800, 34 px) | texte réel ; les crans sont `aria-hidden`, on lit « État : Bon état » |
| `look` | `button` si `onOpen`, sinon `span aria-hidden` | 36 px | 20 / 9 (4) | `N°07` (display 800, 15 px) ; si `pieces > 0` : filet puis `3 pièces` (11 px) | `aria-label={libelleLook(index, pieces)}`, `aria-haspopup="dialog"` |

Détails qui comptent :

- **Balises.** Hors `fiche`, toutes les parties internes (talon, œillet,
  filets, textes) sont des `span` en `flex` : la variante `look` est un
  `button`, qui n'accepte pas de contenu de bloc. `fiche` est la seule à
  contenir des blocs (`h1`, `dl`).
- **Débordement des bandes** (`carte`, `vendue`, `barre`). La taille d'une
  pièce de membre est un texte libre de 12 caractères au plus (« 38 FR / 6 UK »)
  et un prix va jusqu'à « 8 000 € », dans une carte d'environ 165 px. La
  taille porte `min-w-0 line-clamp-2 break-words leading-[1.15]` : deux lignes
  de 12 px tiennent dans les 36 px, et la carte est le seul endroit où cette
  taille se lit. Le prix porte `shrink-0 whitespace-nowrap` : il ne se coupe
  jamais. La hauteur de la bande ne bouge pas.
- **Débordement de la `fiche`.** Rien n'y est coupé (c'est la seule source).
  Le `dl` est une grille `grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]` : la
  taille passe à la ligne (`break-words`), le mot d'état aussi, le prix reste
  d'un seul tenant (`whitespace-nowrap`).
- `fiche` : porte sa marge haute de 16 px et un fil de 1 px (`bg-bone`,
  `aria-hidden`), centré sur l'œillet, qui part de 16 px au-dessus de son bord
  et s'arrête au centre de l'œillet (placé en haut du talon). La page la pose
  directement sous la photo, sans marge ni `gap`. Le fil est masqué à partir
  de `lg` (la photo passe à gauche, plus au-dessus). `sold` : la case PRIX
  montre le tampon fixe « VENDUE », sans prix. Elle rend le `h1` de la page :
  une seule `fiche` par page.
- Crans (fiche seulement) : quatre carrés de 10 px, `niveauEtat(condition)`
  pleins depuis la gauche (`bg-bone`), les autres à filet
  `border-line-strong`. Niveau 0 : pas de crans, le mot seul. Le mot porte
  l'information ; les crans sont un décor.
- `look` : monde sombre, donc renversée, `bg-bone`, sans bord ; perforation
  et filet en `border-ink/45` et `border-ink/20`. **Tout le texte en
  `text-ink`** (17,8:1), « 3 pièces » en `text-ink/70` (7,5:1), 11 px,
  graisse 600. **Jamais `text-ash` ni `.etiquette` ici** : `ash` sur `bone`
  tombe à 2,56:1. En bouton, la cible monte à 44 px par un pseudo-élément qui
  ne déborde que vers le haut (`relative before:absolute before:inset-x-0
  before:-top-2 before:bottom-0 before:content-['']`) : rien ne recouvre la
  rangée du pseudo, juste dessous. Non interactive, elle est `aria-hidden` :
  le titre masqué de la carte dit déjà la position.
- Le tampon fixe de `vendue` n'est pas `Stamp` : `Stamp` s'anime une fois,
  aux jalons. Ici c'est un `span` immobile.
- Aucun hook : pas besoin de `"use client"`.

### 0.4 `Chip` : la sélection ne se renverse plus

API inchangée (`active`, `onClick`, `radio`, `children`). Rendu :

- base : `relative inline-flex min-h-11 min-w-11 items-center justify-center
  whitespace-nowrap rounded-none border px-4 text-[13px] font-medium
  transition-colors` ;
- repos : `border-line text-bone/70 hover:border-line-strong hover:text-bone` ;
- choisi : `border-line-strong text-bone`, plus un point plein
  `<span aria-hidden className="absolute left-1.5 top-1/2 size-1.5
  -translate-y-1/2 rounded-full bg-bone" />`. Le point vit dans la marge
  gauche : le chip ne change pas de largeur. L'état est porté par le point et
  par `aria-pressed` / `aria-checked`, pas par le seul filet.

### 0.5 `Stamp`

Les deux objets en entier (l'opacité et la branche « Réduire les
animations » restent) :

```tsx
initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.15, rotate: -4 }}
animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -2 }}
```

Durée `DUR.move` et courbe inchangées. Jalons : pièce déposée, achat
confirmé, look publié. Aucun nouveau.

### 0.6 Choix d'architecte (là où la conception laissait la main)

1. `euro()` est corrigé à la source (insécables, milliers) : l'étiquette est
   son premier lecteur et un prix coupé en deux lignes la casse.
2. Sur ordinateur, la barre d'achat n'est pas collée : elle se pose dans le
   flux, juste sous l'étiquette `fiche` (`md:static`). « Acheter » est donc
   visible sans défiler (D-07) sans refaire la mise en page.
3. « Pièces du look » réutilise `ProductCard` dans la feuille : c'est la
   variante `carte`, sans seconde tuile à maintenir.
4. Point de non-lu de l'onglet Messages : le serveur n'expose aucun compteur
   de messages et `netlify/` ne bouge pas. Le point lit les notifications de
   type `message` **plus récentes que la dernière visite de Messages**,
   gardée dans `localStorage` (voir lot 5). Limite assumée : la mémoire est
   par appareil.
5. Onglet « Looks » du Marché : il ne liste plus que des looks. Le Journal
   sort de cette recherche (il a son entrée depuis le Profil et la colonne) :
   « Looks et Journal » ne tient pas sur un tiers d'écran, et annoncer
   « look » pour un article serait faux.
6. Le « + » et le sélecteur Looks / Pièces restent des blocs pleins sur le
   fil : la conception ne nomme que « Suivre ». Décision des deux fondateurs.
7. Les cartes des pièces de membres gardent leur bouton plein « Acheter »
   (plusieurs par grille) : la conception n'en parle pas, et c'est
   aujourd'hui leur seul chemin d'achat.
8. Le champ `originalEUR` du type `Item` est retiré au lot 7, quand plus
   aucun lot ne le lit.

### 0.7 Critique du plan : ce qui est intégré, ce qui est écarté

| # | Défaut relevé | Décision | Où |
|---|---|---|---|
| 1 | Liens vers `/article/<id>` pour des pièces de membres (404), y compris depuis le paiement et l'onglet « Gardées » | **Intégré.** Vérifié : `CheckoutView.tsx:443, 491, 506` et `store.tsx:375-381` (garde de type fausse) | 3.6, 6.2, 6.4, 7.2 |
| 2 | Point de Messages qui ne s'éteint ni ne se rallume | **Intégré, avec une variante.** Le repère « vu » est la date *serveur* du dernier message notifié (`dernierMessage`), pas `Date.now()` : deux horloges différentes laisseraient le point allumé. Il est posé en entrant dans Messages **et** en en sortant | 0.2, 5.1 à 5.3 |
| 3 | Barre d'achat `fixed` dans un ancêtre transformé | **Intégré.** La colonne qui la contient n'anime plus que l'opacité ; marges alignées sur `PageShell`. Reste les 0,45 s de `.page-enter` (toute la page apparaît en même temps) : à contrôler sur capture | 3.2, 3.3 |
| 4 | Contrastes de la variante `look` et de l'encart « déjà vendue » | **Intégré** | 0.1, 0.3, 1.6, 3.6 |
| 5 | Pièce vendue : la barre affichait encore le prix | **Intégré.** Vendue : pas d'étiquette `barre`. Carte d'un membre vendue : le bloc « Vendu » sous la carte disparaît | 2.3, 3.3 |
| 6 | Débordement dans les bandes | **Intégré, avec une variante.** `line-clamp-2` plutôt que `truncate` : la carte est le seul endroit où la taille d'une pièce de membre se lit. La fiche ne coupe rien | 0.3 |
| 7 | La fiche ne pouvait pas toucher la photo (grille, `gap`, arrondi, pastille) | **Intégré.** La pastille « n / N » de la photo est retirée : les vignettes portent déjà la position | 3.1, 3.2 |
| 8 | Fiche et barre visibles en démo seulement | **Intégré** : écrit en tête de ce plan et dans le compte rendu du lot 7 | en-tête, 3.3, 7.6 |
| 9 | Onglet « Looks » qui listait aussi le Journal | **Intégré** par le second remède proposé : la liste est filtrée aux looks | 0.6 (5), 2.1, 2.6 |
| 10 | Journal au « tu » : liste partielle | **Intégré** : une règle et un contrôle par `grep` | 6.9 |
| 11 | `LaunchScreen` accroché à `onTransitionEnd` | **Intégré** : deux minuteries. Un toucher appelle `onDone()` tout de suite (plus simple qu'une sortie partagée, et rien ne peut rester monté) | 5.6 |
| 12 | `Stamp` : consigne ambiguë | **Intégré** : les deux objets sont écrits en entier | 0.5 |
| 13 | Lecteur d'écran : carte, barre, bouton | **Intégré** | 0.3, 2.3 |
| 14 | L'étiquette `look` ajoute 40 px et sa cible débordait sur le pseudo | **Intégré** : écart assumé et écrit dans DA §5, cible vers le haut seulement | 0.3, 1.10, 4.3 |
| 15 | `FilterDrawer` : nom des groupes, « maison », « Trier par » | **Intégré** | 2.5 |
| 16 | Profil : trois entrées vers Gardées ; onglet « À vendre » vide pour un membre | **Intégré en partie.** « À vendre » montre les pièces disponibles du membre. Mais « Gardées » **reste** dans la rangée de liens : un invité n'a pas la statistique « Gardées », et la conception écrit « Cercles, Gardées et Journal s'ouvrent depuis le Profil ». En échange la statistique est renommée sans devenir un lien : deux entrées, pas trois | 6.1 à 6.3 |
| 17 | Code mort laissé | **Intégré, sauf `savedIds`** : `store.tsx:27, 165, 423` le lit encore. Seule la constante `savedItems` de `mock.ts` part, avec `liked()`, `MARQUES_PHARES` et `CreatorHeader.tsx` | 7.3 |
| 18 | « Mise en avant » écrit deux fois ; compteur de j'aime retiré sans le dire ; jetons sans contraste renforcé | **Intégré.** Le compteur de j'aime de la fiche part, et c'est dit (3.1). Les jetons sont redéclarés dans un seul bloc combiné plutôt que dans les trois blocs existants : même cascade, et aucun test existant ne lit de `color-mix()` | 0.1, 3.1, 6.5 |

Constaté en vérifiant, sans correction dans ce chantier : sur le fil,
`FeedTopBar` et `MobileTabBar` appellent tous deux `/api/notifications`
(`FeedTopBar` n'est dans aucun lot ; les fusionner demande un état partagé).

---

## Lot 1 — Fondations

**Dépend de :** rien. **Fichiers :**

- Créer : `src/components/ui/Etiquette.tsx`, `src/lib/etiquette.ts`,
  `src/lib/__tests__/etiquette.test.ts`, `src/lib/__tests__/utils.test.ts`
- Modifier : `src/lib/utils.ts`, `src/lib/__tests__/legal.test.ts`,
  `src/app/globals.css`, `src/lib/__tests__/a11y-css.test.ts`,
  `src/components/ui/Chip.tsx`, `src/components/ui/Stamp.tsx`,
  `design/DA.md`, `design/composants.md`

**Constats :** DA-02, DA-16 (jetons), DA-17, SLOP-04, SIG-01, SIG-02 (crans),
SIG-05 (cotes du tampon, « Vendue » tamponnée), SIG-07, D-09 (point 2),
DA-15, TXT-10, P11, D-14 (pour `euro` seulement).

- [ ] **1.1 Tests d'abord, `etiquette.test.ts`.** Cas : `conditions.map(niveauEtat)`
  vaut `[4, 3, 2, 1]` ; `niveauEtat("")` et `niveauEtat("Correct")` valent 0 ;
  `niveauEtat(" Bon état ")` vaut 1 ; `numeroPassage(0)` = `N°01`,
  `numeroPassage(6)` = `N°07`, `numeroPassage(99)` = `N°100` ; `nPieces(1)` =
  `1 pièce`, `nPieces(3)` = `3 pièces` ; `libellePiece({ size: "43",
  priceEUR: 290 })` = `Taille 43, ${euro(290)}` ; `libellePiece({ size: "42" })`
  = `Taille 42, vendue` ; `libelleLook(6)` = `Look numéro 7` ;
  `libelleLook(6, 1)` = `Look numéro 7, voir la pièce` ; `libelleLook(6, 3)` =
  `Look numéro 7, voir les 3 pièces`. Lancer : échec attendu (module absent).
- [ ] **1.2 Écrire `src/lib/etiquette.ts`** (signatures du §0.2). `niveauEtat` :
  position du libellé, espaces de bord retirés, dans `conditions` ; `longueur
  − position`, 0 si absent. Relancer : vert.
- [ ] **1.3 `euro()`.** Écrire `utils.test.ts` : `euro(290)` = `"290 €"`,
  `euro(5.99)` = `"5,99 €"`, `euro(12642)` = `"12 642 €"`,
  `euro(1234.5)` = `"1 234,50 €"`, `euro(0)` = `"0 €"` (espaces
  insécables U+00A0 partout). Échec attendu. Puis, dans `utils.ts` : partie
  entière groupée par `/\B(?=(\d{3})+(?!\d))/g`, virgule décimale, U+00A0
  avant `€`. Mettre le commentaire de la fonction à jour.
- [ ] **1.4 `legal.test.ts:113-117`.** Le texte des CGV est lu espaces aplaties
  (`\s+` couvre l'insécable). Attendre `"25 €"` (insécable) pour
  `plafond`, et comparer l'article avec `plafond.replace(/\s+/g, " ")` : même
  normalisation des deux côtés, assertion intacte.
- [ ] **1.5 `globals.css`.** Ajouter les jetons et le bloc « contraste
  renforcé » du §0.1. Supprimer la règle `.pulse-ring`, ses `@keyframes
  pulse-ring` et son entrée dans le bloc `prefers-reduced-motion` (le lot 5
  retire son seul usage). Ne rien changer d'autre.
- [ ] **1.6 `a11y-css.test.ts`.** Trois tests de plus. (a) Le bloc de prélude
  `:root, .theme-dark` existe et déclare `--line-hair`, `--line`,
  `--line-strong` avec `var(--c-bone) 10%`, `20%`, `45%`. (b) Le bloc
  `:root, .theme-dark` sous `@media (prefers-contrast: more)` déclare `--line`
  à `40%` et `--line-strong` à `70%`. (c) Contraste calculé avec les aides du
  fichier, dans les thèmes « feed .theme-dark (OS clair) » et « contraste
  renforcé, .theme-dark » : `ink` sur `bone` ≥ 4,5 et `ink` à 70 % posé sur
  `bone` ≥ 4,5 (les deux couleurs de texte de l'étiquette `look`).
- [ ] **1.7 `Chip.tsx`** selon §0.4. Mettre le commentaire d'en-tête à jour
  (« choisi = filet fort + point plein, jamais le renversement »).
- [ ] **1.8 `Stamp.tsx`** selon §0.5. Commentaire : jalons = pièce déposée,
  achat confirmé, look publié (retirer « pièce vendue »).
- [ ] **1.9 `Etiquette.tsx`** selon §0.3, sans rien en oublier : `span` hors
  fiche, règles de débordement, couleurs de `look`, `barre` en `aria-hidden`,
  cible du bouton vers le haut. Sous-composants privés au fichier (talon avec
  œillet, crans, tampon fixe). Pas d'export autre que `Etiquette` et
  `EtiquetteProps`.
- [ ] **1.10 `design/DA.md`.** §4 : dire que les trois jetons existent, donner
  leurs utilitaires, leurs valeurs en contraste renforcé, et la règle
  « `--line-strong` n'est jamais un contour de champ ni le seul porteur d'un
  état ». §5 : le numéro de passage vit dans l'étiquette `look`, en bas à
  gauche du média, au-dessus du pseudo, suivi du nombre de pièces ; **la
  rangée ajoute 40 px au bloc du bas** (écart assumé avec « sans rien ajouter
  en hauteur ») ; on ne numérote rien d'autre (Journal, Live, en-têtes :
  retirés). §7 : écran de lancement réservé à l'app installée, 0,9 s au plus,
  fond uni, émergence du logo seule, il ne capte plus les touchers en
  sortant ; supprimés : maillage 3D, halo, anneau pulsé, cascade des lettres.
  §9 : anatomie (talon, perforation, œillet, pas de numéro de dépôt), le
  tableau des cinq variantes, les règles de débordement, les couleurs de la
  variante `look`, l'essai des crans (fiche seulement, à juger par les deux
  fondateurs), cotes du tampon et jalons (pièce déposée, achat confirmé, look
  publié), et la réserve : `fiche` et `barre` n'existent que là où une pièce
  a une page (la démo, aujourd'hui).
- [ ] **1.11 `design/composants.md`.** Ajouter `ui/Etiquette` (quand
  l'utiliser : tout ce qui décrit une pièce ou un look ; quand ne pas :
  décor, libellé de champ). `ui/Chip` : sélection par filet fort + point.
  `ui/Stamp` : retirer « Vendue » des jalons. `ui/ProductCard` : « Vendue »
  est l'étiquette `vendue`, plus un badge.
- [ ] **1.12 Vérifier.** `npm run lint && npx tsc --noEmit && npx vitest run`.
  Puis `grep -rn "euro(" src` : aucun appelant ne découpe ni ne compare la
  chaîne rendue (vérifié à la rédaction : seul `legal.test.ts` la compare).

---

## Lot 2 — Marché et filtres

**Dépend de :** lot 1. **Fichiers :** `src/components/ui/ProductCard.tsx`,
`src/components/ui/FilterDrawer.tsx`, `src/app/decouvrir/page.tsx`,
`src/lib/marche.ts`, `src/lib/__tests__/marche.test.ts`.

**Constats :** DA-02, DA-03, DA-05, DA-07 (recherche), SLOP-03, SLOP-04,
SLOP-06 (recherche), SLOP-09, SLOP-13 (onglet), P08, P09, P10 (carte,
recherche), P14 (signet), P15 (lien d'un membre, « Look »), TXT-01, TXT-02,
TXT-06, TXT-07, TXT-13 (onglets, « Look »), TXT-18 (champ, microtexte, puce
« Tout »), D-04, D-08 (recherche carrée), D-09, D-16, D-17, SIG-01, SIG-07,
branche:105, branche:106, branche:107, branche:111, branche:112, branche:114.

- [ ] **2.1 `marche.test.ts` d'abord.** (a) Nouveau `describe("marquesEnVente")` :
  dédoublonne, trie en français, ignore les marques vides et les pièces dont
  `status` n'est ni absent ni `"available"`. (b) Mettre à jour les attentes de
  `resultatsMarche` : `"12 pièces, 3 membres, 1 look"`, `"2 pièces, 0 membre,
  0 look"`, `"Aucune pièce ne correspond. 2 membres, 0 look"`. Échec attendu.
- [ ] **2.2 `marche.ts`.** `export function marquesEnVente(pieces: readonly
  { brand: string; status?: string }[]): string[]`. Dans `resultatsMarche` :
  `pluriel(profiles, "membre")`, `pluriel(content, "look")` ; commentaire à
  jour (`content` ne compte que des looks, voir 2.6). Vert.
- [ ] **2.3 `ProductCard.tsx`, la tuile.** Supprimer : le calcul `discount`
  (82-84), la pastille (109-114), la pilule d'état (128-131), la bulle
  d'achat rapide (132-140), le voile « Vendu » (142-151), l'import `Bag`.
  Photo : `relative overflow-hidden` + ratio, sans `rounded-2xl` ni `ring` ;
  le média seul (pas le bouton Garder) passe en `opacity-40` si vendue.
  Bouton Garder : icône `Bookmark filled={saved}` à la place de `Heart`.
  Collée sous la photo : `<Etiquette variant={sold ? "vendue" : "carte"}
  item={item} />`. Sous l'étiquette : marque (`font-display text-[11px]
  font-bold uppercase tracking-[0.14em] text-bone`), nom (`text-[13.5px]
  text-bone`, une ligne), état en toutes lettres (`text-[12px] text-ash`),
  puis la ligne « + envoi dès … » inchangée. Plus de prix ni de taille hors
  étiquette, plus de prix barré. **Lecteur d'écran** : l'`aria-label` du
  `Link` (243-247) remplace tout son contenu, donc il doit dire la taille et
  le prix lui-même : `` `${item.brand} — ${item.name},
  ${libellePiece(sold ? { size: item.size } : item)}` `` (le « , vendu »
  d'avant disparaît, `libellePiece` le dit). Carte d'un membre (un `div`, pas
  de `aria-label`) : le `sr-only` de l'étiquette est lu, rien à ajouter.
- [ ] **2.4 `ProductCard.tsx`, sous la carte d'un membre.** Vendue : supprimer
  le bloc « Vendu » (200-206), l'étiquette `vendue` le dit déjà. « Paiement en
  cours » reste. « Ton annonce » devient « Ta pièce ». Le bouton « Acheter »
  et « Contacter » ne bougent pas (§0.6, point 7).
- [ ] **2.5 `FilterDrawer.tsx`.** `reset` : `cats: []`. Supprimer la puce
  « Tout ». Remplacer `Pill` et `Square` par `Chip` (import `./Chip`) et
  supprimer les deux fonctions locales ; tailles et pointures en
  `flex flex-wrap gap-1.5` (chaque chip fait 44 px au moins). Sous-titres
  « Vêtements » et « Chaussures » : `text-[11px]`. `Tick` : choisi = `border-
  line-strong` avec un point `size-1.5 rounded-full bg-bone`, repos =
  `border-line`, plus de fond plein. Recherche de marques (195) et
  `PriceField` (519) : `border-[var(--field-border)]
  focus-within:border-[var(--field-border-focus)]` (pas `border-line-strong`,
  §0.1). **Groupes nommés** : dans `Row`, un `useId` de plus posé sur le
  `<span>` du libellé seul (387), et `role aria-labelledby={idDuLibellé}` sur
  le bloc déplié ; `Row` reçoit une prop `role?: "group" | "radiogroup"`
  (défaut `"group"`). Le nom du groupe est ainsi « Catégories », pas
  « Catégories Toutes ». **« Trier par »** : `<Row role="radiogroup" …>` et
  des `<Chip radio>` dans la grille à deux colonnes (un choix unique ne
  s'annonce pas en `aria-pressed` ; les flèches de `Chip` cherchent
  `[role="radiogroup"]`). **Marques** : sans recherche, la liste est
  `featuredBrands` (les marques en vente) précédée des marques choisies hors
  liste ; vide et sans recherche, ne rien afficher ; avec une recherche sans
  résultat : « Aucune marque ne s'appelle ainsi. » Microtexte : sans
  recherche « N marque(s) en vente. Tape un nom pour chercher parmi M. » ;
  avec recherche « N marque(s) trouvée(s) ». Le seul bloc renversé du tiroir
  est « Voir N pièces ».
- [ ] **2.6 `decouvrir/page.tsx`.** `EMPTY_FILTERS.cats = []`. Sous-titre :
  « Ce que les membres mettent en vente en ce moment. » Recherche : conteneur
  carré, `border border-[var(--field-border)] bg-[var(--field-bg)]
  focus-within:border-[var(--field-border-focus)]`, sans `glass` ni
  `rounded-full` ; le champ garde `text-base md:text-sm` ; bouton Filtres
  carré, cible de 44 px gardée. Placeholder : « Marque, pièce, membre… ».
  Onglets : « Pièces », « Membres », « Looks » (clés et identifiants
  inchangés). **L'onglet Looks ne liste que des looks** : `const
  looksTrouves = useMemo(() => results.content.filter((h) => h.type ===
  "post"), [results])` ; `counts.contenu` et la liste lisent `looksTrouves` ;
  les branches « Journal » de la liste (lien `/journal/…`, libellé, photo
  conditionnelle) disparaissent ; libellé de ligne « Look ». `searchAll`
  (`src/lib/data.ts`) ne bouge pas. Marques :
  `featuredBrands={marquesEnVente([...filterCatalog(), ...serverProducts])}`
  (mémoïsé), retirer l'import `MARQUES_PHARES`. Lien d'un membre trouvé
  (345) : `/membre/${encodeURIComponent(c.handle)}` (la page membre sait
  afficher un créateur de démo). Textes : 239 « Les pièces des membres n'ont
  pas chargé. » ; 332 « Cherche un nom ou un @identifiant pour trouver un
  membre. » ; 336 « Aucun membre ne correspond à … » ; 391 « Cherche une
  marque, un style ou un sujet pour trouver des looks. » ; 396 « Aucun look
  ne correspond à … ».
- [ ] **2.7 Vérifier.** Commandes de fin de lot. `grep -n "originalEUR\|Tout<\|rounded-full\|maison" src/components/ui/ProductCard.tsx src/components/ui/FilterDrawer.tsx` :
  il ne reste que le rond du bouton Garder et les points.

---

## Lot 3 — Fiche pièce et paiement

**Dépend de :** lot 1. **Fichiers :** `src/app/article/[id]/ArticleDetail.tsx`,
`src/app/article/[id]/page.tsx`, `src/app/checkout/[id]/CheckoutView.tsx`,
`src/components/checkout/RelayPicker.tsx`, `src/app/commande/[id]/page.tsx`.

**Constats :** DA-03, DA-04, DA-07 (retour carré), DA-08 (titre de la pièce),
DA-12 et SLOP-08 et P06 (pour `/article`), DA-15 (« Article »), SLOP-03,
SLOP-05 (titre), P03, P09, P10 (pilules), P14, P17 (nom de la pièce), P18,
TXT-02, TXT-06, TXT-07, TXT-09 (phrase fausse), TXT-12, TXT-19 (fiche),
D-03, D-04, D-07, D-16, D-17, D-19 (retour carré), SIG-01, SIG-02.

Rappel : cette fiche ne sert que le catalogue de démo (voir l'en-tête).

- [ ] **3.1 `ArticleDetail.tsx`, ce qui part.** Le titre Bodoni et la marque
  au-dessus (120-123), la ligne de prix entière (125-154 : prix barré,
  pastille, « Pièce unique »), le faux choix de taille et son état `size`
  (157-166), les pilules état et catégorie (167-174), le bloc d'actions du
  bas (244-285), la phrase « Commission dégressive reversée au vendeur. »
  (293). **Deux retraits à dire dans le compte rendu du lot**, car la
  conception ne les nomme pas : le compteur de j'aime à cœur (145-153), parce
  qu'une pièce ne se « j'aime » plus, elle se garde (P14, TXT-07) et que la
  notification « N personnes l'ont aimée » garde le chiffre ; la pastille
  floue « n / N » de la photo (63-67), parce que plus rien n'est posé sur la
  photo à part Garder et que les vignettes portent déjà la position
  (`aria-label` « Photo i sur N », `aria-pressed`). Imports devenus
  inutiles : `Chip`, `compact`, `Bag`, `Heart`.
- [ ] **3.2 Ordre de l'écran et grille.** Type de la prop : `item: DisplayItem`
  (import de type depuis `ui/ProductCard`). Grille (47) : `grid grid-cols-1
  gap-0 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12`. **Cellule 1** : la photo
  seule, sans `rounded-3xl` ni `ring` (le fil de l'étiquette doit toucher son
  bord), puis les vignettes en `hidden lg:block`. **Cellule 2** : `<Etiquette
  variant="fiche" item={item} sold={sold} />` en premier enfant, la barre
  d'achat (3.3), les vignettes en `lg:hidden`, la ligne vendeur, la
  description, le tableau, la protection, « Signaler cette pièce ». La rangée
  de vignettes est écrite une fois dans une constante et rendue deux fois.
  **Animation de la cellule 2** (114-118) : opacité seule, `initial={{
  opacity: 0 }} animate={{ opacity: 1 }}` ; sans cela, tant que le `y` joue,
  la barre `fixed` se cale sur la colonne et saute en fin d'animation. Bouton
  Garder : sur la photo, en haut à droite, rond `glass` de 44 px, icône
  `Bookmark`, `aria-label={`Garder ${item.brand} ${item.name}`}`,
  `aria-pressed`.
- [ ] **3.3 La barre d'achat.** Un seul bloc, dans la cellule 2 :
  `fixed inset-x-0 bottom-0 z-50 flex gap-2 border-t border-line
  bg-[var(--background)] pt-2.5 pl-[max(1.25rem,env(safe-area-inset-left))]
  pr-[max(1.25rem,env(safe-area-inset-right))]
  pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:z-auto md:mt-4
  md:border-0 md:bg-transparent md:p-0` (les marges latérales sont celles de
  `PageShell` : étiquette et bouton s'alignent sur la photo). Contenu :
  - en vente : `<Etiquette variant="barre" item={item} className="min-w-0
    flex-1 md:hidden" />` puis `<Button href={`/checkout/${item.id}`}
    className="min-h-[52px] flex-1" …>Acheter</Button>` (garder le
    `track("checkout_start", …)`). C'est le seul `Button` primaire de l'écran.
    Moitié-moitié : la recette d'origine (`flex-1 basis-1/2`) faisait grandir
    le bouton à 74 % de la largeur, l'étiquette `barre` n'avait plus que
    84 px à 390 px et son prix était rogné (il lui faut 141 px pour
    « 290 € | T. 43 »). Le code livré fait foi ;
  - `sold` : **pas d'étiquette `barre`** (aucun prix pour une pièce vendue) ;
    un bloc à filet sur toute la largeur, 52 px, `text-ash`, « Vendue » ;
  - `item.reserved` : étiquette `barre` puis le même bloc, « Paiement en
    cours » ; `item.mine` : « Ta pièce ». Deux lignes d'affichage, aucune
    autre logique : ces deux états n'existent pas sur une pièce de démo.
- [ ] **3.4 Le reste de la fiche.** Ligne vendeur : cadre carré `border
  border-line`, sans `glass` ni arrondi ; un seul lien à filet « Écrire à
  @{item.seller} » vers `/messages?item=…` (plus de « Contacter le vendeur »
  ni de « Faire une offre »). Tableau : Catégorie, Couleur, Matière, En
  ligne ; Marque, Taille et État n'y sont plus (une seule source :
  l'étiquette) ; affiché dès qu'une valeur existe.
- [ ] **3.5 `article/[id]/page.tsx`.** Bouton retour : `rounded-none` (les
  classes de celui de `PageHeader`). Rien d'autre.
- [ ] **3.6 `CheckoutView.tsx`, liens et étiquette.** Prop : `item: DisplayItem`
  (import de type depuis `ui/ProductCard` ; `MemberCheckout` passe déjà ce
  type, il ne change pas ; retirer les imports de type devenus inutiles).
  **Liens** : une seule constante `const retour = item.member ? "/decouvrir" :
  `/article/${item.id}``, utilisée par les deux boutons retour (443, 506) ;
  « Revoir la pièce » (491) n'est rendu que si `!item.member`. Une pièce de
  membre n'a pas de fiche : ces trois liens menaient à une page 404.
  **Les trois encarts qui décrivent la pièce** (succès 366-387, déjà vendue
  460-484, formulaire 545-572) : retirer `glass` et les arrondis ; photo,
  puis marque, nom, état, « Vendue par @… » ; dessous `<Etiquette
  variant="carte" item={item} className="mt-3" />`. Succès : `item={{ size:
  item.size, priceEUR: paidPrice }}`. Déjà vendue : `variant="vendue"`,
  retirer la pilule « Vendue » et la ligne « Taille · prix », et **retirer
  `opacity-70` du conteneur** (460) : l'opacité va sur la photo seule
  (`opacity-40`), jamais sur le texte ni sur l'étiquette.
- [ ] **3.7 `CheckoutView.tsx`, les mots.** « Article » devient « Pièce » (391,
  724) ; « Retour au feed » devient « Retour aux looks » (430, 488) ; le
  libellé de chargement « Enregistrement… » devient « Paiement… » (969) ;
  « Vendu par » devient « Vendue par » (566).
- [ ] **3.8 `RelayPicker.tsx:220`.** « Valider ce point relais » devient
  « Choisir ce point relais ». **`commande/[id]/page.tsx:774`.** « Article »
  devient « Pièce ».
- [ ] **3.9 Vérifier.** Commandes de fin de lot. `grep -n "originalEUR\|font-editorial\|Pièce unique\|Enregistrer" "src/app/article/[id]/ArticleDetail.tsx"` :
  seul le titre « Pièces similaires » garde `font-editorial`.
  `grep -n 'article/\${' "src/app/checkout/[id]/CheckoutView.tsx"` : une
  seule ligne, celle de `retour`.

---

## Lot 4 — Fil

**Dépend de :** lot 1. **Fichiers :** `src/components/feed/FeedCard.tsx`,
`src/components/feed/MemberPostCard.tsx`,
`src/components/feed/CarouselMedia.tsx`, `src/components/feed/ActionRail.tsx`,
`src/components/feed/ShopTheLook.tsx`, `src/components/feed/ShopCard.tsx`,
`src/lib/posts-demo.ts`, `src/lib/annonces-demo.ts`, `src/app/page.tsx`.

**Constats :** DA-02, DA-06 (« Suivre »), DA-11 et SLOP-11 et D-06 (« édition
Nº1 »), DA-13 et P01 et SLOP-07 (pastille « 1/4 »), SLOP-02, SLOP-03, P02,
TXT-02, TXT-03, TXT-06, TXT-12 (« Lien copié »), D-02, D-04, SIG-03, SIG-06
(looks liés).

La feuille « pièces du look » rend des `ProductCard` : son aspect final
dépend du lot 2, son code non (l'API `item`, `index` ne change pas).

- [ ] **4.1 Démo.** `posts-demo.ts` : `linkedProductIds:
  ["gucci-horsebit-1953-marron"]` sur `post-gucci-ss27-details`,
  `["maison-margiela-track-jacket-bleu"]` sur `post-margiela-future` ;
  corriger l'en-tête (« Rien à vendre » n'est plus vrai). `annonces-demo.ts` :
  retirer les trois `originalEUR` (54, 78, 102).
- [ ] **4.2 `ShopTheLook.tsx`.** Props : `{ pieces: DisplayItem[]; open: boolean;
  onOpenChange: (v: boolean) => void }`. Supprimer le déclencheur (aucun
  appelant), `variant`, `highlightId`, « Tout ajouter » et son état, le prix
  barré. Feuille : surtitre « Les pièces du look », titre `${nPieces(n)} à
  chiner`, corps `grid grid-cols-2 gap-3` de `<ProductCard>`. Garder
  `useFeedSheetContainer` tel quel (`CommentSheet` l'importe).
- [ ] **4.3 `FeedCard.tsx`.** `pieces` = `(look.linkedProductIds ?? [])` résolus
  par `catalogItem` (mémoïsé) ; `hasShop = pieces.length > 0` ; retirer
  `highlightId` et `openShop`. Première rangée du bloc du bas, avant le
  pseudo, dans son `motion.div variants={item}` : `<Etiquette variant="look"
  index={index} pieces={pieces.length} onOpen={hasShop ? () =>
  setShopOpen(true) : undefined} />`. La rangée ajoute 40 px au bloc du bas
  (écart assumé, DA §5) ; la cible du bouton ne déborde que vers le haut
  (§0.3), ne rien ajouter ici. « Suivre » en filet : sur le `TogglePill`,
  `className={following ? undefined : "border border-bone/45 bg-transparent
  text-bone hover:bg-bone/10"}` (la primitive ne change pas). Rail :
  `shopCount={pieces.length}`. « Copié » devient « Lien copié ».
- [ ] **4.4 `MemberPostCard.tsx`.** `taggedPieces` en `DisplayItem[]` :
  `catalogItem(id)` sinon `toDisplayItem(produitServeur)`. Même étiquette
  `look`, même place, `index` de la carte. Indice du cintre : « du look ».
  « Copié » devient « Lien copié ».
- [ ] **4.5 `CarouselMedia.tsx`.** Supprimer la pastille « n/N » (114-122) et la
  phrase qui la décrit dans le commentaire. Flèches et points inchangés.
- [ ] **4.6 `ActionRail.tsx`.** Repli « Shop » devient « Pièces » ; indice « à
  shopper » devient « du look ».
- [ ] **4.7 `ShopCard.tsx`.** Supprimer `off`, la pastille de rabais, le prix
  barré. Remplacer la ligne de prix et les deux cadres « Taille » / état par
  `<Etiquette variant={sold ? "vendue" : "carte"} item={item}
  className="max-w-[15rem]" />` suivi de l'état en texte. Voile vendu : garder
  l'assombrissement, retirer le cadre « Vendu » (l'étiquette le dit).
  « Vendu » devient « Vendue » (bouton), « Vendu par » devient « Vendue par »,
  « Copié » devient « Lien copié ».
- [ ] **4.8 `src/app/page.tsx`.** Supprimer le `span` « édition Nº1 · Paris »
  (44-46).
- [ ] **4.9 Vérifier.** Commandes de fin de lot (dont `feed-a11y.test.ts`).
  `grep -rn "Shop the look\|à shopper\|originalEUR\|Nº" src/components/feed src/app/page.tsx src/lib/posts-demo.ts src/lib/annonces-demo.ts` :
  rien.

---

## Lot 5 — Connexion, lancement, navigation

**Dépend de :** lot 1. **Fichiers :** `src/components/chrome/AuthScreen.tsx`,
`src/components/chrome/LaunchScreen.tsx`, `src/components/chrome/AuthGate.tsx`,
`src/components/chrome/MeshBackground.tsx` (supprimé),
`src/components/chrome/MobileTabBar.tsx`, `src/components/chrome/SideNav.tsx`,
`src/lib/nav.ts` (créé), `src/lib/__tests__/nav.test.ts` (créé).

**Constats :** DA-01, DA-07 (connexion), DA-12 et SLOP-08 et P06 (`/article`),
DA-18 (onglet actif, « Publier un look »), SLOP-01, SLOP-06 (connexion),
SLOP-14, P03, P04, P05, P14 (signet), TXT-05 (menus +), TXT-07, D-01, D-11,
D-17, SIG-04, branche:99, branche:100, branche:101, branche:102.

- [ ] **5.1 `nav.test.ts` d'abord.** `dansMarche` : vrai pour `/decouvrir`,
  `/article/x`, `/checkout/x` ; faux pour `/`, `/journal/x`.
  `sansBarreOnglets` : vrai pour `/article/x`, faux pour `/decouvrir` et
  `/checkout/x`. `dernierMessage` : 0 pour une liste vide ou sans message ;
  la plus grande date `at` parmi les notifications `type: "message"`, les
  autres types ignorés. `messageNonLu` : faux pour une liste vide, un message
  lu, un autre type non lu, un message non lu dont `at` vaut `vuA` ou moins ;
  vrai pour un message non lu dont `at` dépasse `vuA` ; sans second
  argument, vrai dès qu'un message est non lu. Échec attendu.
- [ ] **5.2 `src/lib/nav.ts`** selon les signatures du §0.2. Vert.
- [ ] **5.3 `MobileTabBar.tsx`.** Rendre `null` quand
  `sansBarreOnglets(pathname)` (après les hooks). Onglets : Looks, Marché
  (`match: dansMarche`), le « + », Messages (`/messages`, icône `Chat`),
  Profil. Point du Profil : `circlesUnread > 0` (les Cercles vivent
  maintenant sous Profil). **Point de Messages**, qui doit s'éteindre quand
  on lit et se rallumer quand on reçoit :
  - un effet qui dépend de `pathname` et de `user` ; sans `user`, il ne fait
    rien (pas de 401 pour un invité) et le point n'est pas rendu ;
  - `const surMessages = pathname.startsWith("/messages")` et une `ref`
    `etaitSurMessages` ; dans l'effet : `const vu = surMessages ||
    etaitSurMessages.current; etaitSurMessages.current = surMessages;` puis
    `api.notifications()` (avec le drapeau d'annulation habituel) ;
  - à la réponse : si `vu`, écrire `String(dernierMessage(notifs))` dans
    `localStorage` sous `solange:messages-vus` et éteindre le point ; sinon
    allumer le point si `messageNonLu(notifs, Number(lu) || 0)`. Lecture et
    écriture dans un `try/catch` (stockage bloqué : `vuA` vaut 0) ;
  - commentaire `// ponytail: repère « vu » par appareil ; un vrai compteur
    de messages non lus demande le serveur (netlify/), hors chantier.`

  Feuille du « + » : titre « Publier ou déposer », indice « Photos et
  inspiration, sans vente. »
- [ ] **5.4 `SideNav.tsx`.** Marché : `match: dansMarche`. Journal : `/journal`
  seulement. Gardées : icône `Bookmark`. Menu « + » : « Déposer une pièce »
  sans sous-ligne « Mettre en vente », « Publier un look » à la place de
  « Créer un look / Publier un édito ».
- [ ] **5.5 `AuthScreen.tsx`.** Supprimer l'import et le `<MeshBackground>`, le
  voile en dégradés (154-162), le halo (174-181), la cascade lettre à lettre
  du mot SOLANGE (un `h1` fixe, même typographie, `sr-only` gardé).
  Émergence du logo : `scale` et `opacity` seuls, `DUR.set`, `EASE.luxe` ;
  retirer l'assistant `blur` s'il ne sert plus et le retard de 0,5 s du bloc
  d'étapes. Champ e-mail : retirer `rounded-full`. Bouton : `<Button
  size="lg">` avec les mêmes `onClick`, `disabled={busy}`, `aria-disabled`,
  `aria-describedby` et la classe `aria-disabled:opacity-40`.
- [ ] **5.6 `LaunchScreen.tsx`.** Fond `bg-noir` uni : supprimer le maillage et
  le voile. 0,9 s en tout, **par deux minuteries dans le même effet, sans
  écouteur de transition** : à 660 ms `setSortie(true)` (classes `opacity-0
  pointer-events-none`, `transition-opacity duration-[240ms]`), à 900 ms
  `onDone()` ; sous « Réduire les animations », une seule minuterie,
  `onDone()` à 660 ms. Les deux sont annulées au démontage. Un toucher
  appelle `onDone()` tout de suite. Ce n'est plus un `motion.div` avec
  `exit`. Émergence du logo en `DUR.set`. Mot SOLANGE fixe.
- [ ] **5.7 `AuthGate.tsx`.** Lancement seulement si
  `matchMedia("(display-mode: standalone)").matches` (retirer la clause
  `max-width`) et si l'accueil est déjà passé (P05 : pas de lancement quand
  la connexion suit, son écran fait déjà émerger le logo). Rendre
  `{launch && <LaunchScreen onDone={endLaunch} />}` sans `AnimatePresence`
  (le fondu est interne). Écran d'attente : retirer
  l'anneau `pulse-ring`. Commentaires à jour.
- [ ] **5.8 Supprimer `MeshBackground.tsx`.** `grep -rn "MeshBackground" src` :
  rien. `design/login-3d/` ne bouge pas.
- [ ] **5.9 Vérifier.** Commandes de fin de lot.

---

## Lot 6 — Profil, dépôt, publication, Journal

**Dépend de :** lot 1. **Fichiers :** `src/lib/store.tsx`,
`src/app/profil/page.tsx`, `src/app/favoris/page.tsx`,
`src/app/vendre/page.tsx`, `src/app/creer/page.tsx`,
`src/app/notifications/page.tsx`, `src/app/membre/[handle]/page.tsx`,
`src/components/ui/PageHeader.tsx`, `src/app/journal/JournalView.tsx`,
`src/app/journal/[id]/page.tsx`, `src/app/live/StreamsView.tsx`,
`src/lib/journal.ts`.

**Constats :** DA-06 et D-10 (Premium en filet), DA-10 et SLOP-10 et P19 et
D-13 (folios), SLOP-13, P04, P12 (mots), P14, P16, P17 (Notifications),
TXT-03, TXT-04 (point 1), TXT-05, TXT-06, TXT-07, TXT-13, TXT-15, TXT-16,
TXT-17 (Premium, « Boost »), TXT-19 (« Membres suivis »), D-14 (état vide),
D-17, SIG-03, SIG-06.

- [ ] **6.1 `profil/page.tsx`, la navigation.** Sous les statistiques, une
  rangée `md:hidden` de trois liens à filet de 44 px : « Gardées »
  (`/favoris`), « Cercles » (`/communaute`, avec le point et le « , du
  nouveau » masqué si `circlesUnread > 0`), « Journal » (`/journal`). La
  statistique « Favoris » est seulement renommée « Gardées » : elle ne
  devient pas un lien (deux entrées vers la liste, pas trois ; un invité n'a
  pas cette statistique, d'où le lien dans la rangée).
- [ ] **6.2 `src/lib/store.tsx`, `savedItems()` dit vrai.** Aujourd'hui la
  fonction renvoie des `ApiProduct` bruts sous le type `CatalogItem` (garde
  de type fausse, 375-381) : `ProductCard` les prenait pour du catalogue et
  les liait à `/article/<id>`, une page qui n'existe pas. Type de retour :
  `(CatalogItem | ApiProduct)[]`, à la ligne 66 et dans la garde (`(it): it
  is CatalogItem | ApiProduct => it !== undefined`). Rien d'autre dans le
  store ; ne pas y importer `ProductCard` (cycle store ↔ carte). Les deux
  seuls appelants sont dans ce lot (6.3, 6.4).
- [ ] **6.3 `profil/page.tsx`, les onglets.** « Aimés » devient « Gardées » et
  lit `savedItems().map((it) => ("status" in it ? toDisplayItem(it) : it))`
  (retirer l'import de `liked` ; `src/lib/data.ts` ne bouge pas, le lot 7 y
  retire `liked()`). **« À vendre »** : pour un membre, ses pièces
  disponibles, `myProds.filter((p) => p.status === "available")
  .map(toDisplayItem)` ; pour un invité, `forSale()` comme avant. Liste
  vide : « Ta penderie est vide. Dépose ta première pièce. » puis `<Button
  href="/vendre">Déposer une pièce</Button>`, primaire pour un membre,
  `outline` pour un invité. « Premium » : `variant="outline"`. Un seul bloc
  renversé à l'écran : « Se connecter » pour un invité, « Déposer une pièce »
  pour un membre.
- [ ] **6.4 `favoris/page.tsx`.** Ligne 48 : la même conversion, `const saved =
  savedItems().map((it) => ("status" in it ? toDisplayItem(it) : it))`
  (import de `toDisplayItem`). Ligne 84 : « Vendeurs suivis » devient
  « Membres suivis ».
- [ ] **6.5 `profil/page.tsx`, les mots.** Statistiques : « Favoris » devient
  « Gardées », « Annonces » devient « Pièces ». « Mes annonces » devient « Mes
  pièces » ; « Retirer l'annonce » devient « Retirer la pièce » ; « Garder
  l'annonce » devient « Laisser en vente » ; « sans passer par une annonce »
  devient « sans passer par une pièce » ; « tes favoris » devient « tes
  pièces gardées ». Ne toucher à aucun `disabled={…}` (verrouillé par
  `focus-disabled.test.ts`).
- [ ] **6.6 `vendre/page.tsx` (TXT-05).** Surtitre « Au Marché » ; sous-titre
  « Des photos, un prix, une taille de colis. » ; « Titre de l'annonce »
  devient « Nom de la pièce » ; « Ton article » devient « Ta pièce » ; bouton
  « Mettre en vente » devient « Déposer la pièce » ; chargement « Dépôt… » ;
  aide « Ajoute … pour déposer. » ; « Connecte-toi pour déposer ta pièce. » ;
  succès : titre « Ta pièce est au Marché. », phrase « {nom} est déposée :
  tout le monde peut la voir au Marché. » ; l'annonce vocale (221) dit la
  même chose. Interrupteur de mise en avant (621-626) : le titre est déjà
  « Mise en avant 72 h » ; le sous-titre « Boost ta visibilité dans le feed ·
  2 € » devient « 2 € », rien de plus (ne pas répéter le titre).
- [ ] **6.7 `creer/page.tsx` (TXT-16).** Sous-titre « Tes photos, ta légende,
  les pièces que tu portes. » ; « Titre éditorial du post » devient « Titre
  du look » ; « Tagguer des marques » devient « Associer des marques » ;
  « Lier des articles de la marketplace » et « Tagguer des pièces »
  deviennent « Associer des pièces du Marché » ; « Tags tendances » devient
  « Mots-clés du moment » ; « Créer un autre post » devient « Publier un
  autre look » ; « Shop the look » devient « Les pièces du look » ; « Ton
  haul part dans le feed » devient « Tes achats partent dans les looks » ;
  annonce vocale (278) : « {titre ou "Ton look"} est publié. »
- [ ] **6.8 `notifications/page.tsx:82-85`.** Surtitre « Quoi de neuf », titre
  « Notifications », `marginWord="Notifications"`.
  **`membre/[handle]/page.tsx:283`.** « Profil introuvable » devient « Membre
  introuvable ». **Numérotations.** `PageHeader.tsx` : supprimer la prop
  `sectionNo` et son rendu. `JournalView.tsx` : supprimer `folio()`,
  `sectionNo={…}` et « Nº 01 — » devant « À la une ». `journal/[id]/page.tsx` :
  supprimer `folio()` et ses trois emplois (94, 133, 203), garder « Journal »
  et « Journal Solange ». `live/StreamsView.tsx:661-663` : « {n} à venir » à
  la place de « Nº 0n ».
- [ ] **6.9 `src/lib/journal.ts` (TXT-15).** Une règle, pas une liste : dans les
  lignes 35 et 51 à 58, **toute deuxième personne du pluriel adressée au
  lecteur passe au singulier** (verbes, impératifs, « vous », « votre »,
  « vos », « souvenez-vous » compris). « Une annonce qui ne part pas »
  devient « Une pièce qui ne part pas ». Le reste du texte ne bouge pas.
  Contrôle : `grep -nE "\b(vous|votre|vos)\b|[[:alpha:]]+ez\b"
  src/lib/journal.ts` ne rend plus rien (22 occurrences aujourd'hui, toutes
  dans ces lignes).
- [ ] **6.10 Vérifier.** Commandes de fin de lot. `grep -rn "sectionNo\|folio(\|Nº" src` :
  rien hors `checkout` (« N° et rue »). `grep -rn "savedItems" src` : le
  store, le profil et Gardées (plus la constante de `mock.ts` et `data.ts`,
  que le lot 7 retire).

---

## Lot 7 — Clôture

**Dépend de :** lots 1 à 6. **Fichiers :** `src/lib/mock.ts`,
`src/lib/data.ts`, `src/lib/brands.ts`,
`src/components/feed/CreatorHeader.tsx` (supprimé).

**Constats :** D-04 (fin : le champ du prix d'origine disparaît),
branche:109 (la liste des « maisons phares » n'existe plus).

- [ ] **7.1** `grep -rn "originalEUR" src netlify` : seule la ligne du type
  `Item` reste. La supprimer dans `src/lib/mock.ts`.
- [ ] **7.2 Balayage des références.** Chacune de ces recherches ne rend rien
  dans `src` : `MeshBackground`, `sectionNo`, `pulse-ring`, `highlightId`,
  `Shop the look`, `Pièce unique`, `édition Nº1`, `Retour au feed`. Puis
  `grep -rn 'article/\${' src` : chaque lien est soit dans la branche
  « catalogue » de `ProductCard` (`item.member` faux), soit gardé par
  `item.member` (`CheckoutView`), soit sur la fiche elle-même.
- [ ] **7.3 Code mort, après un `grep` de chaque nom.** S'il reste un appelant
  ou un test, s'arrêter et le signaler. À supprimer : `liked()` et son import
  de `savedItems` dans `src/lib/data.ts` ; la constante `savedItems` de
  `src/lib/mock.ts` (179-181) ; `MARQUES_PHARES` et son commentaire dans
  `src/lib/brands.ts` (la liste reste dans l'historique git) ;
  `src/components/feed/CreatorHeader.tsx`. **`savedIds` reste** : le store le
  lit (`store.tsx:27, 165, 423`).
- [ ] **7.4 CI à l'identique.** `npm run lint`, `npx tsc -p
  netlify/functions/tsconfig.json`, `npx vitest run`, `npm run build`. Tout
  vert, aucun test retiré ni affaibli.
- [ ] **7.5 Relire les fichiers modifiés** pour un bloc renversé en trop sur
  la fiche, le tiroir Filtres et le fil ; pour tout texte sous 11 px, toute
  opacité et tout `text-ash` sur fond `bone` dans `Etiquette.tsx`.
- [ ] **7.6 Compte rendu.** Y écrire noir sur blanc : « fiche et barre
  d'achat : démo seulement ; les pièces de membres s'achètent toujours par
  leur carte, décision à prendre par les fondateurs » ; les deux retraits non
  nommés par la conception (compteur de j'aime et pastille « n / N » de la
  fiche) ; la sortie du Journal de la recherche du Marché ; la suppression de
  `MARQUES_PHARES`.
- [ ] **7.7 À remettre au pilote** (hors de ce lot, il faut un navigateur) :
  - les 42 captures, les deux tests du flou, le scan axe des 12 pages ;
  - `/article` à t = 0 et à 1 s : la barre d'achat ne saute pas ;
  - le pire cas de l'étiquette, à 320 px et 375 px : taille de 12 caractères
    (« 38 FR / 6 UK »), 8 000 €, « Neuf avec étiquette », en `carte`, `barre`
    et `fiche` ;
  - le fil sur un écran court (700 px de haut au plus), légende dépliée :
    l'étiquette `look` ne chasse rien hors de l'écran ;
  - les états « Paiement en cours » et « Ta pièce » de la barre, forcés sur
    une pièce de démo modifiée à la main le temps de la capture ;
  - le point de Messages : reçu, lu, quitté, reçu de nouveau.

---

## Constats laissés de côté

Hors de la conception : signalés, pas corrigés. « (reste) » : la part du
constat que ce chantier ne traite pas.

- DA-06, D-10 (reste) : le « + », le sélecteur Looks / Pièces et les onglets pleins. La règle du bloc renversé pour la navigation demande une décision des deux fondateurs.
- DA-07, SLOP-06, P10 (reste) : pilules de Messages, des onglets de Gardées et du paiement, verre du tiroir. Non listés par la conception.
- DA-08, SLOP-05, P17 (reste) : en-tête de Messages, titres d'état et titres du Journal en Bodoni droit. Le Journal demande une exception écrite dans la DA.
- DA-09 : échelle typographique en jetons. Hors périmètre explicite.
- DA-10, SLOP-10, P19, D-13 (reste) : la une du Journal (aplat à halo, photo, métadonnées). Seuls les folios sont dans la conception.
- DA-11, SLOP-11, D-05, D-06 (reste) : curseur maison, mots géants, grain. Décision à deux, DA §1 à amender d'abord.
- DA-12, SLOP-08, P06, D-20 (reste) : barre d'onglets opaque, et masquée sur /checkout, /vendre, /creer. La conception ne la retire que sur /article.
- DA-13, P01, SLOP-07 (reste) : flèches du carrousel au toucher, recadrage 4:5, ombre du rail. Masquer les flèches toucherait un chemin d'accessibilité.
- DA-14 : durées en dur, reflet `.sweep`, zoom au survol. Non listé.
- DA-15, P11, SLOP-12 (reste) : cartes empilées du paiement, bloc Répartition, statistiques du profil, feuille Créer. Non listés.
- DA-16, D-18 (reste) : halos d'avatar, ombres des menus, icônes de la colonne, cloche en double. Non listés.
- DA-18 (reste) : tailles d'icônes, « + » rond ou carré, SVG local de Live. Finitions non listées.
- SLOP-04 (reste) : amender DA §1 sur l'overline. Décision des fondateurs.
- SLOP-13 (reste), TXT-11 : tirets cadratins. Hors lexique DA §8 ; à faire d'un coup.
- SLOP-14 (reste) : graisse du mot SOLANGE. Non listé.
- SLOP-15, TXT-14, P13, TXT-04 (points 2 à 5) : états vides de Cercles, Messages, Notifications, Gardées, Looks. Seule la penderie du profil est dans la conception.
- P03, D-07 (reste) : la barre d'achat ne répare « Acheter » que sur la fiche, donc en démo ; une pièce de membre n'a pas de fiche. Décision des fondateurs.
- P05 (reste) : phrase d'accueil sous le logo, aide sous le bouton grisé. Non listé.
- P07 : rayons sur la page du Marché, filtres actifs visibles. Non listé.
- P12 (reste) : barre fixe « Déposer ». Non listé.
- P15 (reste) : un look trouvé au Marché renvoie toujours en haut du fil. Hors périmètre (pas d'adresse par publication).
- TXT-08 : jargon et « simulé » du paiement. Non listé.
- TXT-09 (reste) : textes de commission de Déposer et de protection acheteur. Non listés.
- TXT-10 (reste) : `compact()`, note « 4,9 », insécables dans les chaînes, apostrophes. Seul `euro()` est traité.
- TXT-12 (reste) : phrase « a 7 jours pour l'expédier ». Contenu nouveau, à valider contre les CGV.
- TXT-13 (reste) : « Live / En direct », les trois sens de « fil ». /live est hors périmètre.
- TXT-17 (reste) : textes de /premium et /drops, « Invite, gagne. », masquer l'interrupteur de mise en avant. Pages et décision hors périmètre.
- TXT-18 (reste) : surtitres qui redisent le titre, « Circular », verbe unique « Chercher ». Non listé.
- TXT-19 (reste) : « vendeur·se » dans les textes de versement. Alignés sur les CGV.
- TXT-20 : casse de « afficher plus », suppression du compte, erreurs brutes. Finitions non listées.
- D-02 (reste) : étiquette « N°01 / 04 » à la place des tirets sur ordinateur. La conception garde les tirets.
- D-08, D-14 (reste) : largeurs du Marché et du profil sur ordinateur. Hors périmètre explicite.
- D-09 (point 3) : voile du tiroir sur ordinateur. Non listé.
- D-12 : mot de marge et « Solange — Éditorial » de `PageShell`. Non listé (19 appels).
- D-15 : commerce forcé en clair. Hors périmètre explicite.
- D-19 (reste) : en-tête du paiement par `PageHeader`. Non listé.
- SIG-02 (reste) : fil du « Neuf avec étiquette », teinte du papier, crans sur les cartes. L'essai est limité à la fiche.
- SIG-05 (reste) : tampon « Vendue » côté vendeur. La conception n'ajoute aucun jalon.
- SIG-06 (reste) : la tringle. Amendement DA à proposer, pas à coder.
- branche:103, branche:117, branche:121 : repli « paiement simulé » du mode démo. Touche au paiement.
- branche:104 : logo. Rien à corriger.
- branche:108 : « Trier par » ne trie pas les pièces des membres. Défaut fonctionnel hors conception.
- branche:110, branche:113 : doublons de la base de marques, tailles libres. Données, hors conception.
- branche:115, branche:116, branche:120 : médias de tiers, faux profils vérifiés, publication polémique. Décision des deux fondateurs.
- branche:118, branche:119 : achat de démo pour un membre connecté, données de démo dans le bundle. Hors conception.
- branche:122, branche:125, branche:126, branche:127, branche:128 : porte à code /acces et robots. Hors conception.
- branche:123, branche:124, branche:131 : Partager envoie le profil, `share.ts` en double. Hors périmètre explicite.
- branche:129, branche:130 : « afficher plus » à 32 px, hashtags en bone/70. À reprendre dans un passage accessibilité.

Vu en lisant le code, hors constats :

- Sur le fil, `FeedTopBar` et `MobileTabBar` appellent tous deux `/api/notifications`. À fusionner le jour où le store porte les notifications.
- La recherche « Membres » et « Looks » du Marché ne cherche que dans les données de démonstration (`searchAll`, `src/lib/data.ts`) : vide en production.
- Les cartes des pièces de membres portent chacune un bouton plein « Acheter » (plusieurs blocs renversés dans la grille du Marché) : voir §0.6, point 7.
