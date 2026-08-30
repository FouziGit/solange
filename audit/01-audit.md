# Phase 1 — Audit du slop

> Base : audit/00-inventaire.md + captures phase0. Chaque occurrence : écran,
> description, preuve, sévérité, correction prévue. Les sections « RAS
> vérifiés » listent les points du catalogue que la DA existante évite déjà.


**Total : 12 bloquants · 39 majeurs · 36 mineurs.**


---

## 1. Slop visuel — 3 bloquant(s) · 4 majeur(s) · 9 mineur(s)

Périmètre : `/Users/fouzi/solange`, branche `design/de-slop`, lecture seule. S'appuie sur `audit/00-inventaire.md` (Phase 0) et va au-delà : chaque point du catalogue slop a été vérifié par grep/lecture sur `src/` complet. La DA (mono ivoire/encre, brutalisme éditorial, grain, glass) est AFFIRMÉE — les corrections proposées la renforcent, jamais ne la remplacent.

---

## BLOQUANTS

### [BLOQUANT] Débordement horizontal du checkout mobile
- Écran : Checkout (`/checkout/[id]`), 375 px
- Description : le libellé « VIA STRI… » est coupé au bord droit et le champ CVC est tronqué — la page déborde horizontalement. Le CTA invité « Se connecter / créer un compte » passe sous la tab bar flottante. Un écran de paiement cassé au premier regard, sur le parcours le plus court de l'app (3 taps feed→checkout).
- Preuve : capture `audit/captures/phase0/checkout-375.png` ; suspects code : `src/app/checkout/[id]/CheckoutView.tsx:368-370` (« via Stripe » uppercase non rétrécissable dans un flex `justify-between`), `:403` (grid 2 col. champs Expiration/CVC), `:349-350` (`.overline` tracking 0.32em insécable)
- Correction prévue : reproduire au viewport réel 375 px, poser `min-w-0`/`shrink` sur les items flex/grid fautifs et `overflow-wrap` sur les overlines ; remonter le CTA invité au-dessus de `--tabbar-clearance` (déjà tokenisé dans `globals.css:63`).

### [BLOQUANT] Première rangée produits masquée par la tab bar
- Écran : Découvrir (`/decouvrir`), 375 px
- Description : la première rangée de la grille masonry passe sous la tab bar glass — titre « Veste motard… » et prix à moitié masqués dès l'ouverture. L'info commerciale primaire (prix) est illisible au fold.
- Preuve : capture `audit/captures/phase0/decouvrir-375.png` ; nuance : `PageShell` applique bien `pb-[var(--tabbar-clearance)]` (`src/components/ui/PageShell.tsx:21`) et `decouvrir/page.tsx:130` l'utilise
- Correction prévue : re-vérifier au viewport réel (le clearance ne protège que la FIN de page, pas le fold — et la capture pleine page peut amplifier) ; si confirmé, l'enjeu est le contraste de la barre glass sur contenu clair : opacifier `--glass-bg` côté thème clair ou ajuster le fold initial.

### [BLOQUANT] Chips de catégorie sous la tab bar sur Vendre
- Écran : Vendre (`/vendre`), 375 px
- Description : les chips Streetwear/Luxe/Sneakers/Accessoires — éléments interactifs du formulaire — sont à moitié recouvertes par la tab bar flottante au chargement. Cible tactile partiellement occluse sur le parcours vendeur (celui que le FAB central privilégie).
- Preuve : capture `audit/captures/phase0/vendre-375.png` ; `src/app/vendre/page.tsx:139` utilise pourtant `PageShell` (clearance présent en code)
- Correction prévue : même diagnostic live que Découvrir ; garantir qu'aucun élément interactif ne peut rester sous la barre (scroll-margin ou clearance sur le conteneur scrollable interne s'il échappe au padding de `PageShell`).

---

## MAJEURS

### [MAJEUR] Anarchie de radius : la règle écrite n'est pas la règle réelle
- Écran : toute l'app
- Description : `globals.css` documente la règle (« sharp edges via tokens… rounded-full untouched: avatars/dots ») mais 173 `rounded-full` incluent des dizaines de CTA/pills ; le même CTA primaire `bg-bone text-ink` existe en 3 formes (carré, `rounded-none`, `rounded-full`) ; FAB mobile rond vs FAB desktop carré pour la même action ; `.field` « brutalist: sharp » surchargé en `rounded-full` dès l'AuthScreen ; seuls vrais arrondis doux : `rounded-[30px]`/`rounded-t-[28px]` arbitraires qui contournent les tokens. Aucune règle discernable (ni par rôle, ni par zone sombre/claire : le checkout clair a des pills, le ShopCard sombre des carrés) — c'est le tic « généré » le plus visible en naviguant.
- Preuve : `src/app/globals.css:30-38` (règle écrite) ; contradictions : `MobileTabBar.tsx:67` (FAB `rounded-full`) vs `SideNav.tsx:110` (FAB `rounded-none`) ; `CheckoutView.tsx:446` (payer, pill) vs `ShopCard.tsx:174,182` (carré) vs `ArticleDetail.tsx:183` (`rounded-none`) ; `AuthScreen.tsx:198` (`field … rounded-full`) ; inventaire §2 (22 CTA, 3 formes) ; captures `vendre-1440.png`/`profil-375.png`
- Correction prévue : décider et ÉCRIRE la règle dans la DA existante (proposition compatible : carré = surfaces et actions de commerce, `rounded-full` = organique uniquement — avatars, dots, glass-pills posées SUR média) puis normaliser les CTA ; tokeniser 28/30px si les sheets/stage les gardent.

### [MAJEUR] Rouge Tailwind brut dans un système « no chroma »
- Écran : Profil, zone suppression de compte
- Description : `red-400/60`, `red-500/20`, `red-950/25`, `red-300`, `red-900`, `red-50` — six teintes de la palette Tailwind stock dans la seule zone chromatique de l'app, dont l'en-tête de la DA proclame « Strict noir & blanc — no chroma ». La palette par défaut est le marqueur « généré » par excellence.
- Preuve : `src/app/profil/page.tsx:623,628,633,642` ; `src/app/globals.css:5`
- Correction prévue : traiter le destructif dans la DA — soit mono renforcé (bordure `bone` pleine, inversion, poids), soit un unique token `--c-danger` désaturé/teinté défini dans `@theme` avec ses deux thèmes, jamais la gamme rouge stock.

### [MAJEUR] Rail d'actions à cheval sur le cadre du feed desktop
- Écran : Feed (`/`), 1440 px
- Description : le rail d'actions (cintre « shop » notamment) est coupé/à cheval sur le bord du cadre téléphone (`overflow-hidden` + `rounded-[30px]`) — un élément interactif à moitié tronqué au premier écran desktop. Fait « pas fini » sur la vitrine de l'app.
- Preuve : capture `audit/captures/phase0/feed-1440.png` ; `src/components/feed/FeedCard.tsx:146` (cadre `overflow-hidden md:rounded-[30px]`), `:262` (rail `absolute right-3 md:!bottom-40`)
- Correction prévue : repositionner le rail dans la marge interne du cadre au breakpoint md (le `right-3` mobile ne suffit pas dans le stage 468 px), ou le sortir du cadre en vis-à-vis assumé — mais jamais clippé à moitié.

### [MAJEUR] Aucune échelle canonique de bordures et d'états hover
- Écran : toutes les pages commerce + feed
- Description : bordures `bone/15`, `/20`, `/25`, `/30`, `/60` distribuées au hasard sur le même rôle (bouton outline) ; trois retours hover différents (`bg-bone/10`, `bg-bone/15`, `border-bone/60`) ; 5 implémentations divergentes du bouton « Suivre » dont une seule carrée. Les valeurs sont bien teintées via `bone` (pas de gris pur) mais l'absence d'échelle produit l'effet patchwork « chaque écran généré séparément ».
- Preuve : inventaire §2 (relevé exhaustif) ; `src/app/decouvrir/page.tsx:347-351` (Suivre carré unique + `hover:bg-bone/90` unique) ; `ArticleDetail.tsx:154` vs `creer/page.tsx:432` vs `membre/[handle]/page.tsx:417`
- Correction prévue : arrêter 3 crans de bordure sémantiques (hairline / défaut / actif) et 1 seul retour hover par rôle, en vars dans `@theme` à côté de `--hairline` qui existe déjà ; passer les boutons dessus lors de la primitive `<Button>`.

---

## MINEURS

### [MINEUR] Blobs lumineux animés + halo + sonar sur l'écran d'entrée
- Écran : AuthScreen (premier écran de chaque nouvel utilisateur)
- Description : deux blobs `blur-[110px]`/`[120px]` en dérive infinie (18 s/22 s) + halo bloom + anneau sonar + logo qui se matérialise du flou — l'empilement complet du hero « AI landing page », exécuté en mono à 5-7 % d'opacité (ce qui le sauve visuellement). `useReducedMotion` respecté.
- Preuve : `src/components/chrome/AuthScreen.tsx:76-121`
- Correction prévue : garder UN geste (le logo qui émerge) et remplacer les blobs errants par une lumière statique ou le `.sweep` cinématique maison — plus proche du grain/key-light déjà dans la DA.

### [MINEUR] Montserrat : rôle cadré, chargement sans intention
- Écran : global (typo display)
- Description : le système typo est intentionnel (3 familles à rôles écrits : Bodoni eyebrows italiques, Hanken texte, Montserrat display — `globals.css:174-199`) mais Montserrat reste LE choix display par défaut du web, et 7 graisses sont chargées (300→900) quand l'app n'en porte que 4 (700 dominant ×50, 600, 500, 900 ×6 ; 800 = 0 usage, 300 = 1).
- Preuve : `src/app/layout.tsx:13-18` ; grep graisses : `font-extrabold` = 0 occurrence
- Correction prévue : réduire aux graisses réellement utilisées (gain perf immédiat) ; en Phase 2, évaluer une display plus caractérielle sur le même rôle — option, pas obligation, la hiérarchie actuelle tient.

### [MINEUR] Glyphes texte à la place des icônes maison
- Écran : Profil, Drops, Créer, Vendre
- Description : `♡` en caractère texte pour le compteur de likes, `✓` texte dans trois CTA de succès — alors que `Heart` et `Check` existent dans le set maison 24×24 stroke 1.6 et que `Check` est déjà utilisé ailleurs (ReferralCard). Rendu OS-dépendant, graisse incohérente avec le set.
- Preuve : `src/app/profil/page.tsx:550` ; `src/app/drops/DropsView.tsx:223` ; `src/app/creer/page.tsx:424` ; `src/app/vendre/page.tsx:322` ; icônes : `src/components/chrome/icons.tsx:48,203`
- Correction prévue : remplacer par `<Heart>`/`<Check>` du set. (Les emoji 🤍🔥🙏 restent cantonnés au contenu conversationnel mock — plausible en UGC, RAS.)

