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
photo/fallback, l'état vendu (`soldBase` de la donnée source + `isSold()` du
store) et le CTA des pièces de membres. Taille et prix passent par
`ui/Etiquette` : « Vendue » est l'étiquette `vendue`, plus un badge. Ne pas
dupliquer en tuile locale (le doublon `ProductTile` de /membre est résorbé au
lot 0).

### `ui/Chip`

Sélecteur rectangulaire brutaliste (catégories, tailles, états). Choisi =
filet fort + point plein à gauche du mot, jamais le renversement (réservé à
l'action primaire de l'écran). Pas pour de la navigation (onglets) ni des
tags décoratifs.

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
- Migré sur : FeedCard, favoris, membre, decouvrir (seule
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

### `ui/Etiquette` — l'étiquette (signature, DA §9)

- **Utiliser pour** : tout ce qui décrit une pièce ou un look — taille, prix,
  état, « Vendue », numéro de passage. Cinq variantes : `carte` (bande collée
  sous la photo), `vendue` (la même, tamponnée, sans prix), `fiche` (page
  d'une pièce ; elle rend le `h1`, donc une seule par page), `barre` (barre
  d'achat, muette), `look` (N° de passage sur le fil ; avec `onOpen`, un
  bouton qui ouvre les pièces du look).
- **Ne pas utiliser pour** : un décor, un libellé de champ (`FieldLabel`), un
  badge qui ne décrit ni une pièce ni un look. Ne jamais redessiner un prix
  ou une taille à la main dans un écran : poser l'étiquette.
- Donne gratuitement : le texte lu par un lecteur d'écran (`carte`, `vendue`,
  `look`), les règles de débordement, la cible de 44 px du bouton `look`.
  Ses textes viennent de `lib/etiquette.ts`.

### `ui/Stamp` — le tampon (signature, DA §9)

- **Utiliser pour** : les VRAIS jalons uniquement — Payée, Déposée, Publié.
  Un par écran de succès, jamais ailleurs, jamais pour décorer.
- **Ne pas utiliser pour** : confirmations mineures (le changement d'état à
  l'écran suffit), badges permanents (utiliser l'étiquette overline), une
  pièce vendue (c'est l'étiquette `vendue`, immobile).

### `ui/ReportSheet`

- **Utiliser pour** : tout signalement (post, membre, pièce, message) — ne
  jamais recréer un prompt/flow local.

### `chrome/PushInvite` + `chrome/PushSettings` (lot 3)

- **PushInvite** : l'invitation aux notifications. Monté une fois dans le
  layout ; il décide SEUL de s'afficher (jamais au premier lancement,
  seulement après une action qui compte, au plus une fois par mois). Ne
  jamais l'appeler à la main depuis un écran.
- **PushSettings** : le bloc de réglages du profil. Ne s'affiche pas du
  tout quand le serveur n'a pas de clés VAPID (D-023) — on ne montre pas
  un interrupteur qui ne ferait rien.
- Les deux interrupteurs restants (dmOpen, NotifySwitch de Drops) plus
  ceux-ci font 3 usages : la primitive `Switch` devient justifiée, à
  extraire au prochain passage sur les réglages.

## À venir (lots suivants, voir DECISIONS)

Toast (si un besoin réel émerge — pour l'instant l'écran montre le résultat).
