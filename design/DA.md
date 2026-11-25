# DA — Solange

## 0. Le brief avant la forme

**Pour qui.** Celles et ceux qui chinent : 16–35, français·es, biberonné·es à
TikTok et Vinted, qui parlent « archive », « grail » et « très bon état »,
et pour qui un vêtement de seconde main n'est pas un rabais mais une trouvaille.

**Dans quel moment.** Mobile, posé, le soir ou dans les transports. Une session
commence comme un divertissement (scroller des looks) et bascule sans couture
vers la chine (regarder une pièce, écrire au vendeur, acheter). Personne
n'ouvre Solange « au bureau pour travailler » : c'est un plaisir, pas un outil.

**Ce que ça doit faire ressentir — trois adjectifs.**
1. **Précis** — chaque étiquette, chaque prix, chaque filet est net et aligné ;
   on sent la main d'un atelier, pas un template.
2. **Charnel** — la photo et la vidéo dominent ; la matière (cuir, laine,
   nylon) est le vrai contenu, l'interface s'efface devant elle.
3. **Calme** — pas d'urgence, pas de compte à rebours agressif, pas de confetti.
   La chine est une flânerie.

**Trois anti-adjectifs.** Criard (jamais de couleur d'alerte marketing),
gamifié (pas de points, pas de streaks visuels), corporate (pas de bleu SaaS,
pas de « solutions »).

**L'univers de référence — le vestiaire.** Les objets de Solange ne viennent
pas d'autres apps mais du monde réel du vêtement de seconde main : le
**cintre** (déjà l'icône du rail), l'**étiquette** cousue ou épinglée (prix,
taille, état), le **poinçon/tampon** (VENDU, DÉPOSÉ), le **numéro de passage**
d'un défilé (« Look N°07 »), le papier de soie, le lookbook, la penderie.
Chaque choix visuel ci-dessous doit pouvoir se raccrocher à l'un de ces objets.

---

## 1. Typographie

Trois faces, trois rôles écrits — inchangées (la marque existe, on l'affirme) :

| Face | Rôle | Règle d'usage |
|---|---|---|
| **Montserrat** (`--font-display`) | La **griffe** : titres d'écran, wordmark, CTA, chiffres forts | Caps + graisse 700–800 pour les H1 ; tracking large (0.2em+) réservé aux étiquettes/overlines ; jamais en pavé de texte |
| **Bodoni Moda italique** (`--font-serif`) | La **voix éditoriale** : surtitres, mots-portés (« Marketplace », « Circular ») | Toujours italique, toujours court (≤ 3 mots), jamais interactif |
| **Hanken Grotesk** (`--font-sans`) | Le **texte** : légendes, descriptions, formulaires | Interligne 1.5 ; corps ≥ 13px lu, ≥ 16px saisi (inputs mobiles) |

- Échelle unique (tokens `--text-*`) : 11 / 12 / 13.5 / 15 / 17 / 22 / 34 / 44.
  Les tailles hors échelle (`text-[9px]`, `text-[10px]`) sont fondues dans 11px
  minimum — en dessous, illisible sur mobile.
- `tabular-nums` sur tout chiffre aligné (prix, compteurs, codes).
- 3 niveaux hiérarchiques max par écran : griffe / voix / texte.
- Justification brief : la griffe = l'étiquette de marque cousue ; la voix
  serif = la légende de lookbook.

## 2. Couleur

**La signature chromatique de Solange est l'absence de chroma.** Six valeurs
nommées, toutes teintées chaud (déjà en tokens — on les garde) :

`ink` (noir vrai, feed) · `noir` (toile) · `coal` (surfaces posées) ·
`smoke` (filets) · `bone` (ivoire, texte/action) · `ash` (texte atténué).

- **Couleur signature : le renversement `bone ↔ ink`.** L'action primaire est
  toujours le négatif exact de sa surface (bloc ivoire sur monde sombre, bloc
  encre sur monde clair). Règle : **un seul bloc renversé par écran** — c'est
  lui, l'action primaire. Interdit : le renversement sur un élément secondaire.
- **Sémantiques sourdes** (nouveaux tokens, à définir dans `@theme` avec leurs
  deux thèmes) : `--c-danger` unique, un oxblood désaturé (≈ `#6e3a35` clair /
  `#c99b94` sombre — cuir passé, jamais le rouge Tailwind), contraste AA
  vérifié. Succès/info : pas de couleur — le mono + le mot suffisent
  (« Publié », tampon). La gamme `red-*` stock est bannie.
- Deux mondes assumés : feed = sombre, commerce = clair. La bascule est un
  choix (nuit du défilé / lumière de la cabine d'essayage) — on l'écrit au
  lieu de la subir.

## 3. Espacement et densité

- Base 4px, échelle Tailwind standard, **aucune valeur arbitraire** de padding.
- Gouttières : 12px (grilles produit mobile), 16px (page), 20px (md+).
- Densité : serrée dans les grilles marché et les listes (la penderie est
  pleine), aérée dans l'onboarding, les états vides et le checkout (on signe).

## 4. Formes et profondeur

**La règle des formes (écrite, enfin) — « carré = commerce, rond = organique » :**

| Forme | Usage exclusif |
|---|---|
| Angles vifs (0–2px, tokens actuels) | Tout ce qui se vend ou se remplit : cartes produit, champs, chips, CTA de commerce, étiquettes, badges |
| `rounded-full` | Ce qui est vivant ou posé sur le média : avatars, dots, le rail glass du feed, le switch Feed/Marché, le FAB `+` |
| `--radius-stage` (28px, nouveau token) | Uniquement le cadre téléphone du feed desktop et les bottom-sheets |

Toutes les autres valeurs (`rounded-2xl`, `rounded-xl` décoratifs, pills de
CTA commerce) sont normalisées. Justification brief : l'étiquette est carrée,
le cintre est courbe.

**Profondeur : une seule stratégie — le filet.** Hairlines teintées `bone` en
**trois crans**, déclarés dans `globals.css` et exposés en utilitaires. Tout
nouveau filet passe par eux :

| Jeton | Utilitaire | Valeur | En contraste renforcé |
|---|---|---|---|
| `--line-hair` | `border-line-hair` | 10 % | 10 % |
| `--line` | `border-line` | 20 % | 40 % |
| `--line-strong` | `border-line-strong` | 45 % | 70 % |

`--line-strong` fait 4,1:1 en sombre mais 2,9:1 en clair : c'est un bord
décoratif. Il n'est **jamais un contour de champ** (les champs gardent
`--field-border`, garanti à 3:1) **ni le seul porteur d'un état** (un chip
choisi a aussi son point plein). Le glass (`.glass`) est réservé aux surfaces
posées sur un média (rail, barres flottantes). Les ombres sont bannies
**sauf** une exception écrite : l'ombre du stage feed desktop (profondeur de
scène).

## 5. Structure

- **La numérotation dit le vrai** : les looks du feed sont une vraie séquence →
  chaque carte porte son numéro de passage (« N°07 ») dans l'étiquette `look`
  (§9), en bas à gauche du média, juste au-dessus du pseudo, suivi du nombre
  de pièces quand le look en a — façon défilé. Cette rangée ajoute 40 px au
  bloc du bas : écart assumé avec « sans rien ajouter en hauteur », le média
  garde tout le reste. On ne numérote rien d'autre : ni le Journal, ni le
  Live, ni les en-têtes de page.
- Surtitre serif italique + H1 griffe : le couple existant, systématisé sur
  toutes les pages (déjà le cas via `PageHeader` — on le garde).
- L'**étiquette** (`ui/Etiquette`, anatomie au §9) est LE dispositif de mise
  en page : prix, taille, état, numéro de passage, « Vendue » — tout ce qui
  décrit une pièce ou un look vit dans une étiquette. Jamais d'étiquette pour
  du décoratif.

## 6. Iconographie et images

- Set maison `icons.tsx` uniquement (35 glyphes, stroke 1.6) — les 3 icônes
  locales de `StreamsView` y sont rapatriées. Trois tailles : 16 / 20 / 24.
- Une icône = navigation, action ou statut. Aucun emoji dans l'interface.
- Bouton icône seule : toujours `aria-label` (déjà largement le cas).
- Avatars : photo du membre si fournie, sinon initiales sur dégradé
  déterministe (graine = id du membre) ; portraits de démo réservés aux
  créateurs mock (`PORTRAIT_SEEDS`).
- Aucune illustration stock. Les états vides sont typographiques (voir voix).

## 7. Motion

Tokens de durée (nouveaux, dans `@theme`) : `--dur-micro: 140ms` (feedback
tactile), `--dur-move: 240ms` (transitions), `--dur-set: 480ms` (orchestration
max). Courbe canonique : `EASE.luxe` existant (`cubic-bezier(0.16,1,0.3,1)`)
en entrée, `ease-in` en sortie. Trois raisons de bouger : continuité spatiale,
feedback, direction de l'attention. Sinon : immobile.

- **Le moment orchestré** (signature motion) : l'entrée étagée de la carte de
  feed (média → étiquette → légende, stagger existant). Tout le reste de l'app
  est calme.
- **Fiche d'une pièce** : la page entre en fondu, sans glissement, pour que la
  barre d'achat (§9) soit en place dès la première image.
- Supprimés : blobs errants de l'AuthScreen (on garde la seule émergence du
  logo), keyframes morts (`shimmer`, `marquee`, `grain-shift`).
