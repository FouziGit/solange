# Composants — quand les utiliser, quand ne pas les utiliser

Une primitive par type. Toute nouvelle UI passe par elles ; en créer une
variante locale est un bug de revue. (Réf. DA.md pour les règles de forme.)

## Primitives consolidées (lot F2)

### `ui/Sheet` — bottom-sheet unique
- **Utiliser pour** : tout panneau qui monte du bas (pièces d'un look,
  commentaires, filtres, compose du `+`). `container="absolute"` quand il vit
  dans une carte du feed, `desktopSide` pour le rail droit md+ (filtres).
- **Ne pas utiliser pour** : du contenu qui tiendrait inline, une confirmation
  simple (préférer l'inline à deux temps, cf. suppression de compte), ou une
  page entière.
- Donne gratuitement : scrim, Échap, focus initial, `rounded-t-stage`,
  en-tête eyebrow+titre+fermer, filet.

### `feed/RailAction` — bouton du rail des cartes
- **Utiliser pour** : chaque action posée sur un média plein écran (like,
  commenter, garder, cintre, signaler). Rond par la règle carré/organique.
- **Ne pas utiliser pour** : des actions hors média (utiliser les CTA carrés).

### `ui/FieldLabel` — label de champ
- **Utiliser pour** : chaque champ de formulaire (au-dessus, jamais en
  placeholder). 11px plancher.
- **Ne pas utiliser pour** : des titres de section (PageHeader/eyebrow).

## Primitives existantes conservées

### `ui/PageShell` + `ui/PageHeader`
Structure de toute page hors feed : padding, dégagement tab bar, en-tête
surtitre serif + H1 griffe. Ne jamais recréer un header de page à la main.

### `ui/ProductCard` (+ `toDisplayItem`, `sortMemberProducts`)
La tuile pièce des grilles (Marché, profil). Gère photo/fallback, badge
Vendu, CTA Contacter des annonces membres. Ne pas dupliquer en tuile locale
(le doublon `ProductTile` de /membre est dette à résorber, cf. audit §5).

### `ui/Chip`
Sélecteur rectangulaire brutaliste (catégories, tailles, états). Pas pour de
la navigation (onglets) ni des tags décoratifs.

### `ui/Photo` / `chrome/Avatar` / `ui/LuxeMedia`
Image avec fallback ; avatar monogramme déterministe ; pile média éditoriale
des tuiles. Jamais de `<img>` nu dans un écran.

### `ui/GlassInput` (+ classe `.field`)
Saisie standard. Tout nouveau champ = `.field` (tokens focus inclus).

### `chrome/icons`
Le seul set d'icônes (stroke 1.6, tailles 16/20/24). Aucune icône locale,
aucun emoji.

### `ui/Button` — le CTA unique
- **Variantes** : `primary` (bloc renversé bone↔ink, carré — UNE occurrence
  par écran max), `outline` (filet carré, secondaire), `media` (pill glass —
  uniquement posé sur un média), `danger` (oxblood carré), `ghost` (texte).
- **Tailles** : `sm` (contexte dense), `md` (défaut, ≥ 44px), `lg` (pleine
  largeur, fins de tunnel).
- `href` → rend un lien ; sinon un bouton. Libellé = verbe d'action, toujours.
- **Ne pas utiliser pour** : le rail des cartes (RailAction), les chips de
  sélection (Chip), la navigation (onglets/nav).
- Migré sur : checkout (payer + 2 sorties de succès), vendre (2 sorties),
  membre (réessayer), profil (Premium, se connecter, supprimer). Le reste des
  CTA migre écran par écran en Phase 5.

## À venir (lots suivants, voir DECISIONS)
Squelettes de chargement, toast. Documentés ici quand ils existeront.
