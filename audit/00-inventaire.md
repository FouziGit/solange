# Phase 0 — Inventaire

> Audité sur https://solange-beta.netlify.app (== `main`), en invité (« Passer »).
> Captures : `audit/captures/phase0/` — 7 écrans cœur × 375/768/1440 + 11 écrans × 375.
> Mode : l'app assume UN thème par zone (feed = sombre, pages = claires via
> `theme-dark`/défaut) — il n'y a pas de toggle sombre/clair utilisateur.

## 1. Ce qu'est Solange

**Solange est une marketplace sociale de mode de seconde main : on scrolle des
looks en vidéo plein écran comme sur TikTok, et chaque pièce portée peut
s'acheter ou se vendre entre particuliers.**

- **Pour qui** : Gen Z / jeunes millennials français (15–40, cible BP), à l'aise
  avec les codes TikTok/Vinted, sensibles à la mode archive/vintage.
- **Moment d'usage** : mobile, posé, le soir ou dans les transports — session de
  scroll (divertissement) qui glisse vers la chine (achat impulsif considéré).
  *Hypothèse déduite du format vidéo plein écran + tab bar mobile-first.*
- **Action cœur** : **le scroll du feed** est l'action d'ouverture (route `/`,
  premier onglet), mais l'action qui crée la valeur est double :
  **acheter une pièce vue** (feed → cintre → tiroir → checkout) et
  **déposer une annonce** (bouton `+` central surélevé, position privilégiée).
  *Hypothèse : le `+` central dit que le produit veut d'abord des vendeurs
  (une marketplace meurt sans offre) ; le feed est l'aimant, la vente est la
  valeur.*

## 2. Stack exacte