- **Écran de lancement** : réservé à l'app installée (`display-mode:
  standalone`), 0,9 s au plus, fond uni, l'émergence du logo seule. Il ne
  capte plus les touchers en sortant, et ne s'affiche pas avant la connexion
  (son écran fait déjà émerger le logo). Supprimés : maillage 3D, halo, anneau
  pulsé, cascade des lettres.
- `prefers-reduced-motion` : déjà respecté sur le feed, étendu partout.

## 8. Voix et ton

- **Registre : tu.** (Majorité écrasante de l'existant ; public Gen Z.)
  Appliqué sans exception, vouvoiement banni.
- Casse de phrase partout (pas de Majuscule À Chaque Mot). Les H1 display en
  capitales sont de la typographie, pas de la casse de texte.
- **Verbe d'action sur chaque contrôle**, et le même mot du bouton au résultat :
  Publier → Publié · Déposer → Déposée · Garder → Gardée · Suivre → Suivi ·
  Envoyer → Envoyé. « Valider », « OK », « Soumettre » : bannis.
- **Lexique canonique** (un objet = un nom, partout) :
  **pièce** (objet à vendre — jamais « article », « produit », « annonce » ne
  survit que dans « déposer une annonce » ? Non : *déposer une pièce*) ·
  **look** (post du feed) · **Marché** (l'onglet commerce ; « Découvrir » et
  « Boutique » disparaissent) · **Cercles** (communautés ; « Commu » disparaît) ·
  **Notifications** (« Alertes » disparaît) · **Garder / Gardées** (bookmark ;
  « Favoris » devient « Gardées ») · **membre** (personne) · **vendeur·se**
  (rôle dans une transaction).
- Erreurs : ce qui s'est passé + quoi faire, sans excuse ni « Oups ».
  Gabarit : « Le code a expiré. Redemande un code. »
- États vides : une phrase + l'action cœur. Gabarit : « Ta penderie est vide.
  Dépose ta première pièce. »
- Typographie française : espaces insécables avant `: ; ? !` et dans « … »,
  nombres `1 234,56 €`, dates françaises. Anglicismes assumés car lexique mode
  établi : *look, vintage, oversize, drop* (+ hashtags libres). Bannis : *shop,
  feed* dans la copy (l'onglet s'appelle « Défilé » ? — non : trop. L'onglet
  reste « Feed » ? Tranché : **« Looks »**, français par l'usage mode, dit le
  contenu réel).

## 9. Signature

**Un élément visuel : l'étiquette poinçonnée.** Un seul composant,
`ui/Etiquette`, porte tout ce qui décrit une pièce ou un look — prix, taille,
état, « N°07 », « VENDUE ». Reconnaissable flouté : une photo et, collée
dessous, une bande claire à talon.

*Anatomie.* Surface `coal`, bord `--line-strong`, angles vifs ; ni ombre, ni
dégradé, ni flou, ni opacité sur l'étiquette ou ses textes. À gauche, le
**talon**, fermé par une **perforation** (filet pointillé vertical). Il ne
porte que l'**œillet** : un anneau à filet, troué à la couleur de la page.
C'est le poinçon, et le seul rond de l'objet. Pas de numéro de dépôt : on ne
numérote que les looks (§5). Chiffres en Montserrat 800, `tabular-nums` ;
libellés en capitales espacées, 11 px, `ash` ; rien sous 11 px. L'étiquette
n'est jamais interactive, sauf `look` quand le look a des pièces.

| Variante | Où | Ce qu'elle porte |
|---|---|---|
| `carte` | Collée sous la photo : Marché, profil, Gardées, pièces d'un look, paiement. Exception, à valider par les deux fondateurs : dans le mode Pièces du fil, où la photo occupe toute la carte, la bande est posée dans le bloc du bas, sur le voile | Bande de 36 px : `T. 43` (Montserrat 700, 12 px), un filet, le prix calé à droite (800, 15 px). Marque, nom et état restent dessous, hors cadre |
| `vendue` | À la place de `carte` | La même bande : taille en `ash`, « VENDUE » tamponné à la place du prix, aucun prix. La photo passe à 40 % |
| `fiche` | Page d'une pièce, sous la photo | Œillet relié au bord bas de la photo par un fil de 1 px (masqué dès `lg`, où la photo passe à gauche). Marque en griffe (800, 22 px) et nom (Hanken 17 px) : c'est le `h1` de la page. Puis trois cases à filets : TAILLE (22 px), ÉTAT (crans et mot), PRIX (34 px) |
| `barre` | Barre d'achat de la fiche, sur téléphone | Bande de 52 px : prix (17 px) puis taille, à gauche du bloc « Acheter », qui prend un peu plus de la moitié de la largeur utile (ses marges intérieures en plus). Muette pour un lecteur d'écran : la fiche vient de tout dire |
| `look` | Fil, au-dessus du pseudo | Renversée : `N°07` (800, 15 px), puis « 3 pièces » (11 px). Avec des pièces, c'est un bouton qui les ouvre |

*Débordement.* La taille d'une pièce de membre est un texte libre de 12
caractères au plus, et un prix va jusqu'à « 8 000 € ». Dans une bande
(`carte`, `vendue`), la taille tient sur deux lignes de 12 px puis se coupe,
le prix ne se coupe jamais, la hauteur ne bouge pas. Quand la bande est trop
étroite (moins de 150 px : une carte du Marché sur un écran de 320 px), le
préfixe « T. » de la taille s'efface plutôt que de couper la taille ; la
hauteur de 36 px ne bouge pas. Dans la `barre`, s'il reste moins de 32 px
après le prix, la taille n'est pas affichée. Dans la
`fiche`, rien n'est coupé, c'est la seule source : la taille et le mot d'état
passent à la ligne, le prix reste d'un seul tenant. Les trois cases sont de
front dès que le corps de l'étiquette fait 312 px (écran de 390 px) ; plus
étroit, TAILLE et ÉTAT partagent une rangée et PRIX passe dessous.

*Couleurs de `look`.* Dans le monde sombre l'étiquette est `bone`, sans bord,
tout le texte en `ink` (17,8:1), « 3 pièces » en `ink` à 70 % (7,5:1),
perforation et filet en `ink` à 45 % et 20 %. Jamais `ash` ni la classe
`.etiquette` ici : `ash` sur `bone` tombe à 2,56:1. C'est le seul bloc
renversé de la carte, donc « Suivre » y passe en filet ; le « + » et le
sélecteur Looks / Pièces restent pleins tant que les deux fondateurs n'ont
pas tranché. Sur le fil, « Suivre » est un bouton à filet sur fond `ink` à
55 %, pour rester lisible sur un média chargé.

*L'état en crans (essai).* Sur la `fiche` seulement : quatre carrés de 10 px,
pleins depuis la gauche, le reste à filet fort. Neuf avec étiquette 4,
Excellent état 3, Très bon état 2, Bon état 1 ; un état inconnu n'a pas de
crans. C'est un décor : le mot porte l'information, un lecteur d'écran lit
« État : Bon état ». Ni sur les cartes ni dans les filtres tant que les deux
fondateurs n'ont pas jugé l'essai.

*Réserve.* `fiche` et `barre` n'existent que là où une pièce a une page :
aujourd'hui, le catalogue de démonstration. Une pièce de membre s'achète par
le bouton de sa carte ; lui donner une fiche est une décision des fondateurs.

**Une interaction : le tampon.** Aux vrais jalons seulement (pièce déposée,
achat confirmé, look publié), l'étiquette de confirmation (`ui/Stamp`)
s'applique d'un « coup de tampon » : scale 1.15→1 + rotation -4°→-2° en
`--dur-move`, `ease-out`, une fois. C'est l'unique célébration de l'app — pas
de confetti, pas de toast redondant. Sous `prefers-reduced-motion` :
apparition simple. « VENDUE » sur une étiquette n'est pas ce geste : c'est un
tampon immobile (cadre 1,5 px, Montserrat 800, 11 px, penché de -2°), un
état, pas une célébration.

**L'unique prise de risque esthétique** est là : un objet graphique (l'étiquette)
et un geste (le tampon) empruntés au vestiaire réel. Tout le reste — grilles,
formulaires, navigation — reste calme, conventionnel et discipliné (loi de
Jakob : l'originalité vit dans la DA, pas dans les mécaniques).

---

## 10. Auto-critique (avant la première ligne de code)

**« Est-ce que je produirais ça pour n'importe quelle app du même type ? »**

- *Mono noir/ivoire + serif éditorial* — honnêtement : oui, c'est adjacent aux
  tics « quasi-noir » et « journal » du catalogue. Ce qui l'en sort, et qu'on
  renforce au lieu de diluer : (a) l'univers vestiaire (cintre, étiquette,
  tampon, N° de passage) qu'aucun template ne porte ; (b) le renversement
  bone↔ink comme unique couleur ; (c) les deux mondes nuit/cabine assumés.
  **Changé après critique** : abandon de l'idée d'une couleur d'accent (même
  sourde) pour « différencier » — c'était LE réflexe générique ; la
  différenciation vient des objets, pas d'une teinte.
- *Blobs + halo + sonar de l'AuthScreen* — pur hero IA, exécution mono ne
  suffit pas à l'excuser. **Changé** : supprimés, seule l'émergence du logo
  reste (un geste, pas cinq).
- *Radius « brutaliste » proclamé mais pills partout* — le tic n'était pas le
  carré, c'était l'incohérence. **Changé** : règle carré=commerce/rond=organique
  écrite et exécutoire.
- *« Feed » comme nom d'onglet* — générique de toutes les apps. **Changé** :
  « Looks ».
- **Tests — état zéro (avant travaux)**, captures dans
  `audit/captures/da-tests/` : le **test du flou échoue aujourd'hui** —
  `blur-feed-375.png` pourrait être n'importe quelle app vidéo sombre,
  `blur-decouvrir-375.png` n'importe quelle marketplace claire ; le **test du
  logo échangé échoue aussi** (`logoswap-decouvrir-375.png` : un bandeau
  Vinted posé sur le marché ne détonne pas). C'est la mesure de départ qui
  justifie la signature §9 : étiquette systématisée + numéro de passage +
  renversement discipliné. Les deux tests sont re-passés en Phase 6 avec
  obligation de réussite.