### [MINEUR] Fuites de couleur hors tokens
- Écran : badge Vérifié (partout), feed (média génératif)
- Description : `Verified` a sa coche en `stroke="#060607"` dur — en thème clair le badge est rempli quasi-noir (`currentColor` = bone clair #1a1813), la coche devient invisible. `KenBurnsMedia` compose son studio en 4 hex gris purs neutres (#272727→#050505) et des `rgba(255,255,255,…)` dans un système aux neutres chauds (bone #f3f0e8, ash #8a8782) — recette key-light dupliquée dans 5 fichiers.
- Preuve : `src/components/chrome/icons.tsx:86` ; `src/components/feed/KenBurnsMedia.tsx:101,108-146` ; `LuxeMedia.tsx:49,61` ; `profil/page.tsx:540` ; `creer/page.tsx:460`
- Correction prévue : `stroke="var(--c-ink)"` (suit le thème) ; basculer les gris du studio sur les tokens coal/ink et factoriser la recette key-light (déjà à moitié dans `LuxeMedia`).

### [MINEUR] Stratégie de profondeur mélangée sur les flottants
- Écran : global
- Description : la profondeur est globalement cohérente (hairlines pour la structure, glass pour le chrome sur média — 47 usages) mais les éléments flottants cumulent 5 recettes d'ombre non tokenisées (stage `0_40px_120px`, FAB `0_8px_24px`, dropdown `0_20px_60px`, `shadow-xl` ×2, `shadow-lg` ×1), `ring-1` et `border` sont interchangés pour le même rôle de liseré, et des cartes glass posées sur fonds plats (`backdrop-blur-xl` du formulaire checkout, rows profil/messages) paient le blur sans rien avoir à flouter.
- Preuve : `FeedCard.tsx:146` ; `MobileTabBar.tsx:66` ; `membre/[handle]/page.tsx:448` ; `messages/page.tsx:423,514` ; `CheckoutView.tsx:362` ; `profil/page.tsx:358` (glass) vs `:311` (border) vs `:533` (ring)
- Correction prévue : 2 ombres tokenisées max (flottant proche / stage), règle écrite border-vs-ring, et réserver `.glass` aux surfaces posées sur média ou scroll — fond plat = `bg-coal` + hairline.

### [MINEUR] Vocabulaire radius mensonger
- Écran : global (code)
- Description : `rounded-xl/2xl/3xl` truffent le code mais rendent tous 2 px via les tokens — le code dit « cartes douces », l'écran dit brutalisme. Piège pour tout contributeur et fragilité : retoucher les tokens re-skinnerait silencieusement 40+ surfaces.
- Preuve : `src/app/globals.css:35-38` vs `profil/page.tsx:67,77,311…`, `messages/page.tsx:326,475`, `PlanCards.tsx:28`, `confidentialite/page.tsx:19`
- Correction prévue : lors de la normalisation radius (cf. MAJEUR), remplacer par les classes qui disent la vérité (`rounded-none`/`rounded-[2px]` tokenisé) — mécanique, sans changement visuel.

### [MINEUR] hover:scale génériques sur le chrome de nav
- Écran : SideNav, Profil
- Description : `hover:scale-110` sur le logo et le FAB desktop, `group-hover:scale-110` sur le monogramme profil — le pop générique, quand l'app possède déjà son langage motion (y-lift 1-4 px + ease luxe en `whileHover`, zooms média 1.03-1.06 sur 700 ms). Deux langages coexistent.
- Preuve : `src/components/chrome/SideNav.tsx:51,110` ; `src/app/profil/page.tsx:544` ; langage maison : `ProductCard.tsx:162`, `ActionRail.tsx:39`
- Correction prévue : aligner ces 3 cas sur le y-lift/opacité maison ; `active:scale-9x` (press tactile) reste, il est cohérent partout.

### [MINEUR] Résidus : gradient dégénéré et keyframes slop morts
- Écran : feed (ring avatar live), CSS global
- Description : le ring live de `CreatorHeader` est `bg-gradient-to-tr from-bone via-bone to-bone` — un dégradé à 3 stops identiques, squelette du ring-story Instagram jamais adapté à la mono ; `.shimmer` (le loader-slop par excellence) et `.marquee` + leurs keyframes sont définis et utilisés nulle part ; 2 halos d'avatar dupliqués `from-bone/40 to-bone/10 blur-[2px]`.
- Preuve : `src/components/feed/CreatorHeader.tsx:31-36` ; `src/app/globals.css:368-397` (0 usage tsx, confirmé inventaire) ; `profil/page.tsx:230` = `membre/[handle]/page.tsx:360`
- Correction prévue : ring live en `bg-bone` plein (même rendu, code honnête) ; supprimer `.shimmer`/`.marquee`/`@keyframes grain-shift` ; factoriser le halo d'avatar.

### [MINEUR] Grille pricing template sur Premium
- Écran : Premium (`/premium`)
- Description : 3 colonnes, carte centrale surélevée (`md:-mt-3`), badge « POPULAIRE » + couronne, CTA pleine largeur — la structure pricing SaaS stock au pixel près, seulement re-teintée mono. Reconnaissable comme template malgré l'exécution dans la DA.
- Preuve : `src/components/ui/PlanCards.tsx:28-38` ; capture `audit/captures/phase0/premium-375.png`
- Correction prévue : garder la hiérarchie mais l'éditorialiser avec les gestes maison (eyebrow Bodoni au lieu du badge couronne, filet + graisse pour le plan mis en avant plutôt que l'élévation `-mt`).

---

## RAS vérifiés (le catalogue sans occurrence — la DA fait déjà le travail)

- **Dégradés violet→bleu / rose→orange, texte en dégradé** : 0. Les 20 gradients du code sont des scrims noirs de lisibilité sur média ; `gradientFor()` génère des fonds quasi-neutres (saturation 5-6 %, `utils.ts:62-68`) qui restent dans la mono — même les placeholders respectent la DA.
- **Hero « titre centré + 2 boutons »** : 0. `PageHeader` est éditorial aligné gauche partout ; 404/erreur centrés à 1 CTA = convention légitime.
- **Grilles de cartes rounded-2xl shadow-lg** : 0 à l'écran — les tokens aplatissent tout à 2 px et 3 `shadow-lg/xl` seulement dans toute l'app ; le marché est une masonry `columns` à hairlines, pas un card-grid.
- **Stat-cards dashboard** : la rangée stats du profil (`profil/page.tsx:31,311`) est la convention de profil social, mono, hairline — pas le tic KPI.
- **Emoji comme icônes de chrome** : 0 (grep unicode complet) — emoji uniquement dans le contenu conversationnel mock, plausible en UGC.
- **Gris purs / `gray-* slate-* zinc-*`** : 0 — tout le neutre passe par les tokens chauds bone/ash/coal (les 2 fuites hex sont en MINEUR).
- **animate-bounce / confettis / shimmer à l'écran** : 0 rendu (`.shimmer` défini mais mort, cf. MINEUR) ; `animate-ping` réservé aux dots live — sémantique, pas décoratif.
- **Avatars vides** : 0 — `Avatar` (15 importeurs) : monogramme + portrait en overlay avec retrait gracieux sur erreur.
- **Couleur signature** : la mono ivoire-sur-encre EST la signature, déclarée (`globals.css:5` « Strict noir & blanc — no chroma ») et tenue à une exception près (le rouge profil, traité en MAJEUR).
- **Les trois looks-tics** : verdict — choix ASSUMÉ, pas tic surajouté. Le brutalisme éditorial est porté par un système, pas par des filets décoratifs : tokens radius volontairement aplatis et commentés, hiérarchie 3 familles à rôles écrits, marginWord Bodoni vertical + folio, set d'icônes maison stroke 1.6, grain statique justifié perf, curseur éditorial. Le feed quasi-noir n'a aucun accent acide (mono stricte) et les pages crème n'ont ni terracotta ni serif de titrage. La combinaison feed-sombre/commerce-ivoire est cohérente en soi ; seul point de polish (hors slop) : la bascule sombre→clair sans transition, déjà notée en Phase 0.

**Bilan : 3 BLOQUANTS · 4 MAJEURS · 9 MINEURS.** La DA est réelle et défendable — le slop de SOLANGE n'est pas dans la direction (elle est tenue) mais dans la discipline d'exécution : radius sans règle réelle, échelles non canoniques, résidus de patterns importés (blobs, pricing template, ring story) et trois débordements mobiles qui cassent la première impression.

---

## 2. Slop de copy — 2 bloquant(s) · 14 majeur(s) · 13 mineur(s)