| Couche | Choix | Détail |
|---|---|---|
| Framework | Next.js 16.3.3, App Router, React 19.2.4 | SSG + runtime Netlify, 63 routes |
| Langage | TypeScript 5 strict | 14 116 lignes dans `src/` |
| Styling | Tailwind CSS v4 (CSS-first) | tokens `@theme` dans `src/app/globals.css` ; `clsx` + `tailwind-merge` |
| État | React Context maison (`src/lib/store.tsx`) | session, likes/saves/follows, annonces serveur ; pas de lib d'état |
| Données | `fetch` maison (`src/lib/api.ts`) vers Netlify Functions | pas de cache SWR/React Query ; mock statique `src/lib/mock.ts` (1 352 l.) |
| Fonts | `next/font/google` : Montserrat (display), Bodoni Moda (serif éditorial), Hanken Grotesk (texte) | swap auto next/font ; PAS auto-hébergées au sens strict (Google Fonts pipeline next/font = self-host au build ✓) |
| Icônes | Set maison `src/components/chrome/icons.tsx` | 24×24, stroke 1.6, ~30 glyphes, cohérent |
| Animation | Motion 12 (`motion/react`) + keyframes CSS (`globals.css`) | `useReducedMotion` présent sur le feed |
| Build/CI | GitHub Actions : lint + tsc functions + vitest + build → deploy Netlify | `.github/workflows/ci.yml` |
| Tests | Vitest 4 — 2 fichiers, 15 tests | commission + filtres catalogue uniquement |
| Analytics | Aucun (pas d'événements — rien à préserver, rien à casser) | |
| Backend (hors périmètre) | Netlify Functions + Blobs, Resend | contrats API intouchés |

## 3. Observations visuelles factuelles (captures)

- **`checkout-375.png` — BLOQUANT** : débordement horizontal — libellé « VIA STRI… »
  coupé, champ CVC tronqué au bord droit ; le CTA invité « Se connecter/créer un
  compte » passe SOUS la tab bar flottante.
- **`decouvrir-375.png` — MAJEUR** : la première rangée de cartes produit passe
  sous la tab bar (titre « Veste motard… » et prix à moitié masqués) — le
  dégagement bas (`--tabbar-clearance`) n'est pas appliqué aux pages claires.
- **`vendre-375.png` — MAJEUR** : chips de catégorie (Streetwear/Luxe/Sneakers/
  Accessoires) à moitié sous la tab bar. Surtitre « Vendre = mettre en vente »
  (copy étrange). Registre « tu » ✓, labels visibles au-dessus des champs ✓.
- **`feed-1440.png`** : cadre téléphone centré, typo verticale décorative
  (« Circular », « Seconde Main », « édition N°1 · Paris ») ; le rail d'actions
  déborde à cheval sur le bord du cadre (cintre à moitié dehors) ; SideNav dit
  « Cercles » et « Alertes » quand la tab bar mobile dit « Commu » et que la
  page s'appelle « Notifications » — trois noms pour deux objets.
- **Thème** : feed sombre / pages commerce claires (ivoire). Cohérent en soi,
  mais la bascule sombre→clair feed→marché est brutale (aucune transition).
- Ce qui est déjà bon : hiérarchie typographique display (gros titres gras +
  surtitres serif italiques), chips carrées brutalisme assumé, safe-areas
  respectées sur le feed, icônes cohérentes, prix barrés lisibles.




---

## 4. Carte des écrans et parcours

Repo : `/Users/fouzi/solange` · branche `design/de-slop` · Chrome global monté dans `src/app/layout.tsx:95-101` : `AuthGate` enveloppe tout, `SideNav` (desktop, `md:flex`, `SideNav.tsx:48`) + `MobileTabBar` (`md:hidden`, `MobileTabBar.tsx:53`).

## 1. Carte des routes

19 routes `page.tsx`. Rendu : pas de `output: "export"` dans `next.config.ts` — build Next standard sur Netlify ; toutes les pages sont prérendues statiquement (aucun fetch serveur, données mock), sauf `/membre/[handle]` (route dynamique sans `generateStaticParams`, page `"use client"` via `useParams`, `membre/[handle]/page.tsx:1-12`).

| Route | Rôle | Racine | Rendu | Accès mobile | Accès desktop |
|---|---|---|---|---|---|
| `/` | Feed vidéo ⇄ boutique (toggle "Scroll/Boutique") | `FeedModeShell` (client, `page.tsx:36`) | SSG | Tab "Feed" (`MobileTabBar.tsx:28`), logo `FeedTopBar.tsx:74` | SideNav "Feed" + logo (`SideNav.tsx:15,50`) |
| `/decouvrir` | Marché : catalogue + recherche 3 onglets (Pièces/Profils/Contenu) + `FilterDrawer` ; accepte `?q=` (`decouvrir/page.tsx:48-50`) | page client | SSG | Tab "Marché" (`MobileTabBar.tsx:29`) | SideNav "Marché" (`SideNav.tsx:17`) + `FeedCard.tsx:391` (pont `?q=marque`), `vendre:329`, `membre:336`, `article:29` (retour) |
| `/communaute` | Cercles à rejoindre (mock, join local) | `CommunityView` (client) | SSG | Tab "Commu" (`MobileTabBar.tsx:30`) | SideNav "Cercles" (`SideNav.tsx:19`) |
| `/profil` | Mon profil : annonces, commandes, ventes, gate invité, footer légal | page client (682 l.) | SSG | Tab "Profil" (`MobileTabBar.tsx:31`) | Avatar bas de SideNav (`SideNav.tsx:156`) |
| `/creer` | Composer un post « look » (seul type actif) | page client (625 l.) | SSG | Sheet du FAB « + » (`MobileTabBar.tsx:119`) | Menu du FAB (`SideNav.tsx:140`) |
| `/vendre` | Dépôt d'annonce (photos, commission, boost) | page client (525 l.) | SSG | Sheet du FAB « + » (`MobileTabBar.tsx:126`) | Menu du FAB (`SideNav.tsx:129`) |
| `/article/[id]` | Fiche produit **catalogue mock uniquement** (`generateStaticParams` sur `catalog`, `article/[id]/page.tsx:11-13`) | `ArticleDetail` (client) | SSG | `ProductCard.tsx:189` (decouvrir, favoris, creer), `StreamsView.tsx:286`, retours checkout | idem |
| `/checkout/[id]` | Paiement simulé ; `dynamicParams = false` → **les annonces membres 404** (`checkout/[id]/page.tsx:12`) | `CheckoutView` (client) | SSG | `ArticleDetail.tsx:174`, `ShopCard.tsx:180`, `ShopTheLook.tsx:159` | idem |
| `/messages` | Inbox + fil ; `?item=` (offre), `?to=` (DM) | page client (529 l.) | SSG | **Aucune entrée nav** — contextuel seulement : `ArticleDetail.tsx:152,190`, `ProductCard.tsx:178`, `ShopCard.tsx:172`, `membre:199,415` | SideNav "Messages" (`SideNav.tsx:21`) |
| `/notifications` | Alertes (API si connecté, mock démo sinon) | page client | SSG | Cloche du `FeedTopBar.tsx:82` — **visible sur le feed uniquement** | SideNav "Alertes" + cloche desktop `FeedTopBar.tsx:135` |
| `/favoris` | Pièces enregistrées + vendeurs suivis | page client | SSG | **Aucune entrée mobile** | SideNav "Favoris" (`SideNav.tsx:20`) — seul lien entrant du site |
| `/journal` | Éditorial (liste) | `JournalView` | SSG | **Aucune entrée nav mobile** ; seulement les résultats "Contenu" de decouvrir (`decouvrir:384`) | SideNav "Journal" (`SideNav.tsx:18`) |
| `/journal/[id]` | Article éditorial (SSG sur `articles`) | page serveur | SSG | `JournalView.tsx:53,138`, decouvrir:384 | idem |
| `/live` | Streams live/replay | `StreamsView` | SSG | Dot live `FeedTopBar.tsx:61` — **seulement si `anyLive` et sur le feed** | SideNav "Live" + badge (`SideNav.tsx:16`) |
| `/drops` | Drops partenaires | `DropsView` | SSG | **ORPHELINE** | **ORPHELINE** |
| `/premium` | Plans d'abonnement + JSON-LD | page serveur | SSG | `profil:283`, upsell `vendre:431` | idem |
| `/membre/[handle]` | Profil public (API ou démo mock) | page client | dynamique (SSR à la demande) | `ArticleDetail.tsx:132`, `CreatorHeader.tsx:23`, `FeedCard.tsx:298`, `MemberPostCard.tsx:227,326`, `messages:387` | idem |
| `/mentions-legales` | Légal | page serveur | SSG | `profil:664`, `confidentialite:111` | idem |
| `/confidentialite` | RGPD | page serveur | SSG | `profil:673`, `mentions-legales:84` | idem |

### Routes orphelines et incohérences de nav

- **`/drops` est orpheline** : zéro `href` entrant dans tout `src/` (grep exhaustif) ; seule référence : `sitemap.ts:12`. Inaccessible sans taper l'URL.
- **MobileTabBar (4 items + FAB) vs SideNav (8 items + FAB + avatar)** : le mobile perd `/live`, `/journal`, `/favoris`, `/messages`, `/notifications`.
  - `/favoris` : accessible **uniquement** depuis la SideNav desktop → un utilisateur mobile qui « enregistre » une pièce (cœur, `ArticleDetail.tsx:197`, `ShopCard.tsx:113`) n'a aucun écran pour la retrouver (hors onglet du profil).
  - `/messages` : sur mobile, uniquement en passant par une fiche produit ou un profil membre — pas d'accès direct à l'inbox.
  - `/notifications` : cloche présente seulement dans `FeedTopBar` (rendu sur `/` uniquement) — invisible depuis Marché/Commu/Profil mobile.
  - `/live` : dot conditionnel (`anyLive`) sur le feed mobile ; jamais listé en nav mobile.
- **Labels divergents pour la même route** : `/communaute` = « Commu » mobile (`MobileTabBar.tsx:30`) vs « Cercles » desktop (`SideNav.tsx:19`). Options du FAB : mobile « Publier du contenu » / « Vendre un article » (creer d'abord, `MobileTabBar.tsx:118-131`) vs desktop « Déposer une pièce » / « Créer un look » (vendre d'abord, `SideNav.tsx:128-149`) — mêmes destinations, ordre et vocabulaire différents.
- **`/article` s'illumine sous « Journal »** : `SideNav.tsx:18` → `match: p.startsWith("/journal") || p.startsWith("/article")` — une fiche produit (marginWord « Boutique ») active l'item éditorial. Sur mobile, aucun tab ne matche `/article`, `/checkout`, `/messages`, `/vendre`, `/creer`.
- **Liens « profil » cassés vers soi-même** : 3 endroits lient le profil *d'un autre membre* vers `/profil` (mon profil) au lieu de `/membre/[handle]` : résultats "Profils" de la recherche (`decouvrir/page.tsx:318-319`), vendeurs suivis (`favoris/page.tsx:106`), pont créateur en fin d'article éditorial (`journal/[id]/page.tsx:186-187`).
- **Bouton mort** : « Faire une offre » du `ShopCard` (feed Boutique) est un `<button>` sans `onClick` (`ShopCard.tsx:187-193`) — ne fait rien (la fiche article, elle, route l'offre vers `/messages?item=`, `ArticleDetail.tsx:190`).

## 2. Parcours principaux (mobile, taps depuis l'ouverture)

Préambule : au **premier lancement**, `AuthGate` affiche `AuthScreen` plein écran (`AuthGate.tsx:54`). Sortie : « Passer · mode démo » = **+1 tap** (`AuthScreen.tsx:329`), ou connexion complète (parcours f). Les comptes ci-dessous partent d'un état déjà « onboardé » (flag `solange:onboarded`).

### a) Regarder le feed — **0 tap**
`/` s'ouvre directement en mode `scroll` (`FeedModeShell.tsx:16`), `VideoFeed` plein écran, snap vertical. Aucune friction.

### b) Acheter une pièce du catalogue (→ écran de succès)

| Voie | Séquence | Taps |
|---|---|---|
| Feed vidéo | ActionRail « shop » (`FeedCard.tsx:273`) → drawer ShopTheLook « Acheter » (`ShopTheLook.tsx:159` → `/checkout/[id]`) → « Payer … (simulé) » | **3** |
| Feed Boutique | Toggle « Boutique » (`FeedTopBar` tablist) → « Acheter » (`ShopCard.tsx:180`) → « Payer » | **3** |
| Marché | Tab « Marché » → `ProductCard` → `/article/[id]` → « Acheter — X € » (`ArticleDetail.tsx:173`) → « Payer » | **4** |

Frictions constatées dans le code : aucun champ à remplir — les 4 champs carte sont `readOnly` sur des valeurs démo (`CheckoutView.tsx:23-28,391-431`) ; **aucune étape adresse/livraison** (livraison 4,90 € forfaitaire, `CheckoutView.tsx:44`) ; achat invité autorisé (commande locale non persistée, bandeau `CheckoutView.tsx:484-501`) ; gestion 409 « déjà vendue » ; les drawers ShopTheLook/ShopCard **court-circuitent la fiche article** (feed → checkout direct).

### c) Déposer une annonce avec photo — **~7 taps in-app + 3 saisies** (session requise)
FAB « + » (1) → sheet « Vendre un article » (2) → `/vendre` → « Ajoute des photos » (3) → picker système (hors décompte) → champ Titre (4, saisie) → champ Prix (5, saisie) → chip État (6) → « Mettre en vente » (7) → succès inline dans l'aside.
- Obligatoires : **titre, prix, état** seulement (`vendre/page.tsx:49-54`, hint « Ajoute … pour publier » :486-489). Photos, marque, catégorie, taille, description **optionnelles** (jusqu'à 4 photos, redimensionnées client via `resizeImage`).
- Friction : invité → bouton « Se connecter » qui fait `localStorage.removeItem` + `location.reload()` (`vendre/page.tsx:131-136`) → **tout le formulaire saisi est perdu**.
- Préremplissage : aucun ; simulation commission/net vendeur en direct dans l'aside.

### d) Publier un post — **4 taps + 1 saisie** (session requise)
FAB « + » (1) → « Publier du contenu » (2) → `/creer` → champ Titre (3, saisie) → « Publier le look » (4).
- Seul le **titre** est requis (`creer/page.tsx:79-81`) ; photos optionnelles.
- Préremplissages existants : pièce taguée `["k1"]` et hashtag `["#archive"]` **pré-cochés d'office** (`creer/page.tsx:43-44`) — un post publié sans y toucher part avec ces tags.
- Le type de post est verrouillé : `const [kind] = useState<PostKind>("look")` sans setter (`creer/page.tsx:40`) — les branches « actu » / « achats » du code sont inatteignables.
- Même friction invité `location.reload()` (`creer/page.tsx:182-187`).

### e) Écrire à un vendeur — **3 taps pour arriver, 5 pour envoyer son texte**
Marché (1) → `ProductCard` (2) → « Contacter le vendeur » (`ArticleDetail.tsx:151-158`) (3) → `/messages?item={id}` → champ (4, saisie) → envoyer (5).
- **Une offre à −10 % est injectée automatiquement dans le fil, affichée comme déjà envoyée par « me », sans aucune action** (`messages/page.tsx:109-115` `offerMessage`, seed :173-178) — le libellé du CTA (« Contacter ») ne l'annonce pas.
- Depuis une annonce membre du feed Boutique : toggle (1) → « Contacter » (2) — 2 taps.
- Résolution du bon fil vendeur garantie (`threadForItem`, :55-65) ; persistance serveur seulement si connecté (`send()`, :262-278) — l'offre auto-injectée n'est jamais envoyée au serveur.

### f) Se connecter (email → code) — **2 taps + 2 saisies** au premier lancement
AuthScreen d'office → champ email (1, saisie) → « Recevoir le code » (2) → saisie du code 6 chiffres : **auto-vérification au 6ᵉ chiffre, zéro tap** (`AuthScreen.tsx:57-64`) → succès auto (1,5 s) → app.
- Bonnes pratiques présentes : `autoComplete="one-time-code"`, renvoyer/modifier l'email, entrée clavier.
- Friction majeure : **après « Passer », aucune entrée de connexion dans la nav**. Se connecter exige de trouver un encart invité (profil `:339`, vendre `:459`, creer `~:306`, checkout `:493`, bandeau notifications `:166` — ce dernier route vers `/profil`, pas vers la connexion) dont le bouton **supprime le flag et recharge la page** (`location.reload()`), détruisant l'état en cours.

## 3. Action cœur (hypothèses déduites de la structure)

Faits structurels : `/` = feed vidéo par défaut (mode `scroll`, `FeedModeShell.tsx:16`) ; position 1 des deux navs ; le seul élément saillant de la tab bar est le FAB central « + » (surélevé, `bg-bone`, `MobileTabBar.tsx:60-72`) qui mène à créer/vendre ; les chemins d'achat depuis le feed sont les plus courts de l'app (3 taps, checkout direct sans fiche) ; messages/favoris/notifications sont exclus de la nav mobile.

- **Hypothèse 1** : le produit privilégie la **consommation du feed shoppable + l'achat impulsif** — c'est le parcours le plus court et le plus câblé (checkout accessible depuis 3 surfaces, fiche article contournable).
- **Hypothèse 2** : la **création** (post/vente) est mise en avant symboliquement (FAB central unique) mais coûte 2 taps avant d'atteindre un formulaire, avec un choix binaire dont le vocabulaire diffère selon la plateforme.
- **Hypothèse 3** : le **social** (messages, notifications, favoris) est structurellement tertiaire sur mobile — accessible seulement en contexte — alors que la SideNav desktop le traite en pair. L'app mobile est un funnel feed→achat ; l'app desktop est un réseau social complet. Cette divergence de hiérarchie entre les deux navs est le signal structurel le plus fort de l'inventaire.


---

## 5. Inventaire des composants

Périmètre : `src/components/` (34 fichiers) + composants inline notables de `src/app/`. Branche `design/de-slop`. Lecture seule.

## A. Liste des composants

### `src/components/chrome/` (10)

| Composant | Fichier | Rôle |
|---|---|---|
| `AuthGate` | `chrome/AuthGate.tsx:16` | Gate onboarding/session : splash brandé puis `AuthScreen` ou l'app |
| `AuthScreen` | `chrome/AuthScreen.tsx:20` | Écran plein viewport email+code (`fixed z-[100] theme-dark`) |
| `Avatar` | `chrome/Avatar.tsx:6` | Avatar monogramme + portrait `Photo` en overlay (fallback gracieux) — 15 importeurs |
| `Brandmark` / `LogoMark` / `SMark` | `chrome/Brandmark.tsx:72,11,49` | Marque « S » en CSS mask, suit le thème via token `bone` |
| `CustomCursor` | `chrome/CustomCursor.tsx:27` | Curseur éditorial dot+ring `mix-blend-difference`, desktop only, `z-[100]` |
| `FeedThemeLock` | `chrome/FeedThemeLock.tsx:14` | Force `.theme-dark` sur `<html>` pour la route `/` uniquement |
| `GrainOverlay` | `chrome/GrainOverlay.tsx:2` | Grain film fixe plein écran (CSS `.grain`, z-90) |
| `MobileTabBar` | `chrome/MobileTabBar.tsx:34` | Tab bar mobile 4 onglets + FAB `+` ouvrant un compose bottom-sheet (`z-[60]`) |
| `SideNav` | `chrome/SideNav.tsx:25` | Rail desktop `w-[88px]` fixe + compose en **popover** (outside-click), pas en sheet |
| `icons` | `chrome/icons.tsx` | 35 icônes SVG maison exportées (Home… Hanger), pas de lib d'icônes |

### `src/components/feed/` (15)

| Composant | Fichier | Rôle |
|---|---|---|
| `FeedModeShell` | `feed/FeedModeShell.tsx:15` | Shell du home : switch Scroll/Boutique + rend `VideoFeed` ou `ShopFeed` |
| `FeedTopBar` | `feed/FeedTopBar.tsx:26` | Barre haute du feed : logo + switch coulissant + cloche |
| `VideoFeed` | `feed/VideoFeed.tsx:12` | Scroll vertical snap : `MemberPostCard` (backend) + `FeedCard` (looks mock) |
| `ShopFeed` | `feed/ShopFeed.tsx:19` | Feed Boutique : snap vertical de `ShopCard` |
| `FeedCard` | `feed/FeedCard.tsx:38` | Carte look plein écran : média, `CreatorHeader`, `ActionRail`, `ShopTheLook`, `CommentSheet` |
| `MemberPostCard` | `feed/MemberPostCard.tsx:79` | Carte post membre plein écran — « même gabarit que FeedCard » (son propre commentaire, :74) |
| `ShopCard` | `feed/ShopCard.tsx:20` | Carte produit shoppable plein écran (rail + CTA Acheter/Contacter) |
| `ActionRail` | `feed/ActionRail.tsx:55` | Rail droit like/comment/share/save du `FeedCard` (+ `Action` privé :15) |
| `CreatorHeader` | `feed/CreatorHeader.tsx:10` | Bloc auteur + bouton Suivre du `FeedCard` |
| `CommentSheet` | `feed/CommentSheet.tsx:15` | Bottom-sheet commentaires (absolute in-card, composer no-op) |
| `ShopTheLook` | `feed/ShopTheLook.tsx:11` | Pill trigger + drawer « Shop the look » (variant trigger/drawer/both) |
| `ProductHotspots` | `feed/ProductHotspots.tsx:9` | Pins hover→popover produit sur média — **jamais importé** |
| `ShopHotspots` | `feed/ShopHotspots.tsx:17` | Pins + chip marque/prix animés sur média — **jamais importé** |
| `KenBurnsMedia` | `feed/KenBurnsMedia.tsx:15` | Média « studio » génératif Ken Burns du FeedCard |
| `CarouselMedia` | `feed/CarouselMedia.tsx:14` | Carrousel horizontal snap n/N dans un post |

### `src/components/ui/` (9)

| Composant | Fichier | Rôle |
|---|---|---|
| `PageShell` | `ui/PageShell.tsx:8` | Wrapper page (padding, clearance tab bar, mot Bodoni marge) — 19 importeurs |
| `PageHeader` + `PAGE_TITLE` | `ui/PageHeader.tsx:12,9` | Header animé eyebrow/H1/subtitle/back — 10 importeurs ; `PAGE_TITLE` = échelle H1 canonique |
| `ProductCard` (+`toDisplayItem`, `sortMemberProducts`) | `ui/ProductCard.tsx:54` | Tuile produit grille (save, -%. vendu, CTA Contacter membre) — 7 importeurs |
| `Chip` | `ui/Chip.tsx:6` | Chip sélectionnable **rectangle brutaliste** `rounded-none` |
| `FilterDrawer` | `ui/FilterDrawer.tsx:35` | Drawer filtres Découvrir (sheet mobile / panneau droit desktop) |
| `GlassInput` | `ui/GlassInput.tsx:25` | Wrapper input/textarea appliquant `.field` — 2 importeurs seulement |
| `LuxeMedia` | `ui/LuxeMedia.tsx:22` | Pile média « still » luxe (gradient+key light+watermark+Photo+vignette) — 6 importeurs |
| `Photo` | `ui/Photo.tsx:14` | `<img>` avec fallback auto-retrait sur erreur |
| `PlanCards` | `ui/PlanCards.tsx:12` | Grille de plans Premium animée |

### Composants inline notables dans `src/app/`

| Inline | Fichier | Rôle |
|---|---|---|
| `ProductTile`, `PostThumb` | `membre/[handle]/page.tsx:143,211` | Tuiles produit/post du profil public |
| `Stat`, `ReferralCard` | `profil/page.tsx:31,44` | Stats + carte parrainage (bouton Copier avec état inline) |
| `Row`, `Field` | `checkout/[id]/CheckoutView.tsx:514,529` | Ligne récap + wrapper label de champ |
| `Label` ×2 | `creer/page.tsx:25`, `vendre/page.tsx:19` | Wrapper label overline — **copié-collé identique** |
| `StreamVideo`, `Eye`, `SoundIcon`, `LiveBadge`, `LiveTile`, `RemindToggle`, `UpcomingRow`, `ChatRow`, `ShoppableRail`, `Composer`, `Viewer` | `live/StreamsView.tsx:23-330` | 11 sous-composants live, dont 3 icônes hors de `icons.tsx` |
| `CommunityCard` | `communaute/CommunityView.tsx:38` | Carte communauté + bouton Rejoindre |
| `FeaturedCountdown`, `NotifySwitch`, `ProductRow` | `drops/DropsView.tsx:30,53,85` | Compte à rebours + toggle notif + rail produits |
| `FollowToggle` | `favoris/page.tsx:25` | Enième bouton Suivre (voir §2) |
| `NotifIcon` | `notifications/page.tsx:28` | Mapping type→icône |
| `MessagesInner` | `messages/page.tsx:117` | Tout l'écran messages (529 lignes, 1 fichier) |

---

## 1) Doublons et quasi-doublons

### Code mort (à supprimer ou brancher)

| Élément | Preuve |
|---|---|
| **`ProductHotspots.tsx` entier (143 l.)** | 0 importeur dans tout `src/` (grep `import.*ProductHotspots`) ; `FeedCard.tsx` n'importe que `ShopTheLook` (`FeedCard.tsx:20`) |
| **`ShopHotspots.tsx` entier (86 l.)** | 0 importeur ; même mécanique hotspot que ProductHotspots dans un 2e fichier — deux implémentations concurrentes du même pattern, toutes deux abandonnées |
| **`SMark` exporté** | `Brandmark.tsx:49` — utilisé uniquement en interne (`Brandmark.tsx:89`) ; export inutile |
| **Classe `.stage` fantôme** | posée sur `FeedCard.tsx:146` et `MemberPostCard.tsx:155` mais définie nulle part (absente de `globals.css`, aucun autre .css) |
| **CSS morts dans `globals.css`** | `.shimmer` (:376), `.marquee` (:395) + `@keyframes marquee` (:387), `@keyframes grain-shift` (:305), `.pt-safe` (:258) — 0 usage tsx (grep) |

### Quasi-doublons de composants

| Doublon | Preuve |
|---|---|
| **`ProductTile` (membre) ≈ `ProductCard`** | `membre/[handle]/page.tsx:143-209` réécrit à la main : overlay Vendu identique (:169-173 vs `ui/ProductCard.tsx:123-128`), bloc meta identique (`overline text-[9px]` / `text-[15px] font-bold` — :177-188 vs ProductCard:132-147), CTA « Contacter » aux classes identiques (:198-206 vs ProductCard:177-184). Seuls l'entrée d'animation et `LuxeMedia`→`Photo` diffèrent |
| **Triplet bouton de rail** | `ActionRail.tsx` `Action` (:15-54), `ShopCard.tsx` `RailButton` (:201-234), `MemberPostCard.tsx` `RailAction` (:32-70) — trois copies quasi identiques (`glass size-12 rounded-full` + label `text-[11px]`) ; ShopCard omet le `whileHover` que les deux autres ont |
| **Coquille de carte feed ×3** | className strictement identique (89 caractères dont `md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-[30px] md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]`) : `FeedCard.tsx:146`, `MemberPostCard.tsx:155`, `ShopCard.tsx:44` |
| **Chrome de bottom-sheet ×3** | `ShopTheLook.tsx:91-110`, `CommentSheet.tsx:43-61`, `FilterDrawer.tsx:90-109` : même scrim (`bg-ink/70 backdrop-blur-[2px]`), même panneau (`rounded-t-[28px] border-t border-bone/15 bg-coal/95 backdrop-blur-2xl`), même header eyebrow+`font-display text-xl`, même bouton fermer, même divider `mx-5 h-px bg-bone/10` — copié 3× au lieu d'une primitive Sheet |
| **Overlay « Vendu » ×3** | `ui/ProductCard.tsx:123-128`, `feed/ShopCard.tsx:80-86`, `membre/[handle]/page.tsx:169-173` — même `bg-black/55` + cadre `border-bone/60 uppercase tracking-widest` |
| **Wrapper label de champ ×4** | `creer/page.tsx:25-29` et `vendre/page.tsx:19-23` = fonction `Label` **identique** (`overline mb-2 block text-[9px] text-ash`) ; `CheckoutView.tsx:529-544` `Field` (variante `mb-1.5`) ; legends `FilterDrawer.tsx:115,143,173,191` (variante `mb-2.5`) |
| **Composer pill ×3** | className identique `glass h-11 flex-1 rounded-full px-4 text-base … md:text-[13.5px]` : `CommentSheet.tsx:101`, `live/StreamsView.tsx:309`, `messages/page.tsx:488` |
| **Search glass ×2** | `decouvrir/page.tsx:143-150` (py-3, icône size-5, text-sm) vs `messages/page.tsx:300-305` (py-2.5, size-4, text-base md:text-[13px]) — même pattern, dimensions divergentes |
| **Dot « ping » live ×2** | `MobileTabBar.tsx:164-167` vs `CommunityView.tsx:64-66` — même markup animate-ping recopié |
| **`LuxeMedia` bien factorisé, mais…** | son propre doc (`LuxeMedia.tsx:8`) mentionne un `MediaTile` d'ArticleDetail qui n'existe plus — commentaire périmé ; la recette « key light radial » reste dupliquée en inline dans `profil/page.tsx:540`, `creer/page.tsx:460` et `KenBurnsMedia.tsx:108-146` |

---

## 2) Variantes incohérentes du même pattern

### Boutons primaires (`bg-bone text-ink`) — 22 occurrences, 3 formes, ≥6 combos de taille

| Forme | Occurrences (extraits) |
|---|---|
| `rounded-none` explicite | `not-found.tsx:24`, `error.tsx:35`, `membre/[handle]/page.tsx:314,338`, `vendre/page.tsx:330`, `article/[id]/ArticleDetail.tsx:183` (px-6 py-3 ou min-h-11 px-5/px-6) |
| `rounded-full` | `profil/page.tsx:86` (px-3.5 py-2 text-[13px]), `:284` (px-4 py-2 text-sm), `:341` (min-h-11 px-5), `drops/DropsView.tsx:197` (px-5 py-2 text-xs), `live/StreamsView.tsx:288` (px-3 py-1.5 text-[12px]), `FilterDrawer.tsx:236` (px-5 py-2.5 text-sm), `ShopTheLook.tsx:162` (px-3.5 py-1.5 text-[11px]), `ProductHotspots.tsx:130` (py-2 text-xs), `PlanCards.tsx` bouton (:~68, `rounded-full py-3`) |
| **aucune classe de radius** (carré par défaut brutaliste) | `ShopCard.tsx:174,182` (`bg-bone px-6 py-2.5 text-sm`) |

Tailles de padding relevées sur le seul CTA primaire : `px-6 py-3`, `px-6 py-2.5`, `px-5 py-2.5`, `px-5 py-2`, `px-4 py-2`, `px-3.5 py-2`, `px-3.5 py-1.5`, `px-3 py-1.5`, `py-3.5` (`ArticleDetail.tsx:183`), `min-h-11 px-5/px-6`. `min-h-11` (touch target) est appliqué à certains CTA seulement.

### Bouton « Suivre » — 5 implémentations divergentes

| Lieu | Classes clés |
|---|---|
| `feed/CreatorHeader.tsx:68-70` | `rounded-full px-4 py-1.5 text-xs` ; suivi → `border-bone/25` |
| `feed/FeedCard.tsx:312-315` | `h-8 rounded-full px-3.5 text-[12px]` ; suivi → `border-bone/30 text-bone/80` |
| `favoris/page.tsx:34-38` (`FollowToggle`) | `rounded-full border px-4 py-1.5 text-[13px]` ; suivi → `border-bone/20 text-bone/70` |
| `membre/[handle]/page.tsx:403-407` | `min-h-11 rounded-full px-6 text-sm` |
| `decouvrir/page.tsx:347-351` | `min-h-11 border px-4 text-[12px]` — **carré** (seul sans `rounded-full`), + `hover:bg-bone/90` unique |

### Boutons secondaires / outline — opacités et hovers non canoniques

Bordures relevées : `border-bone/15`, `/20`, `/25`, `/30`, `/60` selon l'écran (ex. `creer/page.tsx:432` `/30 hover:bg-bone/10` ; `membre:417` `/25 hover:border-bone/60` ; `membre:498` `/25 hover:bg-bone/10` ; `ArticleDetail.tsx:154` `/25 hover:bg-bone/15` ; `CheckoutView.tsx:496` `/25 active:bg-bone/10`). Trois retours hover différents (`bg-bone/10`, `bg-bone/15`, `border-bone/60`) pour le même rôle.

### Chips / tags — 5 familles pour un seul pattern

| Famille | Preuve | Forme |
|---|---|---|
| `Chip` (canonique) | `ui/Chip.tsx:21-27` | `rounded-none border px-4 py-1.5 text-[13px]` |
| Boutons tri du FilterDrawer | `ui/FilterDrawer.tsx:128-132` | **`rounded-full`** `border py-1.5 text-[12px]` — mêmes couleurs que Chip, radius opposé, à 50 lignes des `Chip` qu'il utilise (:178) |
| Tags feed | `FeedCard.tsx:366`, `MemberPostCard.tsx:375`, `CommunityView.tsx:111` | carré `border-bone/20 px-2.5 py-1 text-[11px]` |
| Tags article/vendre | `ArticleDetail.tsx:120-123` (`rounded-full px-3 py-1 text-[12px]`), `:93` (`rounded-full … tracking-[0.14em]`), `creer/page.tsx:538` (carré `tracking-[0.14em]`) |
| Badges méta | `drops/DropsView.tsx:273` (`rounded-full px-2.5 py-0.5 text-[11px]`), `CheckoutView.tsx:252` (`rounded-full text-[10px] uppercase`) |

### Champs de formulaire — 4 mécaniques concurrentes

| Mécanique | Preuve |
|---|---|
| `.field` via `GlassInput` | `creer/page.tsx`, `vendre/page.tsx` (seuls importeurs — `ui/GlassInput.tsx`) |
| `.field` en classe brute | `CheckoutView.tsx:394,409,418,429`, `FilterDrawer.tsx:156,167`, `AuthScreen.tsx:198` — court-circuitent le composant |
| Pill glass ad hoc | `messages/page.tsx:488`, `live/StreamsView.tsx:309`, `CommentSheet.tsx:101` (`glass h-11 rounded-full`) |
| `bg-transparent` dans conteneur glass | `decouvrir/page.tsx:145`, `messages/page.tsx:302` |

Incohérence interne : `.field` est `border-radius: 0` « brutalist: sharp fields » (`globals.css:221`) mais `AuthScreen.tsx:198` le surcharge en `rounded-full`, et les composeurs pill ignorent `.field` entièrement.

### Sheets / modales — mécaniques divergentes

| Surface | Positionnement | z | Escape | `role="dialog"` |
|---|---|---|---|---|
| `ShopTheLook.tsx:84-91` | `absolute` (in-card) | 30/40 | non | non |
| `CommentSheet.tsx:36-43` | `absolute` (in-card) | 30/40 | non | non |
| `FilterDrawer.tsx:77-90` | `fixed`, sheet mobile / panneau droit desktop | 40/50 | non | **oui** (:83-85) |
| Compose `MobileTabBar.tsx:81-98` | `fixed`, sheet + grabber (:101, seul sheet avec grabber) | `z-[60]` | **oui** (:39-46) | oui (:92) |
| Compose `SideNav.tsx:31-45` | popover desktop, outside-click | 50 | oui | non |
| Menu `membre/[handle]/page.tsx:448` | `absolute` dropdown | 40 | non vérifié | non |
| `Viewer` `live/StreamsView.tsx:387` | `fixed` plein écran, sans scrim | `z-[70]` | oui (:339-345) | non |
| `AuthScreen.tsx:74` | `fixed` plein écran | `z-[100]` | — | — |

Aucun focus-trap nulle part ; gestion Escape et sémantique dialog présentes ou absentes au cas par cas.

### Toasts / feedback éphémère — 2 implémentations + 2 patterns inline

| Lieu | Style | Durée |
|---|---|---|
| `MemberPostCard.tsx:384-400` | `bg-black/70 ring-1 ring-bone/15 backdrop-blur`, positionné `calc(var(--tabbar-clearance) + 5.5rem)` | 2600 ms |
| `messages/page.tsx:508-518` | `bg-coal border-bone/10 shadow-xl`, positionné `bottom-[calc(7rem+env(safe-area-inset-bottom))]` | 3000 ms |
| `profil/page.tsx:51,88-95` | swap de label « Copié » dans le bouton | 1800 ms |
| `ShopTheLook.tsx:41-45` | swap « Ajouté » dans le CTA | persistant jusqu'à fermeture |

### Bouton fermer ×4 (cohérent mais copié-collé)

`grid size-9 place-items-center rounded-full bg-bone/10 text-bone` : `ShopTheLook.tsx:103`, `CommentSheet.tsx:54`, `FilterDrawer.tsx:102`, `MobileTabBar.tsx:110` (celui-ci ajoute `hover:bg-bone/20`, les autres non).

---

## 3) Valeurs arbitraires

**Totaux (grep `[a-z-]+-\[[^]]+\]` sur `*.tsx`) : 518 occurrences** — 326 dans `src/app/`, 192 dans `src/components/`. S'y ajoutent **64 `style={{…}}`** inline et **~18 rgba()/hex** littéraux en tsx.

### Par famille

| Famille | Nb | Détail |
|---|---|---|
| **`text-[..]` : 350** (68 % du total) | 26 valeurs distinctes | px : `11px`×80, `9px`×57, `13px`×49, `12px`×48, `10px`×36, `12.5px`×15, `13.5px`×12, `15px`×11, `14px`×10, `11.5px`×5, `8px`×4, `16px`×4, `10.5px`×3, `8.5px`×1 — **une échelle typo fantôme entière vit hors tokens** (demi-pixels inclus) |
| display géants | 12 | `7rem`×2, `7.5rem`×2, `8rem`, `5.5rem`, `4.5rem`, `2.7rem` (`PageHeader.tsx:10`), `1.7/1.65/1.35rem`, 2 clamp |
| tracking/leading | 17 | `tracking-[0.14em]`×4, `[0.18em]`×3, `[0.42em]`, `[0.2em]`, `[0.12em]` ; `leading-[0.95]`×6 |
| dimensions | ~60 | `h-[100dvh]`×6, `w-[min(94vw,468px)]`×3, `max-h-[880px]`×3, `w-[88px]`, `w-[400px]`, `w-[380px]`, `w-[340px]`, `w-[248px]`, `size-[22px]`×4, `size-[21px]`×2… |
| radius/ombres | 9 | `rounded-[30px]`×3, `rounded-t-[28px]`×3, `shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]`×3 |
| z-index | 6 arbitraires + double échelle | `z-[100]`×3, `z-[70]`, `z-[60]`, `z-[15]` en plus de l'échelle standard (z-10×14, z-20×12, z-40×8, z-50×6, z-30×6) — aucune carte de calques centralisée |
| aspect | 12 | `aspect-[3/4]`×6, `[4/5]`×3, `[4/3]`×2, `[3/5]` |
| couleurs inline | 18 rgba + 4 hex | radial-gradients `rgba(255,255,255,…)` : `LuxeMedia.tsx:49,61`, `KenBurnsMedia.tsx:108-146`, `profil/page.tsx:540`, `creer/page.tsx:460` ; hex : `KenBurnsMedia.tsx:101` (4 gris), `icons.tsx:86` (`stroke="#060607"` en dur — ne suit pas le thème) |

### 30 occurrences significatives

| # | Localisation | Valeur |
|---|---|---|
| 1-3 | `FeedCard.tsx:146` / `MemberPostCard.tsx:155` / `ShopCard.tsx:44` | `md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-[30px] md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]` — le « stage » desktop entier en arbitraire, ×3 |
| 4-6 | `AuthScreen.tsx:74`, `CustomCursor.tsx:72`, `AuthGate.tsx:46` | `z-[100]` |
| 7 | `StreamsView.tsx:387` | `z-[70]` (viewer live) |
| 8 | `MobileTabBar.tsx:81` | `z-[60]` (compose) |
| 9 | `ShopHotspots.tsx:31` | `z-[15]` (fichier mort) |
| 10-12 | `ShopTheLook.tsx:91`, `CommentSheet.tsx:43`, `FilterDrawer.tsx:90` | `rounded-t-[28px]` + `max-h-[78%]`/`[82%]` |
| 13 | `journal/[id]/page.tsx:103` | `text-[clamp(2.4rem,9vw,5.25rem)]` |
| 14 | `journal/JournalView.tsx:82` | `text-[clamp(2.1rem,8vw,4.75rem)]` |
| 15 | `PageHeader.tsx:10` | `text-[2.7rem] … leading-[0.95]` (le H1 canonique lui-même est arbitraire) |
| 16 | `ShopCard.tsx:49` | `text-[7rem]` monogramme fallback |
| 17 | `CommunityView.tsx:60` | `text-[7rem] … text-bone/[0.06]` |
| 18 | `not-found.tsx:10` | `text-[5.5rem]` |
| 19 | `SideNav.tsx:48` (aside) | `w-[88px]` |
| 20 | `FilterDrawer.tsx:90` | `md:w-[400px]` |
| 21 | `membre/[handle]/page.tsx:448` | `shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]` (menu dropdown, ombre unique) |
| 22 | `MobileTabBar.tsx:66` | `shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)]` (FAB) |
| 23 | `ShopHotspots.tsx:63` | `shadow-[0_2px_10px_rgba(0,0,0,0.5)]` |
| 24 | `messages/page.tsx:512` | `bottom-[calc(7rem+env(safe-area-inset-bottom))]` (toast) |
| 25 | `messages/page.tsx:487` | `pb-[calc(6rem+env(safe-area-inset-bottom))]` |
| 26 | `CommentSheet.tsx:95` | `pb-[calc(1rem+env(safe-area-inset-bottom))]` — 3 formules safe-area différentes alors que `--tabbar-clearance` et `.pb-safe` existent (`globals.css:63,261`) |
| 27 | `ProductHotspots.tsx:105` | `max-w-[calc(100vw-2rem)]` (fichier mort) |
| 28 | `ShopCard.tsx:41` | `h-[100dvh] … md:py-[3vh]` (×3 avec FeedCard/MemberPostCard) |
| 29 | `ShopCard.tsx:91` | `style={{ top: "calc(env(safe-area-inset-top) + 6.75rem)" }}` |
| 30 | `KenBurnsMedia.tsx:101` | gradient 4 hex en dur `#272727→#050505` |

---

## 4) Primitives manquantes

| Primitive absente | Ce que les écrans font à la place |
|---|---|
| **`<Button>`** | 22 CTA primaires + ~30 outline recomposés à la main (§2) ; grep `function Button` = 0 résultat. Conséquence directe : 3 radius et 6+ combos de padding pour le même bouton |
| **`<Toast>`** | 2 implémentations inline complètes avec leur propre timer/cleanup (`MemberPostCard.tsx:111-127`, `messages/page.tsx:221-234`) + swaps de label ad hoc (`profil:51`, `ShopTheLook:41`) |
| **`<Sheet>`/`<Modal>`** | chrome de sheet copié 3× et mécaniques divergentes (§2 tableau sheets) ; Escape/dialog/focus-trap aléatoires |
| **`<Skeleton>`/état de chargement** | 1 seul `animate-pulse` dans toute l'app (`membre/[handle]/page.tsx:298`) ; la classe `.shimmer` prévue pour ça (`globals.css:376`) n'est utilisée nulle part ; les autres écrans n'affichent rien pendant les fetchs (`VideoFeed.tsx:27-34` dégrade en silence) |
| **`<Badge>`/`<Tag>`** | 5 familles de chips/badges divergentes (§2) ; `Chip` existe mais ne couvre que le cas « sélectionnable » |
| **`<FieldLabel>`/`<FormField>`** | 4 wrappers de label réécrits (`creer:25`, `vendre:19`, `CheckoutView:529`, legends FilterDrawer) |
| **Icônes** | `icons.tsx` couvre 35 glyphes mais `StreamsView.tsx:65,83,106` redéfinit `Eye`, `SoundIcon`, `LiveBadge` localement |

**Bien factorisé (à préserver)** : `PageShell` (19 usages), `PageHeader`/`PAGE_TITLE` (10), `Avatar` (15), `LuxeMedia` (6), `Photo`, `Chip`, tokens thème + `.glass`/`.field`/`.overline`/`.eyebrow` dans `globals.css:9-39,202-236`.

---

## 6. Inventaire de la copy

Repo : `/Users/fouzi/solange` (branche `design/de-slop`). Toutes les réfs sont relatives à la racine du repo, format `fichier:ligne`.

## 1. Chaînes structurantes (~80)

| Écran | Chaîne | Type | Réf |
|---|---|---|---|
| Nav desktop | Feed · Live · Marché · Journal · Cercles · Favoris · Messages · Alertes | items nav | src/components/chrome/SideNav.tsx:15-22 |
| Nav desktop | « Déposer une pièce » / « Créer un look » | menu Créer | src/components/chrome/SideNav.tsx:135,146 |
| Nav mobile | Feed · Marché · Commu · Profil | items nav | src/components/chrome/MobileTabBar.tsx:28-31 |
| Nav mobile | « Que voulez-vous créer ? » | aria-label sheet | src/components/chrome/MobileTabBar.tsx:93 |
| Nav mobile | « Publier du contenu » / « Photos, vidéos, inspiration » | titre+sous-titre sheet | src/components/chrome/MobileTabBar.tsx:121-122 |
| Nav mobile | « Vendre un article » / « Marque, taille, état, prix » | titre+sous-titre sheet | src/components/chrome/MobileTabBar.tsx:128-129 |
| Feed top bar | « Feed » / « Boutique » | toggle mode | src/components/feed/FeedTopBar.tsx:15-16 |
| Feed | « Pour vous » / « Abonnements » | onglets | src/lib/mock.ts:370 |
| Feed | « Suivre » / « Suivi » | bouton | src/components/feed/FeedCard.tsx:320 ; CreatorHeader.tsx:72 |
| Feed rail | « Garder » / « Enregistré » | bouton save | src/components/feed/ActionRail.tsx:135 |
| Feed rail | « Shop » (fallback) / « N pièces » | bouton rail | src/components/feed/ActionRail.tsx:96-97 |
| Feed rail | « Voir les pièces à shopper » | aria-label | src/components/feed/ActionRail.tsx:100 |
| Feed rail | « Retirer le j'aime » | aria-label | src/components/feed/ActionRail.tsx:110 |
| Feed | « Voir des pièces similaires en vente » | lien | src/components/feed/FeedCard.tsx:395 |
| Feed fin | « Tu as tout vu. Remonte pour revoir les looks. » | fin de liste | src/components/feed/VideoFeed.tsx:92 |
| Boutique fin | « Fin de la sélection » / « Tu as tout vu. Remonte, ou explore le Marché complet. » | fin de liste | src/components/feed/ShopFeed.tsx:39-42 |
| Shop the look | « Shop the look » / « N pièces à chiner » | titre sheet | src/components/feed/ShopTheLook.tsx:64,96-98 |
| Shop the look | « Acheter » / « Tout ajouter » | boutons | src/components/feed/ShopTheLook.tsx:164,207 |
| Shop the look | « Protection acheteur incluse · livraison 48h » | réassurance | src/components/feed/ShopTheLook.tsx:174 |
| Carte boutique | « Gardé » / « Garder » ; « Contacter » ; « Faire une offre » ; « Vendu » ; « protection acheteur incluse » | boutons/badge | src/components/feed/ShopCard.tsx:112,176,192,83,156 |
| Commentaires | « Ajoute un commentaire… » / « Publier le commentaire » | placeholder/bouton | src/components/feed/CommentSheet.tsx:99,106 |
| Découvrir | eyebrow « Marketplace » · titre « Découvrir » | en-tête | src/app/decouvrir/page.tsx:132-133 |
| Découvrir | « Le moteur de recherche de la mode de seconde main. Pièces, profils, contenus — filtre, chine, achète. » | sous-titre | src/app/decouvrir/page.tsx:134 |
| Découvrir | « Rechercher une marque, un profil, un contenu… » | placeholder | src/app/decouvrir/page.tsx:150 |
| Découvrir | Pièces · Profils · Contenu | onglets dimension | src/app/decouvrir/page.tsx:41-44 |
| Découvrir | Tout · Femme · Homme · Archive · Streetwear · Luxe · Sneakers · Accessoires | catégories | src/lib/mock.ts:385-394 |
| Filtres | « Filtres » · « Trier par » · Récent / Prix ↑ / Prix ↓ / Populaire · « Tailles » · « État » · « Marques » · « Réinitialiser » · Min/Max | drawer | src/components/ui/FilterDrawer.tsx:97,116,17-22,174,192,210,232,153,164 |
| Vendre | eyebrow « Vendre = mettre en vente » · titre « Déposer » | en-tête | src/app/vendre/page.tsx:142-143 |
| Vendre | « Mets une pièce en vente en moins d'une minute. Commission légère, tu fixes ton prix. » | sous-titre | src/app/vendre/page.tsx:144 |
| Vendre | Titre · Marque · Taille · Prix · Description | champs (aria) | src/app/vendre/page.tsx:237-302 |
| Vendre | « Veste en cuir vintage » / « Acne Studios » / « M · 38 · 42… » / « 245 » / « Raconte l'histoire de la pièce, sa coupe, ses petits défauts… » | placeholders | src/app/vendre/page.tsx:240,249,272,282,306 |
| Vendre | « Tu reçois » · « Prix de vente » · « Commission (x %) » · « Mise en avant 72 h » | récap | src/app/vendre/page.tsx:393,379,381,386 |
| Vendre | « Boost ta visibilité dans le feed · 2 € » | toggle | src/app/vendre/page.tsx:417 |
| Vendre succès | « Voir dans le Marché » / « Déposer une autre pièce » | boutons | src/app/vendre/page.tsx:332,339 |
| États produit | Neuf avec étiquette · Excellent état · Très bon état · Bon état | enum condition | src/lib/mock.ts:424-429 |
| Créer | titre « Créer » · « Compose ton look, tague tes pièces — et il part dans le feed. » | en-tête | src/app/creer/page.tsx:192-193 |
| Créer | « Publier le look » ; « Ajoute des photos » ; « Ajoute {manque} pour publier. » | CTA/hints | src/app/creer/page.tsx:95,230,598 |
| Créer | « Connecte-toi pour publier. » / « Se connecter / créer un compte » | gate invité | src/app/creer/page.tsx:565,572 |
| Article | « Pièce unique » · « Acheter — {prix} » · « Faire une offre » · « Contacter le vendeur » · « Vendu » · « Pièces similaires » | fiche produit | src/app/article/[id]/ArticleDetail.tsx:94,186,195,157,170,221 |
| Checkout | « Paiement » · « Carte bancaire » · « via Stripe » · champs Numéro de carte / Expiration / CVC / Nom sur la carte | formulaire | src/app/checkout/[id]/CheckoutView.tsx:289,388-424 |
| Checkout | « Payer {total} (simulé) » · « Déjà vendue » · « Enregistrement… » | bouton d'état | src/app/checkout/[id]/CheckoutView.tsx:477,456,467 |
| Checkout | Article · Protection acheteur · Livraison suivie · Total · « Répartition · Stripe Connect » · « Le vendeur reçoit » · « Commission SOLANGE (x %) » | récap | src/app/checkout/[id]/CheckoutView.tsx:335-340,350-354 |
| Checkout succès | « Commande enregistrée » · « Voir mes commandes » · « Retour au feed » | confirmation | src/app/checkout/[id]/CheckoutView.tsx:133,195,201 |
| Live | eyebrow « Live shopping » · titre « En direct » | en-tête | src/app/live/StreamsView.tsx:486-487 |
| Live | « Me prévenir » · « Prévu » · « À venir » · « Commente le live… » · « Acheter » · badge « En direct » | boutons/labels | src/app/live/StreamsView.tsx:179,198,510,313,290,369 |
| Drops | eyebrow « Partenariats » · titre « Drops » | en-tête | src/app/drops/page.tsx:10-11 |
| Drops | « Ouvert maintenant » · « À venir » · « Voir le drop » · « Pièces du drop » · « Réserver ma place » / « Place réservée ✓ » · « Me prévenir » | statuts/CTA | src/app/drops/DropsView.tsx:157,233,199,210,223,66 |
| Journal | eyebrow « Éditorial » · titre « Journal » · rubriques Focus / Collection / Entretien | en-tête/labels | src/app/journal/JournalView.tsx:39-40,13-16 |
| Communauté | titre « Communauté » · « Rejoindre » · « {n} en ligne » · « {n} réponses » · « Tu fais partie de N cercles. » | page | src/app/communaute/CommunityView.tsx:19,96,68,175,25 |
| Favoris | eyebrow « Ma sélection » · titre « Favoris » · onglets « Pièces · N » / « Vendeurs suivis · N » | page | src/app/favoris/page.tsx:53,57-58 |
| Messages | « Messages » · « Rechercher une conversation… » · « Écris un message… » · préfixe « Toi :  » · « Signaler » · « Débloquer » | page | src/app/messages/page.tsx:298,303,492,346,430,438 |
| Notifications | eyebrow « Notifications » · titre « Activité » · « À jour » / « N non lue(s) » · « Se connecter » | page | src/app/notifications/page.tsx:81-82,86-88,170 |
| Profil | « Invite, gagne. » · « Copier le code » · « Inviter des amis » · onglets À vendre / Looks / Aimés · « Mes annonces · N » | page | src/app/profil/page.tsx:70,93,292,25-29,401 |
| Profil | « Autoriser les messages directs » · « Déconnexion » · « Supprimer mon compte » · « Sûr ? Toutes tes données seront effacées. » · « Annuler » | réglages | src/app/profil/page.tsx:585,615,625,630,655 |
| Membre public | « Suivre / Suivi / C'est toi » · « Écrire » · « Contacter » · « Signaler le profil » · « Bloquer @x » · « Membre bloqué » | actions | src/app/membre/[handle]/page.tsx:409,419,204,456,468-469,489 |
| Membre public | sections « Annonces en vente » / « Posts publiés » · bandeau « Profil de démonstration » | sections | src/app/membre/[handle]/page.tsx:506,529,351 |
| Auth | « Entre ton email pour recevoir ton code d'accès. » · « ton@email.com » · « Recevoir le code » · « Renvoyer le code » · « Bienvenue » | login | src/components/chrome/AuthScreen.tsx:184,196,214,293,315 |
| Premium | titre « Premium » · « Sans engagement · résiliable à tout moment · paiement sécurisé. » | page | src/app/premium/page.tsx:43,50 |
| Premium | plans Gratuit / Premium / Pro · CTA « Plan actuel » / « Passer Premium » / « Passer Pro » | plans | src/lib/mock.ts:719,733,747,730,743,758 |
| Parrainage | « Partage ton code » · « Il rejoint SOLANGE » · « Il vend sa 1re pièce » · « 5 € par ami qui vend sa 1re pièce » | steps | src/lib/mock.ts:981-993 |
| 404 | « Page introuvable » · « Retour à l'accueil » | page | src/app/not-found.tsx:15,26 |
| Erreur | « Quelque chose s'est cassé » · « Réessayer » | page | src/app/error.tsx:19,37 |
| SEO/global | « SOLANGE — La mode circulaire & connectée » · « Inspire-toi, achète, revends. La marketplace sociale… Chaque look est shoppable. » | title/description | src/app/layout.tsx:39,43 |

## 2. Registre : tutoiement vs vouvoiement

- **Tutoiement : ≈ 69 occurrences** dans les chaînes UI (44 en littéraux + 25 en nœuds JSX), réparties sur 24 fichiers — c'est le registre du produit (creer ×14, vendre ×6, notifications ×5, checkout ×3, confidentialite ×3, etc.).
- **Vouvoiement : 5 occurrences**, dont 2 seulement sont de vraies adresses à l'utilisateur :
  - `src/components/chrome/MobileTabBar.tsx:93` — aria-label « Que voulez-vous créer ? » (seul vouvoiement d'interface pure, incohérent avec tout le reste) ;
  - `src/lib/mock.ts:993` — « Dès sa première vente validée, **vous** gagnez chacun 5 € » au milieu d'un module parrainage entièrement tutoyé (« Partage **ton** code », « **Ton** ami crée son compte », mock.ts:984-989) — le « vous » désigne toi+ton ami, mais l'enchaînement tu→vous se lit comme une rupture ;
  - `src/lib/mock.ts:370` « Pour vous » — idiome de feed, assumable ;
  - `src/lib/mock.ts:1223,1249` (+ corps d'article :1347 « la pièce vous survivra ») — les descriptions d'articles Journal vouvoient (« Vos avis », « Vos meilleures trouvailles ») alors que le chrome UI tutoie ; frontière contenu éditorial/UI, mais visible sur les cartes.

**Écrans qui mélangent** : MobileTabBar (aria vouvoie / labels neutres, app tutoie), Profil/parrainage (tu → vous dans les 3 steps), Journal (cartes éditoriales vouvoient dans une UI qui tutoie).

## 3. Incohérences de nommage (même objet, plusieurs noms)

| Objet | Noms concurrents | Preuves |
|---|---|---|
| La marketplace | **Marché** (nav) / **Découvrir** (titre+URL) / **Marketplace** (eyebrow) / **Boutique** (toggle feed) / **boutique** (CTA) | SideNav.tsx:17 ; MobileTabBar.tsx:29 ; decouvrir/page.tsx:133 + decouvrir/layout.tsx:4 ; decouvrir/page.tsx:132 ; FeedTopBar.tsx:16 ; membre/[handle]/page.tsx:340 « Découvrir la boutique » ; ShopFeed.tsx:42 « explore le Marché complet » ; vendre/page.tsx:332 « Voir dans le Marché » ; layout.tsx:43 « marketplace sociale » |
| Les notifications | **Alertes** (nav) / **Notifications** (eyebrow + `<title>`) / **Activité** (titre H1 + marginWord) | SideNav.tsx:22 ; notifications/page.tsx:81 + notifications/layout.tsx:4 ; notifications/page.tsx:79,82 |
| La communauté | **Cercles** (nav desktop) / **Commu** (nav mobile) / **Communauté** (titre + URL) / « cercle » (corps) | SideNav.tsx:19 ; MobileTabBar.tsx:30 ; CommunityView.tsx:19 ; CommunityView.tsx:25-26 |
| L'objet en vente | **pièce** / **article** / **annonce** / « Article » (ligne récap) | vendre/page.tsx:325 « Ta pièce » vs :370 « Ton article » (même écran) ; MobileTabBar.tsx:128 « Vendre un article » vs SideNav.tsx:135 « Déposer une pièce » ; profil/page.tsx:401 « Mes annonces » ; membre/[handle]/page.tsx:389 « N annonce(s) » + :506 « Annonces en vente » ; ArticleDetail.tsx:94 « Pièce unique » ; CheckoutView.tsx:335 Row « Article » ; route `/article/[id]` |
| L'action d'enregistrer | **Garder** / **Gardé** / **Enregistrer** / **Enregistré** / **Favoris** / « enregistrements » | ActionRail.tsx:135 `saved ? "Enregistré" : "Garder"` ; ShopCard.tsx:112 `"Gardé" : "Garder"` + :115 aria « Retirer des favoris »/« Enregistrer » ; MemberPostCard.tsx:284,289 ; ProductCard.tsx:101 aria « Enregistrer » ; nav « Favoris » SideNav.tsx:20 ; favoris/page.tsx:93 « Aucune pièce enregistrée » ; ActionRail.tsx:139 « Retirer des enregistrements » |
| La personne | **membre** / **créateur** / **vendeur** / **profil** | route `/membre/[handle]` + « Membre bloqué » membre/[handle]/page.tsx:489 ; :353 « ce créateur » (même écran) ; StreamsView.tsx:488 « Les vendeurs présentent » ; favoris/page.tsx:58 « Vendeurs suivis » ; decouvrir/page.tsx:42 onglet « Profils » ; communaute/CommunityView.tsx:20 « des créateurs » |
| L'acte de vendre | **Vendre** (nav+layout) / **Déposer** (titre H1) / « Vendre = mettre en vente » (eyebrow qui s'auto-explique) | vendre/layout.tsx:4 titre « Vendre » ; vendre/page.tsx:143 « Déposer » ; :142 eyebrow ; SideNav.tsx:135 « Déposer une pièce » vs MobileTabBar.tsx:128 « Vendre un article » |
| Le contenu publié | **look** / **post** / **actu** / **contenu** | creer/page.tsx:95 « Publier le look » vs :427 « Ton post » vs :615 « Ton actu » ; decouvrir/page.tsx:43 onglet « Contenu » vs :399 badge « Post » ; profil/page.tsx:27 onglet « Looks » vs membre/[handle]/page.tsx:529 « Posts publiés » |
| Le like | **j'aime** / **likes** / « a aimé » | ActionRail.tsx:110 « Retirer le j'aime » ; notifications/layout.tsx:6 « likes et drops » ; mock.ts:559 « a aimé ton look » |

## 4. Anglicismes et franglais

**Assumables (vocabulaire mode/social établi)** : Feed (SideNav.tsx:15, FeedTopBar.tsx:15), Live (SideNav.tsx:16), Drops (drops/page.tsx:11), look/looks (partout), « Shop the look » (ShopTheLook.tsx:64 — nom de feature du secteur), Premium/Pro (mock.ts:733,747), hashtags/tags (#gorpcore, #y2k… mock.ts:372-383), vintage/streetwear (catégories), badge, drop (creer/page.tsx:315).

**Slop / franglais à trancher** :
- **« shoppable » ×5** : layout.tsx:43, page.tsx:7,12, creer/layout.tsx:6, creer/page.tsx:481 « pièces shoppables » — adjectif anglais francisé au pluriel ;
- **« à shopper »** (verbe) : ActionRail.tsx:100 « Voir les pièces à shopper » — alors que ShopTheLook.tsx:98 dit joliment « à chiner » ;
- **« Shop »** label rail fallback : ActionRail.tsx:97 (seul label de rail en anglais) ;
- **« Boost ta visibilité »** : vendre/page.tsx:417 ;
- **« Live shopping »** eyebrow : StreamsView.tsx:486, au-dessus d'un titre FR « En direct » — les deux registres se contredisent sur le même en-tête ;
- **« marketplace sociale »** : layout.tsx:43 + eyebrow « Marketplace » decouvrir/page.tsx:132 quand la nav dit « Marché » ;
- **« Commu »** : MobileTabBar.tsx:30 — abréviation registre réseau social, en tension avec la DA quiet luxury ;
- **« haul »** : creer/page.tsx:297 « Haul du week-end… », :616 « Ton haul » — mais le CTA dit « Publier mes achats » (:98) : le même objet est haul ET achats ;
- Dans la copy mock affichée : « Tu shippes en province ? » (mock.ts:799), « Hello ! » (mock.ts:650), « Grail unlocked. » (mock.ts:229), « le gilet Carhartt est un must » (mock.ts:150) — contenu conversationnel simulé, mais visible à l'écran.

## 5. Typographie française — état des lieux

| Point | État | Preuves |
|---|---|---|
| Apostrophes | **3 encodages coexistent** : droite `'` dominante (≈47 occ. rien que dans mock.ts, et tous les littéraux app, ex. creer/page.tsx:313), entité `'` ×24 dans le JSX, typographique `’` ×2 seulement | error.tsx:19 « s’est cassé », not-found.tsx:26 « l’accueil » — les 2 seuls `’` du code ; tout le reste rend `'` |
| Espace avant : ! ? | Toujours présente (règle FR respectée) mais **toujours sécable** (U+0020) — aucune insécable/fine, sauf 2 ` ` dans les guillemets | « SOLANGE : » page.tsx:7 ; « créer ? » MobileTabBar.tsx:93 ; `« {q} »` decouvrir/page.tsx:310,377 (seuls cas protégés) → ponctuation orpheline possible en fin de ligne partout ailleurs |
| Ellipse | Cohérent : `…` typographique ×28, zéro `...` dans l'UI | messages/page.tsx:303, CommentSheet.tsx:99, etc. |
| Prix | Cohérent via `euro()` : « 245 € » (espace + virgule décimale), `compact()` « 24,3 k » / « 1,2 M » | src/lib/utils.ts:16-26 |
| Pourcentages | **Incohérent** : badges remise « −63% » collé (ProductCard.tsx:92, ShopCard.tsx:94) vs « Commission (3,5 %) » espacé (vendre/page.tsx:381, CheckoutView.tsx:353, mock.ts:724 « 2 à 4 % ») |
| Signe moins | Vrai moins U+2212 utilisé, mais « − 2 € » espacé (vendre/page.tsx:386) vs « −63% » collé (ProductCard.tsx:92) |
| Durées | **Incohérent** : « livraison 48h » collé (ShopTheLook.tsx:174) vs « sous 48 h » (mock.ts:540) et « 72 h » (vendre/page.tsx:386) |
| Tirets | Em-dash « — » utilisé partout en séparateur (« Acheter — 245 € » ArticleDetail.tsx:186) — cohérent |

## 6. Erreurs et états vides — verbatim exhaustif

**Erreurs**

| Verbatim | Réf |
|---|---|
| « Quelque chose s’est cassé » + « Une erreur inattendue est survenue de notre côté. Tu peux réessayer — la plupart du temps, ça repart. » + « Réessayer » | src/app/error.tsx:19,24,37 |
| « Page introuvable » + « Cette pièce a quitté la vitrine. Le lien est peut-être périmé, ou la page a été déplacée. » + « Retour à l’accueil » | src/app/not-found.tsx:15,18-19,26 |
| « Entre une adresse email valide. » | src/components/chrome/AuthScreen.tsx:35 |
| « Impossible de lire une des photos. Réessaie avec un autre fichier. » (dupliquée dans 2 écrans) | src/app/creer/page.tsx:125 ; src/app/vendre/page.tsx:81 |
| « Ta session a expiré — reconnecte-toi pour publier. » | src/app/creer/page.tsx:165 |
| « Session expirée — reconnecte-toi pour finaliser la commande. » (formulation différente pour le même cas) | src/app/checkout/[id]/CheckoutView.tsx:105 |
| « Cette pièce vient d'être vendue. » | src/app/checkout/[id]/CheckoutView.tsx:102 |
| « Déjà vendue » + « Cette pièce a trouvé preneur avant toi — elle n'est plus disponible à l'achat. » | src/app/checkout/[id]/CheckoutView.tsx:224,227-228,456 |
| « Échec du signalement, réessaie plus tard. » | src/app/messages/page.tsx:246 |
| « Impossible de charger tes notifications. » + « Réessayer » | src/app/notifications/page.tsx:105,111 |
| « Profil indisponible » + « Réessayer » | src/app/membre/[handle]/page.tsx:306,316 |
| « Profil introuvable » + « Aucun membre ne répond au nom de @… Il a peut-être été supprimé, ou le lien est périmé. » + « Découvrir la boutique » | src/app/membre/[handle]/page.tsx:328,331-333,340 |
| « Erreur réseau » / « Hors ligne ou serveur indisponible » | src/lib/api.ts:124,131 |
| « Ajoute {liste des manques} pour publier. » | src/app/creer/page.tsx:598 ; src/app/vendre/page.tsx:488 |
| « Sûr ? Toutes tes données seront effacées. » (confirmation destructive) | src/app/profil/page.tsx:630 |
| Toasts succès signalement : « Signalement envoyé. Merci. » / « Signalement envoyé. Merci, notre équipe va examiner ce profil. » (2 formulations) | src/components/feed/MemberPostCard.tsx:138 ; src/app/messages/page.tsx:245 ; src/app/membre/[handle]/page.tsx:289 |

**États vides**

| Verbatim | Réf |
|---|---|
| « Aucune pièce enregistrée pour l'instant. » | src/app/favoris/page.tsx:93 |
| « Rien pour l'instant » + « Tes ventes, messages et nouveaux abonnés apparaîtront ici. » | src/app/notifications/page.tsx:120,123 |
| « Aucune activité pour l'instant. » (2e état vide du même écran, autre formulation) | src/app/notifications/page.tsx:206 |
| « Aucune conversation pour le moment. » / « Aucune conversation à afficher. » (2 formulations, même écran) | src/app/messages/page.tsx:313,367 |
| « Tu ne suis encore aucun cercle. Rejoins-en un pour lancer la conversation. » | src/app/communaute/CommunityView.tsx:26 |
| « Aucune pièce ne correspond. Élargis tes filtres ou tente une autre marque. » | src/app/decouvrir/page.tsx:289-290 |
| « Cherche un nom ou un handle pour trouver des profils. » / « Aucun profil ne correspond à « {q} ». » | src/app/decouvrir/page.tsx:306,310 |
| « Cherche une marque, un style ou un sujet pour trouver des posts et des articles. » / « Aucun contenu ne correspond à « {q} ». » | src/app/decouvrir/page.tsx:372-373,377 |
| « Aucune annonce en vente pour le moment. » / « Aucun post publié pour le moment. » | src/app/membre/[handle]/page.tsx:512,535 |
| « Aucun commentaire pour l'instant. » | src/components/feed/CommentSheet.tsx:66 |
| « Fin de la sélection » + « Tu as tout vu. Remonte, ou explore le Marché complet. » | src/components/feed/ShopFeed.tsx:39-42 |
| « Tu as tout vu. Remonte pour revoir les looks. » | src/components/feed/VideoFeed.tsx:92 |

Nuance de formulation récurrente : « pour l'instant » (favoris, commentaires, notifications) vs « pour le moment » (messages, membre) — deux locutions pour le même état.


---

## 7. Dette, risques et acquis

Inventaire factuel, lecture seule, branche `design/de-slop`. Toutes les lignes vérifiées par grep/lecture sur `src/` complet.

## 1. Performance

### Images

| Constat | Preuve |
|---|---|
| **0 usage de `next/image`** dans tout `src/` | grep `next/image` → 0 fichier |
| 18 occurrences `<img>` brut (9 fichiers UI) | `src/app/profil/page.tsx:365,415` · `src/app/creer/page.tsx:249,448` · `src/app/checkout/[id]/CheckoutView.tsx:152,237,312` · `src/app/vendre/page.tsx:199,354` · `src/components/ui/Photo.tsx:31` · `src/components/feed/CarouselMedia.tsx:46,54` · `src/components/feed/KenBurnsMedia.tsx:84` · `src/components/feed/ShopCard.tsx:57,64` · `src/components/feed/MemberPostCard.tsx:174,181` |
| `next.config.ts` déclare pourtant `images.formats: ["image/avif","image/webp"]` — « next/image ready » mais jamais branché | `next.config.ts:44-46` |
| JPEG servis tels quels, non redimensionnés | `public/img/carousel/prada2.jpg` = 576 KB, `prada1.jpg` = 497 KB (6 fichiers 330-576 KB) |

### Poids des assets (`du -sh`)

| Dossier | Poids |
|---|---|
| `public/img` (total) | **4.7 MB** |
| — `public/img/carousel` | 2.4 MB |
| — `public/img/looks` | 1.2 MB |
| — `public/img/catalog` | 1.1 MB |
| — `public/img/people` | 88 KB |
| `public/video` (total) | **5.4 MB** — 6 mp4 (564 KB → 1.6 MB, `l5.mp4` le plus lourd) + 6 posters jpg 40-72 KB |

### Vidéos en autoplay simultané (live)

- `StreamVideo` porte `autoPlay` inconditionnel (`src/app/live/StreamsView.tsx:56`) ; la grille EN DIRECT rend une tuile vidéo **par stream live** (`StreamsView.tsx:492-503`), soit **4 vidéos autoplay simultanées** (mock : 4 × `live: true`, `src/lib/mock.ts:65,1021,1038,1054`). Aucun IntersectionObserver, aucun gating.
- Le Viewer plein écran (`fixed inset-0`, `StreamsView.tsx:387`) **ne démonte pas la grille** : ses 4 vidéos continuent de tourner derrière + la 5e en `eager` (`StreamsView.tsx:393-400`).
- `StreamVideo` **ignore `prefers-reduced-motion`** (pas de `useReducedMotion` dans le fichier), contrairement à `KenBurnsMedia` qui le respecte (`KenBurnsMedia.tsx:46`).

### Fonts (layout.tsx)

- 3 familles via `next/font/google`, toutes en `display: "swap"` ✓ (`src/app/layout.tsx:14-32`).
- **Montserrat chargé en 7 graisses (300→900)** (`layout.tsx:17`) — le poids font le plus lourd du site ; Bodoni 2 graisses × 2 styles, Hanken 4 graisses.

### Bundles

- Deps runtime légères : `motion` est la seule lib UI lourde ; pas de lib carrousel/chart (carrousel maison `CarouselMedia`) (`package.json` dependencies).

### Lazy loading du feed — réel et bien fait ✓

- `VideoFeed` calcule `inView = |i − active| ≤ 1` (`src/components/feed/VideoFeed.tsx:70,82`) ; `active` piloté par IntersectionObserver seuil 0.6 (`VideoFeed.tsx:42-53`).
- `FeedCard` hors fenêtre rend **un simple panneau noir** — zéro média/animation/blur offscreen (`FeedCard.tsx:150-151`) ; idem `MemberPostCard.tsx:158`.
- `will-change` réservé à la bande active (`FeedCard.tsx:145`, `KenBurnsMedia.tsx:78`) ; vidéo look play/pause pilotée par `[active, paused, reduce]` (`KenBurnsMedia.tsx:43-51`) ; image active en `eager`+`fetchPriority="high"`, voisines `lazy` (`KenBurnsMedia.tsx:89-90`) ; `CarouselMedia.tsx:58` et `ShopCard.tsx:68` gèrent aussi eager/lazy.

## 2. Accessibilité

### Couverture (grep)

| Signal | Volume | Où |
|---|---|---|
| `aria-label` | 33 fichiers, ~100 occurrences | tous les écrans principaux couverts (feed, live, checkout, vendre, decouvrir, chrome…) |
| `role=` | 45 occurrences / 18 fichiers | dont `role="switch"` (`StreamsView.tsx:185`), `role="dialog"` (`StreamsView.tsx:388`, `FilterDrawer.tsx:83`) |
| `:focus-visible` ring global | `globals.css:156-162` (outline 2px bone, mouse ringless) | ✓ |
| `useReducedMotion` | 8 composants (`DropsView`, `ActionRail`, `ShopHotspots`, `KenBurnsMedia`, `FeedCard`, `AuthScreen`, `VideoFeed`, `MemberPostCard`) + CSS `@media (prefers-reduced-motion)` (`globals.css:422-438`) + **`MotionConfig reducedMotion="user"` global** (`src/app/template.tsx:24`) | ✓ très bonne couverture — sauf `StreamsView` (cf. Perf) |
| `alt` sur `<img>` | 22 occurrences — chaque fichier à `<img>` a ses `alt` (fond flouté correctement `alt="" aria-hidden` `MemberPostCard.tsx:176-177`) | ✓ |

### Cibles < 44 px restantes

| Élément | Taille | Preuve |
|---|---|---|
| Bouton filtres du champ recherche | `size-8` (32px) | `src/app/decouvrir/page.tsx:156` |
| Boutons fermer des sheets | `size-9` (36px) | `CommentSheet.tsx` (~l.57), `FilterDrawer.tsx` (~l.100), `MobileTabBar.tsx:110` |
| Bouton Suivre mobile du feed | `h-8` (32px) | `FeedCard.tsx:314` |
| Mute mobile du feed | `size-9` | `FeedCard.tsx:324` |

Contre-exemple sain : `ProductCard` en `size-8` mais **étend la zone tactile via `before:-inset-2`** → ~48px effectifs (`ProductCard.tsx:103,116`). 31 fichiers utilisent `min-h-11`/`size-11`/`size-12`.

### Focus trap des sheets

| Sheet | role/aria-modal | Escape | Focus trap / focus initial |
|---|---|---|---|
| `FilterDrawer` | ✓ `role="dialog" aria-modal` (`FilterDrawer.tsx:83-85`) | ✗ | ✗ |
| `CommentSheet` | ✗ (aucun role) | ✗ | ✗ |
| `ShopTheLook` | ✗ | ✗ | ✗ |
| Viewer live | ✓ `role="dialog"` (`StreamsView.tsx:388-389`) | ✓ (`StreamsView.tsx:339-345`) | ✗ |
| Compose sheet mobile / SideNav | — | ✓ (`MobileTabBar.tsx`, `SideNav.tsx` grep Escape) | ✗ |

Aucun sheet ne piège le focus ni ne rend le fond `inert` (grep `inert` → 0).

### Contrastes à risque (fond noir `#0b0b0c`, ratios ≈ calculés sur l'alpha composité)

| Classe | Ratio ≈ | Occurrences |
|---|---|---|
| `text-bone/40` | ~3.5:1 (AA fail texte < 18pt) | 10 occ. / 8 fichiers : `JournalView.tsx`, `journal/[id]/page.tsx` ×3, `membre/[handle]/page.tsx`, `vendre/page.tsx`, `PageHeader.tsx`, `ProductCard.tsx`, `MemberPostCard.tsx`, `ShopCard.tsx` |
| `text-bone/35` | ~2.9:1 | 4 occ. : `JournalView.tsx:148,192`, `journal/[id]/page.tsx:216`, `StreamsView.tsx:512` |
| `text-bone/30` | ~2.5:1 | `journal/[id]/page.tsx:141`, `LuxeMedia.tsx:69` |
| `text-ash/60` | ~2.7:1 | `profil/page.tsx` ×2, `MobileTabBar.tsx:171` (labels de la tab bar !) |
| `text-ash` plein | ~5.5:1 — **passe AA** ✓ | usage massif, OK |

### Micro-typographie

- `text-[9px]` / `text-[10px]` : **93 occurrences** (dont ~59 en `text-[9px]`), la plupart en `.overline` uppercase tracking 0.32em — labels `FilterDrawer` (legend ×5), marques produit, tab bar (`MobileTabBar.tsx:171`), badges. `text-[8px]` sur le label « voir » du curseur (`CustomCursor.tsx:92`).
- Formulaires vendre/creer : labels visuels = `<span class="overline">` non associés (`vendre/page.tsx:21`, `creer/page.tsx:27`) ; compensé par `aria-label` sur chaque input (`vendre/page.tsx:237-302`) — pas de `htmlFor`.

## 3. États manquants — matrice écran × état

✓ = géré (preuve) · ✗ = absent · — = non applicable.

| Écran | Chargement | Vide | Erreur | Partiel | Succès | Hors-ligne |
|---|---|---|---|---|---|---|
| **Feed** `/` | ✗ (posts membres fetchés sans indicateur, `VideoFeed.tsx:26-34`) | ✓ « Fin du fil » (`VideoFeed.tsx:88-94`) ; jamais vide (mock) | ✗ — dégradation silencieuse assumée (`VideoFeed.tsx:19-21`) | ✓ (fil complet aux looks si l'API échoue) | ✓ | ✗ |
| **Découvrir** | ✗ (mock synchrone + store) | ✓ ×3 : pièces (`decouvrir/page.tsx:289`), profils (`:310`), contenus (`:377`) | ✗ | ✓ (`serverProducts` fusionnés, `:82-100`) | ✓ | ✗ |
| **Article** | — (SSG, `generateStaticParams` `article/[id]/page.tsx:11-13`) | — | ✓ `notFound()` (`page.tsx:22`) | ✓ état « Vendu » (`ArticleDetail.tsx:163-170`) | ✓ | ✗ |
| **Checkout** | ✓ step `processing` + disabled (`CheckoutView.tsx:445-458`) | — | ✓ bandeau (`:434-439`) + 409 `soldOut` (`:39`) | ✓ `alreadySold` (`:41`) | ✓ step `done` (`:114`) | ✗ |
| **Vendre** | ✓ `submitting` disabled (`vendre/page.tsx:471`) | — (formulaire) | ✓ `submitError` (`:111`) | ✓ `photoBusy` (`:167`) | ✓ (`:316-325`) | ✗ |
| **Créer** | ✓ disabled (`creer/page.tsx:581`) | — | ✓ `submitError` (`:168`) | ✓ `photoBusy` (`:217`) | ✓ « Publié ✓ » (`:418-424`) | ✗ |
| **Messages** | ✗ | ✓ (`messages/page.tsx:313,367`) | ✗ fetch silencieux (`:134`) ; **envoi fire-and-forget sans erreur ni rollback** (`void api.sendMessage`, `:277-283`) | ✓ fusion serveur+mock (`:144-151`) | ✓ feedback signalement (`:243-247`) | ✗ |
| **Profil** | ✗ (aucun indicateur pendant `loadMine`, `profil/page.tsx:162-171`) | ✗ (sections simplement masquées) | ~ `deleteError` seul (`:214-216`) ; fetchs silencieux (`if p.ok` sans else, `:168-170`) | ✓ | ✓ | ✗ |
| **Notifications** | ✓ (`notifications/page.tsx:98-102`) | ✓ (`:206`) | ✓ + bouton « Réessayer » (`:102-111`) | — | ✓ | ✗ |
| **Membre** | ✓ union `loading/error/notfound/ready` (`membre/[handle]/page.tsx:56-59`, rendus `:296,303,328`) | ✓ | ✓ | ✓ | ✓ | ✗ |

**Hors-ligne : 0 écran.** Aucun `navigator.onLine`, aucun service worker (grep → 0) ; `manifest.ts` existe mais pas de cache offline. Modèles à répliquer : **notifications** et **membre** (seuls écrans avec la machine d'états complète).

## 4. Divers

| Point | Constat | Preuve |
|---|---|---|
| `console.log/warn/error` | **0** dans `src/` | grep → vide |
| `TODO/FIXME/HACK` | **0** | grep → vide |
| `any` | **0** (l'unique match est la variable `anyLive`) | `SideNav.tsx:16` |
| **Code mort** | `ProductHotspots.tsx` et `ShopHotspots.tsx` : **0 importeur** (les pins ont été retirés du feed, cf. commentaire `FeedCard.tsx:188-189`) | grep importeurs → 0 |
| Scrollbars masquées | `::-webkit-scrollbar { width:0; height:0 }` **global** (`globals.css:169-172`) — aucune affordance de scroll sur desktop WebKit ; pas de `scrollbar-width` → Firefox les affiche = rendu incohérent | |
| `window.prompt` natif | motif de signalement hors DA (`messages/page.tsx:240`, idem membre `:290` env.) | |
| **CustomCursor** (desktop) | `cursor: none !important` sur tout le doc dès `html.cursor-ready` (`globals.css:147-152`) — activé uniquement par JS via `(hover:hover)(pointer:fine)` (`CustomCursor.tsx:10-20,41`), donc fail-safe si JS plante. Coûts : perte du I-beam texte/resize partout, listener `mousemove` global avec `setVariant` par événement (`:43-51`), couche fixe plein écran `z-[100]` en `mix-blend-difference` + ring en spring (`:76-95`) | |

## 5. Ce qui fonctionne déjà bien — à ne pas casser

| Acquis | Preuve |
|---|---|
| **Tokens à 2 niveaux** : `@theme inline` → vars runtime `--c-*`, thème clair OS + `.theme-dark` forcé sur le feed, `color-scheme` par thème | `globals.css:9-121`, `FeedThemeLock` (`layout.tsx:88`) |
| **Radius brutalistes par tokens** : `--radius-sm..lg: 0`, `xl..4xl: 2px`, `rounded-full` épargné (avatars/dots) — flatten app-wide sans toucher chaque composant | `globals.css:30-38` |
| **`.field`** : champ verre unifié (border tokens, focus par `--field-border-focus`) | `globals.css:218-236`, utilisé ×4 checkout |
| **`.glass` / `.glass-bone` / `.hairline`** : 47 usages, verre discret via vars sémantiques | `globals.css:202-216` |
| **Safe-areas** : `--tabbar-clearance = safe-area + 5.5rem` (0 en md) + `.pt-safe/.pb-safe` + `env()` inline (19 usages) | `globals.css:63,123-127,257-263`, `FeedCard.tsx:239,261,286`, `StreamsView.tsx:406,448` |
| **Stagger du feed** : variants `group/item` (staggerChildren 0.07, ease luxe) | `FeedCard.tsx:25-36,281-284` |
| **Reduced-motion 3 couches** : CSS kill-switch (`globals.css:422-438`) + `MotionConfig reducedMotion="user"` (`template.tsx:24`) + `useReducedMotion` ciblé (8 composants) |  |
| **`.page-enter` CSS-only** : entrée de route sans dépendance JS — commentaire « load-bearing » anti page noire Safari | `globals.css:283-303`, `template.tsx:10-19` |
| **Snap feed `mandatory`** documenté load-bearing, à ne pas relâcher | `globals.css:409-417` |
| **Gating offscreen du feed** (panneau noir hors ±1, `will-change` conditionnel, eager/lazy/fetchPriority) — cf. §1 | `FeedCard.tsx:145-151`, `KenBurnsMedia.tsx:43-51,89-90` |
| **Grain statique volontairement non animé** (perf paint) + `aria-hidden` | `globals.css:264-276`, `GrainOverlay.tsx:3` |
| **Fallbacks média gracieux** : `Photo` se retire sur erreur (`Photo.tsx:28-37`), `StreamVideo` retombe sur `LuxeMedia` (`StreamsView.tsx:46`), `KenBurnsMedia` → composition studio générative (`KenBurnsMedia.tsx:94-149`) |  |
| **`.hscroll`** : momentum + edge-fade en mask | `globals.css:239-255` |
| **Focus ring strict mono keyboard-only** coexistant avec `cursor:none` | `globals.css:154-162` |
| **A11y ponctuelle soignée** : `role="switch"`+`aria-checked` (`StreamsView.tsx:185-187`), `aria-pressed` mute/follow (`FeedCard.tsx:313,326`), `aria-haspopup/expanded` filtres (`decouvrir/page.tsx:158-159`), double-tap = like jamais unlike (`FeedCard.tsx:121-122`) |  |
| **CSP prod stricte** sans `unsafe-eval`, headers sécurité | `next.config.ts:22-35,48-67` |
