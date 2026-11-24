# L'étiquette — conception (24 novembre 2026)

## Pourquoi

Les fondateurs veulent « le moins d'AI slop possible » et le niveau du site
Au Bond, où une seule chose du sujet (la pression de la balle) porte toute
l'interface. Une revue sur 42 captures et le code (132 constats vérifiés,
dans `findings.json`, voir « Sources ») conclut : la rigueur est là, il manque
l'objet. Les trois tests de `design/DA.md` §10 échouent : flouté, le fil est
une app vidéo sombre quelconque et le Marché une marketplace crème
quelconque ; un logo Vinted posé dessus ne choque pas. L'étiquette
poinçonnée, le tampon et le numéro de passage promis par la DA §5 et §9
n'apparaissent sur aucun écran. À leur place : maillage 3D, pastilles de
rabais, pilules, fausse urgence.

## Buts

1. Un seul objet, **l'étiquette**, porte tout ce qui décrit une pièce ou un
   look : prix, taille, état, numéro de passage, « Vendue ».
2. Retirer ce que la DA interdit déjà et qui trahit le générique.
3. Réparer les trous de parcours sur téléphone trouvés par la revue.
4. Garder tout ce qui marche : accessibilité (0 défaut axe sur 12 pages),
   887 tests, paiement, textes longs.

## Hors périmètre (dit, pour que personne ne le fasse au passage)

- Refonte des mises en page ordinateur (Marché, profil, pièce étirés).
- Migration des 231 tailles `text-[..px]` vers une échelle de jetons.
- Forcer le monde clair du commerce quel que soit le réglage du système.
- Pages `/premium`, `/drops`, `/live`.
- Médias de tiers dans `public/` (droits) : décision des deux fondateurs.
- Adresse propre à chaque publication (le bouton Partager envoie le profil).
- Tout fichier sous `netlify/` : le serveur et le paiement ne bougent pas.

## Ce qui ferait de ce travail un échec

- L'étiquette cache le vêtement, ou devient un décor posé partout.
- Une couleur, une ombre, un dégradé, un verre dépoli de plus.
- Un parcours d'achat, de vente ou de connexion qui régresse.
- Un défaut d'accessibilité réintroduit.

## Approches

| | Contenu | Jugement |
|---|---|---|
| A. Nettoyage | Retirer les tics, remettre le N°, réparer les parcours | Propre, mais toujours « une marketplace bien tenue » |
| **B. L'étiquette** (retenue) | A + un seul objet du vestiaire, partout | Reconnaissable ; c'est notre « jaune de la balle » |
| C. L'état pilote | B + l'état de la pièce change l'étiquette | Le plus inimitable, risque de gadget |

Choix de Nouh (« fais au mieux ») sur recommandation : **B**, plus un essai
de C limité à la fiche pièce.

Pour la forme de l'étiquette, trois partis ont été maquettés et jugés sur
image par trois juges (reconnaissance au flou, DA, usage) : ticket de
dépôt-vente 20, étiquette volante 18, griffe cousue 13. Retenu : **la bande
du ticket, collée sous la photo**, parce qu'elle ne cache jamais la pièce et
que le prix tombe toujours au même endroit. On lui greffe l'œillet et le fil
de la volante. On écarte le numéro de dépôt du ticket : la DA §5 ne numérote
que les looks.

## L'étiquette : anatomie

Un seul composant, `src/components/ui/Etiquette.tsx`. Constantes communes :

- Surface : `coal` (la surface posée, la plus claire du monde clair). Bord :
  filet 1 px à 45 % du texte. Angles vifs. Ni ombre, ni dégradé, ni flou.
- Trois crans de filet, à créer comme jetons s'ils manquent (DA §4) :
  `--line-hair` 10 %, `--line` 20 %, `--line-strong` 45 % de `bone`.