Base : `audit/00-inventaire.md` (§6 copy) + greps propres sur `src/` et `netlify/functions/` (les erreurs serveur surfacées à l'écran n'étaient pas dans l'inventaire — elles y passent ici). 29 occurrences : 2 BLOQUANT · 14 MAJEUR · 13 MINEUR.

---

## BLOQUANT

### [BLOQUANT] L'erreur serveur du dépôt contredit les règles affichées par le formulaire
- Écran : /vendre (dépôt d'annonce, connecté)
- Description : le formulaire annonce que seuls titre, prix et état sont requis (« Ajoute un titre, un prix, un état pour publier », marque/taille optionnelles), mais le serveur rejette avec « Titre, marque et taille sont requis ». Un vendeur qui suit les consignes de l'écran est bloqué par un message qui les contredit — sur le parcours qui crée la valeur.
- Preuve : `src/app/vendre/page.tsx:49-54,486-489` (requis client) vs `netlify/functions/products.mts:115` (requis serveur) ; l'erreur remonte brute via `setSubmitError(res.error)`
- Correction prévue : aligner les deux règles (décider ce qui est vraiment requis), et faire porter le hint client exactement la même liste que la validation serveur.

### [BLOQUANT] La marketplace a cinq noms
- Écran : nav, /decouvrir, feed, /membre, /vendre, metadata
- Description : le même lieu s'appelle « Marché » (les 2 navs), « Découvrir » (H1 + URL + title), « Marketplace » (eyebrow), « Boutique » (toggle feed + « Découvrir la boutique »), « marketplace sociale » (SEO). Taper « Marché » et atterrir sur « Découvrir » sous un eyebrow « Marketplace » fait généré au premier regard, sur la surface commerce cœur.
- Preuve : `SideNav.tsx:17` · `MobileTabBar.tsx:29` · `decouvrir/page.tsx:132-133` + `decouvrir/layout.tsx:19` · `FeedTopBar.tsx:16` · `membre/[handle]/page.tsx:340` · `ShopFeed.tsx:42` · `vendre/page.tsx:332` · `layout.tsx:43` (captures `decouvrir-375/768/1440.png`)
- Correction prévue : canon « Marché » partout (nav, H1, title, CTA « Voir dans le Marché ») ; « Boutique » réservé exclusivement au mode boutique du feed ; « Marketplace » supprimé de l'UI (toléré en SEO).

---

## MAJEUR

### [MAJEUR] Le geste « enregistrer » change de verbe au sein du même bouton
- Écran : feed (rail), feed Boutique, Marché, /favoris
- Description : le bouton du rail affiche « Garder » au repos et « Enregistré » une fois actif — deux verbes pour un seul contrôle. Autour : « Gardé » (ShopCard), aria « Enregistrer »/« Retirer des favoris »/« Retirer des enregistrements », nav « Favoris », vide « Aucune pièce enregistrée ». Quatre champs lexicaux pour un geste.
- Preuve : `ActionRail.tsx:135,139` (Garder→Enregistré) · `ShopCard.tsx:112,115` · `ProductCard.tsx:101` · `SideNav.tsx:20` · `favoris/page.tsx:93`
- Correction prévue : verbe canon « Garder/Gardé » partout (labels + aria « Retirer des gardés » → « Retirer »), l'écran reste « Favoris » comme nom de lieu ; le vide devient « Aucune pièce gardée… ».

### [MAJEUR] Notifications : trois noms pour un écran
- Écran : nav desktop, /notifications
- Description : la SideNav dit « Alertes », on atterrit sur eyebrow « Notifications » + H1 « Activité » (+ marginWord « Activité », title « Notifications »). Trois noms se superposent sur le même écran.
- Preuve : `SideNav.tsx:22` · `notifications/page.tsx:79-82` · `notifications/layout.tsx:4` (capture `feed-1440.png` pour la SideNav)
- Correction prévue : « Notifications » partout (nav, H1, title) — sobre, conforme quiet-luxury ; « Activité » et « Alertes » disparaissent.

### [MAJEUR] Communauté : Commu / Cercles / Communauté
- Écran : nav mobile, nav desktop, /communaute
- Description : tab mobile « Commu » (abréviation registre réseau social, en tension avec la DA), SideNav « Cercles », page « Communauté », corps « cercle ». Trois noms, dont un qui casse le ton.
- Preuve : `MobileTabBar.tsx:30` · `SideNav.tsx:19` · `CommunityView.tsx:19,25-26`
- Correction prévue : « Cercles » partout (nav mobile incluse, H1 « Cercles ») — c'est le nom le plus distinctif et le plus DA ; « cercle » reste le nom d'unité.

### [MAJEUR] L'objet en vente : pièce / article / annonce, y compris dans le même écran
- Écran : /vendre, navs, /profil, /membre, fiche, checkout
- Description : « Ta pièce » puis « Ton article » à 45 lignes d'écart sur /vendre ; FAB mobile « Vendre un article » vs desktop « Déposer une pièce » ; « Mes annonces », « Annonces en vente », « Pièce unique », ligne récap « Article », route `/article/[id]`.
- Preuve : `vendre/page.tsx:325,370` · `MobileTabBar.tsx:128` vs `SideNav.tsx:135` · `profil/page.tsx:401` · `membre/[handle]/page.tsx:389,506` · `ArticleDetail.tsx:94` · `CheckoutView.tsx:335`
- Correction prévue : lexique tranché — « pièce » = l'objet (côté acheteur et feed), « annonce » = sa mise en vente (côté vendeur : Mes annonces) ; « article » supprimé de l'UI (la route peut rester).

### [MAJEUR] L'acte de vendre : Vendre / Déposer / Publier / Mettre en vente
- Écran : /vendre, navs, gate invité, serveur
- Description : nav « Vendre », H1 « Déposer », gate « Connecte-toi pour publier ta pièce », CTA « Mettre en vente », erreur serveur « Connecte-toi pour déposer une annonce ». Quatre verbes pour la même action sur un seul parcours.
- Preuve : `vendre/layout.tsx:94` · `vendre/page.tsx:143,456,469` · `SideNav.tsx:135` vs `MobileTabBar.tsx:128` · `netlify/functions/products.mts:103`
- Correction prévue : « Vendre » = le lieu, « Mettre en vente » = l'action de soumission ; gate « Connecte-toi pour mettre ta pièce en vente » ; FAB unifié mobile/desktop (même libellé, même ordre).

### [MAJEUR] Le contenu publié : look / post / actu / contenu / haul / achats
- Écran : /creer, /decouvrir, /profil, /membre
- Description : « Publier le look » vs « Ton post » vs « Ton actu » dans le même fichier ; onglet recherche « Contenu » vs badge « Post » ; onglet profil « Looks » vs « Posts publiés » ; « Haul du week-end… » vs CTA « Publier mes achats » pour le même objet (branches d'ailleurs inatteignables, kind verrouillé).
- Preuve : `creer/page.tsx:95,427,615-616,98,297` · `decouvrir/page.tsx:43,399` · `profil/page.tsx:27` vs `membre/[handle]/page.tsx:529`
- Correction prévue : « look » = le seul type actif, employé partout (« Looks publiés », badge « Look ») ; supprimer la copy morte actu/haul avec ses branches.

### [MAJEUR] Eyebrow qui s'auto-explique : « Vendre = mettre en vente »
- Écran : /vendre (en-tête)
- Description : le surtitre définit un mot par lui-même — copy d'échafaudage qui fait généré, au-dessus du H1 « Déposer » qui dit un 3e verbe.
- Preuve : `src/app/vendre/page.tsx:142` (capture `vendre-375.png`)
- Correction prévue : eyebrow qui pose le décor sans gloser, p. ex. « Seconde vie » ou « Ta pièce, ton prix », aligné sur le canon lexical retenu.

### [MAJEUR] Registre : ~98 tutoiements, 6 vouvoiements dont 3 fuites
- Écran : sheet créer (aria), parrainage profil, cartes Journal
- Description : le produit tutoie massivement (78 marqueurs tu/ton/ta/tes/toi dans app+components, 20 dans mock affiché). Fuites : aria « Que voulez-vous créer ? » (seul vouvoiement d'interface pure) ; parrainage « Partage ton code » → « vous gagnez chacun 5 € » (rupture dans 3 steps d'une même carte) ; cartes Journal « Vos avis », « Vos meilleures trouvailles », « la pièce vous survivra » dans une UI qui tutoie. « Pour vous » (idiome feed) assumable.
- Preuve : `MobileTabBar.tsx:93` · `mock.ts:993` (vs :984-989) · `mock.ts:1223,1249,1347` · comptage grep `\btu|ton|ta|tes|toi\b` = 78 + 20
- Correction prévue : basculer l'aria en « Que veux-tu créer ? », réécrire le step parrainage en tu (« vous gagnez chacun » → « chacun gagne 5 € »), tutoyer les accroches Journal (le corps éditorial peut garder sa voix).

### [MAJEUR] « Commission (3.5 %) » — point décimal anglais sur l'écran vendeur
- Écran : /vendre (récap « Tu reçois »)
- Description : `toFixed(1)` produit « 3.5 % »/« 2.5 % » avec un point, alors que le checkout formate le même taux en « 3,5 » via `toLocaleString("fr-FR")`. Le nombre le plus sensible du parcours vendeur n'est pas localisé, et diverge entre deux écrans du même flux d'argent.
- Preuve : `src/app/vendre/page.tsx:381` vs `src/app/checkout/[id]/CheckoutView.tsx:47` ; taux 0.035/0.025 dans `src/lib/utils.ts:71-76`
- Correction prévue : formater via `toLocaleString("fr-FR")` (ou réutiliser la logique checkout) — une seule fonction de format de taux partagée.

### [MAJEUR] États vides cul-de-sac, sans porte de sortie
- Écran : /favoris, /notifications, /messages, commentaires
- Description : « Aucune pièce enregistrée pour l'instant. » (aucun lien vers le Marché — et l'écran n'a déjà aucune entrée mobile), « Aucune activité pour l'instant. », « Aucune conversation à afficher. » (formulation technique), « Aucun commentaire pour l'instant. » — constats secs là où Communauté montre le bon geste (« Rejoins-en un pour lancer la conversation. »).
- Preuve : `favoris/page.tsx:93` · `notifications/page.tsx:206` · `messages/page.tsx:313,367` · `CommentSheet.tsx:66`
- Correction prévue : chaque vide propose l'action qui le remplit, sur le modèle Communauté/Découvrir : « Rien de gardé. Chine dans le Marché → », « Lance la conversation. », etc.

### [MAJEUR] Erreurs serveur brutes surfacées : « Origine refusée », « Corps invalide »…
- Écran : checkout, /creer, /vendre, /membre
- Description : `res.error` est affiché verbatim ; le serveur peut renvoyer « Origine refusée », « Méthode non autorisée », « Corps invalide », « Requête invalide », « Limite atteinte » — jargon HTTP/technique exposé tel quel à l'acheteur ou au vendeur, sans cause ni action.
- Preuve : rendus bruts `CheckoutView.tsx:108`, `creer/page.tsx:168`, `vendre/page.tsx` (submitError), `membre/[handle]/page.tsx:290` (« Signalement impossible : {error} ») ; chaînes dans `netlify/functions/*` (grep `bad("…")` : 13× « Origine refusée », 11× « Méthode non autorisée »)
- Correction prévue : table de correspondance côté client (code/status → message DA actionnable) avec fallback « Réessaie dans un instant » ; les libellés serveur métier (« Cette pièce vient d'être vendue ») passent tels quels.

### [MAJEUR] Signalement : window.prompt nu + trois feedbacks pour la même action
- Écran : /messages, /membre, feed (post membre)
- Description : le motif est demandé via `window.prompt` natif (« Pourquoi signaler @x ? ») — copy système hors DA ; puis le succès dit « Signalement envoyé. Merci. » ici et « Merci, notre équipe va examiner ce profil. » là, l'échec « Échec du signalement, réessaie plus tard. » ou « Signalement impossible : {error} ».
- Preuve : `messages/page.tsx:240,245-246` · `membre/[handle]/page.tsx:284,289-290` · `MemberPostCard.tsx:138`
- Correction prévue : un seul couple succès/échec canonique ; le prompt natif remplacé par le sheet maison (chantier UI, mais la copy s'unifie dès maintenant).

### [MAJEUR] Franglais non assumé : shoppable, à shopper, Shop, Live shopping, Boost
- Écran : metadata, feed (rail), /creer, /live, /vendre
- Description : « shoppable/shoppables » ×5, « pièces à shopper » (quand ShopTheLook dit joliment « à chiner »), label rail « Shop » (seul label EN du rail), eyebrow « Live shopping » au-dessus du H1 FR « En direct », « Boost ta visibilité ». L'app possède déjà le mot juste — « chiner » — et ne s'en sert pas partout. (Feed, Live, look, drop, « Shop the look » : assumés.)
- Preuve : `layout.tsx:43` · `page.tsx:7,12` · `creer/layout.tsx:6` · `creer/page.tsx:481` · `ActionRail.tsx:97,100` · `StreamsView.tsx:486` · `vendre/page.tsx:416`
- Correction prévue : « chaque pièce se chine/s'achète » en SEO, rail « Pièces » + aria « Voir les pièces à chiner », eyebrow live « En direct » assumé seul (ou « Ventes en direct »), « Gagne en visibilité dans le feed ».

### [MAJEUR] L'app écrit « Bonjour ! … Tu accepterais X € ? » à la place de l'utilisateur
- Écran : /messages (arrivée via « Contacter le vendeur »)
- Description : une offre à −10 % rédigée par l'app est injectée dans le fil comme déjà envoyée par « me » — exclamation, tutoiement d'un inconnu et engagement de négociation que l'utilisateur n'a jamais formulés. Le CTA amont disait « Contacter », pas « Faire une offre ».
- Preuve : `src/app/messages/page.tsx:109-115` (offerMessage), seed :173-178
- Correction prévue : ne rien envoyer à la place de l'utilisateur — pré-remplir le composer avec un brouillon modifiable, sans « ! », et réserver le texte d'offre au CTA « Faire une offre ».

---

## MINEUR

### [MINEUR] La personne : membre / créateur / vendeur / profil
- Écran : /membre, /favoris, /decouvrir, /live, /communaute
- Description : « Membre bloqué » et « ce créateur » dans le même écran ; « Vendeurs suivis » (favoris) et onglet « Profils » (recherche) listent les mêmes personnes. Les rôles (vendeur en contexte de vente) sont défendables, le mélange intra-écran non.
- Preuve : `membre/[handle]/page.tsx:353,489` · `favoris/page.tsx:58` · `decouvrir/page.tsx:42` · `StreamsView.tsx:488` · `CommunityView.tsx:20`
- Correction prévue : « membre » = terme générique, « vendeur/créateur » seulement quand le rôle est actif dans la phrase ; jamais deux termes pour la même personne dans un écran.

### [MINEUR] Le mode sans compte : Mode démo / Mode invité / Démo / mode démo sans compte
- Écran : AuthScreen, /profil, checkout, /notifications
- Description : quatre libellés pour le même état (« Passer · mode démo sans compte », « Mode démo », « Mode invité — la commande sera une démo locale », « Démo — connecte-toi… »).
- Preuve : `AuthScreen.tsx:332` · `profil/page.tsx:334` · `CheckoutView.tsx:487` · `notifications/page.tsx:163`
- Correction prévue : un seul nom, « Mode démo », partout ; « invité » disparaît de l'UI.

### [MINEUR] Le like : j'aime / likes / a aimé
- Écran : feed (aria), metadata notifications, notifications mock
- Description : « Retirer le j'aime » (aria), « likes et drops » (description), « a aimé ton look » (notification).
- Preuve : `ActionRail.tsx:110` · `notifications/layout.tsx:6` · `mock.ts:559`
- Correction prévue : « j'aime » en canon FR (« Retirer le j'aime », « j'aime et drops ») — « a aimé » reste correct comme verbe.

### [MINEUR] « en un clic » — cliché de la liste noire, et faux
- Écran : /confidentialite (Tes droits RGPD)
- Description : « Tu peux supprimer ton compte et toutes tes données en un clic » — formule creuse, et inexacte : la suppression est (heureusement) une confirmation en 2 temps.
- Preuve : `src/app/confidentialite/page.tsx:71` vs flux 2 temps `profil/page.tsx:619-655`
- Correction prévue : « Tu peux supprimer ton compte et toutes tes données depuis ton profil. » — factuel, sans promesse de vitesse.

### [MINEUR] « Bienvenue » comme succès de connexion
- Écran : AuthScreen (étape succès)
- Description : après la vérification du code, l'écran dit « Bienvenue » — mot de la liste noire ; c'est un contexte de célébration légitime, mais le mot ne confirme rien (et accueille aussi celui qui revient).
- Preuve : `src/components/chrome/AuthScreen.tsx:315`
- Correction prévue : confirmer l'état plutôt qu'accueillir : « Te voilà. » ou « Connecté. » — court, DA, factuel.

### [MINEUR] Apostrophes : trois encodages coexistent
- Écran : toute l'app
- Description : apostrophe droite `'` dominante (littéraux + mock), `'` ×~21 dans le JSX (rend droit aussi), typographique `’` dans exactement 2 fichiers (error.tsx, not-found.tsx). Le rendu varie selon la page.
- Preuve : `error.tsx:19`, `not-found.tsx:26` (seuls `’`) vs grep `'` (9 fichiers) et `'` partout ailleurs
- Correction prévue : `’` typographique partout dans les chaînes visibles (une passe mécanique) ; garder `'` dans le code non affiché.

### [MINEUR] Aucune espace insécable avant ? ! : ni dans les prix
- Écran : toute l'app
- Description : l'espace avant la ponctuation haute est toujours sécable (« créer ? », « SOLANGE : »), et `euro()` rend « 245 € » avec espace sécable — € et ponctuation peuvent se retrouver orphelins en début de ligne. Seuls les guillemets de recherche sont protégés (`« {q} »`).
- Preuve : grep U+00A0/U+202F → 0 hors `decouvrir/page.tsx:310,377` ; `utils.ts:24-26` (euro), `MobileTabBar.tsx:93`
- Correction prévue : espace fine insécable (U+202F) avant ? ! : et entre nombre et €/%/k/M — d'abord dans `euro()`/`compact()` (un seul point de code), puis les chaînes statiques.

### [MINEUR] Pourcentages et durées : collés ou espacés selon l'écran
- Écran : Marché, feed Boutique, /vendre, checkout, ShopTheLook
- Description : « −63% » collé (badges remise) vs « 3,5 % » espacé (commissions) ; « livraison 48h » collé vs « 72 h » et « sous 48 h » espacés.
- Preuve : `ProductCard.tsx:92`, `ShopCard.tsx:94` vs `vendre/page.tsx:381`, `CheckoutView.tsx:353` ; `ShopTheLook.tsx:174` vs `mock.ts:540`, `vendre/page.tsx:386`
- Correction prévue : règle unique FR — espace (fine insécable) avant % et h partout : « −63 % », « 48 h ».

### [MINEUR] Horodatages : cinq formats relatifs concurrents
- Écran : /notifications, /messages
- Description : « il y a 12 min » (fonction, minuscule) vs « Il y a 12 min » (mock, majuscule), « maintenant », « — », « 14:02 », « Lun »/« Dim » — selon la source et l'écran.
- Preuve : `notifications/page.tsx:18-24` vs `mock.ts:531-578` · `messages/page.tsx:43,82,102` · `mock.ts:626-696`
- Correction prévue : un seul formateur relatif partagé (celui de notifications), appliqué aussi aux données mock, casse comprise.

### [MINEUR] « Se connecter » qui mène au profil, pas à la connexion
- Écran : /notifications (bandeau démo)
- Description : le lien « Se connecter » route vers `/profil` — le libellé promet une action que le clic ne fait pas (il faut retrouver l'encart et re-cliquer). Ailleurs le même geste s'appelle « Se connecter / créer un compte ».
- Preuve : `src/app/notifications/page.tsx:166-171` vs `profil/page.tsx:341`, `CheckoutView.tsx:498`
- Correction prévue : libellé unique « Se connecter » branché sur le même `signIn`/`reconnect` que les autres encarts (ou, a minima, « Voir mon profil »).

### [MINEUR] « Sûr ? » — confirmation destructive en registre relâché
- Écran : /profil (suppression de compte)
- Description : « Sûr ? Toutes tes données seront effacées. » — le flux 2 temps est bon, mais la question familière minimise un acte irréversible et l'irréversibilité n'est pas dite.
- Preuve : `src/app/profil/page.tsx:630`
- Correction prévue : « Suppression définitive — annonces, messages et favoris seront effacés. » ; boutons inchangés (ils nomment déjà l'action).

### [MINEUR] Deux formulations pour la même erreur de session, et doublons d'états vides
- Écran : /creer, checkout, /messages, /notifications, /favoris
- Description : « Ta session a expiré — reconnecte-toi pour publier. » vs « Session expirée — reconnecte-toi pour finaliser la commande. » ; « Aucune conversation pour le moment. » et « …à afficher. » dans le même écran ; « pour l'instant » (favoris, commentaires, notifications) vs « pour le moment » (messages, membre).
- Preuve : `creer/page.tsx:165` vs `CheckoutView.tsx:105` · `messages/page.tsx:313,367` · `notifications/page.tsx:120,206` · grep « pour l'instant/le moment »
- Correction prévue : gabarit unique « Ta session a expiré — reconnecte-toi pour {action}. » ; une locution unique « pour l'instant » ; un seul texte vide par écran.

### [MINEUR] Copy morte : les branches actu/haul inatteignables
- Écran : /creer
- Description : `kind` est verrouillé sur « look » (useState sans setter) mais les chaînes « Le drop Lemaire SS26… », « Haul du week-end… », « Ton actu part dans le feed… », « Ton haul part dans le feed… », « Publier mes achats » vivent dans le fichier — dette de copy qui ressurgira désynchronisée.
- Preuve : `creer/page.tsx:40` (verrou) ; chaînes :98,296-297,613-616
- Correction prévue : supprimer les branches et leurs chaînes ; les réécrire au canon du jour si les types reviennent.

---

## RAS vérifiés

- **Boutons génériques (Valider / OK / Soumettre / Confirmer)** : zéro occurrence (grep vide). Les CTA nomment l'action et souvent l'enjeu : « Recevoir le code », « Mettre en vente », « Publier le look », « Payer 245 € (simulé) », aria « Envoyer le message ». Acquis à préserver.
- **Accroches creuses** : hors « en un clic » et « Bienvenue » traités ci-dessus, la liste noire est vide (Découvrez/Boostez/Optimisez/simplicité/intuitif/puissant/seamless/elevate → 0). Les sous-titres vendent le résultat, pas la fonctionnalité (« Mets une pièce en vente en moins d'une minute », « achète avant que ça parte », « Le moteur de recherche de la mode de seconde main »).
- **Exclamations hors célébration** : aucune dans le chrome UI — les seules « ! » vivent dans les DM mock conversationnelles (assumable) et l'offre auto-injectée (traitée en MAJEUR). Les succès utilisent un « ✓ » sobre (« Publié ✓ », « Place réservée ✓ »).
- **Erreurs vagues type « Une erreur est survenue »** : le boundary global assume et rassure (« …de notre côté. Tu peux réessayer — la plupart du temps, ça repart. ») ; les erreurs métier sont spécifiques et actionnables (« Cette pièce a trouvé preneur avant toi », « Ton prix minimum dépasse ton maximum. Inverse les deux bornes… » — exemplaire). Seul le passe-plat serveur brut (MAJEUR ci-dessus) fuit.
- **Ellipses** : `…` typographique partout, zéro `...` dans l'UI.
- **Prix** : `euro()` cohérent (virgule décimale, espace avant €) — seule l'insécabilité manque (MINEUR ci-dessus).
- **Placeholders** : concrets et incarnés (« Veste en cuir vintage », « Acne Studios », « ton@email.com », « Raconte l'histoire de la pièce… ») — aucun « Entrez votre texte ».
- **Guillemets** : « » français utilisés, avec insécables, aux deux seuls endroits où une citation apparaît (`decouvrir:310,377`).
- **Jargon « démo/simulé »** : l'exposition de la nature démo (« Payer (simulé) », « aucune donnée bancaire n'est saisie ») est un choix de transparence documenté (`layout.tsx:96`) et honnête — on le garde ; seul « Répartition · Stripe Connect » dans le récap acheteur est du jargon dispensable, absorbable par la correction des erreurs serveur.

---

## 3. Slop d'interaction et de motion — 4 bloquant(s) · 9 majeur(s) · 6 mineur(s)

Périmètre : `/Users/fouzi/solange`, branche `design/de-slop`, lecture seule. S'appuie sur `audit/00-inventaire.md` (Phase 0) et va au-delà : chaque point ci-dessous a été re-vérifié dans le code (grep + lecture).

---

## BLOQUANTS

### [BLOQUANT] `window.prompt()` natif pour signaler — ×3
- Écran : Messages (menu ⋯ du fil), Membre public (menu Signaler), Feed (MemberPostCard)
- Description : le motif de signalement est demandé via `window.prompt()` : non stylable (chrome système gris sur une DA noir/ivoire), une seule ligne, pas mobile-friendly, et purement supprimé en PWA standalone iOS (prompt y retourne null sans s'afficher).
- Preuve : `src/app/messages/page.tsx:240` · `src/app/membre/[handle]/page.tsx:284` · `src/components/feed/MemberPostCard.tsx:131`
- Correction prévue : bottom-sheet de signalement dans le chrome de sheet existant (scrim `bg-ink/70` + panneau `bg-coal/95`) : chips carrées de motifs (le `Chip` brutaliste existe) + textarea `.field`, envoi via `api.report` déjà en place.

### [BLOQUANT] « Faire une offre » : bouton mort dans le feed Boutique
- Écran : Feed mode Boutique (ShopCard)
- Description : `<button>` rendu actif, hover et active:scale câblés, mais aucun `onClick` — taper ne produit strictement rien, sans feedback. La fiche article, elle, route l'offre vers `/messages?item=`.
- Preuve : `src/components/feed/ShopCard.tsx:187-193` (vs `src/app/article/[id]/ArticleDetail.tsx:190`)
- Correction prévue : `Link href={/messages?item=${item.id}}` comme ArticleDetail (l'offre −10 % y est déjà gérée), ou retirer le bouton tant que la feature n'existe pas.

### [BLOQUANT] Le CTA « Se connecter » détruit le formulaire saisi (`location.reload()`), et aucun brouillon ne survit
- Écran : Vendre, Créer (gate invité)
- Description : l'encart invité fait `localStorage.removeItem("solange:onboarded")` + `location.reload()` : un invité qui a rempli titre/prix/photos perd tout pour se connecter, puis retape tout. Aucune persistance de brouillon nulle part (grep `sessionStorage|localStorage` → seul le flag onboarding, `AuthGate.tsx:27,37`) : un refresh accidentel efface aussi tout.
- Preuve : `src/app/vendre/page.tsx:131-136` · `src/app/creer/page.tsx:182-187`
- Correction prévue : brouillon `sessionStorage` (champs texte, pas les photos) restauré au mount ; gate de connexion en overlay (AuthScreen est déjà un composant monté en `fixed z-[100]`) sans reload de page.

### [BLOQUANT] Le composer de commentaires avale le texte tapé
- Écran : Feed (CommentSheet)
- Description : le bouton « Publier le commentaire » fait uniquement `setDraft("")` : le commentaire tapé disparaît sans apparaître dans la liste, sans toast, sans erreur. Une affordance complète (input + bouton send actif) qui détruit silencieusement l'entrée utilisateur. Enter dans le champ ne fait rien non plus (aucun onKeyDown).
- Preuve : `src/components/feed/CommentSheet.tsx:96-110` (commentaire code « composer — non-submitting (mock) »)
- Correction prévue : append optimiste local dans la liste mock de la sheet (même pattern que `setExtra` de messages) ; à défaut, désactiver le composer plutôt que simuler un envoi.

---

## MAJEURS

### [MAJEUR] Cibles tactiles recouvertes par la tab bar flottante (conséquence interaction du débordement Phase 0)
- Écran : Checkout, Découvrir, Vendre (mobile 375)
- Description : le CTA invité « Se connecter/créer un compte » du checkout passe sous la tab bar (tap intercepté par la nav), la 1re rangée de cartes produit de Découvrir et les chips de catégorie de Vendre sont à moitié recouvertes — la zone haute de la tab bar vole leurs taps.
- Preuve : captures `audit/captures/phase0/checkout-375.png`, `decouvrir-375.png`, `vendre-375.png` ; `CheckoutView.tsx:484-501` (bandeau invité) ; `--tabbar-clearance` non appliqué (`globals.css:63`)
- Correction prévue : appliquer `padding-bottom: var(--tabbar-clearance)` (token déjà défini) au conteneur scrollable des pages claires — PageShell est le point unique (19 usages).

### [MAJEUR] « Tout ajouter » : faux succès — confirme « Ajouté ✓ » sans rien ajouter
- Écran : Feed (drawer Shop the look)
- Description : `addAll` fait `track()` + `setAdded(true)` : le label anime vers « Ajouté » avec check, mais aucune pièce n'est enregistrée nulle part (ni saves du store, ni panier). Feedback de succès mensonger, réinitialisé à la fermeture.
- Preuve : `src/components/feed/ShopTheLook.tsx:41-45` (addAll), `:195-207` (swap « Ajouté »)
- Correction prévue : `toggleSave` sur chaque pièce du look (le store expose déjà saves + la page Favoris existe), et libeller « Tout garder » pour coller au vocabulaire du rail.

### [MAJEUR] Scroll et état du feed perdus à chaque navigation
- Écran : Feed → membre/checkout/decouvrir → retour
- Description : le feed est un scroller interne (`overflow-y-auto`, `VideoFeed.tsx:62`) — le navigateur ne restaure jamais sa position. Aucune persistance de l'index actif ni du mode Feed/Boutique (`FeedModeShell.tsx:16`, `useState` simple ; grep sessionStorage → rien). Retour = post 1, mode Scroll, systématiquement.
- Preuve : `src/components/feed/VideoFeed.tsx:58-84` · `src/components/feed/FeedModeShell.tsx:16`
- Correction prévue : persister `{activeIndex, mode}` en `sessionStorage` au changement, restaurer au mount avec `scrollTo` instantané (le snap `mandatory` se recale seul).

### [MAJEUR] Zéro état d'interface dans l'URL — 0 `router.push/replace` dans tout `src/`
- Écran : Découvrir (onglet Pièces/Profils/Contenu, catégorie, filtres, même `q` tapé), Feed (mode Scroll/Boutique), Messages (conversation active)
- Description : tout vit en `useState`. Rien n'est partageable ni restaurable ; pire, sur mobile le fil de messages ouvert est un état local (`selId`, bascule `hidden md:flex`) — le back navigateur/geste OS sort de `/messages` au lieu de revenir à l'inbox.
- Preuve : grep `router.push|router.replace` sur `src/` → 0 ; `src/app/decouvrir/page.tsx:49-54` (`?q=` lu à l'init, jamais réécrit) · `src/app/messages/page.tsx:291-292,363`
- Correction prévue : `?tab=`, `?cat=`, `?mode=` via `router.replace` shallow ; conversation via `?conv=` en `pushState` pour que back = retour inbox (plateforme-first, zéro lib).

### [MAJEUR] Escape absent de la moitié des surfaces, et aucun focus-trap nulle part
- Écran : FilterDrawer (pourtant `role="dialog"`), ShopTheLook, CommentSheet, menu ⋯ de Membre
- Description : seuls les compose sheets (MobileTabBar/SideNav) et le viewer live écoutent Escape (grep exhaustif). Aucune surface ne piège le focus ni ne rend le fond `inert` (grep → 0) : au clavier, Tab s'échappe derrière le scrim d'un dialog ouvert.
- Preuve : grep `Escape` → `StreamsView.tsx:341`, `SideNav.tsx:37`, `MobileTabBar.tsx:42` uniquement ; `FilterDrawer.tsx:83-85` (dialog sans Escape) ; inventaire §a11y (0 `inert`)
- Correction prévue : primitive Sheet unique (déjà réclamée par le chantier doublons) construite sur `<dialog>` natif — Escape, focus-trap et inert offerts par la plateforme.

### [MAJEUR] Envoi de message fire-and-forget : aucun état d'échec, jamais de retry
- Écran : Messages
- Description : `send()` ajoute le message localement puis `void api.sendMessage(...)` sans `.catch`, sans statut par message. Hors ligne ou en 500, le message s'affiche envoyé pour toujours — divergence silencieuse avec le serveur sur l'écran le plus transactionnel du social.
- Preuve : `src/app/messages/page.tsx:261-285`
- Correction prévue : statut par message (`pending/sent/failed`), échec → libellé « Non envoyé — appuyer pour réessayer » sur la bulle, dans le style existant.

### [MAJEUR] Chargements sans squelette : texte brut, sections qui popent, feed qui se réécrit sous le doigt
- Écran : Notifications, Profil, Feed, Découvrir
- Description : notifications = « Chargement… » en texte nu (`notifications/page.tsx:95-101`) ; profil = sections gated `myProds.length > 0` → absentes puis pop-in sans transition (`profil/page.tsx:398`, fetch sans indicateur `:162-171`) ; feed = posts membres **prépendus** après résolution API → le 1er écran visible est remplacé sous les yeux de l'utilisateur (`VideoFeed.tsx:26-34,64`) ; grille Découvrir = memberItems prépendus pareil (`decouvrir/page.tsx:102-105`). Un seul `animate-pulse` dans toute l'app (`membre:298`) et la classe `.shimmer` prévue pour ça est définie mais jamais utilisée (`globals.css:376`).
- Preuve : réfs ci-dessus ; grep `animate-pulse` → 1 occurrence
- Correction prévue : squelettes `.shimmer` (déjà dans le CSS !) pour notifications/profil ; feed et grille : appendre en fin ou réserver l'emplacement, jamais prépendre au-dessus du viewport.

### [MAJEUR] Zoom iOS au focus : `.field` est en 14 px, la recherche Découvrir en `text-sm`
- Écran : Vendre, Créer, Checkout, FilterDrawer (prix min/max), Auth (email), Découvrir (recherche)
- Description : `.field { font-size: 0.875rem }` → iOS zoome la page au focus de chaque champ et la laisse zoomée. Le bon pattern (`text-base … md:text-[13px]`) existe déjà dans les composeurs messages/live/commentaires — les formulaires ne l'ont pas.
- Preuve : `src/app/globals.css:225` · `src/app/decouvrir/page.tsx:152` (`text-sm`) ; contre-exemple sain `messages/page.tsx:494`
- Correction prévue : `.field` → `font-size: 1rem` + `@media (min-width: 768px) { 0.875rem }` ; recherche Découvrir → `text-base md:text-sm`.

### [MAJEUR] Trois canaux de feedback différents pour la même action « Signaler » (et 2 implémentations de toast)
- Écran : Feed (toast éphémère 2,6 s), Messages (toast 3 s, autre style/position), Membre (texte inline `reportMsg` jamais effacé, persiste jusqu'à quitter la page)
- Description : le succès du signalement est annoncé différemment selon l'écran ; les deux toasts ont chacun leur timer, leur style et leur position (`calc(--tabbar-clearance + 5.5rem)` vs `bottom-[calc(7rem+env(...))]`).
- Preuve : `MemberPostCard.tsx:123-127,384-400` · `messages/page.tsx:231-234,508-518` · `membre/[handle]/page.tsx:287-291,479-484`
- Correction prévue : primitive Toast unique (position, durée, `role="status"`) au style du toast MemberPostCard (le plus DA) ; `reportMsg` du profil membre migre dessus.

---

## MINEURS

### [MINEUR] Barre de progression du feed : 13 s forfaitaires, décorrélées du média
- Écran : Feed (FeedCard)
- Description : la barre anime `width: 100%` en 13 s fixes quelle que soit la durée réelle de la vidéo, et le `key` incluant `paused` la remet à zéro à chaque pause/reprise — c'est un faux indicateur.
- Preuve : `src/components/feed/FeedCard.tsx:427-437`
- Correction prévue : piloter par `timeupdate` de la vidéo (et durée du cycle kenburns pour les stills) ; sinon la retirer — un faux instrument est pire que pas d'instrument.

### [MINEUR] Optimistes sans rollback sur like/save/follow
- Écran : global (store)
- Description : les toggles mettent l'état local à jour puis `void api.social(...)` sans `.catch` — un échec réseau laisse l'UI désynchronisée en silence. Acceptable pour un like, mais le pattern est le même pour follow/block.
- Preuve : `src/lib/store.tsx:180-190`
- Correction prévue : `.catch` → revert du toggle (l'optimiste reste, on ajoute juste le retour arrière).

### [MINEUR] Cibles < 44 px restantes
- Écran : Découvrir (bouton filtres `size-8` = 32 px), sheets (fermer `size-9` = 36 px ×4), Feed (Suivre `h-8`, mute `size-9`), FilterDrawer (« Réinitialiser » `text-xs` sans min-height)
- Description : le gros de l'app respecte `min-h-11` (31 fichiers) ; restent ces poches, toutes sur des actions fréquentes.
- Preuve : `decouvrir/page.tsx:156` · `CommentSheet.tsx:~57` / `FilterDrawer.tsx:~102` / `MobileTabBar.tsx:110` · `FeedCard.tsx:314,324` · `FilterDrawer.tsx:227-232`
- Correction prévue : `size-11`, ou étendre la zone tactile via `before:-inset-2` — pattern déjà dans le code (`ProductCard.tsx:103,116`).

### [MINEUR] Pas de scroll-lock du fond sous les sheets
- Écran : FilterDrawer, compose sheet, drawers du feed
- Description : aucun lock body ni `overscroll-behavior: contain` sur les panneaux (grep `document.body.style|overscroll` sur les sheets → 0) : en fin de course du scroll interne d'un drawer, la page derrière se met à défiler.
- Preuve : grep sur `src/` ; `FilterDrawer.tsx:90` (panneau `overflow-y-auto` sans contain)
- Correction prévue : `overscroll-behavior: contain` sur les panneaux scrollables + lock du body à l'ouverture (gratuit avec `<dialog>` si la primitive Sheet arrive).

### [MINEUR] Le média du feed est inaccessible au clavier
- Écran : Feed
- Description : la couche tap (pause / double-tap like) est un `div onClick` sans `role`, `tabIndex` ni handler clavier ; aucune navigation par flèches du feed. Le like reste accessible via le bouton du rail, la pause n'a aucun chemin clavier.
- Preuve : `src/components/feed/FeedCard.tsx:155-158` ; grep `onKeyDown` dans VideoFeed → 0
- Correction prévue : Espace = pause quand le feed a le focus, flèches ↑/↓ = post précédent/suivant (un listener sur le scroller suffit).

### [MINEUR] `cursor: none` global : perte du I-beam sur tous les champs texte desktop
- Écran : global desktop
- Description : le CustomCursor masque le curseur natif partout (`!important`), y compris sur inputs/textarea — plus d'affordance de sélection de texte, pour un bénéfice purement décoratif à ces endroits.
- Preuve : `src/app/globals.css:147-152` · `CustomCursor.tsx:41-51`
- Correction prévue : exclure `input, textarea, [contenteditable]` du `cursor: none` (ou variant « text » du curseur custom).

---

## RAS vérifiés (le crible n'a rien trouvé — la DA/le code évitent déjà ce slop)

- **`confirm()` / `alert()` natifs : 0.** La suppression de compte utilise une confirmation inline stylée à deux temps (« Sûr ? … » + Annuler, `profil/page.tsx:625-655`) — le bon pattern, à généraliser.
- **Modale dans modale : aucune.** Les scrims (z-30) couvrent le rail (z-20) donc les sheets in-card ne s'empilent pas ; le menu membre se ferme avant le prompt (`membre:283`). Le seul empileur est le `window.prompt` lui-même (traité en BLOQUANT).
- **Toast pour tout : non.** L'app n'abuse pas des toasts (signalement/blocage uniquement) — le défaut est l'inverse : canaux incohérents (traité en MAJEUR).
- **Spinner plein écran : aucun.** L'unique `animate-spin` est dans le bouton Payer pendant l'action (`CheckoutView.tsx:466`) — usage légitime.
- **Double-tap like vs tap pause (conflit 230 ms) : bien jugé, à garder.** Timer annulé au 2e tap, double-tap = like jamais unlike (`FeedCard.tsx:117-128`), overlay pause visible (`:193-200`), burst coupé sous reduced-motion. La latence de 230 ms sur la pause est le prix standard du pattern TikTok.
- **Enter pour envoyer : présent** sur messages (`:491`), live (`StreamsView.tsx:312`), auth (`AuthScreen.tsx:195`). Seul manque : le composer commentaires, absorbé par le BLOQUANT dédié.
- **focus-visible : cohérent.** Ring mono global (`globals.css:156-162`), non cassé par les `outline-none` utilitaires (règles non-layered > utilities) ; `.field` substitue un focus par bordure — voulu et visible.
- **Scroll Découvrir → article → retour : conservé** (scroll document natif, restauration navigateur). Seul le feed perd le sien (scroller interne — traité en MAJEUR).
- **Animations décoratives : sobres et disciplinées.** Stagger du feed = signature ; blobs AuthScreen et chevron « défile » gardés par `useReducedMotion` ; `MotionConfig reducedMotion="user"` global (`template.tsx:24`) ; grain statique. Seule la fausse barre de progression déroge (MINEUR).

---

**Bilan : 4 BLOQUANTS · 9 MAJEURS · 6 MINEURS.** Fil rouge : les mécaniques plateforme (dialog, URL, sessionStorage, `<dialog>`-Escape-trap) sont absentes alors que la DA et les tokens, eux, sont solides — corriger l'interaction n'exige de toucher ni au style ni à la signature motion.

---

## 4. Slop de code — 3 bloquant(s) · 12 majeur(s) · 8 mineur(s)

Repo `/Users/fouzi/solange`, branche `design/de-slop`, lecture seule. Base : `audit/00-inventaire.md`, approfondie par greps et lectures ciblées. 23 occurrences : 3 BLOQUANT · 12 MAJEUR · 8 MINEUR.

---

### [BLOQUANT] Écran cœur triplé : coquille de carte feed ×3 + bouton de rail ×3

- Écran : Feed `/` (Scroll + Boutique), l'écran d'ouverture du produit.
- Description : la surface la plus vue de l'app existe en trois copies parallèles. La coquille desktop (className de 89 caractères strictement identique, `md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-[30px] md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]`) est collée dans 3 fichiers, et le bouton de rail est réécrit 3 fois (`Action`/`RailButton`/`RailAction`, mêmes props, même markup `glass size-12 rounded-full` + label `text-[11px]`). La dérive est déjà réelle : `ShopCard` a perdu le `whileHover` des deux autres, et 2 des 3 coquilles portent une classe `.stage` définie nulle part. Toute retouche du feed doit se faire ×3 — c'est le signal « généré » n°1 du code.
- Preuve : coquille — `src/components/feed/FeedCard.tsx:146`, `src/components/feed/MemberPostCard.tsx:155`, `src/components/feed/ShopCard.tsx:44` ; rail — `ActionRail.tsx:15-54`, `ShopCard.tsx:201-234`, `MemberPostCard.tsx:32-70` (signatures vérifiées identiques, `accent` absent de ShopCard). Visible : `audit/captures/phase0/feed-1440.png` (rail qui déborde du cadre — se corrigera 1 fois au lieu de 3).
- Correction prévue : deux primitives dans `src/components/feed/` — `FeedStage` (la coquille + tokens `--feed-stage-*` pour largeur/radius/ombre) et `RailButton` partagé (props `accent?/pressed?`, `whileHover` uniforme). Fichiers à migrer, tous : `FeedCard.tsx`, `MemberPostCard.tsx`, `ShopCard.tsx` (+ suppression des privés `Action`/`RailButton`/`RailAction`). Zéro changement visuel attendu hors ré-alignement du hover ShopCard.
- Effort : M

### [BLOQUANT] Chrome de bottom-sheet copié ×3, mécaniques modales divergentes

- Écran : feed (Shop the look, commentaires), Découvrir (filtres), tab bar (compose), membre (menu ⋯), live (viewer).
- Description : le même chrome (scrim `bg-ink/70 backdrop-blur-[2px]`, panneau `rounded-t-[28px] border-t border-bone/15 bg-coal/95`, header eyebrow, bouton fermer `size-9`) est copié 3 fois, et la mécanique modale diverge partout : Escape géré sur 2 surfaces sur 7, `role="dialog"` sur 3, focus-trap nulle part, z-index au cas par cas (30/40/50/60/70). Conséquence utilisateur directe : le clavier ferme certaines sheets et pas d'autres.
- Preuve : chrome — `src/components/feed/ShopTheLook.tsx:91-110`, `src/components/feed/CommentSheet.tsx:43-61`, `src/components/ui/FilterDrawer.tsx:90-109` ; matrice divergences — inventaire §5.2 (tableau sheets) : Escape ✓ seulement `MobileTabBar.tsx:39-46` et `StreamsView.tsx:339-345` ; `role="dialog"` ✓ seulement `FilterDrawer.tsx:83-85`, `MobileTabBar.tsx:92`, `StreamsView.tsx:388` ; `grep inert` → 0.
- Correction prévue : primitive `src/components/ui/Sheet.tsx` (scrim + panneau + header + fermer + Escape + `role="dialog"`/`aria-modal` + focus initial, z par token) dans la DA existante. À migrer, tous : `ShopTheLook.tsx`, `CommentSheet.tsx`, `FilterDrawer.tsx`, compose de `MobileTabBar.tsx:81-98` ; alignement comportemental seul (Escape/dialog) pour le menu `membre/[handle]/page.tsx:448` et le `Viewer` `StreamsView.tsx:387`.
- Effort : L

### [BLOQUANT] Échelle typographique fantôme : 350 `text-[..px]` arbitraires, 26 valeurs

- Écran : toute l'app (35 fichiers tsx).
- Description : 68 % des 518 valeurs arbitraires sont des tailles de texte hors tokens : `11px`×80, `9px`×57, `13px`×49, `12px`×48, `10px`×36… jusqu'aux demi-pixels `12.5px`×15, `13.5px`×12, `11.5px`×5, `10.5px`×3, `8.5px`×1 — quatorze crans px pour ce qui devrait être 5-6 rôles. Même le H1 canonique est arbitraire (`text-[2.7rem]`). C'est une échelle entière qui vit hors de `@theme`, et la source des micro-incohérences (le même label vaut 11, 11.5 ou 12px selon l'écran).
- Preuve : comptes re-vérifiés par grep ce jour (350/518, détail ci-dessus) ; `src/components/ui/PageHeader.tsx:10` ; inventaire §5.3.
- Correction prévue : étendre `@theme` de `globals.css` avec l'échelle réelle constatée (ex. `--text-2xs: 9px` overline, `--text-xs: 11px` label, `--text-sm: 12.5px` meta, `--text-base: 13.5px` corps, + display), puis sweep mécanique valeur→token en fusionnant les demi-pixels sur le cran le plus proche. On AFFIRME l'échelle existante dominante, on ne redessine rien.
- Effort : L

---

### [MAJEUR] Code mort confirmé — liste complète pour suppression

- Écran : aucun (invisible utilisateur, 229+ lignes mortes).
- Description : deux implémentations concurrentes et abandonnées du même pattern hotspot dorment dans `feed/`, plus un export inutile, une classe fantôme et 5 blocs CSS jamais consommés. Re-vérifié ce jour : 0 importeur, 0 usage tsx.
- Preuve : `src/components/feed/ProductHotspots.tsx` (143 l., 0 importeur), `src/components/feed/ShopHotspots.tsx` (86 l., 0 importeur), export `SMark` `src/components/chrome/Brandmark.tsx:49` (usage interne seul :89), classe `.stage` posée sur `FeedCard.tsx:146` + `MemberPostCard.tsx:155` mais définie dans aucun CSS, CSS morts `globals.css` : `.shimmer` (:376), `.marquee` (:395) + `@keyframes marquee` (:387), `@keyframes grain-shift` (:305), `.pt-safe` (:258).
- Correction prévue : supprimer les 2 fichiers, retirer l'export `SMark`, retirer le token `stage` des 2 className, purger les 5 blocs CSS (`.shimmer` : soit purger, soit le brancher comme skeleton — décision en Phase 2, l'app n'a aucun état de chargement visuel).
- Effort : S

### [MAJEUR] `ProductTile` (membre) réécrit à la main ≈ `ProductCard`

- Écran : profil public `/membre/[handle]`.
- Description : la tuile produit du profil public duplique `ProductCard` bloc par bloc — overlay Vendu identique, bloc meta identique (`overline text-[9px]` / `text-[15px] font-bold`), CTA « Contacter » aux classes identiques. Seuls diffèrent l'entrée d'animation et `Photo` vs `LuxeMedia`. Toute évolution de la carte produit oublie ce clone.
- Preuve : `src/app/membre/[handle]/page.tsx:143-209` vs `src/components/ui/ProductCard.tsx:123-147,177-184`.
- Correction prévue : migrer `membre/[handle]/page.tsx` sur `ProductCard` (prop existante `member`, plus une option `media: "photo" | "luxe"` et un `index` pour le stagger) ; supprimer `ProductTile`. Seul fichier à migrer : `membre/[handle]/page.tsx`.
- Effort : S

### [MAJEUR] Wrapper de label de champ copié-collé ×4

- Écran : Créer, Vendre, Checkout, filtres Découvrir.
- Description : la fonction `Label` de creer et vendre est un copié-collé caractère pour caractère (vérifié par diff : `overline mb-2 block text-[9px] text-ash`) ; CheckoutView a sa variante `Field` (`mb-1.5`), FilterDrawer ses legends (`mb-2.5`). Quatre sources pour un seul rôle, trois marges différentes.
- Preuve : `src/app/creer/page.tsx:25-29` ≡ `src/app/vendre/page.tsx:19-23` ; `src/app/checkout/[id]/CheckoutView.tsx:529-544` ; `src/components/ui/FilterDrawer.tsx:115,143,173,191`.
- Correction prévue : primitive `src/components/ui/FieldLabel.tsx` (avec `htmlFor` — corrige au passage l'association label/input manquante notée en a11y). À migrer, tous : `creer/page.tsx`, `vendre/page.tsx`, `CheckoutView.tsx`, `FilterDrawer.tsx`.
- Effort : S

### [MAJEUR] Primitive `<Button>` absente : 22 CTA primaires recomposés, 3 radius, 6+ paddings, 5 boutons « Suivre »

- Écran : toute l'app.
- Description : `grep "function Button"` → 0. Chaque écran recompose son CTA `bg-bone text-ink` : `rounded-none` explicite, `rounded-full`, ou aucun radius, avec 10 combos de padding relevés et `min-h-11` (touch target) appliqué à certains seulement. Le bouton « Suivre » seul existe en 5 implémentations divergentes.
- Preuve : inventaire §5.2 (tableaux boutons, vérifiés par sondage) — primaires : `not-found.tsx:24`, `error.tsx:35`, `membre/[handle]/page.tsx:314,338`, `vendre/page.tsx:330`, `ArticleDetail.tsx:183`, `profil/page.tsx:86,284,341`, `DropsView.tsx:197`, `StreamsView.tsx:288`, `FilterDrawer.tsx:236`, `ShopTheLook.tsx:162`, `PlanCards.tsx:~68`, `ShopCard.tsx:174,182` ; Suivre : `CreatorHeader.tsx:68-70`, `FeedCard.tsx:312-315`, `favoris/page.tsx:34-38`, `membre:403-407`, `decouvrir:347-351`.
- Correction prévue : `src/components/ui/Button.tsx` — variants `primary/outline/ghost` × `sm/md`, radius tranché UNE fois selon la DA brutaliste existante (les tokens `--radius-*: 0` de `globals.css:30-38` disent carré ; `rounded-full` réservé au feed sombre si on l'assume comme règle de zone), `min-h-11` par défaut. Migration écran par écran, pas de big-bang.
- Effort : L

### [MAJEUR] Tokens motion recopiés en dur : 27 courbes ease + 48 durées magiques

- Écran : toute l'app (65 `transition={{ }}` Motion).
- Description : `globals.css:26-28` définit `--ease-silk/--ease-spring/--ease-luxe`, mais le JS recopie les mêmes cubic-bezier en littéral : `[0.16,1,0.3,1]` ×24 (9 fichiers), `[0.34,1.56,0.64,1]` ×2, `[0.22,1,0.36,1]` ×1. Les durées sont 15 valeurs magiques éparses (0.18→22 s) sans échelle : 0.6×11, 0.5×8, 0.4×5, 0.7×4, 0.55×3, 0.45×3…
- Preuve : greps ce jour ; fichiers ease-luxe en dur : `JournalView.tsx`, `DropsView.tsx`, `CommunityView.tsx`, `ArticleDetail.tsx`, `PageHeader.tsx`, `ProductCard.tsx`, `FeedCard.tsx`, `MemberPostCard.tsx`, `AuthScreen.tsx`.
- Correction prévue : module `src/lib/motion.ts` exportant `EASE = { silk, spring, luxe }` (mêmes valeurs que les vars CSS, source commentée croisée) et une échelle `DUR = { fast: 0.18, base: 0.45, slow: 0.6, hero: 0.7 }` ; sweep mécanique des 65 transitions vers ces constantes.
- Effort : M

### [MAJEUR] `window.prompt` natif ×3 pour le signalement

- Écran : Messages, profil membre, feed (post membre).
- Description : le motif de signalement ouvre la boîte de dialogue navigateur brute — rupture totale de la DA quiet-luxury, non stylable, comportement dégradé en PWA/standalone.
- Preuve : `src/app/messages/page.tsx:240`, `src/app/membre/[handle]/page.tsx:284`, `src/components/feed/MemberPostCard.tsx:131`.
- Correction prévue : mini sheet « Signaler » (textarea + envoyer) bâtie sur la primitive `Sheet` du bloquant n°2 ; un seul composant `ReportSheet` consommé par les 3 écrans.
- Effort : M

### [MAJEUR] Fetchs sans erreur affichée : envoi de message fire-and-forget, profil silencieux

- Écran : Messages, Profil.
- Description : l'envoi d'un message est `void api.sendMessage({...})` — l'optimistic local reste seul maître, aucun échec n'est montré ni annulé : un message peut être « envoyé » à l'écran et perdu côté serveur. Sur Profil, `loadMine` fait `if (p.ok)` sans else (échec = sections vides sans explication, aucun indicateur de chargement) et `toggleDm` échoue en silence (le switch ne bouge pas, sans feedback).
- Preuve : `src/app/messages/page.tsx:277-283` (commentaire assumant le fire-and-forget), `src/app/profil/page.tsx:162-182` (`:168-170` sans else), `:154-160` (toggleDm).
- Correction prévue : messages — `.then` sur `sendMessage`, en échec marquer la bulle « non envoyé · réessayer » (pattern discret, pas de toast intrusif) ; profil — état `loading/error` sur `loadMine` avec « Réessayer » (répliquer la machine d'états de `notifications/page.tsx:98-111`, déjà exemplaire).
- Effort : M

### [MAJEUR] `mock.ts` : 1 352 lignes monolithiques

- Écran : aucun (données), mais importé partout.
- Description : 20+ exports de 11 domaines distincts (looks, catalog, drops, notifs, conversations, plans, comments, invite, streams, communities, articles) dans un seul fichier — 2,7× la limite de 500 l., toute navigation dedans est coûteuse.
- Preuve : `src/lib/mock.ts` (wc -l = 1352 ; outline des exports vérifié : types+data par domaine, frontières nettes aux lignes 107, 404, 465, 523, 615, 717, 772, 973, 1015, 1120, 1280).
- Correction prévue : sans big-bang — dossier `src/lib/mock/` (`looks.ts`, `catalog.ts`, `drops.ts`, `notifications.ts`, `messages.ts`, `plans.ts`, `comments.ts`, `invite.ts`, `streams.ts`, `communities.ts`, `articles.ts`) + `src/lib/mock.ts` réduit à un barrel `export * from "./mock/…"` : zéro import à changer dans l'app, découpe purement mécanique.
- Effort : M

### [MAJEUR] `messages/page.tsx` : 529 lignes + cascade de sélection à 6 `useEffect`

- Écran : Messages.
- Description : tout l'écran (liste, fil, composer, menu, toast, offre auto) vit dans `MessagesInner`, avec la cascade la plus dense de l'app : 6 effets dont 2 corrigent `selId` après coup via `queueMicrotask(() => setSelId(...))` (préférence fil DM serveur, retour liste si bloqué) + un `seededRef` qui sème l'offre à l'arrivée des données serveur. C'est documenté par commentaires — donc connu comme fragile.
- Preuve : `src/app/messages/page.tsx:117` (529 l.), effets :130-142, :180-186, :188-198, :208-210, :225-230 ; `queueMicrotask` :185, :209.
- Correction prévue : sans big-bang, 3 extractions à interface inchangée — `ConversationList`, `ThreadView`, `useThreadSelection` (hook regroupant selId/seed/blocage en un reducer : la sélection devient dérivée d'un seul état, les 2 `queueMicrotask` disparaissent). Le fichier page garde l'orchestration.
- Effort : L

### [MAJEUR] `StreamsView` : 532 lignes, 11 sous-composants dont 3 icônes hors `icons.tsx`

- Écran : Live.
- Description : 11 composants privés empilés dans un fichier, dont `Eye`, `SoundIcon`, `LiveBadge` qui redéfinissent des glyphes alors que `icons.tsx` est le set canonique (35 icônes, stroke 1.6) — risque de dérive de style d'icônes déjà réel.
- Preuve : `src/app/live/StreamsView.tsx:65,83,106` (icônes), :23-330 (outline vérifié : StreamVideo, Eye, SoundIcon, LiveBadge, LiveTile, RemindToggle, UpcomingRow, ChatRow, ShoppableRail, Composer, Viewer).
- Correction prévue : déplacer les 3 icônes vers `src/components/chrome/icons.tsx` (S, immédiat) ; puis extraire `Viewer` (le plus gros, plein écran) et `LiveTile` vers `src/app/live/` en fichiers frères — le reste peut rester, sous 500 l. atteint sans big-bang.
- Effort : M

### [MAJEUR] Double échelle z-index sans carte de calques

- Écran : chrome global (curseur, auth, viewer live, compose, sheets).
- Description : 6 z arbitraires (`z-[100]`×3, `z-[70]`, `z-[60]`, `z-[15]`) cohabitent avec l'échelle standard (z-10…z-50, 46 usages) sans aucune source de vérité — l'empilement curseur/grain/auth/sheet/tab bar n'est correct que par accident, et chaque nouvelle surface devine son z.
- Preuve : `AuthScreen.tsx:74`, `CustomCursor.tsx:72`, `AuthGate.tsx:46` (z-[100]) ; `StreamsView.tsx:387` (70) ; `MobileTabBar.tsx:81` (60) ; `ShopHotspots.tsx:31` (15, mort) ; grep ce jour.
- Correction prévue : tokens de calques dans `@theme` (`--z-nav: 50`, `--z-sheet: 60`, `--z-viewer: 70`, `--z-grain: 90`, `--z-overlay: 100`) + commentaire-carte dans `globals.css` ; sweep des 6 arbitraires.
- Effort : S

### [MAJEUR] Champs de formulaire : 4 mécaniques concurrentes autour de `.field`

- Écran : Créer/Vendre (GlassInput), Checkout/Filtres/Auth (`.field` brut), Messages/Live/Commentaires (pill glass ad hoc), Découvrir/Messages (bg-transparent dans conteneur glass).
- Description : `GlassInput` n'a que 2 importeurs ; le reste court-circuite le composant ou réinvente le champ. Incohérence interne assumée nulle part : `.field` est `border-radius: 0` « brutalist » mais `AuthScreen` le surcharge en `rounded-full`, et les composeurs pill l'ignorent entièrement.
- Preuve : `src/components/ui/GlassInput.tsx` (importeurs : creer, vendre seulement) ; `.field` brut : `CheckoutView.tsx:394,409,418,429`, `FilterDrawer.tsx:155,166`, `AuthScreen.tsx:198` (surcharge `rounded-full`) ; pills : `messages/page.tsx:488`, `StreamsView.tsx:309`, `CommentSheet.tsx:101` ; `globals.css:221`.
- Correction prévue : trancher la règle (champ carré = pages commerce, pill = surfaces conversationnelles sombres — c'est la pratique de fait, l'écrire) ; étendre `GlassInput` d'un variant `pill` et migrer les 7 usages bruts + 3 pills dessus. AuthScreen adopte le variant au lieu de surcharger.
- Effort : M

---

### [MINEUR] Toast : 2 implémentations complètes + 2 swaps de label

- Écran : feed (post membre), Messages, Profil, Shop the look.
- Description : deux toasts complets avec timer/cleanup propres (styles et positions différents, 2600 vs 3000 ms) + deux feedbacks par swap de label. Quatre durées de feedback distinctes (1800/2600/3000/persistant).
- Preuve : `MemberPostCard.tsx:111-127,384-400`, `messages/page.tsx:221-235,508-518`, `profil/page.tsx:51,88-95`, `ShopTheLook.tsx:41-45`.
- Correction prévue : hook + composant `useToast`/`Toast` uniques (style `bg-coal ring-bone/15`, position au-dessus de `--tabbar-clearance`, durée token unique) ; les swaps de label inline peuvent rester (pattern discret légitime).
- Effort : M

### [MINEUR] Couleurs inline : recette « key light » dupliquée ×4, 4 hex KenBurns, stroke `#060607` d'icône

- Écran : feed (KenBurns), profil, créer, tuiles LuxeMedia, badge Verified.
- Description : 18 rgba + 4 hex littéraux en tsx. La recette radial-gradient « key light » de `LuxeMedia` est recopiée en inline dans 3 autres fichiers ; `KenBurnsMedia` embarque un dégradé 4 hex en dur ; l'icône `Verified` fixe `stroke="#060607"` qui ne suit pas le thème.
- Preuve : `LuxeMedia.tsx:49,61`, `profil/page.tsx:540`, `creer/page.tsx:460`, `KenBurnsMedia.tsx:101,108-146`, `icons.tsx:86`.
- Correction prévue : exporter la recette key-light depuis `LuxeMedia` (fonction `keyLight(x,y,a)`) et l'importer aux 3 endroits ; hex KenBurns → vars `--c-*` ou constantes nommées ; `stroke="var(--c-ink)"` sur Verified.
- Effort : S

### [MINEUR] Safe-area : 3 formules concurrentes alors que les tokens existent

- Écran : Messages (toast), commentaires, feed (toast post membre).
- Description : trois calculs `env(safe-area-inset-bottom)` inline différents coexistent avec `--tabbar-clearance` (`globals.css:63`) et `.pb-safe` — même famille de bug que le checkout sous la tab bar relevé en Phase 0.
- Preuve : `messages/page.tsx:487,512`, `CommentSheet.tsx:95`, `MemberPostCard.tsx:391` ; symptôme visuel : `audit/captures/phase0/checkout-375.png`, `decouvrir-375.png`.
- Correction prévue : normaliser sur `--tabbar-clearance` (+ offset local si besoin) ; interdiction de recalculer `env()` en inline hors tokens.
- Effort : S

### [MINEUR] Fichiers pages massifs restants — plan de découpe léger

- Écran : Profil (682 l.), Créer (625), Membre (551), Checkout (544), Vendre (525), Découvrir (436).
- Description : cinq pages au-dessus de la limite de 500 l., chacune avec des composants inline extractibles sans rien changer d'autre.
- Preuve : wc -l ce jour ; inline : `profil/page.tsx:31,44` (Stat, ReferralCard), `CheckoutView.tsx:514,529` (Row, Field), `membre/[handle]/page.tsx:143,211` (ProductTile→ProductCard cf. MAJEUR, PostThumb).
- Correction prévue : extractions mécaniques par fichiers frères (`profil/ReferralCard.tsx`, `checkout/[id]/Row.tsx`…) au fil des retouches Phase 2 — jamais en lot, chaque extraction dans le commit qui touche l'écran.
- Effort : M (étalé)

### [MINEUR] Props booléennes là où un variant serait plus honnête

- Écran : tuiles produit, médias luxe, marque.
- Description : `LuxeMedia small?: boolean` (taille), `ProductCard member?: boolean` (deux natures de carte), `Brandmark wordmark?: boolean` — trois booléens qui encodent des variants ; le reste des booléens du code (`pressed`, `active`, `filled`, `eager`, `muted`) est légitimement binaire. `ShopTheLook` montre déjà le bon pattern (`variant?: "trigger" | "drawer" | "both"`).
- Preuve : `LuxeMedia.tsx:34`, `ProductCard.tsx:22`, `Brandmark.tsx:79` ; contre-modèle sain `ShopTheLook.tsx:27`.
- Correction prévue : à convertir opportunistement quand ces composants sont touchés (`size: "sm" | "md"`, `kind: "catalog" | "member"`) — pas de refactor dédié.
- Effort : S

### [MINEUR] Durées Tailwind hétérogènes + 64 `style={{ }}` inline

- Écran : transversal.
- Description : `duration-300`×8, `duration-700`×4, `duration-500`×1 sans logique d'attribution, en plus des durées Motion (cf. MAJEUR motion) ; 64 styles inline dont une partie est légitime (gradients calculés) mais sans frontière écrite.
- Preuve : greps ce jour ; recoupe l'inventaire §5.3 (64 `style={{…}}`).
- Correction prévue : aligner les `duration-*` CSS sur l'échelle `DUR` du module motion (mêmes crans) ; règle d'équipe : `style` inline réservé aux valeurs calculées à l'exécution.
- Effort : S

### [MINEUR] Toggles sociaux optimistes sans rollback

- Écran : likes/saves/follows/join/block partout.
- Description : `sync()` fait `void api.social(...)` — un like peut rester affiché alors que le serveur l'a refusé. Documenté comme assumé, et l'enjeu est faible (état re-synchronisé à la session suivante), mais aucun `.catch` même silencieux-loggé.
- Preuve : `src/lib/store.tsx:179-187`.
- Correction prévue : `.then(res => { if (!res.ok) /* revert silencieux du Set */ })` — 5 lignes dans `sync`, aucun changement d'UX nominal.
- Effort : S

### [MINEUR] Micro-doublons de markup restants

- Écran : commentaires/live/messages (composer pill ×3), découvrir/messages (search glass ×2, dimensions divergentes), tab bar/communauté (dot « ping » ×2), sheets (bouton fermer ×4, un seul avec hover).
- Description : quatre patterns courts recopiés à l'identique ou presque — faible coût unitaire, mais c'est le tissu qui fait « généré » à la lecture.
- Preuve : composer — `CommentSheet.tsx:101`, `StreamsView.tsx:309`, `messages/page.tsx:488` ; search — `decouvrir/page.tsx:143-150` vs `messages/page.tsx:300-305` ; ping — `MobileTabBar.tsx:164-167` vs `CommunityView.tsx:64-66` ; fermer — `ShopTheLook.tsx:103`, `CommentSheet.tsx:54`, `FilterDrawer.tsx:102`, `MobileTabBar.tsx:110`.
- Correction prévue : composer et fermer sont absorbés par les primitives `Sheet`/`GlassInput` des findings ci-dessus ; `SearchField` et `LiveDot` = deux petits composants à créer au premier écran retouché.
- Effort : S

---

## RAS vérifiés (le code évite déjà ce slop)

- **`console.log` dans `src/`** : 0. Le seul `console.debug` (`src/lib/track.ts:10`) est un seam analytique volontaire, gaté `NODE_ENV !== "production"` — sain. Dans `netlify/functions` : 4 `console.error` (`auth-send-code.mts:64`, `_shared/core.mts:128,130,179`) = logging serveur légitime, à conserver.
- **`TODO`/`FIXME`/`HACK`** : 0 dans `src/` et `netlify/`.
- **`: any` / `as any`** : 0 (l'unique match grep est la variable `anyLive`, `SideNav.tsx:16`). TypeScript strict tenu.
- **Imports inutilisés** : ESLint (next/core-web-vitals + next/typescript) passe sans une seule erreur ni warning sur `src/` — vérifié par run ce jour.
- **`eslint-disable`** : uniquement `@next/next/no-img-element` (11 occ.), cohérent avec le choix documenté `Photo.tsx` — aucune règle de qualité muselée.
- **Cascades `useEffect` hors Messages** : RAS — `VideoFeed`, `KenBurnsMedia`, `MemberPostCard`, `SideNav` ont des effets à responsabilité unique avec cleanup systématique (`alive`/`cancelled` flags, `io.disconnect`). La seule vraie cascade est celle de `messages/page.tsx` (traitée en MAJEUR).
- **Fetch du feed** : la dégradation silencieuse de `VideoFeed.tsx:19-34` est documentée et défendable (le fil reste complet avec les looks) — assumée, pas du slop.
