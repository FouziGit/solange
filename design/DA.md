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
**trois crans tokenisés** : `--line-hair` (10 %), `--line` (20 %),
`--line-strong` (45 %). Le glass (`.glass`) est réservé aux surfaces posées
sur un média (rail, barres flottantes). Les ombres sont bannies **sauf** une
exception écrite : l'ombre du stage feed desktop (profondeur de scène).

## 5. Structure

- **La numérotation dit le vrai** : les looks du feed sont une vraie séquence →
  chaque carte porte discrètement son numéro de passage (« N°03 ») dans
  l'étiquette basse — façon défilé. On ne numérote rien d'autre.
- Surtitre serif italique + H1 griffe : le couple existant, systématisé sur
  toutes les pages (déjà le cas via `PageHeader` — on le garde).
- L'**étiquette** (cadre hairline carré + overline trackée) est LE dispositif
  de mise en page : prix, taille, état, badges — tout ce qui décrit une pièce
  vit dans une étiquette. Jamais d'étiquette pour du décoratif.

## 6. Iconographie et images

- Set maison `icons.tsx` uniquement (35 glyphes, stroke 1.6) — les 3 icônes
  locales de `StreamsView` y sont rapatriées. Trois tailles : 16 / 20 / 24.
- Une icône = navigation, action ou statut. Aucun emoji dans l'interface.
- Bouton icône seule : toujours `aria-label` (déjà largement le cas).
- Avatars : initiales sur dégradé déterministe (existant, conservé) ; portraits
  réels seulement pour les créateurs mock du lookbook.
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
- Supprimés : blobs errants de l'AuthScreen (on garde la seule émergence du
  logo), keyframes morts (`shimmer`, `marquee`, `grain-shift`).
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

**Un élément visuel : l'étiquette poinçonnée.** Le cadre hairline carré à
overline trackée (déjà partout de façon informe) devient le motif conscient de
Solange — prix, état, taille, « N°07 », VENDU. Reconnaissable flouté : une
photo pleine page + une petite étiquette carrée claire.

**Une interaction : le tampon.** Aux vrais jalons seulement (pièce déposée,
achat confirmé, pièce vendue), l'étiquette de confirmation s'applique d'un
« coup de tampon » : scale 1.15→1 + rotation -4°→-2° en `--dur-move`,
`ease-out`, une fois. C'est l'unique célébration de l'app — pas de confetti,
pas de toast redondant. Sous `prefers-reduced-motion` : apparition simple.

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
