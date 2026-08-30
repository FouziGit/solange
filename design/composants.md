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

La tuile pièce des grilles (Marché, profil, profils publics). Gère
photo/fallback, badge Vendu (`soldBase` de la donnée source + `isSold()` du
store), CTA Contacter des annonces membres. Ne pas dupliquer en tuile
locale (le doublon `ProductTile` de /membre est résorbé au lot 0).

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

### `ui/TogglePill` — le toggle social unique (lot 0)

- **Utiliser pour** : tout engagement réversible envers une personne ou un
  contenu — Suivre/Suivi, Rejoindre/Rejoint, Me prévenir/Prévu, Réserver.
  Pill par la règle carré = commerce / rond = organique. off = bloc renversé
  (l'invite), on = filet + texte posé. `aria-pressed` d'office,
  `switchRole` pour un réglage marche/arrêt (role="switch").
- **Ne pas utiliser pour** : un achat ou une action à sens unique (Button),
  une sélection de filtre (Chip), un réglage à piste/pouce (le switch du
  profil et le NotifySwitch de Drops restent des interrupteurs — candidats
  à une primitive `Switch` quand les préférences de notification du Lot 3
  en créeront un 3ᵉ usage).
- Migré sur : CreatorHeader, FeedCard, favoris, membre, decouvrir (seule
  version carrée, normalisée), CommunityView, CommunityDetail, Drops
  (Réserver), Live (Me prévenir). Zéro implémentation locale restante.

### `ui/Button` — le CTA unique

- **Variantes** : `primary` (bloc renversé bone↔ink, carré — UNE occurrence
  par écran max), `outline` (filet carré, secondaire), `media` (pill glass —
  uniquement posé sur un média), `danger` (oxblood carré), `ghost` (texte).
- **Tailles** : `sm` (contexte dense), `md` (défaut, ≥ 44px), `lg` (pleine
  largeur, fins de tunnel).
- `href` → rend un lien ; sinon un bouton. Libellé = verbe d'action, toujours.
- **Ne pas utiliser pour** : le rail des cartes (RailAction), les chips de
  sélection (Chip), la navigation (onglets/nav).
- Migré sur : checkout, vendre, membre (réessayer, introuvable), profil
  (Premium, se connecter, supprimer, copier le code), not-found, error,
  ArticleDetail, ShopCard, ShopTheLook, FilterDrawer, PlanCards, Live,
  Drops (lot 0). **Plus aucun CTA texte hors Button** (balayage
  `audit/lots/00-filet.md`).

### `ui/Skeleton` (+ `SkeletonTile`, `SkeletonRow`)

- **Utiliser pour** : tout chargement de données — le squelette reproduit la
  mise en page à venir. Jamais de spinner plein écran, jamais de texte
  « Chargement… » seul. `aria-busy` sur le conteneur.
- **Ne pas utiliser pour** : du contenu instantané (mock statique).

### `ui/Stamp` — le tampon (signature, DA §9)

- **Utiliser pour** : les VRAIS jalons uniquement — Payée, Déposée, Publié,
  Vendue. Un par écran de succès, jamais ailleurs, jamais pour décorer.
- **Ne pas utiliser pour** : confirmations mineures (le changement d'état à
  l'écran suffit), badges permanents (utiliser l'étiquette overline).

### `ui/ReportSheet`

- **Utiliser pour** : tout signalement (post, membre, pièce, message) — ne
  jamais recréer un prompt/flow local.

## À venir (lots suivants, voir DECISIONS)

Toast (si un besoin réel émerge — pour l'instant l'écran montre le résultat).