- **Le talon** : à gauche, séparé du corps par une perforation (filet
  pointillé vertical à 45 %). Il porte **l'œillet** : un anneau à filet avec
  un trou de la couleur de la page. C'est le « poinçon » de la DA §9 et le
  seul rond de l'objet.
- Chiffres en Montserrat 800, `tabular-nums`. Libellés en capitales
  espacées, 11 px, `ash`. Rien sous 11 px.
- L'étiquette n'est jamais interactive par elle-même, sauf la variante
  `look` quand le look a des pièces.

### Variantes

**`carte`** — grille du Marché, profil, gardées, « pièces du look ».
Bande pleine largeur, collée sous la photo, 36 px de haut. Talon de 20 px
(œillet de 9 px, trou de 4 px), puis `T. 43` (Montserrat 700, 12 px), un
filet à 20 %, puis le prix calé à droite (Montserrat 800, 15 px). Sous
l'étiquette, hors cadre : la marque (Montserrat 700, 11 px, capitales,
interlettrage 0,14 em), le nom (Hanken 13,5 px), l'état en toutes lettres
(Hanken 12 px, `ash`). Plus rien n'est posé sur la photo, à part le bouton
Garder.

**`vendue`** — même bande ; le tampon « VENDUE » (cadre 1,5 px, Montserrat
800, 11 px, penché de −2°) prend la place du prix. La taille reste lisible.
La photo passe à 40 % d'opacité. Aucun prix affiché.

**`fiche`** — page d'une pièce. Sous la photo, reliée à elle par un fil de
1 px qui part du bord bas de la photo et s'arrête au centre de l'œillet.
Talon de 28 px, œillet de 18 px. Corps : la marque en griffe (Montserrat
800, 22 px, capitales), le nom dessous (Hanken 17 px). Puis trois cases
séparées par des filets à 20 % : TAILLE (valeur en Montserrat 800, 22 px),
ÉTAT (crans + mot, voir plus bas), PRIX (Montserrat 800, 34 px). Le `h1` de
la page contient la marque et le nom. Cette étiquette remplace le titre
Bodoni, la ligne de prix, les pilules et le tableau Marque / Taille / État
du bas de page : une seule source.

**`barre`** — barre d'achat collante de la fiche, sur téléphone, à la place
de la barre d'onglets (qui ne s'affiche plus sur `/article/*`). À gauche,
l'étiquette à plat, 52 px de haut : talon, prix (17 px), taille. À droite,
le bloc renversé « Acheter », au moins la moitié de la largeur, 52 px de
haut. C'est le seul bloc renversé de l'écran. Le bouton du bas de page
disparaît. Pièce vendue, réservée, ou la sienne : la barre le dit à la place
du bouton, avec les textes déjà en place.

**`look`** — fil. En bas à gauche du média, juste au-dessus de la ligne du
pseudo, sans rien ajouter en hauteur. Dans le monde sombre, l'étiquette est
`bone` avec le texte `ink` : c'est le seul bloc renversé du fil, donc
« Suivre » passe en bouton à filet. Talon, puis `N°07` (Montserrat 800,
15 px) ; si le look a des pièces, un filet puis `3 pièces` (11 px), et
l'étiquette devient un bouton qui ouvre les pièces du look. Elle remplace la
pastille « 1/4 » ; les tirets de progression du carrousel restent.

**Récapitulatif du paiement** — la pièce y est décrite par la variante
`carte`.

### L'état, en essai sur la fiche seulement

Quatre crans carrés de 10 px, pleins de gauche à droite, suivis du mot :
Neuf avec étiquette 4, Excellent état 3, Très bon état 2, Bon état 1. Cran
vide = carré à filet 45 %. Le Journal promet « l'état dit franchement » :
la jauge le montre. Les crans sont décoratifs pour un lecteur d'écran, qui
lit « État : Bon état ». Une fonction pure donne le niveau à partir du
libellé de `src/lib/taxonomie.ts`, avec un test. Les crans n'apparaissent
ni sur les cartes ni dans les filtres tant que les fondateurs n'ont pas
jugé l'essai.

### Le tampon

`Stamp.tsx` suit la DA §9 : échelle 1,15 → 1, rotation −4° → −2°, une fois.
Aucun nouveau jalon : pièce déposée, achat confirmé, look publié.

## Le reste du chantier, écran par écran

**Connexion et lancement**
- Retirer le maillage 3D des deux écrans et le halo derrière le logo. Fond
  uni, seule l'émergence du logo reste (DA §7).
- Champ e-mail carré (`.field`), bouton `Button` primaire carré.
- L'écran de lancement ne s'affiche que dans l'app installée
  (`display-mode: standalone`), 0,9 s au plus, et ne capte plus les touchers
  pendant sa sortie. `MeshBackground.tsx` est supprimé ; `design/login-3d/`
  reste comme exploration.

**Marché**
- Retirer la pastille de rabais, le prix barré et « Pièce unique », partout
  (carte, fiche, fil).
- Sous-titre : « Ce que les membres mettent en vente en ce moment. »
- Champ de recherche carré.
- Filtres : rien de coché veut dire aucun filtre ; le chip « Tout »
  disparaît. Un choix se marque par un filet fort et un point plein à gauche
  du mot, pas par le renversement : le seul bloc renversé du tiroir est
  « Voir N pièces ». Une seule primitive, `Chip`.
- Marques : d'abord celles qui ont une pièce en vente ; les autres
  seulement par la recherche. Contours des champs du tiroir à 3:1.

**Fiche pièce** — l'étiquette `fiche` et la `barre`, ci-dessus.

**Fil**
- L'étiquette `look` et le numéro de passage.
- Démo : relier au moins deux looks de démonstration à des pièces de
  démonstration, pour que le cintre du rail et le pont look → pièce se
  voient.
- Retirer les numérotations décoratives (« édition Nº1 · Paris », numéro du
  Live, folios du Journal, `sectionNo` de `PageHeader`).

**Navigation sur téléphone**
- Troisième onglet : Messages, avec son point de non-lu. Cercles, Gardées et
  Journal s'ouvrent depuis le Profil.
- État vide du profil : « Ta penderie est vide. Dépose ta première pièce. »
  avec le bouton « Déposer une pièce ».

**Voix** — appliquer le lexique de la DA §8 aux textes relevés par la
revue : pièce (pas article ni annonce), Gardées (pas Favoris), verbe du
bouton repris dans le résultat. Chaque réécriture est dans `findings.json`.

**DA** — mettre `design/DA.md` à jour dans le même travail : §5 (le numéro
de passage vit dans l'étiquette `look`), §9 (anatomie de l'étiquette,
variantes, essai des crans), §7 (écran de lancement).

## Contraintes

- Aucune dépendance nouvelle. Next 16 : lire `node_modules/next/dist/docs/`
  avant de toucher une API Next.
- Une logique pure extraite a son test ; aucun test affaibli.
- Les annonces réelles et celles de démonstration passent par les mêmes
  composants : le mode démo (`NEXT_PUBLIC_DEMO_ANNONCES=1`) sert à juger.
- Interface en français, tutoiement.

## Vérification

1. CI à l'identique : lint, types (app et fonctions), tests, build.
2. Mêmes 42 captures qu'avant, sur la branche, comparées une à une.
3. Tests de la DA refaits sur les captures floutées du fil et du Marché.
4. Scan axe des 12 pages : 0 défaut, comme avant.

## Laissé au constructeur

Le découpage en lots, les noms de props, la structure interne du composant,
les tailles exactes quand deux crans de l'échelle conviennent.

## Sources

- Constats : `findings.json` (132 entrées, chemin donné au constructeur).
- Maquettes de référence : `depot.html` (structure retenue) et
  `volante.html` (œillet, fil, proportions de la barre d'achat).
