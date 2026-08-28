# AUDIT.md — Audit complet pré-déploiement SOLANGE

> Réalisé le 2026-08-28 sur le commit `9199bc9` (main). Méthode : Phase 0 cartographie ·
> Phase 1 : 7 auditeurs par domaine, lecture seule, preuve `fichier:ligne` obligatoire ·
> Phase 2 : contre-vérification adversariale de chaque constat CRITIQUE/ÉLEVÉ (verdicts :
> confirmé / déclassé / rejeté — **0 constat rejeté**, tout ce qui suit est étayé par le code) ·
> Phase 3 : synthèse. Audit en lecture seule ; aucun correctif appliqué.

---

## 1. Verdict — Go / No-Go

**La question se dédouble, car SOLANGE est aujourd'hui un prototype frontend pur : 0 route API, 0 base de données, 0 vrai paiement, 0 vraie authentification — rien de ce que l'écran montre n'est réellement exécuté côté serveur.**

| Lecture | Verdict | Risque global |
|---|---|---|
| **Lancer comme vraie marketplace** (argent réel) | **NO-GO absolu.** Il n'y a rien à sécuriser côté serveur parce qu'il n'y a pas de serveur : comptes, paiements, annonces, messagerie, modération — tout le socle est à construire. Ce n'est pas une liste de bugs, c'est un chantier produit. | N/A (structurel) |
| **Publier comme démo publique** (aucun argent ne transite) | **NO-GO en l'état — GO conditionnel** après le lot de corrections « avant mise en ligne » (§7.a, ~1-2 jours) : mentions légales, neutralisation du champ carte, étiquetage honnête des promesses fictives, correction des bugs de parcours confirmés. | Moyen, entièrement réductible |

---

## 2. Résumé exécutif

1. **SOLANGE est une maquette, pas une application.** Aucun serveur, aucune base, aucun flux réseau : les données sont compilées dans le JavaScript livré au navigateur, l'« achat » est un `setTimeout` de 1,4 s, le « code de connexion » s'affiche à l'écran.
2. **Le risque n°1 d'une publication en l'état n'est pas technique, il est de sincérité** : la démo affiche « Vendeur vérifié » pour 100 % des vendeurs, facture une « Protection acheteur » 5 % fictive, promet « retour 14 jours » et « paiement chiffré via Stripe » — des allégations commerciales indexables par Google (JSON-LD), sans aucune réalité derrière, et sans aucune mention légale sur le site (obligation LCEN dès publication).
3. **Un vrai danger utilisateur existe : le faux formulaire carte** utilise `autoComplete="cc-number"` — le navigateur d'un visiteur propose de pré-remplir sa **vraie** carte bancaire dans un simulateur. Correctif : 15 minutes.
4. **Trois bugs de parcours confirmés par contre-vérification** : « Faire une offre » ouvre une conversation avec le **mauvais vendeur** pour 12 articles sur 17 ; « publier une annonce » et « créer un post » affichent un succès alors que rien n'est créé nulle part.
5. **Le socle d'hygiène est sain** : zéro secret dans le code et dans les 21 commits d'historique, zéro cookie/traceur (pas de bandeau requis), CSP en place, TypeScript strict, lint/build/tests verts. 7 vulnérabilités npm (Next 16.2.9 → fix disponible en 16.3.3).
6. **Décision recommandée** : corriger le lot §7.a puis publier la démo assumée comme démo ; planifier le vrai lancement comme un projet backend de plusieurs mois (§7.c), pas comme une suite de patchs.

---

## 3. Bloquants de publication (démo publique)

Les problèmes suivants interdisent la mise en ligne **même comme démo**. (Pour la lecture « vraie marketplace », le bloquant est structurel — voir §5 Gap analysis : auth, paiements, T&S, RGPD sont à construire, pas à corriger.)

**Bloquant 1/8**

### [MOYEN] Champ carte en saisie libre + autoComplete cc-* : le navigateur propose la VRAIE carte de l'utilisateur dans un simulateur
- **Emplacement** : src/app/checkout/[id]/CheckoutView.tsx:245-286
- **Constat** : Le champ « Numéro de carte » accepte toute saisie (16 chiffres formatés 4 par 4) et porte autoComplete="cc-number" (idem cc-exp, cc-csc, cc-name), ce qui déclenche l'autofill des cartes réelles enregistrées dans le navigateur. Un utilisateur réel d'une démo publique peut donc taper ou autofiller son vrai PAN + CVC dans un faux checkout. Mitigants vérifiés : la valeur n'est ni loggée, ni persistée, ni transmise (aucun fetch dans le composant, aucun console.log, localStorage limité au flag onboarding — grep vide ; le store ne garde que last4, CheckoutView.tsx:51 et store.tsx:34). Le PAN complet ne vit qu'en state React en mémoire. Lecture (a) démo publique : c'est LE point bloquant du checkout. Lecture (b) : le formulaire serait de toute façon remplacé par Stripe Elements.
- **Impact** : Exposition d'un vrai numéro de carte + CVC dans une interface non prévue pour (mémoire du navigateur, épaule-surfing, extensions navigateur, React DevTools). Perte de confiance majeure si un testeur s'en rend compte.
- **Preuve** :
  ```
  // CheckoutView.tsx:247-251
  <input
    inputMode="numeric"
    autoComplete="cc-number"
    value={card}
    onChange={(e) => setCard(formatCard(e.target.value))}
  // :39 — const [card, setCard] = useState("4242 4242 4242 4242");
  ```
- **Correctif** : Retirer les attributs autoComplete cc-* (mettre autoComplete="off"), passer les champs en readOnly (la carte test préremplie suffit à la démo) ou n'accepter que les cartes test connues (4242…), et refuser toute autre saisie avec un message « mode test — carte fictive uniquement ».
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Factuel : les 4 attributs autoComplete cc-* existent bien (CheckoutView.tsx:249, 266, 277, 291) et la saisie est libre. Mais la sévérité ÉLEVÉ est exagérée pour trois raisons vérifiées : (1) aucun chemin d'exfiltration — grep confirme zéro fetch, zéro console.log, zéro localStorage/sessionStorage dans src/app/checkout/ et store.tsx ; le PAN ne vit qu'en state React et seul last4 atteint le store en mémoire (CheckoutView.tsx:51,68 ; Order.last4 store.tsx:34) ; (2) les champs sont préremplis avec la carte de test Stripe 4242 (ligne 39-42) — les navigateurs ne proposent l'autofill carte que sur champ vide, l'utilisateur devrait d'abord effacer volontairement la valeur, ce qui affaiblit le scénario « autofill déclenché » ; (3) un bandeau Test explicite « Simulation Stripe Connect — aucun paiement réel n'est effectué » est rendu juste au-dessus du formulaire (lignes 163-172), omis par l'auditeur. Le risque résiduel (habituation, vrai PAN saisi dans une démo publique qui n'en fait rien) est réel mais non-bloquant et corrigeable en une ligne (autoComplete="off" ou champs readOnly). Selon la grille de sévérité, ÉLEVÉ = fonctionnalité cassée ; ici rien n'est cassé ni transmis : suboptimal mais fonctionnel = MOYEN.

**Bloquant 2/8**

### [MOYEN] Aucune mention légale sur l'ensemble du site (obligation LCEN dès publication)
- **Emplacement** : /Users/fouzi/solange/src/app/ (aucune route légale) ; aucun footer légal dans src/
- **Constat** : Aucune page mentions légales, CGU, CGV ni politique de confidentialité n'existe : grep insensible à la casse sur 'mentions légales|cgu|cgv|confidentialité|privacy|legal|rgpd' dans tout src/ retourne zéro fichier, et le listing de src/app/ ne contient que article, checkout, communaute, creer, decouvrir, drops, favoris, journal, live, messages, notifications, premium, profil, vendre. Aucun email de contact non plus (grep 'contact@|support@|mailto' : zéro). Or la LCEN (art. 6-III) impose d'identifier l'éditeur (ou au minimum l'hébergeur pour un éditeur non professionnel) sur tout site publié, même une démo sans transaction. Lecture (a) démo publique : c'est LE point qui bloque la mise en ligne — publier solange.app ainsi est directement non conforme. Lecture (b) vrai lancement : s'y ajoutent CGU/CGV obligatoires. Alerte technique, pas un avis juridique.
- **Impact** : Publication d'un service en ligne sous marque SOLANGE sans identification de l'éditeur ni de l'hébergeur : infraction LCEN (sanctions pénales pour un éditeur professionnel), et impossibilité pour un utilisateur d'exercer un recours ou un droit RGPD faute d'interlocuteur identifié.
- **Preuve** :
  ```
  $ ls src/app/
  apple-icon.tsx article checkout communaute creer decouvrir drops error.tsx favoris globals.css icon.tsx journal layout.tsx live manifest.ts messages not-found.tsx notifications opengraph-image.tsx page.tsx premium profil robots.ts sitemap.ts template.tsx twitter-image.tsx vendre
  $ grep -rniE "mentions légales|cgu|cgv|confidentialité|privacy|legal|rgpd" src/ -l
  (aucun résultat — exit 1)
  ```
- **Correctif** : Avant toute mise en ligne publique : créer une route /mentions-legales (éditeur, directeur de publication, hébergeur, contact) liée depuis un footer global, plus une page /confidentialite même minimale ('aucune donnée collectée, aucun cookie tiers' — ce qui est vrai pour ce build). Faire valider le contenu par un avocat avant un vrai lancement.
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Les faits sont exacts et revérifiés : aucune route légale dans src/app/ (listing identique à celui de l'auditeur), grep insensible à la casse sur 'mentions légales|cgu|cgv|confidentialité|privacy|legal|rgpd' dans src/ → zéro fichier (exit 1), grep 'contact@|support@|mailto' → zéro, et find sur *footer*/*legal*/*mention* → rien. Mais la sévérité repose sur le déclencheur LCEN 'dès publication', et le site n'est publié nulle part : aucun .vercel/, aucun netlify.toml, aucune mention de déploiement dans README/CLAUDE.md, et surtout solange.app répond avec 'server: Parking/1.0' (domaine parqué, HTTP 405) — le prototype ne tourne qu'en local. L'obligation LCEN n'est donc pas encore engagée ; c'est le premier item du checklist de mise en ligne (trivial à corriger : une page + un footer), pas une non-conformité actuelle. ÉLEVÉ (= bloquant maintenant) est exagéré pour un repo local.

**Bloquant 3/8**

### [MOYEN] Fausses promesses commerciales publiquement indexables (offres JSON-LD, 'retour 14 jours', 'protection acheteur')
- **Emplacement** : /Users/fouzi/solange/src/app/premium/page.tsx:18-30,50 ; src/app/article/[id]/ArticleDetail.tsx:178-181 ; src/app/robots.ts:5-8 ; src/app/sitemap.ts:11
- **Constat** : La page /premium émet un JSON-LD schema.org Product/Offer avec prix en EUR et availability 'InStock' pour des abonnements fictifs (le bouton CTA de PlanCards.tsx:63-74 n'a aucun onClick), et affiche 'Sans engagement · résiliable à tout moment · paiement sécurisé.'. La page article promet 'Paiement sécurisé, retour sous 14 jours' (engagement de rétractation consommateur) sans CGV et sans aucun disclaimer de démo sur ces pages (seul le checkout a un bandeau Test). robots.ts autorise tout crawl et sitemap.ts référence /premium : ces offres fantômes seront indexées comme réelles. Lecture (a) démo : risque de confusion + indexation d'offres inexistantes (optique pratique commerciale trompeuse, art. L.121-2 c. conso, même sans encaissement). Lecture (b) lancement : vendre avec ces mentions sans CGV ni rétractation outillée rendrait le point bloquant.
- **Impact** : Un visiteur ou un moteur de recherche prend des offres payantes fictives pour de vraies offres commerciales de la marque SOLANGE ; engagement public ('retour sous 14 jours', 'protection acheteur') qu'aucun service ni contrat ne couvre.
- **Preuve** :
  ```
  // premium/page.tsx:24-29
      offers: {
        "@type": "Offer",
        price: schemaPrice(plan.price),
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
  // ArticleDetail.tsx:178-181
  <p className="mt-6 text-[13px] leading-relaxed text-ash">
    Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé,
    retour sous 14 jours. Commission dégressive reversée au vendeur.
  </p>
  ```
- **Correctif** : Tant que c'est une démo : passer robots.ts en disallow (ou metadata robots noindex), retirer le JSON-LD Offer de /premium, et afficher un bandeau 'Démo — aucune offre réelle' global (pas seulement au checkout). Au lancement : CGV réelles + parcours d'acceptation avant tout affichage de ces promesses.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Chaque citation est exacte au caractère près : premium/page.tsx:18-31 émet bien un JSON-LD Product/Offer EUR 'InStock' pour les 3 plans, la ligne 50 affiche 'Sans engagement · résiliable à tout moment · paiement sécurisé.', le bouton CTA de PlanCards.tsx (l.63-74) n'a aucun onClick, ArticleDetail.tsx:178-181 promet 'Paiement sécurisé, retour sous 14 jours', robots.ts autorise tout ('userAgent: *, allow: /') et sitemap.ts:11 liste '/premium'. Mais la conséquence centrale ('ces offres fantômes seront indexées comme réelles') est hypothétique : rien n'est déployé, solange.app est un domaine parqué tiers, donc risque d'indexation et de confusion consommateur aujourd'hui = zéro. L'angle L.121-2 c. conso suppose une pratique commerciale effective envers des consommateurs ; ici aucune offre ne peut être acceptée (CTA mort, checkout explicitement simulé). Reste un vrai défaut de contenu pré-publication : dès qu'une URL publique existera, ces pages sans disclaimer démo diffuseront des engagements fictifs (rétractation 14 j sans CGV, abonnements inexistants en données structurées). À corriger avant toute mise en ligne (disclaimer/noindex/retrait du JSON-LD), mais pas ÉLEVÉ sur un artefact local.

**Bloquant 4/8**

### [MOYEN] Promesses de confiance fictives : « authentifiée », « retour 14 jours », et « Protection acheteur » facturée sans service derrière
- **Emplacement** : src/app/article/[id]/ArticleDetail.tsx:178-181 ; src/app/checkout/[id]/CheckoutView.tsx:207,332 ; src/components/feed/ShopTheLook.tsx:174 ; src/components/feed/ShopCard.tsx:136 ; src/app/article/[id]/layout.tsx:6
- **Constat** : L'UI affirme partout des garanties qui n'existent nulle part dans le code : « Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé, retour sous 14 jours » (ArticleDetail), « Protection acheteur incluse · livraison 48h » (ShopTheLook, ShopCard), et le checkout facture une ligne « Protection acheteur » (montant ajouté au total). Grep exhaustif : aucun flux d'authentification produit, aucun processus de retour, aucune page décrivant la protection, aucune CGU (grep CGU|conditions|terms|mentions légales → 0 résultat). La seule « authentification communautaire » est un thread éditorial mock (mock.ts:1175-1177, guide anti-contrefaçon Margiela). La meta description SEO (article/[id]/layout.tsx:6) répète « authentifiée... vendeur vérifié ». Lecture (a) démo : copy marketing tolérable si le site est clairement étiqueté prototype. Lecture (b) lancement réel : facturer une protection inexistante et promettre un retour 14 jours sans processus = pratique commerciale trompeuse (DGCCRF) et perte d'argent directe pour l'acheteur — bloquant dans cette lecture.
- **Impact** : Acheteur : paie un supplément « Protection acheteur » qui ne couvre rien, croit à un droit de retour qui n'existe pas, achète des pièces « authentifiées » que personne n'a examinées. Plateforme : exposition juridique (pratiques trompeuses, art. L121-2 C. conso) dès le premier litige.
- **Preuve** :
  ```
  ArticleDetail.tsx:178-181 :
  <p className="mt-6 text-[13px] leading-relaxed text-ash">
    Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé,
    retour sous 14 jours. Commission dégressive reversée au vendeur.
  </p>
  CheckoutView.tsx:207 : <Row label="Protection acheteur">{euro(protection)}</Row> (montant intégré au total, ligne 210-215).
  ```
- **Correctif** : Pour la démo : préfixer ces claims d'un marqueur prototype ou les retirer. Avant tout lancement : ne facturer la protection acheteur qu'adossée à un vrai service (séquestre/escrow, politique de litige écrite), publier CGU + politique de retour, et supprimer « authentifiée » tant qu'aucun processus d'authentification n'existe.
- **Effort** : M
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Tous les emplacements cités sont exacts : ArticleDetail.tsx:178-181 (« Pièce authentifiée par la communauté SOLANGE... retour sous 14 jours »), CheckoutView.tsx:207 (`<Row label="Protection acheteur">{euro(protection)}</Row>`, protection = 5% + 0,70 € intégrée au total ligne 47-48), CheckoutView.tsx:331-333 (« protection acheteur incluse »), ShopTheLook.tsx:174, ShopCard.tsx:135-136, layout.tsx:6 (meta SEO). Grep confirmé : zéro CGU/terms/mentions légales, zéro processus de retour (tous les hits « Retour » sont des boutons de navigation arrière), zéro flux d'authentification produit — la seule trace est le thread éditorial mock (mock.ts:1176-1178, guide Margiela). MAIS la lecture (b) qui fonde l'ÉLEVÉ (« facturer une protection inexistante... perte d'argent directe ») est contredite par le code lui-même : pay() est un setTimeout de 1700 ms, carte préremplie 4242 4242 4242 4242, aucun appel réseau, aucun euro ne quitte personne (CheckoutView.tsx:38-72). En l'état prototype, c'est de la copy de fiction produit cohérente avec le paiement simulé — à purger ou étiqueter avant tout déploiement public (la meta SEO indexable est le point le plus gênant), mais pas de pratique commerciale trompeuse effective : MOYEN.

**Bloquant 5/8**

### [ÉLEVÉ] « Faire une offre » ouvre une conversation avec le MAUVAIS vendeur pour 12 articles sur 17
- **Emplacement** : src/app/messages/page.tsx:28-37 et 61-63
- **Constat** : `threadForItem` retombe sur `conversations[0]` (thread de maya.curates sur le manteau Margiela) quand ni l'itemSeed ni le vendeur n'ont de conversation mock. Or les conversations ne couvrent que 5 vendeurs/articles (mock.ts:619-694 : k2-k6) ; les 12 autres pièces — dont toutes celles de lou.archive et nouh.archive (mock.ts:405-421) — injectent le message d'offre pré-rédigé dans le thread d'une autre personne, sous un bandeau produit qui affiche un autre article. Vérifiable en un clic depuis la fiche k1 (veste Acne, vendeur lou.archive).
- **Impact** : L'utilisateur croit négocier la veste Acne avec son vendeur ; il « envoie » l'offre à maya.curates dans un thread sur un manteau Margiela. Incohérence flagrante en démo ; en réel, ce serait une fuite d'intention d'achat au mauvais destinataire.
- **Preuve** :
  ```
  src/app/messages/page.tsx:33-36 `conversations.find((c) => c.itemSeed === item.seed) ?? conversations.find((c) => c.handle === item.seller) ?? conversations[0]` puis :62 `item && targetConv ? { [targetConv.id]: [offerMessage(item)] } : {}`.
  ```
- **Correctif** : Supprimer le fallback `conversations[0]` : créer un thread neuf à la volée pour le vendeur de l'article (nom/handle/itemSeed corrects), même éphémère.
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **confirmé** — Le mécanisme est prouvé mot pour mot et le défaut est réel, mais le décompte de l'auditeur est faux : ce sont 7 articles sur 17, pas 12. Le fallback intermédiaire `conversations.find((c) => c.handle === item.seller)` — que l'auditeur cite lui-même puis oublie dans son comptage — route correctement 5 des 12 pièces sans thread dédié vers le BON vendeur (k7, k14 → samir.fits ; k9, k12 → maya.curates ; k10 → theo.grail), avec pour seul défaut un bandeau produit qui affiche un autre article. Le cas réellement « mauvaise personne » (chute sur conversations[0] = thread Margiela de maya.curates) concerne les 7 pièces dont le vendeur n'a aucune conversation : k1, k8, k15 (lou.archive) et k11, k13, k16, k17 (nouh.archive — qui est en plus le handle de l'utilisateur courant, me.handle mock.ts:586 : on injecte une offre sur ses propres pièces dans le thread de maya). La repro citée (k1, veste Acne, lou.archive → thread maya.curates) est exacte et k1 est la première pièce du catalogue, en tuile span. 7/17 = 41 % du catalogue qui envoie un message d'offre pré-rédigé à une personne sans rapport, sous un bandeau produit erroné : fonctionnalité cassée, ÉLEVÉ maintenu malgré le chiffre corrigé.

**Bloquant 6/8**

### [ÉLEVÉ] Parcours vendeur en impasse : l'annonce « publiée » n'existe nulle part et le succès ment
- **Emplacement** : src/app/vendre/page.tsx:279-293 et 160-163
- **Constat** : Le submit de /vendre ne fait que `setListed(true)` (état local) : rien n'est écrit dans le store ni dans le catalogue. L'écran de succès affirme pourtant que la pièce « est désormais visible dans Découvrir », ce qui est faux — /decouvrir lit uniquement le mock statique via filterCatalog (src/lib/data.ts:37-41). Lecture (a) démo : promesse cassée immédiatement vérifiable par un testeur (il va dans Découvrir, ne trouve rien). Lecture (b) lancement : fonctionnalité cœur inexistante, bloquant.
- **Impact** : Le parcours n°1 d'une marketplace C2C (vendre) se termine sur un mensonge vérifiable en 2 taps ; perte de confiance du testeur/investisseur, et à fortiori de tout vrai vendeur.
- **Preuve** :
  ```
  src/app/vendre/page.tsx:280 `onClick={() => ready && setListed(true)}` puis :162-163 `{title || "Ta pièce"} est désormais visible dans Découvrir.` — aucun appel à useStore(), aucun ajout au catalogue dans tout le fichier.
  ```
- **Correctif** : Ajouter un `addListing(item)` au store (comme addOrder) et le faire lire par filterCatalog/forSale, ou reformuler le succès en démo honnête (« Simulation — l'annonce n'est pas réellement publiée »), sur le modèle du bandeau Test du checkout.
- **Effort** : M
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **confirmé** — Le code prouve intégralement le constat. Le submit ne fait que poser un booléen local, aucun import de useStore() ni aucune écriture dans un état partagé dans tout le fichier (vérifié par lecture complète + grep 'useStore|store' sur vendre/page.tsx : zéro occurrence). /decouvrir lit exclusivement le mock statique via filterCatalog (data.ts:37-66 filtre le tableau `catalog` importé de mock.ts ; grep 'catalog.push|setCatalog' sur tout src : zéro mutation nulle part). La promesse « visible dans Découvrir » est donc fausse et falsifiable en un clic par n'importe quel testeur. La sévérité ÉLEVÉ tient même en lecture démo : le codebase a déjà sa propre convention pour les actions simulées (le checkout écrit dans le store partagé et le profil l'affiche), donc ce flux est en-dessous du standard que l'app s'est elle-même fixé, et le texte de succès affirme un état interne à l'app que l'app contredit.

**Bloquant 7/8**

### [ÉLEVÉ] /creer : même impasse — le post « parti dans le feed » n'apparaît jamais dans le feed
- **Emplacement** : src/app/creer/page.tsx:249-252 et 375-385
- **Constat** : Le CTA « Publier le look » ne fait que `setPublished(true)` local. Le succès annonce « {titre} est parti dans le feed « Pour toi » et chez tes abonnés », mais le feed (looks de src/lib/mock.ts) n'est jamais modifié. Le bouton « Dépose une vidéo ou des photos » (ligne 99) n'a ni onClick ni input file : zéro feedback au clic. Lecture (a) : promesse cassée vérifiable ; lecture (b) : bloquant.
- **Impact** : Le second parcours de création (contenu social) est une coquille : l'utilisateur retourne au feed et ne retrouve jamais son post ; le drop média mort casse la crédibilité dès le 1er clic.
- **Preuve** :
  ```
  src/app/creer/page.tsx:250-252 `{title.trim() || "Ton post"} est parti dans le feed « Pour toi » et chez tes abonnés.` ; :99 `<button className="flex aspect-[16/7]…">` sans onClick ni <input type="file">.
  ```
- **Correctif** : Injecter le post dans un tableau `userLooks` du store consommé par FeedModeShell, ou étiqueter honnêtement la simulation ; donner un comportement (même simulé) au drop média.
- **Effort** : M
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **confirmé** — Identique au constat 1, prouvé ligne par ligne. Le CTA ne fait que `setPublished(true)` local (ligne 376), aucun import de store dans le fichier, et le feed lit les `looks` statiques de mock.ts. Le texte de succès (lignes 250-252) affirme une diffusion dans le feed qui n'a jamais lieu. Le bouton médias ligne 99 est bien un <button> sans onClick, sans <input type="file">, sans aria-disabled : zéro feedback au clic (seul un hover CSS). Même la note sous le CTA (lignes 391-397) répète la promesse « part dans le feed ». Promesse fausse vérifiable en un clic → ÉLEVÉ justifié pour un flux cœur, y compris en lecture démo.

**Bloquant 8/8**

### [MOYEN] 7 vulnérabilités npm (6 high, 1 moderate) — Next 16.2.9 directe avec fix 16.3.3 disponible, le reste en chaîne dev/build
- **Emplacement** : package.json (next 16.2.9, @tailwindcss/postcss ^4, eslint ^9, vitest ^4.1.9) ; node_modules via npm ls
- **Constat** : npm audit relancé le 2026-08-28 : 7 vulns (0 critical, 6 high, 1 moderate). Détail avec chemins vérifiés par `npm ls` : (1) next 16.2.9 [DIRECTE, high, fix 16.3.3 non-major] — advisories GHSA-6gpp-xcg3-4w24 (bypass middleware : l'app n'a AUCUN middleware, vérifié `ls src/middleware.ts` inexistant), GHSA-m99w-x7hq-7vfj + GHSA-89xv-2m56-2m9x (DoS/SSRF Server Actions : 0 'use server' dans src/, vérifié par grep), GHSA-q8wf-6r8g-63ch (DoS image optimizer SVG : l'app n'utilise PAS next/image — 0 hit grep 'next/image', Photo.tsx rend un <img> brut avec eslint-disable no-img-element — mais l'endpoint /_next/image existerait quand même si déployé via `next start` car next.config.ts configure `images.formats` sans `unoptimized`), + cache confusion (moderate). (2) sharp 0.34.5 [transitive via next, high, GHSA-f88m-g3jw-g9cj libvips] — même chemin : seul l'optimiseur d'images l'exerce, jamais appelé par le code de l'app. (3) brace-expansion [via eslint/eslint-config-next, dev-only], js-yaml 4.2.0 [via eslint, dev-only], nanoid [via postcss, chaîne build], postcss 8.4.31/8.5.15 [via next + @tailwindcss/postcss + vitest, build-time : l'advisory XSS/file-read concerne du CSS attaquant-contrôlé, inapplicable ici]. Aucune vuln n'est exercée par le runtime de la démo statique ; en lecture (b) c'est le paquet next lui-même qu'il faut monter avant tout déploiement public.
- **Impact** : Lecture (a) démo : quasi nul (vulns dev/build + endpoints Next jamais exposés tant que rien n'est déployé). Lecture (b) déploiement `next start` : endpoint /_next/image vulnérable au DoS SVG + sharp/libvips vulnérable exposés même sans usage applicatif, cache confusion possible.
- **Preuve** :
  ```
  npm audit --json : `"metadata": { "moderate": 1, "high": 6, "critical": 0, "total": 7 }` ; `"name": "next" ... "fixAvailable": { "version": "16.3.3", "isSemVerMajor": false }` ; npm ls : `next@16.2.9 └── sharp@0.34.5`, `eslint@9.39.4 └── js-yaml@4.2.0`, `@tailwindcss/postcss@4.3.1 └── postcss@8.5.15 └── nanoid@3.3.15`. grep 'next/image' src/ : 0 résultat ; src/components/ui/Photo.tsx:31-32 `<img src={src}`.
  ```
- **Correctif** : npm install next@16.3.3 eslint-config-next@16.3.3 (non-major, risque faible), puis `npm audit fix` pour la chaîne dev. Si l'app reste sans next/image, ajouter `images: { unoptimized: true }` dans next.config.ts pour fermer l'endpoint /_next/image en déploiement autonome.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code


---

## 4. Constats par domaine

Sévérités affichées **après contre-vérification adversariale** (Phase 2). Quand un constat a été déclassé, la ligne « Contre-vérification » explique pourquoi (généralement : garde-fou absent par construction dans un prototype sans backend, non bloquant en lecture démo, bloquant au vrai lancement).


### Domaine 5.1+5.2 Authentification, sessions, contrôle d'accès & IDOR

### [MOYEN] Aucune authentification réelle : l'accès repose sur un flag localStorage non signé, contournable en un clic
- **Emplacement** : /Users/fouzi/solange/src/components/chrome/AuthGate.tsx:24,34 · /Users/fouzi/solange/src/components/chrome/AuthScreen.tsx:296-305 · /Users/fouzi/solange/src/app/layout.tsx:88-92
- **Constat** : AuthGate est le seul mécanisme d'« auth » de l'app et il ne vérifie qu'un booléen localStorage posé côté client. Il n'existe AUCUN concept de session, token, cookie, rôle ou identité serveur : grep -rniE "session|token|cookie|jwt|admin" sur tout src/ ne retourne aucun hit applicatif, il n'y a ni middleware.ts ni aucune route API (find route.ts = 0 résultat). Le contournement est trivial et même OFFERT : le bouton « Passer · accès beta test » appelle directement onComplete, et n'importe qui peut faire localStorage.setItem("solange:onboarded","1") en console. L'email saisi n'est envoyé nulle part (aucun fetch dans AuthScreen), n'est pas persisté, et n'importe quel visiteur devient le même utilisateur unique « me » (Nouh Benzidane, mock.ts:584). Lecture (a) démo publique : intentionnel et assumé (commentaire l.15-16 « A Passer button skips auth for beta testing »), aucun risque réel. Lecture (b) vraie marketplace : bloquant absolu — c'est un garde-fou absent par construction (prototype sans backend), pas un code d'auth défectueux.
- **Impact** : Lancée telle quelle comme marketplace : zéro identité, zéro imputabilité (achats, messages, annonces non rattachables à quiconque), impossibilité de protéger quoi que ce soit. En démo : aucun impact, c'est le comportement voulu.
- **Preuve** :
  ```
  AuthGate.tsx:24 → onboarded = localStorage.getItem(ONBOARD_KEY) === "1";
  AuthGate.tsx:34 → localStorage.setItem(ONBOARD_KEY, "1");
  AuthScreen.tsx:301-304 → onClick={onComplete} … Passer · accès beta test →
  ```
- **Correctif** : Avant tout lancement réel : brancher un fournisseur d'auth avec session côté serveur (Supabase Auth déjà connu du stack de Nouh, ou NextAuth/Auth.js), cookies httpOnly + vérification serveur des routes, et supprimer le bouton Passer. Garder AuthGate uniquement comme écran d'onboarding UX.
- **Effort** : L
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Tous les faits sont exacts et vérifiés dans le code : flag localStorage non signé (AuthGate.tsx:24,34), bouton Passer qui appelle onComplete directement, zéro concept de session/token/cookie/jwt applicatif dans src/ (le grep ne remonte que des design tokens CSS), zéro route.ts ni middleware.ts, zéro fetch dans AuthScreen (l'email n'est ni envoyé ni persisté). MAIS la sévérité ÉLEVÉ est exagérée dans le contexte établi (prototype frontend pur, 0 backend) : l'absence d'auth est intentionnelle et documentée dans le code lui-même — le commentaire d'AuthScreen.tsx:14-16 dit explicitement « Code is SIMULATED for now… A 'Passer' button skips auth for beta testing » et prévoit même le point de branchement futur (« swapping in a real Resend email is a drop-in on sendCode »). Il n'existe aucun actif réel à protéger : données 100% fictives, rien de transmis, rien de persisté sauf un booléen. C'est un garde-fou absent par construction, pas un contrôle défectueux — ÉLEVÉ (fonctionnalité cassée) ne s'applique pas à un mécanisme qui fonctionne exactement comme conçu. MOYEN et pas FAIBLE pour deux raisons : (1) l'écran email→code imite visuellement une vraie inscription, un visiteur public peut saisir un vrai email en croyant créer un compte ; (2) c'est LE bloquant absolu n°1 avant toute mise en production réelle et doit rester visible en tête de roadmap.

### [MOYEN] Code 6 chiffres : théâtre de sécurité — généré, affiché et vérifié dans le même composant client, via Math.random
- **Emplacement** : /Users/fouzi/solange/src/components/chrome/AuthScreen.tsx:36,48,255-260
- **Constat** : Le « code de vérification » est généré côté client par Math.random (non cryptographique), affiché À L'ÉCRAN dans l'encart « Démo · ton code », et comparé côté client (d === demoCode). Sa valeur de sécurité est exactement nulle : le secret, son canal de distribution et sa vérification vivent dans le même état React. C'est assumé (commentaire l.35 « SIMULATED: generate a code and reveal it ») et honnête vis-à-vis du testeur. Le piège pour la suite : le commentaire l.15-16 vend le branchement d'un vrai email Resend comme « a drop-in on sendCode » — c'est FAUX en l'état, car si on ne remplace que l'envoi en gardant la comparaison client (l.48), le code resterait lisible dans le state React et onComplete resterait appelable, donc le contrôle resterait contournable. La vérification doit migrer côté serveur, pas seulement l'envoi. À noter côté conforme : email validé par regex (l.10, bouton disabled sinon), input code inputMode="numeric" avec aria-label et pattern sr-only propre (l.245-252), saisie assainie digits-only (l.44), autoComplete="email" (l.174).
- **Impact** : Aucun en démo (voulu). En cas de « branchement rapide » d'un vrai envoi d'email sans déplacer la vérification serveur : fausse impression d'auth réelle alors que le contrôle reste 100% contournable côté client.
- **Preuve** :
  ```
  AuthScreen.tsx:36 → setDemoCode(String(Math.floor(100000 + Math.random() * 900000)));
  AuthScreen.tsx:48 → if (d === demoCode) {
  AuthScreen.tsx:255-259 → Démo · ton code : … {demoCode}
  ```
- **Correctif** : Corriger le commentaire l.15-16 pour dire que le passage au réel exige génération + stockage + vérification côté serveur (OTP hashé, expiration 10 min, rate limit 5 essais), pas un simple swap de sendCode. Utiliser un RNG crypto côté serveur le moment venu.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] IDs séquentiels devinables (k1..k17) sur /article/[id] et /checkout/[id] — impact réel nul ici, mais checkout sans aucun contrôle d'état
- **Emplacement** : /Users/fouzi/solange/src/app/checkout/[id]/page.tsx:6-8,16-17 · /Users/fouzi/solange/src/app/article/[id]/page.tsx:11-13 · /Users/fouzi/solange/src/app/checkout/[id]/CheckoutView.tsx:124-126
- **Constat** : Les deux routes dynamiques pré-rendent une page par item du catalogue (generateStaticParams sur catalog) et renvoient proprement notFound() pour un id inconnu — pas de crash, pas de page fantôme. L'énumération k1..k17 ne révèle QUE des fiches catalogue publiques par nature : aucune donnée privée n'est derrière ces IDs, donc pas d'IDOR exploitable dans ce code. Le vrai constat est un garde-fou absent côté checkout : n'importe quel visiteur peut « acheter » n'importe quel article sans vérification de disponibilité, de propriété (acheter sa propre annonce) ni de réservation — et l'écran de succès affiche « Le vendeur @x a été notifié — expédition sous 48h » alors que personne n'est notifié (la commande n'existe qu'en mémoire client, store.tsx:71-75, perdue au refresh). Le bandeau « Test — aucun paiement réel » (CheckoutView.tsx:163-172) est en revanche honnête et bien visible.
- **Impact** : Démo : néant. Vraie marketplace : double vente du même article, achat de sa propre annonce, promesse de notification vendeur mensongère — à traiter avec le backend transactionnel.
- **Preuve** :
  ```
  checkout/[id]/page.tsx:16-17 → const item = catalogItem(id);
    if (!item) notFound();
  CheckoutView.tsx:124-126 → Le vendeur <span className="text-bone">@{item.seller}</span> a été
      notifié — expédition sous 48h.
  ```
- **Correctif** : Au passage au réel : checkout derrière auth, verrou de disponibilité côté serveur (réservation transactionnelle), interdiction d'acheter ses propres annonces, IDs opaques (nanoid/uuid) par hygiène. En démo, reformuler éventuellement « a été notifié » en conditionnel pour rester honnête.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] « Déconnexion » ne fait que supprimer le flag d'onboarding — vocabulaire de session sans session
- **Emplacement** : /Users/fouzi/solange/src/app/profil/page.tsx:337-348
- **Constat** : Le bouton « Déconnexion » du profil fait localStorage.removeItem("solange:onboarded") + location.reload(). C'est cohérent aujourd'hui (le seul état persistant de TOUTE l'app est ce flag — grep localStorage sur src/ ne montre que AuthGate get/set et ce removeItem ; le store React est en mémoire et le reload le vide de fait). Deux réserves : (1) le libellé « Déconnexion » suggère une session qui n'existe pas, ce qui peut masquer l'absence d'auth réelle lors des démos investisseurs/testeurs ; (2) le jour où un état utilisateur sera persisté (profil, panier), ce handler ne purgera rien d'autre. À noter côté conforme : AuthGate est fail-closed — si localStorage est bloqué (navigation privée stricte), le try/catch traite l'utilisateur comme non onboardé (AuthGate.tsx:23-27), et le splash évite tout flash de contenu avant résolution du flag.
- **Impact** : Confusion conceptuelle mineure ; risque de purge incomplète le jour où d'autres données seront persistées.
- **Preuve** :
  ```
  profil/page.tsx:340-343 → try {
        localStorage.removeItem("solange:onboarded");
      } catch {}
      location.reload();
  ```
- **Correctif** : Renommer l'action « Revoir l'onboarding » tant qu'il n'y a pas de session, ou centraliser une fonction signOut() qui purgera toutes les clés solange:* — un point unique à étendre avec la vraie auth.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [AMÉLIORATION] Toutes les données « privées » (conversations, profil, commandes) sont livrées à tous dans le bundle JS public
- **Emplacement** : /Users/fouzi/solange/src/lib/mock.ts:615-640 · /Users/fouzi/solange/src/app/messages/page.tsx:8,103 · .next/static/chunks/0t-urly4nc7lc.js
- **Constat** : AuthGate est un gate purement VISUEL : il couvre bien toutes les routes en deep-link (il enveloppe children dans le layout racine, donc /messages, /checkout/k1, /profil affichent l'écran d'auth pour un visiteur non « onboardé ») et le HTML pré-rendu ne contient pas les conversations (grep "Maya Diallo" .next/server/app/messages.html = 0). MAIS tout le dataset mock — y compris les conversations privées avec négociations de prix — est compilé dans le bundle JS statique téléchargé par CHAQUE visiteur, gate ou pas : grep -rl "Maya Diallo" .next/static/chunks → 0t-urly4nc7lc.js. Après le clic « Passer », tous les messages, le profil et les commandes de « me » sont visibles par n'importe qui : il n'existe aucune séparation par utilisateur. Lecture (a) démo : sans impact réel, ce sont des données fictives. Lecture (b) : ce pattern (données utilisateur dans un export statique) serait une fuite de données totale — c'est l'architecture même qui doit changer, pas un correctif ponctuel.
- **Impact** : En vraie marketplace : divulgation intégrale des messages privés et de l'historique d'achat de tous les utilisateurs à quiconque lit le bundle (violation RGPD art. 32 caractérisée). En démo : néant, mais le prototype démontre involontairement le mauvais pattern.
- **Preuve** :
  ```
  messages/page.tsx:103 → {conversations.map((c) => { … })}
  mock.ts:626-627 → { from: "me", text: "Bonjour ! Le manteau est toujours dispo en 38 ?" },
  Build vérifié : grep -rl "Maya Diallo" .next/static/chunks → /Users/fouzi/solange/.next/static/chunks/0t-urly4nc7lc.js (bundle public)
  ```
- **Correctif** : Lors du passage au réel : les conversations/commandes doivent venir d'une API authentifiée filtrée par user_id (RLS Supabase par ex.), jamais du bundle. Le seam src/lib/data.ts existe déjà pour ce swap — le documenter comme frontière « données privées = jamais statiques ».
- **Effort** : L
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → AMÉLIORATION** — Faits intégralement confirmés : le dataset complet (conversations avec négociations de prix mock.ts:618-634, profil « me » Nouh Benzidane, commandes) est bien compilé dans le chunk statique public .next/static/chunks/0t-urly4nc7lc.js téléchargé par tout visiteur, et le gate est bien purement visuel (il couvre correctement le HTML pré-rendu : 0 hit « Maya Diallo » dans .next/server/app/messages.html, mais pas le JS). MAIS qualifier cela d'ÉLEVÉ est un contresens dans le contexte établi : ces données ne sont PAS privées — Maya Diallo, Samir Benali et leurs négociations sont des fixtures fictives écrites à la main par le développeur dans src/lib/mock.ts, dont la présence dans le bundle client est la définition même d'un prototype frontend à données mock. Il n'y a aucun utilisateur, aucune donnée personnelle réelle (le « profil » est la vitrine auto-décrite de l'auteur du site), donc aucune fuite possible. L'auditeur le concède lui-même (« lecture (a) démo : sans impact réel, ce sont des données fictives ») puis note ÉLEVÉ quand même. La valeur résiduelle du constat est une note d'architecture pour la migration future (les données devront être servies par utilisateur côté serveur, jamais embarquées dans un export statique) — c'est exactement le périmètre d'AMÉLIORATION, pas d'un défaut actuel.


### Domaine 5.3+5.6+5.7 — Injections/XSS, uploads, secrets/dépendances/headers

### [MOYEN] safeJsonLd existe mais n'est utilisé nulle part : les 6 injections JSON-LD passent par JSON.stringify brut
- **Emplacement** : src/lib/ld.ts:8 (helper mort) ; src/app/profil/layout.tsx:34, src/app/messages/layout.tsx:34, src/app/decouvrir/layout.tsx:67 et 71, src/app/vendre/layout.tsx:34, src/app/premium/page.tsx:38
- **Constat** : Le projet contient un helper dédié qui échappe '<' pour empêcher une valeur de casser le tag <script> JSON-LD, mais `grep -rn safeJsonLd src/` ne renvoie que sa définition : aucun des 6 sites `dangerouslySetInnerHTML` ne l'appelle, tous font `JSON.stringify(...)` brut. J'ai remonté la source de chaque site : profil/messages/vendre = constantes statiques (breadcrumb), decouvrir = `catalog` de src/lib/mock.ts (brand/name/category mock statiques), premium = `plans` de mock.ts. Aujourd'hui aucune saisie utilisateur n'atteint ces sinks : non exploitable en lecture (a) démo. En lecture (b) marketplace réelle, ces mêmes ItemList/Product JSON-LD seraient alimentés par des noms d'articles UGC : un titre d'annonce contenant `</script><script>...` sortirait du tag et deviendrait un stored XSS — le point passerait alors en ÉLEVÉ/bloquant.
- **Impact** : Nul aujourd'hui (données 100% statiques). Dès branchement sur des données vendeur : XSS stocké servi à chaque visiteur des pages catalogue, aggravé par le fait que la CSP autorise 'unsafe-inline' en script-src (voir finding dédié) donc ne bloquerait rien.
- **Preuve** :
  ```
  src/lib/ld.ts:8 `export function safeJsonLd(obj: unknown): string { return JSON.stringify(obj).replace(/</g, "\\u003c"); }` — vs src/app/decouvrir/layout.tsx:67 `dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}` avec itemListJsonLd construit depuis `catalog.map((item, i) => ({ ... name: `${item.brand} ${item.name}` ...`. grep safeJsonLd sur src/ : 1 seul hit = sa définition.
  ```
- **Correctif** : Remplacer les 6 `JSON.stringify(x)` par `safeJsonLd(x)` (import depuis @/lib/ld). Correction mécanique, aucune régression possible (sortie identique sur les données actuelles).
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] 7 vulnérabilités npm (6 high, 1 moderate) — Next 16.2.9 directe avec fix 16.3.3 disponible, le reste en chaîne dev/build
- **Emplacement** : package.json (next 16.2.9, @tailwindcss/postcss ^4, eslint ^9, vitest ^4.1.9) ; node_modules via npm ls
- **Constat** : npm audit relancé le 2026-08-28 : 7 vulns (0 critical, 6 high, 1 moderate). Détail avec chemins vérifiés par `npm ls` : (1) next 16.2.9 [DIRECTE, high, fix 16.3.3 non-major] — advisories GHSA-6gpp-xcg3-4w24 (bypass middleware : l'app n'a AUCUN middleware, vérifié `ls src/middleware.ts` inexistant), GHSA-m99w-x7hq-7vfj + GHSA-89xv-2m56-2m9x (DoS/SSRF Server Actions : 0 'use server' dans src/, vérifié par grep), GHSA-q8wf-6r8g-63ch (DoS image optimizer SVG : l'app n'utilise PAS next/image — 0 hit grep 'next/image', Photo.tsx rend un <img> brut avec eslint-disable no-img-element — mais l'endpoint /_next/image existerait quand même si déployé via `next start` car next.config.ts configure `images.formats` sans `unoptimized`), + cache confusion (moderate). (2) sharp 0.34.5 [transitive via next, high, GHSA-f88m-g3jw-g9cj libvips] — même chemin : seul l'optimiseur d'images l'exerce, jamais appelé par le code de l'app. (3) brace-expansion [via eslint/eslint-config-next, dev-only], js-yaml 4.2.0 [via eslint, dev-only], nanoid [via postcss, chaîne build], postcss 8.4.31/8.5.15 [via next + @tailwindcss/postcss + vitest, build-time : l'advisory XSS/file-read concerne du CSS attaquant-contrôlé, inapplicable ici]. Aucune vuln n'est exercée par le runtime de la démo statique ; en lecture (b) c'est le paquet next lui-même qu'il faut monter avant tout déploiement public.
- **Impact** : Lecture (a) démo : quasi nul (vulns dev/build + endpoints Next jamais exposés tant que rien n'est déployé). Lecture (b) déploiement `next start` : endpoint /_next/image vulnérable au DoS SVG + sharp/libvips vulnérable exposés même sans usage applicatif, cache confusion possible.
- **Preuve** :
  ```
  npm audit --json : `"metadata": { "moderate": 1, "high": 6, "critical": 0, "total": 7 }` ; `"name": "next" ... "fixAvailable": { "version": "16.3.3", "isSemVerMajor": false }` ; npm ls : `next@16.2.9 └── sharp@0.34.5`, `eslint@9.39.4 └── js-yaml@4.2.0`, `@tailwindcss/postcss@4.3.1 └── postcss@8.5.15 └── nanoid@3.3.15`. grep 'next/image' src/ : 0 résultat ; src/components/ui/Photo.tsx:31-32 `<img src={src}`.
  ```
- **Correctif** : npm install next@16.3.3 eslint-config-next@16.3.3 (non-major, risque faible), puis `npm audit fix` pour la chaîne dev. Si l'app reste sans next/image, ajouter `images: { unoptimized: true }` dans next.config.ts pour fermer l'endpoint /_next/image en déploiement autonome.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Aucune protection anti-clickjacking : ni frame-ancestors dans la CSP, ni X-Frame-Options
- **Emplacement** : next.config.ts (tableau csp lignes ~28-35 et headers() lignes ~50-70)
- **Constat** : La CSP se compose exactement de : default-src 'self', img-src 'self' data: blob:, style-src 'self' 'unsafe-inline', script-src, connect-src, font-src. Il n'y a NI directive frame-ancestors NI en-tête X-Frame-Options dans headers() (qui ne pose que X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP). frame-ancestors ne retombe pas sur default-src : n'importe quel site peut donc iframer l'app. base-uri et form-action, qui ne retombent pas non plus sur default-src, sont également absents. Lecture (a) démo : risque théorique (rien à voler, pas de session). Lecture (b) marketplace avec checkout/paiement réels : le clickjacking sur les boutons 'Payer'/'Confirmer' devient un vrai vecteur de fraude — à corriger avant lancement (ÉLEVÉ dans cette lecture).
- **Impact** : Un site tiers peut superposer l'app dans une iframe invisible et détourner des clics. Sans argent réel : cosmétique. Avec paiement réel : fraude au clic sur des actions irréversibles.
- **Preuve** :
  ```
  next.config.ts : `const csp = [ "default-src 'self'", "img-src 'self' data: blob:", "style-src 'self' 'unsafe-inline'", scriptSrc, connectSrc, "font-src 'self'", ].join("; ");` — aucun frame-ancestors ; headers() : X-Content-Type-Options / Referrer-Policy / Permissions-Policy / CSP uniquement.
  ```
- **Correctif** : Ajouter `"frame-ancestors 'none'"`, `"base-uri 'self'"` et `"form-action 'self'"` au tableau csp, plus `{ key: "X-Frame-Options", value: "DENY" }` dans headers() pour les vieux navigateurs.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] CSP production avec script-src 'unsafe-inline' : la CSP ne mitige aucun XSS
- **Emplacement** : next.config.ts lignes ~23-25 (const scriptSrc)
- **Constat** : En production `script-src 'self' 'unsafe-inline'` : tout <script> inline injecté s'exécuterait, la CSP perd sa fonction principale de défense en profondeur contre le XSS. Le commentaire du fichier documente le choix (JSON-LD inline + chunks bootstrap Next.js l'exigent sous ce setup SSG), donc c'est un compromis assumé et non un oubli — le dev-only 'unsafe-eval' et connect-src ws: sont eux correctement conditionnés à isDev. À noter : Next.js ne permet pas de nonces en SSG pur ; l'alternative réaliste est le hash des scripts inline, coûteux à maintenir. Aujourd'hui aucun sink XSS actif (tout l'UGC est rendu en nœuds texte React auto-échappés — vérifié dans CommentSheet.tsx:86 `{c.text}`, messages/page.tsx:202 `{m.text}`, live/StreamsView.tsx:249 `{line.text}` ; 0 innerHTML/eval/document.write hors JSON-LD), donc l'impact réel est nul en lecture (a).
- **Impact** : Défense en profondeur absente : si un XSS apparaît un jour (ex. le finding JSON-LD branché sur de l'UGC), la CSP ne bloquera rien. Pas de vecteur exploitable aujourd'hui.
- **Preuve** :
  ```
  next.config.ts : `const scriptSrc = isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'";` — et src/components/feed/CommentSheet.tsx:86 : `<p className="mt-0.5 text-[13.5px] leading-relaxed text-bone/90">{c.text}</p>` (rendu texte React, auto-échappé).
  ```
- **Correctif** : Au passage en backend réel : basculer sur des hashes CSP pour les scripts inline (ou déplacer le JSON-LD en génération de hash au build) et retirer 'unsafe-inline'. En attendant, documenter le compromis suffit.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Pas d'en-tête HSTS (Strict-Transport-Security)
- **Emplacement** : next.config.ts headers()
- **Constat** : headers() pose 4 en-têtes (X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy camera/micro/géoloc vides, CSP) mais aucun Strict-Transport-Security. Le projet n'a par ailleurs aucune config d'hébergement (pas de vercel.json/netlify.toml — un hébergeur managé l'ajouterait souvent lui-même). Sans HSTS, un premier accès en http:// reste interceptable (SSL-stripping). Pertinent uniquement au déploiement ; sans déploiement aujourd'hui, dette.
- **Impact** : Downgrade HTTPS→HTTP possible au premier accès sur réseau hostile une fois déployé en autonome. Nul tant que rien n'est en ligne.
- **Preuve** :
  ```
  next.config.ts headers() : `headers: [ { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", ... }, { key: "Permissions-Policy", ... }, { key: "Content-Security-Policy", value: csp } ]` — pas de Strict-Transport-Security.
  ```
- **Correctif** : Ajouter `{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }` dans headers() (ou vérifier que l'hébergeur cible le pose) au moment du premier déploiement.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [AMÉLIORATION] Sélecteurs de photos /vendre et /creer : boutons factices sans aucune implémentation d'upload
- **Emplacement** : src/app/vendre/page.tsx:57-60 ; src/app/creer/page.tsx:99-107
- **Constat** : Constat de garde-fou/feature ABSENT, pas de code défectueux. Le bouton 'Ajoute des photos' de /vendre et le drop-zone 'Dépose une vidéo ou des photos' de /creer sont des <button> sans onClick, sans <input type="file">, sans handler drag-drop. Vérifié sur tout src/ : 0 occurrence de type="file", URL.createObjectURL, FileReader, FormData, fetch(, XMLHttpRequest, sendBeacon — RIEN ne part au serveur ni n'est lu du disque, il n'y a donc aujourd'hui aucune surface d'attaque upload (pas de question de validation type/taille ni d'EXIF : aucun octet n'est traité). En lecture (b), l'upload photo est LA feature cœur d'une marketplace mode : tout le pipeline (validation MIME/magic bytes, limite de taille, strip EXIF/GPS — enjeu RGPD de géolocalisation du domicile des vendeurs —, re-encodage serveur, antivirus) est à construire de zéro.
- **Impact** : Aucun risque sécurité actuel. Risque produit : la démo laisse croire à une fonctionnalité qui n'existe pas ; et le chantier sécurité upload complet reste devant l'équipe.
- **Preuve** :
  ```
  src/app/vendre/page.tsx:57 `<button className="col-span-2 row-span-2 flex aspect-square ... "> <Camera className="size-7" /> <span className="text-[11px]">Ajoute des photos</span> </button>` — aucun attribut onClick ; grep 'type="file"|createObjectURL|FileReader|fetch(|FormData' sur src/ : 0 résultat.
  ```
- **Correctif** : Rien à corriger dans le prototype. Au passage backend : pipeline d'upload avec validation magic-bytes + taille max, strip EXIF/GPS systématique, re-encodage côté serveur, stockage hors webroot.
- **Effort** : L
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [AMÉLIORATION] Secrets : RAS vérifié — historique git propre (21 commits), aucun .env, .gitignore correct
- **Emplacement** : Historique git complet (21 commits, git log --all -p) ; .gitignore ; racine du repo
- **Constat** : Contrôle positif, consigné comme preuve d'audit : scan de TOUT l'historique (git rev-list --count --all = 21 commits) avec les motifs sk-(proj|ant|live|test), ghp_/gho_, AKIA[0-9A-Z]{16}, xox[baprs]-, BEGIN...PRIVATE KEY, eyJhbGciOi (JWT) : 0 correspondance (les seuls hits d'un premier scan large étaient des faux positifs CSS mask-image et des URLs registry npm). git grep sur HEAD (apikey/secret/password/token) : 1 seul hit = un commentaire CSS dans Brandmark.tsx ('colour token'). Aucun fichier .env* n'existe dans le repo (find à la racine hors node_modules : 0), et .gitignore couvre `.env*` ainsi que `*.pem`. Cohérent avec l'architecture : app 100% front sans un seul appel réseau, donc aucun secret n'a de raison d'exister. CORS/CSRF : sans objet aujourd'hui — aucune route API, aucun cookie de session, aucune requête applicative (grep fetch/XHR : 0) ; à concevoir dès le premier backend.
- **Impact** : Aucun. Point de vigilance futur : le jour où Stripe/Supabase arrivent, imposer d'emblée env vars + scan pre-commit, car l'équipe n'a encore aucun outillage secrets.
- **Preuve** :
  ```
  .gitignore : `# env files (can opt-in for committing if needed)` / `.env*` et `*.pem` ; scan historique : `git log --all -p | grep -cE "sk-(proj|ant|live|test)|ghp_...|AKIA[0-9A-Z]{16}|BEGIN.*PRIVATE KEY|eyJhbGciOi"` → `0`.
  ```
- **Correctif** : Rien à corriger. Avant le premier backend : ajouter un hook pre-commit de scan de secrets (gitleaks) et un .env.example.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code


### Domaine 5.4+5.5 Paiements, logique financière, concurrence

### [MOYEN] Champ carte en saisie libre + autoComplete cc-* : le navigateur propose la VRAIE carte de l'utilisateur dans un simulateur
- **Emplacement** : src/app/checkout/[id]/CheckoutView.tsx:245-286
- **Constat** : Le champ « Numéro de carte » accepte toute saisie (16 chiffres formatés 4 par 4) et porte autoComplete="cc-number" (idem cc-exp, cc-csc, cc-name), ce qui déclenche l'autofill des cartes réelles enregistrées dans le navigateur. Un utilisateur réel d'une démo publique peut donc taper ou autofiller son vrai PAN + CVC dans un faux checkout. Mitigants vérifiés : la valeur n'est ni loggée, ni persistée, ni transmise (aucun fetch dans le composant, aucun console.log, localStorage limité au flag onboarding — grep vide ; le store ne garde que last4, CheckoutView.tsx:51 et store.tsx:34). Le PAN complet ne vit qu'en state React en mémoire. Lecture (a) démo publique : c'est LE point bloquant du checkout. Lecture (b) : le formulaire serait de toute façon remplacé par Stripe Elements.
- **Impact** : Exposition d'un vrai numéro de carte + CVC dans une interface non prévue pour (mémoire du navigateur, épaule-surfing, extensions navigateur, React DevTools). Perte de confiance majeure si un testeur s'en rend compte.
- **Preuve** :
  ```
  // CheckoutView.tsx:247-251
  <input
    inputMode="numeric"
    autoComplete="cc-number"
    value={card}
    onChange={(e) => setCard(formatCard(e.target.value))}
  // :39 — const [card, setCard] = useState("4242 4242 4242 4242");
  ```
- **Correctif** : Retirer les attributs autoComplete cc-* (mettre autoComplete="off"), passer les champs en readOnly (la carte test préremplie suffit à la démo) ou n'accepter que les cartes test connues (4242…), et refuser toute autre saisie avec un message « mode test — carte fictive uniquement ».
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Factuel : les 4 attributs autoComplete cc-* existent bien (CheckoutView.tsx:249, 266, 277, 291) et la saisie est libre. Mais la sévérité ÉLEVÉ est exagérée pour trois raisons vérifiées : (1) aucun chemin d'exfiltration — grep confirme zéro fetch, zéro console.log, zéro localStorage/sessionStorage dans src/app/checkout/ et store.tsx ; le PAN ne vit qu'en state React et seul last4 atteint le store en mémoire (CheckoutView.tsx:51,68 ; Order.last4 store.tsx:34) ; (2) les champs sont préremplis avec la carte de test Stripe 4242 (ligne 39-42) — les navigateurs ne proposent l'autofill carte que sur champ vide, l'utilisateur devrait d'abord effacer volontairement la valeur, ce qui affaiblit le scénario « autofill déclenché » ; (3) un bandeau Test explicite « Simulation Stripe Connect — aucun paiement réel n'est effectué » est rendu juste au-dessus du formulaire (lignes 163-172), omis par l'auditeur. Le risque résiduel (habituation, vrai PAN saisi dans une démo publique qui n'en fait rien) est réel mais non-bloquant et corrigeable en une ligne (autoComplete="off" ou champs readOnly). Selon la grille de sévérité, ÉLEVÉ = fonctionnalité cassée ; ici rien n'est cassé ni transmis : suboptimal mais fonctionnel = MOYEN.

### [MOYEN] Taux de commission affiché faux par arrondi : 3,5 % affiché « 4 % » et 2,5 % affiché « 3 % »
- **Emplacement** : src/app/checkout/[id]/CheckoutView.tsx:224 (+ src/lib/utils.ts:71-76)
- **Constat** : Code présent défectueux. Le label utilise Math.round(rate * 100) : pour les paliers dégressifs 0.035 et 0.025 (utils.ts:73-74), l'affichage devient « 4% » et « 3% » alors que le montant affiché à côté est calculé au taux réel. Contradiction visible dans le catalogue actuel : k9 Prada 680 € affiche « Commission SOLANGE (3%) » avec 17,00 € (= 2,5 %) ; k1/k2/k4/k6/k10/k12/k15 (210-420 €) affichent « 4% » avec un montant à 3,5 %. Lecture (a) : la vitrine « business plan dégressif » devant un investisseur se contredit elle-même. Lecture (b) : affichage d'un taux de frais erroné au consommateur (pratique trompeuse).
- **Impact** : Le panneau censé démontrer le modèle économique (commission dégressive) affiche un taux incohérent avec le montant sur 8 des 17 articles du catalogue.
- **Preuve** :
  ```
  // CheckoutView.tsx:224-226
  <Row label={`Commission SOLANGE (${Math.round(rate * 100)}%)`}>
    {euro(price - net)}
  </Row>
  // utils.ts:73-74
  if (price < 500) return 0.035;
  if (price < 1000) return 0.025;
  ```
- **Correctif** : Formater sans arrondir à l'entier : `${(rate * 100).toFixed(1).replace('.', ',').replace(',0', '')}%` (→ « 3,5% », « 2,5% ») et afficher euro(fee) retourné par commission() plutôt que price - net recalculé.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Réalisme trompeur : « via Stripe », « Paiement chiffré », « Paiement réussi / payée X € » sans aucun paiement, disclaimer Test discret
- **Emplacement** : src/app/checkout/[id]/CheckoutView.tsx:163-172, 240-242, 331-334, 89-95
- **Constat** : Le formulaire affiche « via Stripe » (l.241), « Paiement chiffré · protection acheteur incluse » (l.332-333) et l'écran de succès « Paiement réussi … payée {total} · carte •••• {last4} » (l.90-95), le profil un badge « Payé » — alors que rien n'est chiffré, transmis ni payé. Le disclaimer honnête existe (l.164-172 : badge « Test » + « Simulation Stripe Connect — aucun paiement réel n'est effectué ») et il est bien placé AVANT le formulaire dans le DOM et dans les deux layouts (le bandeau précède la grille ; sur mobile la carte est order-1 mais le bandeau reste au-dessus). Il est cependant en 11,5 px couleur ash (faible emphase), et ni le bouton « Payer 56,60 € » ni l'écran de succès ne rappellent le mode test. Lecture (a) : aggrave directement le finding carte réelle (l'utilisateur croit à un vrai checkout). Lecture (b) : « Paiement chiffré » serait une allégation de sécurité mensongère.
- **Impact** : Un utilisateur pressé qui ne lit pas le bandeau gris peut croire à un paiement réel — c'est précisément le scénario où il tape sa vraie carte.
- **Preuve** :
  ```
  // CheckoutView.tsx:331-333
  <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ash">
    <Lock className="size-3" /> Paiement chiffré · protection acheteur
    incluse
  </p>
  // :92-95 — « Commande {orderId} · payée {euro(total)} · carte •••• {last4} »
  ```
- **Correctif** : Supprimer « Paiement chiffré », libeller le bouton « Simuler le paiement · {euro(total)} », répéter le badge TEST sur le formulaire et sur l'écran de succès (« Simulation — aucun débit »).
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Commandes non persistées : « Paiement réussi » puis la commande disparaît au refresh
- **Emplacement** : src/lib/store.tsx:71-75, src/app/profil/page.tsx:211-217
- **Constat** : orders vit dans un useState du SolangeProvider (store.tsx:71) sans aucune persistance — alors que le flag onboarding, lui, est persisté en localStorage (AuthGate.tsx:24,34). Après un achat, un simple refresh (ou la fermeture de l'onglet) vide « Mes commandes » et fait disparaître une commande annoncée « Payée ». Lecture (a) démo : c'est ici que le point pique — un investisseur/testeur qui rafraîchit après l'écran de succès voit sa commande évaporée, incohérence flagrante avec le localStorage déjà utilisé ailleurs. Lecture (b) : perte de données de commande, inacceptable, mais le vrai fix est un backend (déjà couvert par le fait structurant).
- **Impact** : Rupture de confiance en pleine démo : l'app affirme « payée 56,60 € » puis n'en garde aucune trace.
- **Preuve** :
  ```
  // store.tsx:71-75
  const [orders, setOrders] = useState<Order[]>([]);
  const addOrder = useCallback(
    (order: Order) => setOrders((cur) => [order, ...cur]),
    [],
  );
  // AuthGate.tsx:34 — localStorage.setItem(ONBOARD_KEY, "1");  (preuve que la persistance localStorage est déjà le pattern maison)
  ```
- **Correctif** : Persister orders en localStorage (lecture hydration-safe comme AuthGate) — en ne stockant que id/itemId/total/last4/date, jamais plus de données carte.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Aucun statut disponible/vendu ni machine à états commande : un article unique est achetable à l'infini par n'importe qui
- **Emplacement** : src/lib/mock.ts:396-432, src/lib/store.tsx:28-36 et 71-75, src/app/checkout/[id]/page.tsx:6-8
- **Constat** : Garde-fou absent (pas de code défectueux) : grep « sold|vendu|available|status » sur src/lib/mock.ts ne retourne rien — CatalogItem n'a aucun champ de disponibilité. Le type Order n'a pas de champ status (badge « Payé » codé en dur dans profil/page.tsx:247), addOrder empile sans déduplication (setOrders((cur) => [order, ...cur])), le CTA « Acheter » reste actif après achat (ArticleDetail.tsx:143-157, aucune consultation de orders) et generateStaticParams pré-rend un checkout pour chaque tuile du catalogue. Résultat : re-achat illimité du même article par le même utilisateur, et deux « acheteurs » sur deux navigateurs achètent tous deux la même pièce unique (chaque contexte React est isolé, aucune réservation). Lecture (a) démo : simple incohérence de réalisme. Lecture (b) vraie marketplace : bloquant — la double vente d'une pièce unique est garantie (remboursements, litiges, perte sèche).
- **Impact** : En lancement réel : double vente systématique d'articles uniques = remboursements forcés, litiges acheteurs, atteinte à la réputation. En démo : un testeur attentif achète 3 fois la même veste et conclut que le produit n'est pas pensé.
- **Preuve** :
  ```
  // store.tsx:72-75 — aucun contrôle de disponibilité ni dédup
  const addOrder = useCallback(
    (order: Order) => setOrders((cur) => [order, ...cur]),
    [],
  );
  // store.tsx:28-36 — type Order sans champ status
  // profil/page.tsx:247 — <Check .../> Payé  (badge en dur)
  ```
- **Correctif** : Ajouter un champ status ('available'|'reserved'|'sold') sur CatalogItem dans le store, le passer à 'sold' dans addOrder, désactiver le CTA Acheter et le checkout pour un article vendu, et donner à Order une machine à états minimale (paid → shipped → delivered / disputed). Côté vrai backend : réservation transactionnelle pendant le checkout.
- **Effort** : M
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → FAIBLE** — Factuel à 100 % : grep « sold|vendu|available|status » sur src/lib/mock.ts retourne zéro résultat, CatalogItem (mock.ts:396-402) n'a aucun champ de disponibilité, Order (store.tsx:28-36) n'a pas de status, addOrder empile sans dédup (store.tsx:72-75), le CTA « Acheter » est un simple <Link href=/checkout/...> qui ne consulte jamais orders (ArticleDetail.tsx:143-157) et le badge « Payé » est codé en dur (profil/page.tsx:247). Mais la sévérité ÉLEVÉ repose entièrement sur la « lecture (b) vraie marketplace », qui contredit le contexte établi (prototype frontend pur, 0 backend, contextes React isolés, orders éphémères par onglet). L'auditeur reconnaît lui-même que la lecture (a) — la seule applicable — est une « simple incohérence de réalisme ». Aucune double vente réelle n'est possible puisque rien n'est vendu : pas de fonds, pas de stock, pas d'état partagé à corrompre. C'est un garde-fou absent non-bloquant, visible en démo uniquement comme défaut de réalisme (re-achat du même article affiché deux fois dans « Mes commandes »). Note de dette de conception valable pour un futur backend, mais FAIBLE dans le périmètre audité.

### [FAIBLE] Protection acheteur arrondie à l'euro entier : la part 5 % perd jusqu'à 0,50 € par commande
- **Emplacement** : src/app/checkout/[id]/CheckoutView.tsx:47
- **Constat** : protection = Math.round(price * 0.05) + 0.7 arrondit la composante 5 % à l'EURO (et non au centime) avant d'ajouter 0,70 €. Pour k8 Levi's à 49 € : affiché 2,70 € au lieu de 3,15 € (2,45 + 0,70) ; pour k1 à 245 € : 12,70 € au lieu de 12,95 €. Le total (l.49) est cohérent en interne avec cette valeur, et l'UI ne revendique aucun taux (« Protection acheteur » sans pourcentage), donc aucune contradiction visible — mais la formule est infidèle au modèle « Vinted-style 5 % + 0,70 € » revendiqué en commentaire. Lecture (a) : invisible. Lecture (b) : sous/sur-facturation systématique de ±0,50 € par commande vs le barème annoncé.
- **Impact** : Écart silencieux avec le barème métier dès que la logique serait branchée sur de vrais paiements ; chiffres de démo légèrement faux face à un comparatif Vinted.
- **Preuve** :
  ```
  // CheckoutView.tsx:47
  const protection = Math.round(price * 0.05) + 0.7; // Vinted-style buyer protection
  // 49 € → Math.round(2.45)=2 → 2,70 € (attendu 3,15 €)
  ```
- **Correctif** : Arrondir au centime : const protection = Math.round((price * 0.05 + 0.7) * 100) / 100; et déplacer la formule dans utils.ts à côté de commission() avec un test dédié.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] ID de commande Math.random 6 caractères : non unique, prévisible, non crypto
- **Emplacement** : src/app/checkout/[id]/CheckoutView.tsx:57-58
- **Constat** : L'ID « SLG-XXXXXX » est dérivé de Math.random().toString(36).slice(2, 8) : 6 caractères base36 (~2^31 d'espace), générateur non cryptographique, aucune vérification d'unicité contre les commandes existantes. Lecture (a) démo : impact nul (commandes en mémoire d'un seul navigateur). Lecture (b) : les IDs de commande doivent être générés côté serveur, uniques et non prévisibles (énumération de commandes).
- **Impact** : Collision d'ID possible dans une même session (clé React dupliquée dans la liste des commandes) ; pattern à ne surtout pas reconduire côté backend.
- **Preuve** :
  ```
  // CheckoutView.tsx:57-58
  const id =
    "SLG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  ```
- **Correctif** : En démo : crypto.randomUUID().slice(0, 8) suffit. En réel : ID généré serveur (ULID/UUID), jamais côté client.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] setTimeout de paiement jamais annulé : quitter pendant « Paiement en cours… » crée quand même la commande
- **Emplacement** : src/app/checkout/[id]/CheckoutView.tsx:60-72
- **Constat** : La latence simulée (setTimeout 1700 ms) n'a aucun cleanup : si l'utilisateur navigue ailleurs pendant « Paiement en cours… », le timer survit au démontage et addOrder (callback de contexte toujours vivant) enregistre la commande 1,7 s plus tard, sans écran de confirmation. setStep/setOrderId sur composant démonté sont silencieux en React 19. Le double-submit est correctement gardé (l.55 if (step !== "form") return + bouton disabled l.302), les événements discrets React étant flushés synchrones — pas de double commande constatée par lecture. Lecture (a) : commande fantôme dans le profil après un « annulé en cours de route ». Lecture (b) : le pattern (effet de bord dans un timer non annulable) serait un vrai bug d'intégrité.
- **Impact** : Une commande apparaît dans « Mes commandes » alors que l'utilisateur pense avoir abandonné le paiement.
- **Preuve** :
  ```
  // CheckoutView.tsx:60-72 — aucun clearTimeout / cleanup
  setTimeout(() => {
    setOrderId(id);
    addOrder({
      id,
      item,
      ...
    });
    setStep("done");
  }, 1700);
  ```
- **Correctif** : Stocker le timer dans un ref et le nettoyer au démontage (useEffect return () => clearTimeout(ref.current)), n'appeler addOrder que si le composant est encore monté.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [AMÉLIORATION] Provenance du prix saine pour un prototype : mock à la build, non manipulable par URL — mais aucun montant n'est autoritaire
- **Emplacement** : src/app/checkout/[id]/page.tsx:6-17, src/app/checkout/[id]/CheckoutView.tsx:46-50
- **Constat** : Point d'audit vérifié et globalement sain dans le cadre du prototype : le prix vient exclusivement de item.priceEUR résolu à la build via catalogItem(id) sur le catalogue mock (id inconnu → notFound(), l.17) ; aucun paramètre d'URL ni query ne pilote un montant, et generateStaticParams borne les 17 checkouts possibles. Une manipulation via React DevTools (props/state) reste évidemment possible mais à impact nul : aucun argent ne transite. Lecture (b) : tous les montants (prix, protection, commission, total) sont calculés côté client — sur une vraie marketplace ils devraient être recalculés et validés côté serveur au moment du paiement (le client n'envoie qu'un itemId).
- **Impact** : Aucun en démo. En réel, tout montant calculé client serait falsifiable — à traiter dans l'architecture backend, pas dans ce code.
- **Preuve** :
  ```
  // page.tsx:15-17
  const { id } = await params;
  const item = catalogItem(id);
  if (!item) notFound();
  // CheckoutView.tsx:46 — const price = item.priceEUR;
  ```
- **Correctif** : Rien à corriger dans le prototype. Consigner dans le cahier des charges backend : le serveur est seul autoritaire sur prix/commission/total (recalcul au moment du PaymentIntent).
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code


### Domaine 5.8 Conformité légale FR/UE

### [MOYEN] Aucune mention légale sur l'ensemble du site (obligation LCEN dès publication)
- **Emplacement** : /Users/fouzi/solange/src/app/ (aucune route légale) ; aucun footer légal dans src/
- **Constat** : Aucune page mentions légales, CGU, CGV ni politique de confidentialité n'existe : grep insensible à la casse sur 'mentions légales|cgu|cgv|confidentialité|privacy|legal|rgpd' dans tout src/ retourne zéro fichier, et le listing de src/app/ ne contient que article, checkout, communaute, creer, decouvrir, drops, favoris, journal, live, messages, notifications, premium, profil, vendre. Aucun email de contact non plus (grep 'contact@|support@|mailto' : zéro). Or la LCEN (art. 6-III) impose d'identifier l'éditeur (ou au minimum l'hébergeur pour un éditeur non professionnel) sur tout site publié, même une démo sans transaction. Lecture (a) démo publique : c'est LE point qui bloque la mise en ligne — publier solange.app ainsi est directement non conforme. Lecture (b) vrai lancement : s'y ajoutent CGU/CGV obligatoires. Alerte technique, pas un avis juridique.
- **Impact** : Publication d'un service en ligne sous marque SOLANGE sans identification de l'éditeur ni de l'hébergeur : infraction LCEN (sanctions pénales pour un éditeur professionnel), et impossibilité pour un utilisateur d'exercer un recours ou un droit RGPD faute d'interlocuteur identifié.
- **Preuve** :
  ```
  $ ls src/app/
  apple-icon.tsx article checkout communaute creer decouvrir drops error.tsx favoris globals.css icon.tsx journal layout.tsx live manifest.ts messages not-found.tsx notifications opengraph-image.tsx page.tsx premium profil robots.ts sitemap.ts template.tsx twitter-image.tsx vendre
  $ grep -rniE "mentions légales|cgu|cgv|confidentialité|privacy|legal|rgpd" src/ -l
  (aucun résultat — exit 1)
  ```
- **Correctif** : Avant toute mise en ligne publique : créer une route /mentions-legales (éditeur, directeur de publication, hébergeur, contact) liée depuis un footer global, plus une page /confidentialite même minimale ('aucune donnée collectée, aucun cookie tiers' — ce qui est vrai pour ce build). Faire valider le contenu par un avocat avant un vrai lancement.
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Les faits sont exacts et revérifiés : aucune route légale dans src/app/ (listing identique à celui de l'auditeur), grep insensible à la casse sur 'mentions légales|cgu|cgv|confidentialité|privacy|legal|rgpd' dans src/ → zéro fichier (exit 1), grep 'contact@|support@|mailto' → zéro, et find sur *footer*/*legal*/*mention* → rien. Mais la sévérité repose sur le déclencheur LCEN 'dès publication', et le site n'est publié nulle part : aucun .vercel/, aucun netlify.toml, aucune mention de déploiement dans README/CLAUDE.md, et surtout solange.app répond avec 'server: Parking/1.0' (domaine parqué, HTTP 405) — le prototype ne tourne qu'en local. L'obligation LCEN n'est donc pas encore engagée ; c'est le premier item du checklist de mise en ligne (trivial à corriger : une page + un footer), pas une non-conformité actuelle. ÉLEVÉ (= bloquant maintenant) est exagéré pour un repo local.

### [MOYEN] Fausses promesses commerciales publiquement indexables (offres JSON-LD, 'retour 14 jours', 'protection acheteur')
- **Emplacement** : /Users/fouzi/solange/src/app/premium/page.tsx:18-30,50 ; src/app/article/[id]/ArticleDetail.tsx:178-181 ; src/app/robots.ts:5-8 ; src/app/sitemap.ts:11
- **Constat** : La page /premium émet un JSON-LD schema.org Product/Offer avec prix en EUR et availability 'InStock' pour des abonnements fictifs (le bouton CTA de PlanCards.tsx:63-74 n'a aucun onClick), et affiche 'Sans engagement · résiliable à tout moment · paiement sécurisé.'. La page article promet 'Paiement sécurisé, retour sous 14 jours' (engagement de rétractation consommateur) sans CGV et sans aucun disclaimer de démo sur ces pages (seul le checkout a un bandeau Test). robots.ts autorise tout crawl et sitemap.ts référence /premium : ces offres fantômes seront indexées comme réelles. Lecture (a) démo : risque de confusion + indexation d'offres inexistantes (optique pratique commerciale trompeuse, art. L.121-2 c. conso, même sans encaissement). Lecture (b) lancement : vendre avec ces mentions sans CGV ni rétractation outillée rendrait le point bloquant.
- **Impact** : Un visiteur ou un moteur de recherche prend des offres payantes fictives pour de vraies offres commerciales de la marque SOLANGE ; engagement public ('retour sous 14 jours', 'protection acheteur') qu'aucun service ni contrat ne couvre.
- **Preuve** :
  ```
  // premium/page.tsx:24-29
      offers: {
        "@type": "Offer",
        price: schemaPrice(plan.price),
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
  // ArticleDetail.tsx:178-181
  <p className="mt-6 text-[13px] leading-relaxed text-ash">
    Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé,
    retour sous 14 jours. Commission dégressive reversée au vendeur.
  </p>
  ```
- **Correctif** : Tant que c'est une démo : passer robots.ts en disallow (ou metadata robots noindex), retirer le JSON-LD Offer de /premium, et afficher un bandeau 'Démo — aucune offre réelle' global (pas seulement au checkout). Au lancement : CGV réelles + parcours d'acceptation avant tout affichage de ces promesses.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Chaque citation est exacte au caractère près : premium/page.tsx:18-31 émet bien un JSON-LD Product/Offer EUR 'InStock' pour les 3 plans, la ligne 50 affiche 'Sans engagement · résiliable à tout moment · paiement sécurisé.', le bouton CTA de PlanCards.tsx (l.63-74) n'a aucun onClick, ArticleDetail.tsx:178-181 promet 'Paiement sécurisé, retour sous 14 jours', robots.ts autorise tout ('userAgent: *, allow: /') et sitemap.ts:11 liste '/premium'. Mais la conséquence centrale ('ces offres fantômes seront indexées comme réelles') est hypothétique : rien n'est déployé, solange.app est un domaine parqué tiers, donc risque d'indexation et de confusion consommateur aujourd'hui = zéro. L'angle L.121-2 c. conso suppose une pratique commerciale effective envers des consommateurs ; ici aucune offre ne peut être acceptée (CTA mort, checkout explicitement simulé). Reste un vrai défaut de contenu pré-publication : dès qu'une URL publique existera, ces pages sans disclaimer démo diffuseront des engagements fictifs (rétractation 14 j sans CGV, abonnements inexistants en données structurées). À corriger avant toute mise en ligne (disclaimer/noindex/retrait du JSON-LD), mais pas ÉLEVÉ sur un artefact local.

### [MOYEN] Écran d'auth : promesse d'envoi d'email fausse et aucune information RGPD au point de saisie
- **Emplacement** : /Users/fouzi/solange/src/components/chrome/AuthScreen.tsx:30-41,168-170,213-216
- **Constat** : L'UI affirme 'Entre ton email pour recevoir ton code d'accès.' puis 'Code envoyé à {email}' — c'est faux : sendCode() génère le code localement et l'affiche à l'écran, et l'email ne quitte jamais le navigateur (aucun fetch/axios/sendBeacon dans src/, aucune écriture localStorage de l'email — seule clé stockée : 'solange:onboarded', AuthGate.tsx:7). Donc pas de traitement de données au sens RGPD aujourd'hui, mais un utilisateur d'une démo publique croit confier son email à SOLANGE sans aucune information (finalité, durée, droits — art. 13 RGPD) ni page de confidentialité. Le commentaire du code (lignes 14-16) prévoit le branchement Resend en 'drop-in' : le jour où il est branché, cela devient une collecte réelle sans base d'information — ÉLEVÉ à ce moment-là. Lecture (a) : problème de transparence, non bloquant. Lecture (b) : à corriger avant tout envoi réel.
- **Impact** : Des visiteurs réels saisissent leur adresse email en croyant à une collecte réelle, sans aucune information ni politique de confidentialité ; dette RGPD qui devient une non-conformité effective dès que l'envoi d'email est branché.
- **Preuve** :
  ```
  // AuthScreen.tsx:35-36
  // SIMULATED: generate a code and reveal it. (Real email → call an API here.)
  setDemoCode(String(Math.floor(100000 + Math.random() * 900000)));
  // AuthScreen.tsx:168-170
  <p className="text-center text-[15px] text-bone/85">
    Entre ton email pour recevoir ton code d'accès.
  </p>
  ```
- **Correctif** : En mode démo, dire la vérité sous le champ ('Démo : aucun email n'est envoyé ni conservé'). Avant de brancher Resend : page confidentialité + mention d'information art. 13 au point de collecte (finalité, durée, droits) et registre de traitement.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Aucune vérification d'âge ni protection des mineurs sur une marketplace sociale ouverte
- **Emplacement** : /Users/fouzi/solange/src/ (absence vérifiée) ; src/components/chrome/AuthScreen.tsx:295-305 (bouton 'Passer')
- **Constat** : Garde-fou absent : grep sur 'majeur|mineur|18 ans|naissance|birth' dans src/ ne retourne aucun contrôle d'âge, aucune case de déclaration, aucune date de naissance demandée. L'app entière (feed social, messages, checkout, vente) est accessible via le bouton 'Passer · accès beta test →' sans la moindre barrière. Lecture (a) démo : FAIBLE (contenu mode inoffensif, rien de réellement transactionnel). Lecture (b) lancement : un service marketplace + réseau social accessible aux mineurs pose la capacité contractuelle des mineurs vendeurs/acheteurs, le consentement des moins de 15 ans pour les données (art. 45 loi Informatique et Libertés / art. 8 RGPD) et les obligations DSA art. 28 (protection des mineurs sur les plateformes) — à traiter avant lancement.
- **Impact** : Au lancement : mineurs contractant des ventes/achats sans capacité juridique, données de mineurs traitées sans consentement parental, exposition DSA art. 28.
- **Preuve** :
  ```
  // AuthScreen.tsx:301-305 — l'app s'ouvre sans aucune vérification
  <motion.button
    ...
    onClick={onComplete}
  >
    Passer · accès beta test →
  </motion.button>
  $ grep -rniE "majeur|mineur|18 ans|naissance|birth" src/ → aucun contrôle d'âge
  ```
- **Correctif** : Au lancement : âge minimum dans les CGU (18 ans, modèle Vinted), date de naissance à l'inscription, et mesures DSA art. 28 proportionnées. Pour la démo, rien d'indispensable.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Aucun dispositif DSA : pas de signalement de contenu, pas de CGU, pas de point de contact
- **Emplacement** : /Users/fouzi/solange/src/ (absence vérifiée sur tout l'arbre)
- **Constat** : Garde-fou absent par construction (pas de code défectueux) : grep insensible à la casse sur 'signaler|report|réclamation|litige|modération' dans tout src/ retourne zéro fichier. Aucun bouton de signalement sur les articles, les posts du feed, les profils ou les messages ; aucune CGU, aucun point de contact (cf. finding mentions légales). Lecture (a) démo : non bloquant, car aucun contenu utilisateur réel ne peut être publié (pas de backend, aucun appel réseau dans src/). Lecture (b) vraie marketplace sociale : SOLANGE serait un hébergeur/plateforme en ligne au sens du DSA — mécanisme de notification de contenus illicites (art. 16), point de contact unique (art. 11-12), motivation des retraits (art. 17), CGU (art. 14), et traçabilité des vendeurs professionnels pour une marketplace (art. 30-31) deviennent obligatoires : bloquant au lancement.
- **Impact** : Au lancement réel : contenus illicites (contrefaçons, arnaques, contenus haineux dans le feed social ou les messages) sans aucun canal de signalement ni de retrait — non-conformité DSA directe et exposition de la responsabilité d'hébergeur (perte du régime d'exonération faute de retrait prompt).
- **Preuve** :
  ```
  $ grep -rniE "signaler|report|réclamation|litige|moderation|modération" src/ --include="*.tsx" --include="*.ts" -l
  (aucun résultat — exit 1)
  $ grep -rnE "fetch\(|axios|XMLHttpRequest|navigator.sendBeacon" src/
  (aucun résultat — exit 1 : aucun UGC ne peut réellement être publié)
  ```
- **Correctif** : Avant lancement : bouton 'Signaler' sur chaque article/post/profil/message relié à un backoffice de modération, CGU avec politique de contenu, point de contact DSA, procédure notice-and-action documentée, et collecte KYB des vendeurs professionnels (DSA art. 30). À cadrer avec un avocat plateformes.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → FAIBLE** — Les faits sont exacts : grep 'signaler|report|réclamation|litige|moderation|modération' dans src/ → zéro (exit 1), grep 'fetch(|axios|XMLHttpRequest|navigator.sendBeacon' → zéro (exit 1). Mais la sévérité ÉLEVÉ contredit l'analyse de l'auditeur lui-même, qui écrit 'Lecture (a) démo : non bloquant, car aucun contenu utilisateur réel ne peut être publié'. Les obligations DSA (art. 11-12, 14, 16-17, 30-31) s'attachent à une plateforme en exploitation avec des utilisateurs réels ; un prototype local en données mock, sans backend ni aucun appel réseau, n'est pas un hébergeur au sens du DSA. C'est un chantier de lancement du même ordre que 'construire le backend' (explicitement hors scope selon README.md:7), pas un défaut du code actuel. Utile comme note de roadmap ; ÉLEVÉ aujourd'hui est une erreur de calibrage.

### [FAIBLE] Faux formulaire carte avec autofill réel activé (autoComplete cc-*) et mention 'Paiement chiffré' inexacte
- **Emplacement** : /Users/fouzi/solange/src/app/checkout/[id]/CheckoutView.tsx:248,266,277,291,331-334
- **Constat** : Les champs du faux checkout portent autoComplete="cc-number", "cc-exp", "cc-csc", "cc-name" : le navigateur proposera de remplir la VRAIE carte enregistrée de l'utilisateur dans un formulaire de démonstration, sous un libellé 'Paiement chiffré · protection acheteur incluse' qui est faux (rien n'est chiffré ni transmis — aucun appel réseau dans src/). Atténuants vérifiés : carte de test 4242 pré-remplie et bandeau 'aucun paiement réel n'est effectué' en haut de page. Les données ne quittent jamais le navigateur, donc pas de collecte RGPD effective ; le risque est d'habituer des testeurs publics à saisir une vraie PAN/CVC dans une page de démo. Lecture (a) : dette de bonne pratique. Lecture (b) : ces champs disparaîtront au profit des éléments hébergés du PSP (Stripe Elements) de toute façon.
- **Impact** : Un testeur peut autofiller sa vraie carte bancaire dans une page de démonstration ; en cas de faille XSS future, ces données seraient exposées côté client.
- **Preuve** :
  ```
  // CheckoutView.tsx:247-249
  <input
    inputMode="numeric"
    autoComplete="cc-number"
  // CheckoutView.tsx:332-334
  <Lock className="size-3" /> Paiement chiffré · protection acheteur
  incluse
  ```
- **Correctif** : En démo : autoComplete="off" sur les 4 champs carte (ou champs readOnly) et remplacer 'Paiement chiffré' par 'Paiement simulé'.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [AMÉLIORATION] Statut paiement inexistant : rien n'est requis aujourd'hui (aucun argent ne transite), tout reste à construire pour encaisser
- **Emplacement** : /Users/fouzi/solange/src/app/checkout/[id]/CheckoutView.tsx:39-44,164-172 ; absence de tout appel réseau dans src/
- **Constat** : Confirmé : aucun argent ne transite dans ce build. Le checkout est purement simulé — carte de test Stripe pré-remplie ('4242 4242 4242 4242', CheckoutView.tsx:39), aucun fetch/axios/sendBeacon dans tout src/, et un bandeau honnête 'Simulation Stripe Connect — aucun paiement réel n'est effectué' (lignes 164-172). Donc aucune obligation LCB-FT/établissement de paiement aujourd'hui : lecture (a) rien à corriger. Lecture (b) vraie marketplace C2C : encaisser pour le compte des vendeurs est un service de paiement — il faudrait un PSP marketplace (Stripe Connect ou Mangopay) avec statut d'agent ou exemption ACPR, KYC/KYB des vendeurs, gestion LCB-FT portée par le PSP, plus la déclaration DAC7/art. 242 bis CGI des revenus des vendeurs à l'administration fiscale. Bloquant uniquement en lecture (b), et c'est un chantier, pas un correctif.
- **Impact** : Aucun impact sur la démo. Au lancement : encaisser des fonds pour des tiers sans cadre PSP/agrément serait une infraction (monopole bancaire / services de paiement) — le point le plus lourd juridiquement de tout le projet.
- **Preuve** :
  ```
  // CheckoutView.tsx:39-42
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12 / 34");
  const [cvc, setCvc] = useState("123");
  const [name, setName] = useState("Nouh Benzidane");
  // CheckoutView.tsx:169-171
  Simulation <span className="text-bone">Stripe Connect</span> — aucun
  paiement réel n'est effectué.
  ```
- **Correctif** : Rien pour la démo. Pour le lancement : intégrer un PSP marketplace (Stripe Connect / Mangopay), onboarding KYC vendeurs, cantonnement des fonds côté PSP, et process DAC7 de déclaration des revenus vendeurs. Validation avocat + PSP obligatoire avant le premier euro encaissé.
- **Effort** : L
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → AMÉLIORATION** — Tout est vérifié : CheckoutView.tsx:39-42 pré-remplit la carte de test Stripe ('4242 4242 4242 4242', exp '12 / 34', cvc '123'), le bandeau des lignes 164-177 affiche honnêtement 'Test — Simulation Stripe Connect — aucun paiement réel n'est effectué', et aucun fetch/axios/XMLHttpRequest/sendBeacon n'existe dans src/. Mais ce 'constat' n'en est pas un : son propre texte conclut 'aucune obligation LCB-FT/établissement de paiement aujourd'hui : lecture (a) rien à corriger' et 'c'est un chantier, pas un correctif'. Un item dont le contenu est 'le code est conforme par absence et honnêtement étiqueté, rien à changer' ne peut pas porter la sévérité ÉLEVÉ (= fonctionnalité cassée). La valeur résiduelle est purement documentaire pour un futur lancement (PSP marketplace type Stripe Connect/Mangopay, agent/exemption ACPR, KYC/KYB, DAC7/art. 242 bis CGI) : c'est une note de roadmap, à classer AMÉLIORATION.

### [AMÉLIORATION] Acquis vérifié : zéro cookie, zéro traceur, zéro flux tiers — pas de bandeau cookies requis pour ce build ; verrouiller cet acquis
- **Emplacement** : /Users/fouzi/solange/next.config.ts:28-35 ; src/lib/track.ts:8-12 ; src/components/chrome/AuthGate.tsx:7 ; src/app/layout.tsx:2
- **Constat** : Vérifié positivement : aucun cookie posé (grep 'cookie' sur src/ + next.config.ts : zéro), aucun script tiers ni analytics (track.ts est no-op en production), fonts Google auto-hébergées au build via next/font (aucune requête runtime vers Google — la CSP de production 'default-src self / connect-src self / font-src self' bloquerait d'ailleurs tout flux externe), et un seul localStorage technique ('solange:onboarded'), effaçable via 'Déconnexion' (profil/page.tsx:341). Conclusion : pas d'obligation de bandeau de consentement ePrivacy/CNIL pour ce build, et le flag d'onboarding relève de l'exemption 'strictement nécessaire'. Point d'attention : cet acquis saute au premier ajout d'analytics non exempté (le commentaire de track.ts prévoit 'Plausible, Segment…' — Plausible est cookieless et resterait OK, Segment non).
- **Impact** : Positif : conformité cookies/ePrivacy du build actuel. Risque uniquement si un futur ajout de traceur se fait sans CMP ni mise à jour de la CSP.
- **Preuve** :
  ```
  // next.config.ts:28-35 (production)
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    connectSrc,
    "font-src 'self'",
  ].join("; ");
  // track.ts:8-11
  export function track(event: string, props?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[track]", event, props);
  ```
- **Correctif** : Documenter la règle dans le repo : tout futur traceur doit être soit exempté CNIL (Plausible/Matomo configuré), soit derrière une CMP avec consentement préalable, et la CSP mise à jour en conséquence.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code


### Domaine 5.9 Trust & Safety, modération, social

### [MOYEN] Badge « Vendeur vérifié » affiché en dur pour 100 % des vendeurs, sans aucune donnée sous-jacente
- **Emplacement** : src/app/article/[id]/ArticleDetail.tsx:133-137 ; src/app/checkout/[id]/CheckoutView.tsx:197-200 ; src/lib/mock.ts:396-402
- **Constat** : Sur chaque fiche article et au checkout, le badge Verified et le libellé « Vendeur vérifié » sont rendus inconditionnellement, pour tout vendeur. Le type CatalogItem (mock.ts:396-402) ne possède même pas de champ `verified` : la donnée n'existe pas, le badge est du décor. Par ailleurs tous les créateurs du mock sont `verified: true` (mock.ts:64,73,88,96,594,621,642,659) : l'app entière projette « tout le monde est vérifié ». Lecture (a) démo publique : trompeur mais sans enjeu financier. Lecture (b) marketplace réelle : garantie de confiance fictive affichée à l'acheteur au moment de payer — c'est cette lecture qui rend le point bloquant.
- **Impact** : Un fraudeur qui liste un article contrefait serait affiché « Vendeur vérifié » par construction. L'acheteur paie sur la foi d'un signal de confiance que la plateforme n'a jamais établi : perte d'argent client + responsabilité de la plateforme (pratique commerciale trompeuse).
- **Preuve** :
  ```
  ArticleDetail.tsx:130-137 :
  <span className="truncate text-sm font-semibold text-bone">
    @{item.seller}
  </span>
  <Verified className="size-4 shrink-0 text-bone" />
  ...
  <span className="block text-[11px] text-ash">Vendeur vérifié · Voir la vitrine</span>
  — aucun `item.verified` n'existe : mock.ts:396-402 `export type CatalogItem = Item & { seed; category; seller; likes; span? }`. Idem CheckoutView.tsx:197-200 : `Vendu par <span>@{item.seller}</span> <Verified className="size-3 text-bone" />`.
  ```
- **Correctif** : Conditionner le badge à une vraie donnée (`item.sellerVerified` côté mock, puis à un statut KYC réel côté backend) ou le retirer tant qu'aucun processus de vérification n'existe. Ne jamais rendre un signal de confiance en dur.
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Le cœur du constat est exact et même sous-estimé : ArticleDetail.tsx:133-137 et CheckoutView.tsx:197-200 rendent <Verified/> + « Vendeur vérifié » inconditionnellement, le type CatalogItem (mock.ts:396-402) n'a aucun champ verified, et d'autres emplacements non cités font pareil (decouvrir:299, drops:186, live:168/223/360, communaute:126). L'app sait pourtant faire le gating correctement ailleurs (profil/page.tsx:156, messages/page.tsx:124+168 et CreatorHeader.tsx:45 testent bien `verified &&`) — c'est donc une vraie incohérence interne, pas juste un backend manquant. En revanche l'auditeur se trompe en affirmant « tous les créateurs du mock sont verified: true » : neige (c3, mock.ts:75-81) et yuki (c6, mock.ts:98-104) n'ont PAS le champ, et toutes deux vendent des articles du catalog (k5, k6) affichés « Vendeur vérifié » — l'erreur factuelle renforce le défaut au lieu de l'infirmer. Sévérité : le contexte établi (prototype frontend pur, paiement simulé par setTimeout avec carte de test préremplie, CheckoutView.tsx:38-40) exclut la lecture (b) « acheteur au moment de payer » sur laquelle repose l'ÉLEVÉ. En démo c'est du décor trompeur + une incohérence de modèle à corriger avant tout lancement : MOYEN.

### [MOYEN] Promesses de confiance fictives : « authentifiée », « retour 14 jours », et « Protection acheteur » facturée sans service derrière
- **Emplacement** : src/app/article/[id]/ArticleDetail.tsx:178-181 ; src/app/checkout/[id]/CheckoutView.tsx:207,332 ; src/components/feed/ShopTheLook.tsx:174 ; src/components/feed/ShopCard.tsx:136 ; src/app/article/[id]/layout.tsx:6
- **Constat** : L'UI affirme partout des garanties qui n'existent nulle part dans le code : « Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé, retour sous 14 jours » (ArticleDetail), « Protection acheteur incluse · livraison 48h » (ShopTheLook, ShopCard), et le checkout facture une ligne « Protection acheteur » (montant ajouté au total). Grep exhaustif : aucun flux d'authentification produit, aucun processus de retour, aucune page décrivant la protection, aucune CGU (grep CGU|conditions|terms|mentions légales → 0 résultat). La seule « authentification communautaire » est un thread éditorial mock (mock.ts:1175-1177, guide anti-contrefaçon Margiela). La meta description SEO (article/[id]/layout.tsx:6) répète « authentifiée... vendeur vérifié ». Lecture (a) démo : copy marketing tolérable si le site est clairement étiqueté prototype. Lecture (b) lancement réel : facturer une protection inexistante et promettre un retour 14 jours sans processus = pratique commerciale trompeuse (DGCCRF) et perte d'argent directe pour l'acheteur — bloquant dans cette lecture.
- **Impact** : Acheteur : paie un supplément « Protection acheteur » qui ne couvre rien, croit à un droit de retour qui n'existe pas, achète des pièces « authentifiées » que personne n'a examinées. Plateforme : exposition juridique (pratiques trompeuses, art. L121-2 C. conso) dès le premier litige.
- **Preuve** :
  ```
  ArticleDetail.tsx:178-181 :
  <p className="mt-6 text-[13px] leading-relaxed text-ash">
    Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé,
    retour sous 14 jours. Commission dégressive reversée au vendeur.
  </p>
  CheckoutView.tsx:207 : <Row label="Protection acheteur">{euro(protection)}</Row> (montant intégré au total, ligne 210-215).
  ```
- **Correctif** : Pour la démo : préfixer ces claims d'un marqueur prototype ou les retirer. Avant tout lancement : ne facturer la protection acheteur qu'adossée à un vrai service (séquestre/escrow, politique de litige écrite), publier CGU + politique de retour, et supprimer « authentifiée » tant qu'aucun processus d'authentification n'existe.
- **Effort** : M
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Tous les emplacements cités sont exacts : ArticleDetail.tsx:178-181 (« Pièce authentifiée par la communauté SOLANGE... retour sous 14 jours »), CheckoutView.tsx:207 (`<Row label="Protection acheteur">{euro(protection)}</Row>`, protection = 5% + 0,70 € intégrée au total ligne 47-48), CheckoutView.tsx:331-333 (« protection acheteur incluse »), ShopTheLook.tsx:174, ShopCard.tsx:135-136, layout.tsx:6 (meta SEO). Grep confirmé : zéro CGU/terms/mentions légales, zéro processus de retour (tous les hits « Retour » sont des boutons de navigation arrière), zéro flux d'authentification produit — la seule trace est le thread éditorial mock (mock.ts:1176-1178, guide Margiela). MAIS la lecture (b) qui fonde l'ÉLEVÉ (« facturer une protection inexistante... perte d'argent directe ») est contredite par le code lui-même : pay() est un setTimeout de 1700 ms, carte préremplie 4242 4242 4242 4242, aucun appel réseau, aucun euro ne quitte personne (CheckoutView.tsx:38-72). En l'état prototype, c'est de la copy de fiction produit cohérente avec le paiement simulé — à purger ou étiqueter avant tout déploiement public (la meta SEO indexable est le point le plus gênant), mais pas de pratique commerciale trompeuse effective : MOYEN.

### [MOYEN] Aucun mécanisme de signalement (annonce, contenu, utilisateur, message)
- **Emplacement** : src/ (absence globale) ; src/components/feed/ActionRail.tsx:98-134 ; src/app/article/[id]/ArticleDetail.tsx:141-176
- **Constat** : Grep exhaustif `signaler|report|flag|dénoncer|abus|harcèlement|modérat` sur src/ : zéro UI de signalement (seuls faux positifs : un commentaire CSS ActionRail.tsx:109 « the only signal » et le flag localStorage d'onboarding AuthGate.tsx:16). Le rail d'actions du feed propose like/commentaire/partage/enregistrer — pas de « Signaler ». La fiche article propose acheter/offre/enregistrer — pas de « Signaler l'annonce ». La messagerie et le chat live n'offrent rien non plus. Lecture (a) démo : acceptable (contenu 100 % éditorial contrôlé). Lecture (b) marketplace sociale réelle : obligation légale (DSA art. 16 notice-and-action pour toute plateforme UGC en UE) et exigence App Store (guideline 1.2 impose signalement + blocage pour les apps UGC) — à construire avant lancement.
- **Impact** : Au lancement : contrefaçons, arnaques, contenus haineux ou illégaux resteraient en ligne sans aucun canal de remontée ; non-conformité DSA (amendes jusqu'à 6 % du CA mondial) et rejet probable de l'app par Apple/Google.
- **Preuve** :
  ```
  ActionRail.tsx:98-124 — la liste complète des actions du feed :
  <Action label={compact(likes...)} onClick={onLike} .../>
  <Action label={compact(comments)} onClick={onComment} ariaLabel="Commentaires"/>
  <Action label={compact(shares)} ariaLabel="Partager"/>
  <Action label={saved ? "Enregistré" : "Garder"} onClick={onSave} .../>
  — aucune action de signalement. grep -rniE "signaler|dénoncer|abus|harcèlement|modérat" src/ → exit 1 (0 résultat).
  ```
- **Correctif** : Ajouter une entrée « Signaler » sur chaque objet UGC (annonce, look, commentaire, profil, message) menant à un flux notice-and-action (motif, référence de l'objet, accusé de réception), avec file de traitement côté back-office au lancement. En démo, même un stub UI documente l'intention produit.
- **Effort** : L
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Absence intégralement confirmée : grep `signaler|report|dénoncer|abus|harc|modérat|flag` sur src/ ne retourne que les deux faux positifs annoncés (commentaire CSS ActionRail.tsx:110 « the only signal », commentaire onboarding AuthGate.tsx:16). ActionRail.tsx:98-134 vérifié : les actions du feed sont like/commentaires/partager/garder, rien d'autre ; ArticleDetail.tsx:142-176 : acheter/faire une offre/enregistrer, pas de « Signaler l'annonce ». L'auditeur admet lui-même la lecture (a) « acceptable » — et c'est celle qui s'applique : tout le contenu est éditorial mock (looks, threads, chat en dur dans mock.ts), il n'existe aucun UGC réel à signaler ni personne pour recevoir un signalement. Le DSA art. 16 et la guideline App Store 1.2 s'appliqueront au lancement, pas à un prototype local. Exigence à construire avant mise en production d'un vrai flux UGC : MOYEN, pas ÉLEVÉ aujourd'hui.

### [MOYEN] Aucun blocage ni sourdine d'utilisateur, alors que la messagerie privée existe
- **Emplacement** : src/ (absence globale) ; src/app/messages/page.tsx:150-172 ; src/lib/store.tsx:38-50
- **Constat** : Grep `bloquer|block|mute|masquer` sur src/ : uniquement des classes CSS (md:block), des vidéos muted et des commentaires — aucune fonctionnalité de blocage. Le store client (store.tsx:38-50) expose like/save/follow/join/orders, rien pour bloquer ou masquer un utilisateur. L'en-tête de conversation (messages/page.tsx:150-172) n'offre aucun menu d'actions sur l'interlocuteur. Lecture (a) démo : sans objet (interlocuteurs fictifs). Lecture (b) réelle : une app sociale avec DM sans blocage expose au harcèlement sans échappatoire ; c'est aussi une exigence App Store pour les apps UGC.
- **Impact** : Un utilisateur harcelé via DM ou commentaires n'aurait aucun moyen de couper le contact ; risque de sécurité personnelle et churn immédiat des victimes ; rejet possible en review App Store.
- **Preuve** :
  ```
  store.tsx:38-50 — la surface complète du store :
  type Store = {
    isLiked(id)... toggleLike(id)... isSaved(id)... toggleSave(id)...
    isFollowing(handle)... toggleFollow(handle)... savedItems()...
    isJoined(communityId)... toggleJoin(communityId)...
    orders: Order[]; addOrder(order: Order): void;
  };
  — aucun blockedHandles / mute. grep -rniE "bloquer|mute" src → 0 hit fonctionnel.
  ```
- **Correctif** : Ajouter au store un Set `blocked` (toggleBlock(handle)) filtrant conversations, commentaires et feed, plus une entrée « Bloquer @handle » dans l'en-tête de conversation et sur les profils. Côté produit réel : persistance serveur et effet bilatéral (l'utilisateur bloqué ne peut plus écrire).
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Absence confirmée : le grep `bloquer|block|mute|masquer` ne retourne que des classes CSS (`block`, `md:block`), des vidéos `muted` et le toggle son du feed/live — zéro fonctionnalité de blocage. store.tsx:38-50 vérifié à l'identique : like/save/follow/join/orders, aucun blockedHandles/mute. messages/page.tsx:150-172 vérifié : l'en-tête de conversation (avatar, nom, badge verified, @handle) n'offre aucun menu d'actions sur l'interlocuteur. Cependant la messagerie « existe » seulement en apparence : les conversations sont des mocks en dur (mock.ts:615+), l'envoi (send(), page.tsx:69) n'alimente qu'un état local, et l'interlocuteur ne répondra jamais — aucun harcèlement n'est possible dans le prototype, comme l'auditeur le reconnaît (« lecture (a) : sans objet »). Exigence App Store/T&S réelle à construire avec le vrai backend de messagerie, non bloquante en l'état : MOYEN.

### [MOYEN] Aucune vérification d'âge ni protection des mineurs ; l'authentification se contourne par un bouton « Passer »
- **Emplacement** : src/components/chrome/AuthScreen.tsx:14-16,36 ; src/ (absence globale d'age gate)
- **Constat** : Grep `mineur|majeur|birthdate|date de naissance|18 ans|âge` : zéro age gate, zéro case de consentement, zéro CGU à accepter. L'AuthScreen documente lui-même : « Code is SIMULATED for now (shown on screen)... A "Passer" button skips auth for beta testing » — n'importe qui, y compris un mineur, entre dans une app combinant feed vidéo type TikTok, DM privés, live shopping et checkout, sans la moindre assurance d'âge. Lecture (a) démo/beta : choix assumé et documenté, acceptable. Lecture (b) lancement réel : plateforme accessible aux mineurs sans aucune mesure (DSA art. 28 impose des mesures de protection des mineurs aux plateformes en ligne ; vendre implique la capacité contractuelle) — à corriger avant lancement.
- **Impact** : Mineurs exposés aux DM d'inconnus et aux achats ; la plateforme ne peut démontrer aucune mesure de protection en cas de contrôle (ARCOM/CNIL/DSA) ; contrats de vente conclus par des incapables juridiques.
- **Preuve** :
  ```
  AuthScreen.tsx:14-16 (commentaire de tête) :
   * email → 6-digit code → access. Code is SIMULATED for now (shown on screen);
   * swapping in a real Resend email is a drop-in on `sendCode`. A "Passer" button
   * skips auth for beta testing. `onComplete` unlocks the app.
  Aucun autre écran ne demande l'âge (grep âge/mineur/majeur → 0 hit).
  ```
- **Correctif** : Avant lancement : déclaration de date de naissance minimum à l'inscription + CGU avec âge minimum, mesures spécifiques mineurs (DM restreints, pas de live commerce), et retrait du bouton « Passer ». En démo : conserver mais afficher clairement le statut prototype.
- **Effort** : L
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Faits confirmés : grep `mineur|majeur|birth|naissance|18 ans|âge|age.?gate` sur src/ → exit 1, zéro hit ; le commentaire AuthScreen.tsx:13-17 dit exactement ce que cite l'auditeur, et le bouton « Passer · accès beta test → » (AuthScreen.tsx:295-306) appelle directement onComplete(). Mais la formulation « l'authentification se contourne » surestime : il n'y a rien à contourner — le flux « complet » est lui-même factice (sendCode() génère le code côté client et l'affiche à l'écran, AuthScreen.tsx:30-41), donc même sans « Passer » aucune identité ni aucun âge n'est jamais vérifié. Le code documente ce choix (« SIMULATED for now... for beta testing »), lecture que l'auditeur qualifie lui-même d'« acceptable ». L'age gate (DSA art. 28, capacité contractuelle) est un prérequis de lancement d'une vraie plateforme sociale + marchande, pas un défaut exploitable d'un prototype sans comptes, sans paiement et sans inconnus : MOYEN (à concevoir avec la vraie auth), pas ÉLEVÉ aujourd'hui.

### [MOYEN] Messagerie : texte libre sans aucun filtre anti-fraude (IBAN, téléphone, liens, incitation au paiement hors plateforme)
- **Emplacement** : src/app/messages/page.tsx:69-77,208-224
- **Constat** : Lecture intégrale de messages/page.tsx : le composer accepte n'importe quel texte et `send()` l'appende tel quel au fil après un simple trim — on peut taper un IBAN, un numéro de téléphone, un lien externe ou « paye-moi par Lydia hors plateforme » sans détection, avertissement, masquage ni limite de fréquence. Aucun rappel « restez sur SOLANGE » n'est affiché. Lecture (a) démo : sans conséquence, les messages restent en état local et ne partent nulle part. Lecture (b) marketplace réelle : le détournement de la transaction hors plateforme est le vecteur d'arnaque n° 1 du C2C (perte de la protection acheteur + de la commission) ; un filtre + warning est un standard du secteur (Vinted, Leboncoin). C'est un garde-fou absent, pas un code défectueux.
- **Impact** : Au lancement : un fraudeur pousse l'acheteur à payer par virement direct, encaisse sans envoyer l'article ; l'acheteur perd son argent hors de tout recours, la plateforme perd sa commission et sa réputation.
- **Preuve** :
  ```
  messages/page.tsx:69-77 :
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setExtra((e) => ({
      ...e,
      [active.id]: [...(e[active.id] ?? []), { from: "me", text }],
    }));
    setDraft("");
  };
  — aucun filtre, aucune regex, aucune limite.
  ```
- **Correctif** : Au branchement d'une vraie messagerie : détection côté serveur des patterns IBAN/tél/e-mail/liens de paiement avec masquage ou interstitiel d'avertissement, bannière permanente « paiement uniquement via SOLANGE = protégé », et rate limiting. En démo, une regex client + toast d'avertissement suffit à documenter le comportement cible.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Note vendeur (4,9) et compteur de ventes affichés sans aucun système d'avis lié aux transactions
- **Emplacement** : src/lib/mock.ts:590-594 ; src/app/profil/page.tsx:167,207,333
- **Constat** : Le profil affiche `rating: 4.9`, `sales: 147` et même un cumul « {euro(me.sales * 86)} de ventes cumulées » (profil/page.tsx:333) — valeurs statiques du mock. Aucun composant de dépôt d'avis n'existe dans src/ (grep avis/review/rating : seuls hits, la valeur mock et un texte éditorial « Vos avis » mock.ts:1249) ; rien ne lie une note à une commande (le type Order de store.tsx:28-36 ne porte aucun champ d'évaluation). Lecture (a) démo : données de démonstration normales. Lecture (b) réelle : les avis post-transaction sont l'infrastructure de confiance centrale d'une C2C ; sans eux, les acheteurs n'ont aucun signal légitime, et afficher des notes non adossées à des transactions revient à fabriquer de la réputation.
- **Impact** : Au lancement : impossible d'évaluer un vendeur avant achat ; des chiffres de réputation fictifs orienteraient les décisions d'achat (avis trompeurs au sens de la directive Omnibus si présentés comme réels).
- **Preuve** :
  ```
  mock.ts:590-594 :
    followers: 8420,
    following: 312,
    sales: 147,
    rating: 4.9,
    verified: true,
  profil/page.tsx:167 : <Star filled className="size-3.5 text-bone" /> {me.rating}
  ```
- **Correctif** : Produit réel : système d'avis déclenché uniquement après une commande livrée (1 avis par transaction, réponse vendeur, signalement d'avis). Démo : conserver le mock mais prévoir le champ `reviewId` sur Order pour matérialiser le lien transaction→avis.
- **Effort** : L
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] « Vendeur vérifié · Voir la vitrine » mène au profil de l'utilisateur courant, pas à celui du vendeur
- **Emplacement** : src/app/article/[id]/ArticleDetail.tsx:118-139 ; src/app/profil/page.tsx:156-167 ; src/app/ (aucune route profil/[handle])
- **Constat** : Le bloc vendeur de chaque fiche article est un `<Link href="/profil">` : quel que soit le vendeur (@maya.curates, @theo.grail...), le clic ouvre /profil qui rend en dur l'objet `me` (« Nouh Benzidane », profil/page.tsx:156-167). Il n'existe aucune route de profil public par handle (listing de src/app : profil/ est la seule route de profil). Le bouton promet « Voir la vitrine » du vendeur et affiche autre chose : code présent défectueux, visible dès la lecture (a) démo (un testeur voit le mauvais profil et une confusion d'identité). Lecture (b) : impossible de vetter un vendeur avant achat, la brique anti-usurpation de base (page publique du vendeur avec historique) n'existe pas.
- **Impact** : Démo : parcours incohérent qui casse la crédibilité du prototype devant un investisseur/testeur. Réel : l'acheteur ne peut pas vérifier qui vend ; terrain idéal pour l'usurpation de vendeurs réputés.
- **Preuve** :
  ```
  ArticleDetail.tsx:118-122 :
  <Link
    href="/profil"
    data-cursor="link"
    className="glass mt-7 flex items-center gap-3 ..."
  >
  ... suivi ligne 131 de @{item.seller} et ligne 136 « Vendeur vérifié · Voir la vitrine ». profil/page.tsx rend `me` (ligne 156 : {me.verified && <Verified .../>}).
  ```
- **Correctif** : Créer une route mock `/profil/[handle]` rendant le créateur correspondant du mock (creators existent déjà dans mock.ts) et pointer le bloc vendeur dessus ; à défaut, retirer le libellé « Voir la vitrine ».
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Commentaires feed et chat live sans modération ; le bouton « Publier le commentaire » jette silencieusement le texte
- **Emplacement** : src/components/feed/CommentSheet.tsx:94-111 ; src/app/live/StreamsView.tsx:298-327,335-336
- **Constat** : Deux surfaces UGC de plus sans aucun pipeline : (1) le CommentSheet du feed a un composer volontairement no-op — le bouton « Publier le commentaire » exécute `onClick={() => setDraft("")}` : le texte disparaît sans feedback (choix documenté ligne 12-13 « The composer is intentionally non-submitting (mock-only) », mais l'aria-label promet une publication : micro-tromperie UX en démo). (2) Le chat live appende le texte brut sans filtre, longueur max, ni anti-flood (StreamsView.tsx:335-336). Lecture (a) : dette UX mineure. Lecture (b) : le chat d'un live commerce en temps réel exige modération automatique (mots interdits, flood, liens) et outils de modérateur — tout est à construire.
- **Impact** : Démo : un testeur croit avoir commenté, rien n'apparaît — confusion. Réel : spam et arnaques défileraient en direct devant l'audience d'un live sans aucun contrôle.
- **Preuve** :
  ```
  CommentSheet.tsx:103-107 :
  <button
    type="button"
    onClick={() => setDraft("")}
    aria-label="Publier le commentaire"
  StreamsView.tsx:335-336 :
  const send = (text: string) =>
    setMine((m) => [...m, { handle: "toi", seed: "solange-me-01", text }]);
  ```
- **Correctif** : Démo : soit faire apparaître le commentaire localement (comme le fait déjà le chat live), soit désactiver le bouton avec un tooltip « bientôt ». Réel : pipeline de modération (filtre lexical, rate limit, outils modérateur de live) avant d'ouvrir ces surfaces.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Actions sociales illimitées : aucun anti-spam sur likes/follows/joins
- **Emplacement** : src/lib/store.tsx:78-96,110-113
- **Constat** : Le store client toggle like/follow/join sans aucune limite de volume ni de fréquence. C'est attendu pour un prototype 100 % client (tout garde-fou réel serait serveur, et il n'y a pas de serveur) — constat de garde-fou absent, pas de défaut de code. Lecture (a) : sans conséquence (état local, perdu au refresh). Lecture (b) : sans rate limiting serveur, les bots de follow-spam et le like-farming gonflent artificiellement la visibilité des annonces frauduleuses.
- **Impact** : Réel uniquement : manipulation du graphe social et des signaux de popularité par des comptes automatisés, qui sert ensuite d'amplificateur aux arnaques.
- **Preuve** :
  ```
  store.tsx:93-96 :
  const toggleFollow = useCallback(
    (handle: string) => setFollowing((s) => toggle(s, handle)),
    [],
  );
  — aucun compteur, aucun plafond, aucune temporisation nulle part dans le fichier (156 lignes lues).
  ```
- **Correctif** : Rien à faire côté prototype. À l'introduction d'un backend : rate limiting par compte (follows/heure, likes/minute), détection de patterns bot, plafonds progressifs pour comptes récents.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code


### Domaine 5.10+5.11 — UX, parcours, accessibilité, design

### [ÉLEVÉ] Parcours vendeur en impasse : l'annonce « publiée » n'existe nulle part et le succès ment
- **Emplacement** : src/app/vendre/page.tsx:279-293 et 160-163
- **Constat** : Le submit de /vendre ne fait que `setListed(true)` (état local) : rien n'est écrit dans le store ni dans le catalogue. L'écran de succès affirme pourtant que la pièce « est désormais visible dans Découvrir », ce qui est faux — /decouvrir lit uniquement le mock statique via filterCatalog (src/lib/data.ts:37-41). Lecture (a) démo : promesse cassée immédiatement vérifiable par un testeur (il va dans Découvrir, ne trouve rien). Lecture (b) lancement : fonctionnalité cœur inexistante, bloquant.
- **Impact** : Le parcours n°1 d'une marketplace C2C (vendre) se termine sur un mensonge vérifiable en 2 taps ; perte de confiance du testeur/investisseur, et à fortiori de tout vrai vendeur.
- **Preuve** :
  ```
  src/app/vendre/page.tsx:280 `onClick={() => ready && setListed(true)}` puis :162-163 `{title || "Ta pièce"} est désormais visible dans Découvrir.` — aucun appel à useStore(), aucun ajout au catalogue dans tout le fichier.
  ```
- **Correctif** : Ajouter un `addListing(item)` au store (comme addOrder) et le faire lire par filterCatalog/forSale, ou reformuler le succès en démo honnête (« Simulation — l'annonce n'est pas réellement publiée »), sur le modèle du bandeau Test du checkout.
- **Effort** : M
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **confirmé** — Le code prouve intégralement le constat. Le submit ne fait que poser un booléen local, aucun import de useStore() ni aucune écriture dans un état partagé dans tout le fichier (vérifié par lecture complète + grep 'useStore|store' sur vendre/page.tsx : zéro occurrence). /decouvrir lit exclusivement le mock statique via filterCatalog (data.ts:37-66 filtre le tableau `catalog` importé de mock.ts ; grep 'catalog.push|setCatalog' sur tout src : zéro mutation nulle part). La promesse « visible dans Découvrir » est donc fausse et falsifiable en un clic par n'importe quel testeur. La sévérité ÉLEVÉ tient même en lecture démo : le codebase a déjà sa propre convention pour les actions simulées (le checkout écrit dans le store partagé et le profil l'affiche), donc ce flux est en-dessous du standard que l'app s'est elle-même fixé, et le texte de succès affirme un état interne à l'app que l'app contredit.

### [ÉLEVÉ] /creer : même impasse — le post « parti dans le feed » n'apparaît jamais dans le feed
- **Emplacement** : src/app/creer/page.tsx:249-252 et 375-385
- **Constat** : Le CTA « Publier le look » ne fait que `setPublished(true)` local. Le succès annonce « {titre} est parti dans le feed « Pour toi » et chez tes abonnés », mais le feed (looks de src/lib/mock.ts) n'est jamais modifié. Le bouton « Dépose une vidéo ou des photos » (ligne 99) n'a ni onClick ni input file : zéro feedback au clic. Lecture (a) : promesse cassée vérifiable ; lecture (b) : bloquant.
- **Impact** : Le second parcours de création (contenu social) est une coquille : l'utilisateur retourne au feed et ne retrouve jamais son post ; le drop média mort casse la crédibilité dès le 1er clic.
- **Preuve** :
  ```
  src/app/creer/page.tsx:250-252 `{title.trim() || "Ton post"} est parti dans le feed « Pour toi » et chez tes abonnés.` ; :99 `<button className="flex aspect-[16/7]…">` sans onClick ni <input type="file">.
  ```
- **Correctif** : Injecter le post dans un tableau `userLooks` du store consommé par FeedModeShell, ou étiqueter honnêtement la simulation ; donner un comportement (même simulé) au drop média.
- **Effort** : M
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **confirmé** — Identique au constat 1, prouvé ligne par ligne. Le CTA ne fait que `setPublished(true)` local (ligne 376), aucun import de store dans le fichier, et le feed lit les `looks` statiques de mock.ts. Le texte de succès (lignes 250-252) affirme une diffusion dans le feed qui n'a jamais lieu. Le bouton médias ligne 99 est bien un <button> sans onClick, sans <input type="file">, sans aria-disabled : zéro feedback au clic (seul un hover CSS). Même la note sous le CTA (lignes 391-397) répète la promesse « part dans le feed ». Promesse fausse vérifiable en un clic → ÉLEVÉ justifié pour un flux cœur, y compris en lecture démo.

### [ÉLEVÉ] « Faire une offre » ouvre une conversation avec le MAUVAIS vendeur pour 12 articles sur 17
- **Emplacement** : src/app/messages/page.tsx:28-37 et 61-63
- **Constat** : `threadForItem` retombe sur `conversations[0]` (thread de maya.curates sur le manteau Margiela) quand ni l'itemSeed ni le vendeur n'ont de conversation mock. Or les conversations ne couvrent que 5 vendeurs/articles (mock.ts:619-694 : k2-k6) ; les 12 autres pièces — dont toutes celles de lou.archive et nouh.archive (mock.ts:405-421) — injectent le message d'offre pré-rédigé dans le thread d'une autre personne, sous un bandeau produit qui affiche un autre article. Vérifiable en un clic depuis la fiche k1 (veste Acne, vendeur lou.archive).
- **Impact** : L'utilisateur croit négocier la veste Acne avec son vendeur ; il « envoie » l'offre à maya.curates dans un thread sur un manteau Margiela. Incohérence flagrante en démo ; en réel, ce serait une fuite d'intention d'achat au mauvais destinataire.
- **Preuve** :
  ```
  src/app/messages/page.tsx:33-36 `conversations.find((c) => c.itemSeed === item.seed) ?? conversations.find((c) => c.handle === item.seller) ?? conversations[0]` puis :62 `item && targetConv ? { [targetConv.id]: [offerMessage(item)] } : {}`.
  ```
- **Correctif** : Supprimer le fallback `conversations[0]` : créer un thread neuf à la volée pour le vendeur de l'article (nom/handle/itemSeed corrects), même éphémère.
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **confirmé** — Le mécanisme est prouvé mot pour mot et le défaut est réel, mais le décompte de l'auditeur est faux : ce sont 7 articles sur 17, pas 12. Le fallback intermédiaire `conversations.find((c) => c.handle === item.seller)` — que l'auditeur cite lui-même puis oublie dans son comptage — route correctement 5 des 12 pièces sans thread dédié vers le BON vendeur (k7, k14 → samir.fits ; k9, k12 → maya.curates ; k10 → theo.grail), avec pour seul défaut un bandeau produit qui affiche un autre article. Le cas réellement « mauvaise personne » (chute sur conversations[0] = thread Margiela de maya.curates) concerne les 7 pièces dont le vendeur n'a aucune conversation : k1, k8, k15 (lou.archive) et k11, k13, k16, k17 (nouh.archive — qui est en plus le handle de l'utilisateur courant, me.handle mock.ts:586 : on injecte une offre sur ses propres pièces dans le thread de maya). La repro citée (k1, veste Acne, lou.archive → thread maya.curates) est exacte et k1 est la première pièce du catalogue, en tuile span. 7/17 = 41 % du catalogue qui envoie un message d'offre pré-rédigé à une personne sans rapport, sous un bandeau produit erroné : fonctionnalité cassée, ÉLEVÉ maintenu malgré le chiffre corrigé.

### [MOYEN] Commande payée : aucune trace après refresh, et le succès promet une notification vendeur qui n'existe pas
- **Emplacement** : src/lib/store.tsx:71-75 ; src/app/checkout/[id]/CheckoutView.tsx:120-126 ; src/app/profil/page.tsx:211
- **Constat** : L'ordre est stocké en useState pur (`const [orders, setOrders] = useState<Order[]>([])`) — pas de localStorage contrairement au flag d'onboarding. Après F5, « Mes commandes » disparaît entièrement du profil (section conditionnée à `orders.length > 0`). Le succès checkout affirme en plus « Le vendeur @… a été notifié — expédition sous 48h » : rien n'est notifié. Lecture (a) : un testeur qui rafraîchit croit avoir perdu sa commande ; lecture (b) : perte de la preuve d'achat = bloquant absolu.
- **Impact** : Rupture du contrat implicite post-paiement : l'utilisateur qui vient de « payer » 269,90 € ne peut plus rien retrouver ; anxiété maximale sur le parcours le plus sensible.
- **Preuve** :
  ```
  src/lib/store.tsx:71 `const [orders, setOrders] = useState<Order[]>([]);` ; CheckoutView.tsx:124-125 `Le vendeur <span className="text-bone">@{item.seller}</span> a été notifié — expédition sous 48h.` ; profil/page.tsx:211 `{orders.length > 0 && (`.
  ```
- **Correctif** : Persister `orders` en localStorage (le pattern existe déjà dans AuthGate) ; reformuler la notification vendeur en langage de simulation tant qu'aucun backend n'existe.
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Tous les faits sont exacts : orders en useState pur (store.tsx:71), le flag d'onboarding est lui bien persisté en localStorage (AuthGate.tsx:24,34 — l'asymétrie pointée est réelle), la section « Mes commandes » disparaît après F5 (profil/page.tsx:211), et la notification vendeur est fabriquée (CheckoutView.tsx:124-125). Mais la sévérité ÉLEVÉ est exagérée dans le contexte établi. (1) Contrairement aux constats 1-2, ce flux FONCTIONNE en session : addOrder écrit dans le store partagé et le profil affiche la commande — le contrat interne du prototype est respecté. (2) La non-persistance est une décision de design documentée dans l'en-tête même du store (« No persistence, no backend (mock-only) ») et s'applique uniformément aux likes/saves/follows ; isoler les commandes comme bloquantes revient à reprocher au prototype son périmètre assumé. (3) Le même flux porte un bandeau explicite « Test — aucun paiement réel n'est effectué » (CheckoutView:163-172), qui désamorce à la fois la panique du testeur après refresh et l'allégation de notification. (4) La lecture « lancement = perte de preuve d'achat » suppose qu'on shippe ce store en prod, alors que data.ts documente la couture backend qui le remplacera. Garde-fou absent, non-bloquant en lecture démo → MOYEN.

### [MOYEN] Signaux de confiance fabriqués : « Vendeur vérifié » pour tous, « authentifiée », « retour 14 jours » sans aucun dispositif
- **Emplacement** : src/app/article/[id]/ArticleDetail.tsx:133-137 et 178-181 ; src/app/checkout/[id]/CheckoutView.tsx:197-200, 331-334
- **Constat** : La fiche article affiche le badge Verified et « Vendeur vérifié · Voir la vitrine » inconditionnellement pour chaque vendeur (aucun test d'un flag `verified`), plus « Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé, retour sous 14 jours ». Le checkout répète « protection acheteur incluse ». Aucun de ces dispositifs n'existe. Lecture (a) démo : acceptable car bandeau « Test » présent au checkout (CheckoutView:164-172) — mais la fiche article, elle, n'a aucun disclaimer. Lecture (b) lancement : allégations trompeuses au sens DGCCRF/pratiques commerciales — bloquant.
- **Impact** : En démo : un investisseur attentif voit que TOUT vendeur est « vérifié », signal gadget. Lancé tel quel : promesses contractuelles (retour 14 j, protection) juridiquement engageantes sans aucun back-office pour les tenir.
- **Preuve** :
  ```
  ArticleDetail.tsx:133 `<Verified className="size-4 shrink-0 text-bone" />` (rendu sans condition) ; :179-181 `Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé, retour sous 14 jours. Commission dégressive reversée au vendeur.`
  ```
- **Correctif** : Conditionner le badge à un vrai champ `verified` du vendeur ; déplacer les promesses (retour, protection, authentification) derrière un flag « démo » ou les retirer tant que le dispositif n'existe pas.
- **Effort** : S
- **Bloquant** : Oui
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Les faits sont tous exacts et même un peu plus nets que ne le dit l'auditeur : le type CatalogItem (mock.ts:399+) n'a AUCUN champ `verified` — le badge ne pourrait donc pas être conditionnel — alors que le mock modélise bien ce concept ailleurs (me.verified mock.ts:594, Conversation.verified mock.ts:605), preuve d'un vrai trou de modélisation. Le badge (ArticleDetail:133), la mention « Vendeur vérifié » (:136), le paragraphe « authentifiée / retour 14 jours » (:178-181) et « protection acheteur incluse » (CheckoutView:331-333) sont rendus inconditionnellement, et la fiche article n'a effectivement aucun disclaimer (lecture complète du fichier). Mais la sévérité ÉLEVÉ repose entièrement sur la lecture « lancement » (DGCCRF), alors que le contexte établi est un prototype pur : tous les vendeurs sont des personas fictifs, aucune transaction réelle n'existe, et le seul endroit où un engagement pourrait se concrétiser (le paiement) porte le bandeau « Test — aucun paiement réel ». L'auditeur concède lui-même que la lecture démo est « acceptable ». Du copy de confiance statique dans une maquette est un item de checklist pré-lancement (à conditionner à un vrai flag + dispositifs réels avant toute mise en prod), pas une fonctionnalité cassée du livrable actuel → MOYEN.

### [MOYEN] Navigation mobile amputée : Favoris inaccessibles, /drops orphelin total, Messages cachés
- **Emplacement** : src/components/chrome/MobileTabBar.tsx:27-32 ; src/components/chrome/SideNav.tsx:14-23
- **Constat** : La tab bar mobile n'expose que Feed/Marché/Commu/Profil + compose. Grep exhaustif : /favoris n'a AUCUN lien dans l'app hors SideNav (desktop only) — sur mobile, les pièces « Enregistrées » via le cœur sont introuvables (l'onglet « Aimés » du profil affiche une autre liste statique, voir finding dédié). /messages n'est atteignable sur mobile que via « Faire une offre » d'une fiche. /drops n'est référencé par AUCUN lien interne, ni desktop ni mobile : page morte à 61 routes générées.
- **Impact** : L'action « Garder » (mise en avant dans l'ActionRail du feed) est un cul-de-sac sur mobile : l'utilisateur enregistre des pièces qu'il ne peut jamais revoir. Une page entière (Drops) est du travail invisible.
- **Preuve** :
  ```
  MobileTabBar.tsx:28-31 : items = Feed, /decouvrir, /communaute, /profil uniquement. `grep -rn 'href="/favoris' src` → 0 résultat ; `grep -rn '"/drops' src --include="*.tsx"` → 0 lien.
  ```
- **Correctif** : Ajouter Favoris et Messages (ou un hub « Activité ») à la tab bar mobile ou au profil ; lier /drops depuis le feed/SideNav ou supprimer la page.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Contrôles interactifs morts : commentaire « publié » silencieusement jeté, Partager inerte, CTA Premium sans effet, recherches décoratives
- **Emplacement** : src/components/feed/CommentSheet.tsx:103-110 ; src/components/feed/ActionRail.tsx:122-124 ; src/components/ui/PlanCards.tsx:63-73 ; src/app/messages/page.tsx:94-98
- **Constat** : Quatre contrôles cliquables ne font rien : (1) le bouton « Publier le commentaire » exécute `onClick={() => setDraft("")}` — il EFFACE la saisie de l'utilisateur sans la publier ni afficher quoi que ce soit ; (2) l'action « Partager » de l'ActionRail n'a pas de onClick ; (3) les CTA payants de /premium (`{plan.cta}`) n'ont aucun handler — le funnel d'upsell poussé depuis /vendre (« 0 € avec Premium ») se termine sur un bouton mort ; (4) la recherche de conversations (messages:94-98) est un input sans state ni filtrage. Incohérent avec le reste de l'app qui simule des succès (vendre, checkout).
- **Impact** : Perte de saisie silencieuse (le pire pattern UX : l'utilisateur tape 3 lignes, clique, tout disparaît) ; funnel monétisation en impasse ; érosion de confiance à chaque clic sans feedback.
- **Preuve** :
  ```
  CommentSheet.tsx:105 `onClick={() => setDraft("")}` avec aria-label="Publier le commentaire" ; ActionRail.tsx:122 `<Action label={compact(shares)} ariaLabel="Partager">` (pas de prop onClick) ; PlanCards.tsx:64 `disabled={plan.id === "free"}` — bouton payant actif sans onClick.
  ```
- **Correctif** : Commentaire : append local dans le thread (le pattern `extra` de messages existe déjà) ; Partager : navigator.share ou copie de lien ; Premium : au minimum un état simulé « Bientôt disponible » ; recherche : filtrer la liste ou retirer le champ.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Clavier : media du feed non focusable, FilterDrawer modal sans focus trap ni Escape, pas de skip-link
- **Emplacement** : src/components/feed/FeedCard.tsx:155-158 ; src/components/ui/FilterDrawer.tsx:82-90 ; src/app/layout.tsx:83-95
- **Constat** : La couche tap du feed (pause/lecture + double-tap like) est un `<div onClick>` sans role, tabIndex ni handler clavier : ces gestes sont inaccessibles au clavier (RGAA 7.3 / WCAG 2.1.1). Le FilterDrawer déclare `role="dialog" aria-modal="true"` mais n'a ni focus trap, ni déplacement du focus à l'ouverture, ni fermeture Escape (aucun keydown dans le fichier — alors que SideNav:36-38 et MobileTabBar:39-46 gèrent Escape) ; le CommentSheet n'a même pas role=dialog. Aucun lien d'évitement « aller au contenu » dans le layout. À noter en positif : focus-visible global (globals.css:156-159), aria-label/aria-pressed répandus, useReducedMotion dans 8 composants.
- **Impact** : Un utilisateur clavier ne peut pas mettre en pause une vidéo du feed ; ouvrir les filtres l'enferme visuellement (aria-modal) sans piéger réellement le focus, qui continue de circuler dans la page masquée.
- **Preuve** :
  ```
  FeedCard.tsx:155-158 `<div data-cursor="media" onClick={onMediaClick} className="absolute inset-0">` ; FilterDrawer.tsx:83-85 `role="dialog" aria-modal="true" aria-label="Filtres avancés"` — aucun addEventListener/onKeyDown dans les 246 lignes du fichier.
  ```
- **Correctif** : Bouton pause dédié focusable dans FeedCard ; focus trap + Escape + restauration du focus dans FilterDrawer et CommentSheet (ou <dialog> natif) ; skip-link vers <main>.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Onglet « Aimés » du profil déconnecté du store : deux vérités contradictoires sur les favoris
- **Emplacement** : src/lib/data.ts:74-76 ; src/app/profil/page.tsx:136 et 324 ; src/app/favoris/page.tsx:47-48
- **Constat** : `liked()` renvoie la liste statique `savedItems` du mock, tandis que /favoris lit `useStore().savedItems()` (réactif). Résultat : l'utilisateur enregistre une pièce (cœur), elle apparaît dans /favoris mais PAS dans l'onglet « Aimés » de son profil, qui affiche une liste figée différente. Deux écrans censés montrer la même collection divergent.
- **Impact** : Incohérence visible en 3 taps dans la démo ; l'utilisateur doute de ce que le cœur fait réellement.
- **Preuve** :
  ```
  data.ts:74-76 `export function liked(): CatalogItem[] { return savedItems; }` vs favoris/page.tsx:47-48 `const { savedItems } = useStore(); const saved = savedItems();` ; profil/page.tsx:136 `const likedItems = liked();`.
  ```
- **Correctif** : Faire lire l'onglet Aimés depuis `useStore().savedItems()` et supprimer `liked()` de data.ts (ou la brancher sur le store).
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Tous les profils tiers mènent au profil de l'utilisateur : cliquer « @maya.curates » affiche « Nouh B »
- **Emplacement** : src/app/decouvrir/page.tsx:283-285 ; src/app/favoris/page.tsx:105-108 ; src/app/article/[id]/ArticleDetail.tsx:118-121
- **Constat** : Il n'existe pas de page profil public par vendeur : chaque lien vers un créateur/vendeur (résultats de recherche Profils, vendeurs suivis dans Favoris, bloc « Voir la vitrine » de la fiche article) est un `href="/profil"` codé en dur — la page personnelle de l'utilisateur courant. Cliquer sur le vendeur @maya.curates ouvre le profil « Nouh B » avec SES stats et SES annonces.
- **Impact** : Navigation mensongère au cœur du modèle social : impossible d'inspecter un vendeur avant d'acheter ; en démo, l'incohérence nom cliqué ≠ page affichée saute aux yeux.
- **Preuve** :
  ```
  ArticleDetail.tsx:118-121 `<Link href="/profil" … >` sous le libellé « Vendeur vérifié · Voir la vitrine » ; decouvrir/page.tsx:284 `href="/profil"` sur chaque résultat profil.
  ```
- **Correctif** : Route dynamique `/profil/[handle]` alimentée par le mock (créateurs + leurs pièces via forSale par handle), le profil courant restant /profil.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Checkout sans adresse de livraison : on facture « Livraison suivie 4,90 € » sans jamais demander où livrer
- **Emplacement** : src/app/checkout/[id]/CheckoutView.tsx:245-298
- **Constat** : Le formulaire de paiement ne contient que 4 champs carte (numéro, expiration, CVC, nom). Aucune étape adresse/transporteur alors que le récapitulatif facture une ligne « Livraison suivie » (ligne 208) et que le succès promet « expédition sous 48h ». Lecture (a) : crédibilité de la démo entamée pour quiconque connaît un checkout e-commerce ; lecture (b) : parcours d'achat inopérable, bloquant.
- **Impact** : Le flux le plus scruté par un investisseur (paiement) saute une étape universelle du modèle mental e-commerce ; impossible à expédier en réel.
- **Preuve** :
  ```
  CheckoutView.tsx:245 `<Field label="Numéro de carte">` … :289 `<Field label="Nom sur la carte"` — aucun champ adresse dans le composant ; :208 `<Row label="Livraison suivie">{euro(shipping)}</Row>`.
  ```
- **Correctif** : Ajouter une étape adresse (même pré-remplie en mode démo, comme la carte 4242) avant le paiement.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Micro-typographie systémique : 43 occurrences de 9px, labels de formulaire 9px, Déconnexion sous le seuil de contraste
- **Emplacement** : src/app/vendre/page.tsx:15-19 ; src/app/checkout/[id]/CheckoutView.tsx:368 ; src/app/profil/page.tsx:345 ; src/app/globals.css:194-199
- **Constat** : Grep : 43× `text-[9px]` + 31× `text-[10px]`. Les labels des formulaires critiques (Vendre, Checkout) sont en 9px uppercase avec letter-spacing 0.32em (.overline) — en-deçà de toute taille lisible recommandée pour des étiquettes de champ. Le bouton « Déconnexion » (seul moyen de reset l'onboarding) est en 12px `text-ash/70` : #8a8782 à 70 % sur #0b0b0c ≈ 3,4:1, sous le seuil WCAG 1.4.3 (4,5:1). Les text-ash pleins passent (≈5,5:1 sur noir, ≈4,8:1 en thème clair), le problème est concentré sur les variantes /70, /60 et bone/40 utilisées sur du texte porteur de sens.
- **Impact** : Lisibilité dégradée pour basse vision et sur mobile en plein soleil ; les labels 9px des formulaires touchent les deux parcours transactionnels.
- **Preuve** :
  ```
  vendre/page.tsx:17 `<span className="overline mb-2 block text-[9px] text-ash">` (tous les labels du formulaire) ; profil/page.tsx:345 `className="text-[12px] text-ash/70 underline-offset-4…"` ; globals.css:197 `letter-spacing: 0.32em;`.
  ```
- **Correctif** : Remonter le plancher des labels de formulaire à 11-12px ; réserver 9px aux ornements non porteurs de sens ; interdire ash/bone sous /85 sur du texte interactif.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Cibles tactiles sous 44px sur les contrôles de filtrage principaux (Chips ~32px)
- **Emplacement** : src/components/ui/Chip.tsx:21-26 ; src/components/ui/FilterDrawer.tsx:128 ; src/app/favoris/page.tsx:71
- **Constat** : Le composant Chip (catégories, tailles, états, marques — le contrôle de filtrage le plus utilisé) fait `px-4 py-1.5 text-[13px]` ≈ 31-32px de haut, comme les boutons de tri du FilterDrawer et les onglets de /favoris. L'app connaît pourtant le standard : les tabs de /decouvrir ont `min-h-11` (44px, decouvrir/page.tsx:180) et le save de ProductCard étend sa zone via `before:-inset-2` (ProductCard.tsx:77). Application inégale.
- **Impact** : Taux d'erreur de tap accru sur mobile précisément sur les grappes de chips serrées (gap-2) ; incohérence interne du design system.
- **Preuve** :
  ```
  Chip.tsx:22 `"whitespace-nowrap rounded-none border px-4 py-1.5 text-[13px]…"` vs decouvrir/page.tsx:180 `"min-h-11 whitespace-nowrap px-2 py-2.5…"`.
  ```
- **Correctif** : `min-h-11` (ou before:-inset étendu) sur Chip et les boutons de tri/onglets.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Design system solide mais deux choix desktop discutables : scrollbars supprimées partout et curseur natif masqué
- **Emplacement** : src/app/globals.css:147-152 et 169-172 ; src/components/chrome/CustomCursor.tsx:39-64
- **Constat** : Positif d'abord : tokens dark/light complets avec color-scheme, focus-visible global, prefers-reduced-motion coupant toutes les animations CSS (globals.css:422-439), useReducedMotion dans 8 composants, thème forcé cohérent sur le feed. En face : `::-webkit-scrollbar { width: 0 }` supprime la scrollbar sur TOUTES les pages (y compris les longues listes Découvrir/Journal — perte de l'affordance et du grab-scroll) et `cursor: none !important` remplace le curseur natif par un anneau à ressort qui, lui, n'honore pas prefers-reduced-motion (le spring ringX/ringY reste actif).
- **Impact** : Sur desktop, perte de repères de position dans les pages longues ; le curseur custom en retard peut gêner les utilisateurs sensibles au mouvement ou en précision réduite.
- **Preuve** :
  ```
  globals.css:169-172 `::-webkit-scrollbar { width: 0px; height: 0px; }` ; :148-151 `html.cursor-ready, html.cursor-ready * { cursor: none !important; }` ; CustomCursor.tsx:36-37 `useSpring(x, { stiffness: 320, damping: 28… })` sans check reduced-motion.
  ```
- **Correctif** : Scrollbar fine stylée plutôt que supprimée ; désactiver le CustomCursor (garder le curseur natif) sous prefers-reduced-motion.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] metadataBase pointe vers solange.app, domaine vraisemblablement non possédé
- **Emplacement** : src/app/layout.tsx:36
- **Constat** : `metadataBase: new URL("https://solange.app")` sert de base aux canonical/OG de toutes les pages. Si le domaine n'appartient pas au projet (aucune preuve de propriété dans le repo), tous les og:url et canonical pointeront vers un domaine tiers au premier déploiement. Le reste des metadata est bon : OG/twitter images générées, manifest, icons, per-page titles.
- **Impact** : Canonical/OG erronés au déploiement réel ; sans gravité tant que le projet reste un prototype local.
- **Preuve** :
  ```
  layout.tsx:36 `metadataBase: new URL("https://solange.app"),` — la propriété du domaine n'est pas vérifiable depuis le code.
  ```
- **Correctif** : Basculer sur le vrai domaine (ou une env var NEXT_PUBLIC_SITE_URL) avant tout déploiement public.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Suspicion à investiguer

### [AMÉLIORATION] Onboarding : le code démo est bien traité, mais la « connexion » ne crée aucune identité
- **Emplacement** : src/components/chrome/AuthScreen.tsx:254-260 ; src/components/chrome/AuthGate.tsx:32-39
- **Constat** : Bon point : le code 6 chiffres affiché à l'écran est explicitement étiqueté « Démo · ton code : » dans une pilule dédiée, le bouton « Passer · accès beta test → » est visible et honnête, le champ code a un aria-label et l'écran respecte useReducedMotion. Limite : que l'on saisisse zoe@test.fr ou qu'on passe, l'app affiche ensuite le même profil « Nouh B » — l'email collecté est jeté (seul `solange:onboarded=1` est stocké). Un testeur qui entre SON email s'attend à voir une trace de lui.
- **Impact** : Dissonance légère en démo (l'écran d'accueil promet une personnalisation que le profil dément) ; aucune gravité fonctionnelle.
- **Preuve** :
  ```
  AuthGate.tsx:34 `localStorage.setItem(ONBOARD_KEY, "1");` — l'email de AuthScreen n'est jamais transmis ni stocké ; profil/page.tsx affiche `me` statique du mock.
  ```
- **Correctif** : Stocker l'email/pseudo saisi et l'afficher sur /profil (localStorage suffit en démo).
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code


### Domaine 5.12+5.13+5.14 — Performance, qualité de code, observabilité/ops

### [MOYEN] Aucune CI/CD : lint, tests et build ne sont exécutés nulle part automatiquement
- **Emplacement** : /Users/fouzi/solange (racine — .github absent), package.json:5-11
- **Constat** : Le repo n'a aucun dossier .github, aucun vercel.json/netlify.toml/Dockerfile, aucun pipeline. Les scripts lint/test/build existent mais rien ne les impose : un commit qui casse le build ou les 15 tests part sur main sans alerte. Lecture (a) démo publique : gênant mais tolérable. Lecture (b) vraie marketplace : à corriger avant lancement — aucune garantie que ce qui est déployé compile, passe les tests ou est linté.
- **Impact** : Régressions silencieuses possibles sur main ; aucun garde-fou qualité avant déploiement ; déploiement manuel non reproductible.
- **Preuve** :
  ```
  $ ls .github → "NO .github" ; $ ls vercel.json netlify.toml Dockerfile → aucun fichier. package.json:5-11 : "scripts": { "dev": "next dev", "build": "next build", "start": "next start", "lint": "eslint", "test": "vitest run" } — définis mais jamais orchestrés.
  ```
- **Correctif** : Ajouter un workflow GitHub Actions minimal (install → lint → vitest run → next build) déclenché sur push/PR, puis brancher le déploiement (Vercel/Netlify) dessus.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → MOYEN** — Chaque fait avancé est exact et j'ai même trouvé des éléments aggravants que l'auditeur n'a pas cités : aucun .github, aucun vercel.json/netlify.toml/Dockerfile/.vercel/.netlify, aucun fichier .yml/.yaml dans tout le repo hors node_modules, et pas non plus de husky/lint-staged/pre-commit (aucun garde-fou local non plus). Les 15 tests existent bien (7 dans commission.test.ts + 8 dans filter.test.ts) et rien ne les exécute. MAIS la sévérité ÉLEVÉ correspond à la lecture (b) 'vraie marketplace' que l'auditeur lui-même qualifie de conditionnelle ('avant lancement'), alors que le contexte établi est la lecture (a) : prototype frontend pur, données mock, non déployé (zéro config de déploiement, README : 'Backend, real DB, payments... intentionally out of scope'). ÉLEVÉ = fonctionnalité cassée ; ici rien n'est cassé et rien n'est déployé — un main rouge ne casse rien pour personne. Le constat reste réel et non trivial (remote GitHub partagé entre deux fondateurs, tests et lint existants que rien n'impose), donc MOYEN : sous-optimal mais fonctionnel, garde-fou absent non-bloquant en lecture démo.

### [MOYEN] next/image jamais utilisé : toutes les images servies brutes, jusqu'à 576 Ko par JPEG
- **Emplacement** : src/components/ui/Photo.tsx:31-37, src/components/feed/KenBurnsMedia.tsx:84-93, next.config.ts:44-47, public/img/ (4,7 Mo)
- **Constat** : Grep "next/image" sur src : 0 occurrence. Toute l'app passe par des <img> bruts (Photo.tsx, KenBurnsMedia, CarouselMedia, ShopCard…), avec eslint-disable @next/next/no-img-element en tête de fichier. Le bloc images: { formats: ["image/avif", "image/webp"] } de next.config.ts est donc du code mort. Les JPEG du carrousel pèsent jusqu'à 576 Ko pièce (public/img/carousel : 2,4 Mo pour 6 images) et sont servis pleine taille sans srcset ni conversion AVIF/WebP. À décharge : le lazy loading et fetchPriority sont gérés à la main correctement (loading={active ? "eager" : "lazy"}, fetchPriority={active ? "high" : "auto"}, decoding="async").
- **Impact** : Poids réseau 3-5x supérieur au nécessaire sur mobile ; LCP dégradé sur connexion lente ; le budget data d'un visiteur 4G part dans des JPEG non compressés modernes.
- **Preuve** :
  ```
  src/components/ui/Photo.tsx:1 + 31-35 : /* eslint-disable @next/next/no-img-element */ … <img src={src} alt={alt} draggable={false} loading={eager ? "eager" : "lazy"} … >. $ grep -rn "next/image" src | wc -l → 0. $ ls -la public/img/carousel : prada2.jpg = 576 136 octets, prada1.jpg = 497 458 octets.
  ```
- **Correctif** : Soit migrer les surfaces lourdes (carrousel, catalogue) vers next/image avec sizes adaptés, soit pré-optimiser les assets (AVIF/WebP + redimensionnement ~1080px, ex. squoosh/sharp en script) en gardant les <img>. La 2e option préserve le pattern fallback de Photo.tsx.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] CarouselMedia : le calque flouté charge toutes les slides en eager, court-circuitant le lazy loading
- **Emplacement** : src/components/feed/CarouselMedia.tsx:46-60
- **Constat** : Chaque slide rend la même image deux fois : un <img> flouté de fond SANS attribut loading (donc eager par défaut) et le héros object-contain qui, lui, est loading={i === 0 ? "eager" : "lazy"}. Le lazy du héros est donc inopérant : dès que la carte carrousel entre dans la fenêtre inView du feed, le calque flouté déclenche le téléchargement des 6 JPEG Prada (~2,4 Mo) d'un coup, même si l'utilisateur ne swipe jamais.
- **Impact** : ~2,4 Mo téléchargés d'avance pour un seul post du feed ; pénalise exactement le scénario mobile que le gating inView du feed cherche à éviter.
- **Preuve** :
  ```
  src/components/feed/CarouselMedia.tsx:46-58 : <img src={src} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full scale-110 object-cover blur-2xl …" /> (pas d'attribut loading) puis <img src={src} … loading={i === 0 ? "eager" : "lazy"} …/>.
  ```
- **Correctif** : Ajouter loading={i === 0 ? "eager" : "lazy"} (et decoding="async") sur le <img> flouté, identique au héros — même src, le navigateur ne fera qu'une requête par slide, au bon moment.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] /live : 3 vidéos en autoplay simultané dans la grille, sans gating de visibilité
- **Emplacement** : src/app/live/StreamsView.tsx:49-61 et 143, src/lib/mock.ts:1015+ (3 streams live: true)
- **Constat** : StreamVideo pose autoPlay sur chaque <video> et StreamCard en rend une par stream live (3 dans le mock : l1.mp4 908 Ko, l3.mp4 796 Ko, l4.mp4 692 Ko ≈ 2,4 Mo). preload={eager ? "auto" : "metadata"} est présent mais autoPlay force de toute façon le téléchargement et le décodage : 3 boucles vidéo décodent en continu dès l'arrivée sur la page, y compris hors viewport. Contraste avec le feed principal, qui gate correctement (FeedCard.tsx:150 rend un panneau noir hors fenêtre ±1, KenBurnsMedia preload="metadata" piloté par active/paused).
- **Impact** : Data et batterie mobiles consommées inutilement ; décodage vidéo x3 permanent sur la page /live ; ne scalerait pas au-delà du mock (N streams = N vidéos décodées).
- **Preuve** :
  ```
  src/app/live/StreamsView.tsx:49-57 : <video ref={ref} src={src} poster={poster} muted loop playsInline autoPlay preload={eager ? "auto" : "metadata"} …/> ; ligne 143 : <StreamVideo src={stream.video} poster={stream.poster} seed={stream.seed} /> rendu par carte de live.map().
  ```
- **Correctif** : Gater play/pause par IntersectionObserver (même pattern que VideoFeed.tsx:21-32) ou ne jouer que la carte survolée/visible, poster statique pour les autres.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] npm audit : 7 vulnérabilités (6 high, 1 moderate) — sharp/libvips et postcss via Next 16.2.9
- **Emplacement** : package.json:16 (next 16.2.9), node_modules/sharp, node_modules/postcss
- **Constat** : npm audit remonte sharp <0.35.0 (CVE-2026-33327/33328/35590/35591 hérités de libvips, high) et postcss (sourceMappingURL, moderate), tous transitifs via Next/Tailwind. Exposition réelle limitée dans les deux lectures : next/image n'est jamais utilisé (sharp ne traite aucune image fournie par un utilisateur) et postcss ne tourne qu'au build sur des sources maîtrisées. Le fix officiel est next@16.3.3 (hors range déclaré).
- **Impact** : Dette de sécurité dormante ; deviendrait une vraie surface d'attaque le jour où next/image ou des uploads utilisateur sont introduits (roadmap marketplace).
- **Preuve** :
  ```
  Sortie npm audit du 2026-08-28 : "sharp <0.35.0 / Severity: high / sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 … fix available … Will install next@16.3.3" ; "7 vulnerabilities (1 moderate, 6 high)".
  ```
- **Correctif** : Monter next et eslint-config-next à 16.3.3 (npm install next@16.3.3 eslint-config-next@16.3.3), relancer build + tests, re-vérifier npm audit.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [MOYEN] Tests : seuls commission et filtres sont couverts ; la math d'argent du checkout et le store ne le sont pas
- **Emplacement** : src/lib/__tests__/ (2 fichiers), src/app/checkout/[id]/CheckoutView.tsx:47-49, src/lib/store.tsx
- **Constat** : Les 15 tests existants couvrent commissionRate/commission (paliers dégressifs, arrondis) et filterCatalog/similarTo — bien écrits, avec cas limites de bornes. Mais l'autre moitié de la math d'argent, côté acheteur, n'a aucun test : protection = Math.round(price * 0.05) + 0.7 arrondit à l'euro entier AVANT d'ajouter 0,70 (un choix non trivial, non documenté, non verrouillé), et le total qui en découle est affiché sur le bouton Payer. Le store client (likes/saves/follows/orders, src/lib/store.tsx, 155 l.) et le flux AuthGate/AuthScreen n'ont aucun test non plus. Lecture (b) : la logique qui deviendra la facturation réelle n'a pas de filet.
- **Impact** : Une régression sur le calcul du total acheteur ou sur le store passerait inaperçue (aucune CI par ailleurs) ; risque direct d'affichage de prix faux le jour du branchement paiement réel.
- **Preuve** :
  ```
  src/app/checkout/[id]/CheckoutView.tsx:47-49 : const protection = Math.round(price * 0.05) + 0.7; // Vinted-style buyer protection / const shipping = 4.9; / const total = Math.round((price + protection + shipping) * 100) / 100;. $ find src -name "*.test.ts*" → uniquement src/lib/__tests__/filter.test.ts et src/lib/__tests__/commission.test.ts.
  ```
- **Correctif** : Extraire la math du checkout (protection/shipping/total) dans src/lib/utils.ts à côté de commission() et la tester (bornes, arrondis) ; ajouter un test du reducer de store (toggleLike/order). Les tests E2E (checkout, onboarding) peuvent attendre le vrai backend.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Code mort : ProductHotspots.tsx (143 lignes) n'est importé nulle part
- **Emplacement** : src/components/feed/ProductHotspots.tsx
- **Constat** : ProductHotspots est l'ancienne implémentation des pins shoppables (hover/timer anti-flicker), supersédée par ShopHotspots (86 l., pilotée par active + reduced-motion) qui est celle que FeedCard importe. Grep sur tout src : aucun import de ProductHotspots. Le README le liste pourtant encore dans la structure (section components/feed/). C'est la seule duplication réelle trouvée : ShopTheLook (drawer) / ShopCard (carte boutique) / ShopFeed ont des rôles distincts, pas de doublon.
- **Impact** : Poids de maintenance et confusion (deux composants au nom quasi identique, un seul vivant) ; risque de patcher le mauvais fichier.
- **Preuve** :
  ```
  $ grep -rln "ProductHotspots" src --include="*.tsx" (hors le fichier lui-même) → aucun résultat ; ShopHotspots → importé par src/components/feed/FeedCard.tsx (ligne 191 : <ShopHotspots products={look.products} active={active && !paused} onSelect={openShop} />).
  ```
- **Correctif** : Supprimer src/components/feed/ProductHotspots.tsx et retirer sa mention du README.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] README périmé : polices, nombre de routes et roadmap ne correspondent plus au code
- **Emplacement** : README.md:34 (fonts), README.md sections What's built / Structure / Next candidates
- **Constat** : Le README annonce "Archivo (wordmark)" alors que layout.tsx:2 charge Montserrat + Bodoni Moda + Hanken Grotesk (commit 9199bc9 "wordmark SOLANGE en Montserrat"). Il annonce "Ten connected routes" alors qu'il y a 16 pages (checkout, live, journal, communauté… absentes de la liste). La section "Next candidates" liste "Product detail page · auth / onboarding · checkout" comme à venir alors que ArticleDetail, AuthScreen/AuthGate et CheckoutView existent. Aucune section déploiement ; aucune variable d'env à documenter (il n'y en a réellement aucune — cohérent avec le prototype offline).
- **Impact** : Première impression trompeuse pour un investisseur/dev qui ouvre le repo ; le document vend moins que ce qui est construit.
- **Preuve** :
  ```
  README.md:34 : | Fonts | Archivo (wordmark) · Bodoni Moda (Didone editorial) · Hanken Grotesk (UI) | — vs src/app/layout.tsx:2 : import { Montserrat, Bodoni_Moda, Hanken_Grotesk } from "next/font/google"; $ find src/app -name page.tsx | wc -l → 16.
  ```
- **Correctif** : Mettre à jour fonts, liste des routes (16), retirer du "Next candidates" ce qui est livré, ajouter 3 lignes de déploiement (build statique → Vercel/Netlify, zéro env var).
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Fichiers > 500 lignes : mock.ts (1352) et StreamsView.tsx (532)
- **Emplacement** : src/lib/mock.ts (1352 l.), src/app/live/StreamsView.tsx (532 l.)
- **Constat** : Deux fichiers dépassent le seuil de 500 lignes. mock.ts concentre looks, catalog, creators, conversations, streams, plans — assumé comme single source du dataset mock, mais sa taille rend chaque merge/edit risqué. StreamsView.tsx mélange 6 sous-composants (StreamVideo, StreamCard, UpcomingRow, ChatRow, viewer plein écran…). Les autres gros fichiers (FeedCard 423, creer 405, decouvrir 401) restent sous le seuil.
- **Impact** : Navigabilité et reviews dégradées ; conflits git plus probables sur mock.ts, qui est le fichier le plus édité par nature.
- **Preuve** :
  ```
  $ find src -name "*.ts*" | xargs wc -l | sort -rn | head : 1352 src/lib/mock.ts / 532 src/app/live/StreamsView.tsx / 423 src/components/feed/FeedCard.tsx …
  ```
- **Correctif** : Scinder mock.ts par domaine (mock/looks.ts, mock/catalog.ts, mock/streams.ts… ré-exportés par mock.ts pour ne casser aucun import) ; extraire StreamVideo + le viewer plein écran de StreamsView.
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [FAIBLE] Lanceur grand-public versionné : kill -9 aveugle du port 3000 et bind 0.0.0.0
- **Emplacement** : "▶ DÉMARRER SOLANGE.command" et "⚠️ LISEZ-MOI — NE PAS SUPPRIMER.txt" (racine, trackés par git)
- **Constat** : Les deux fichiers sont un onboarding soigné pour le co-fondateur non technique (double-clic → install → build → open) : l'intention est bonne et rien de sensible ne fuit (seule l'URL GitHub https://github.com/FouziGit/solange y figure). Deux réserves : le script tue en kill -9 TOUT processus qui écoute le port 3000 (y compris un autre projet Next en cours), et il expose le serveur en -H 0.0.0.0 sur le LAN sans le signaler autrement que "même Wi-Fi". Dans un repo destiné à devenir public/professionnel, ces fichiers à emoji en racine détonnent aussi dans la première impression.
- **Impact** : Un dev qui double-clique perd sans préavis un autre serveur local sur :3000 ; app exposée à tout le réseau local (acceptable pour la démo iPhone, à connaître) ; bruit en racine du repo.
- **Preuve** :
  ```
  ▶ DÉMARRER SOLANGE.command : lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null … npx next start -H 0.0.0.0 -p 3000. $ git ls-files → les deux fichiers sont bien versionnés.
  ```
- **Correctif** : Restreindre le kill aux process node/next (ou demander confirmation), et à terme déplacer ces deux fichiers dans un dossier demo/ ou les remplacer par un vrai déploiement hébergé partageable.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code

### [AMÉLIORATION] Observabilité zéro : analytics no-op en production et aucun monitoring d'erreurs
- **Emplacement** : src/lib/track.ts:8-12 ; grep sentry/datadog/logrocket/bugsnag → 0 occurrence
- **Constat** : Le seam analytics track() est un no-op assumé en production (il ne logge qu'en dev) et n'est branché que dans 3 fichiers (DropsView, ArticleDetail, ShopTheLook). Aucun SDK de monitoring d'erreurs (Sentry ou autre) nulle part. Lecture (a) démo : acceptable, c'est documenté comme un seam. Lecture (b) lancement réel : on volerait à l'aveugle — un checkout cassé chez les utilisateurs serait indétectable, aucune métrique d'usage, aucun rapport d'erreur client.
- **Impact** : Impossible de détecter une panne côté client, de mesurer l'usage ou de diagnostiquer un incident en production.
- **Preuve** :
  ```
  src/lib/track.ts:8-12 : export function track(event: string, props?: Record<string, unknown>) { if (process.env.NODE_ENV !== "production") { console.debug("[track]", event, props); } } — commentaire en tête : "Fires nothing in production." Grep sentry|logrocket|datadog|bugsnag sur src + package.json : 0 résultat.
  ```
- **Correctif** : Avant tout lancement : brancher le seam track() sur un provider réel (Plausible/PostHog) et ajouter @sentry/nextjs (error boundary global déjà en place dans src/app/error.tsx, il n'expose que error.digest — bon support pour la corrélation).
- **Effort** : M
- **Bloquant** : Non
- **Statut** : Confirmé dans le code
- **Contre-vérification (Phase 2)** : **déclassé ÉLEVÉ → AMÉLIORATION** — Factuellement irréprochable : src/lib/track.ts:8-12 est cité au caractère près, le commentaire d'en-tête dit bien 'Fires nothing in production', track() n'est branché que dans les 3 fichiers cités (4 call sites : DropsView x2, ArticleDetail x1, ShopTheLook x1), et grep sentry|datadog|logrocket|bugsnag|posthog|amplitude|mixpanel sur src + package.json + next.config.ts → 0 résultat. Mais ÉLEVÉ repose entièrement sur la lecture (b) 'lancement réel' — le scénario 'un checkout cassé chez les utilisateurs serait indétectable' est inapplicable : il n'y a ni checkout réel (paiement simulé, checkout_start est un event sur un flux mock), ni backend, ni utilisateurs en production, ni même de déploiement. Dans le contexte établi (prototype démo), le code fait exactement ce qu'un prototype doit faire : un seam délibéré et documenté ('Swap this body for a real provider (Plausible, Segment…) without touching callers'), ce que l'auditeur concède lui-même en lecture (a) : 'acceptable, c'est documenté comme un seam'. Il ne s'agit donc pas d'un défaut du code actuel mais d'un prérequis de lancement futur dont l'architecture anticipe déjà la résolution (remplacer un corps de fonction) → AMÉLIORATION, à réévaluer en ÉLEVÉ uniquement si un lancement réel est décidé.

### [AMÉLIORATION] Boilerplate create-next-app résiduel dans public/ et config images inerte
- **Emplacement** : public/next.svg, vercel.svg, file.svg, globe.svg, window.svg ; next.config.ts:44-47
- **Constat** : Les 5 SVG du template Next (next.svg, vercel.svg, file.svg, globe.svg, window.svg) ne sont référencés par aucun fichier de src (grep : 0 occurrence chacun) et le bloc images: { formats: ["image/avif", "image/webp"] } ne sert à rien tant que next/image n'est utilisé nulle part. À noter côté hygiène : zéro TODO/FIXME/HACK dans src, zéro console.log résiduel (seul console.debug de track.ts, gaté hors production), catch silencieux tous documentés et légitimes (clipboard, localStorage, video.play) — propre.
- **Impact** : Poids et bruit négligeables ; uniquement de la finition de repo.
- **Preuve** :
  ```
  $ for s in next.svg vercel.svg file.svg globe.svg window.svg; do grep -rl "$s" src | wc -l; done → 0 pour les cinq. next.config.ts:45-47 : images: { formats: ["image/avif", "image/webp"] } avec 0 usage de next/image dans src.
  ```
- **Correctif** : Supprimer les 5 SVG ; supprimer le bloc images de next.config.ts ou le conserver seulement si la migration next/image (finding dédié) est retenue.
- **Effort** : S
- **Bloquant** : Non
- **Statut** : Confirmé dans le code


---

## 5. Ce qui manque (gap analysis)

Garde-fous et fonctionnalités attendus d'une marketplace sociale, **absents par construction** (aucun code à corriger — tout est à créer). C'est la liste de chantier du vrai lancement.


**5.1+5.2 Authentification, sessions, contrôle d'accès & IDOR**
- Système de comptes réel : inscription, identité serveur, sessions révocables (cookies httpOnly), multi-appareils
- Vérification email effective : OTP généré/stocké/vérifié côté serveur avec expiration et rate limiting (l'email saisi est aujourd'hui jeté)
- Notion de rôles et permissions : acheteur / vendeur / modérateur / admin inexistante dans tout le code
- Contrôle de propriété des ressources : mes messages, mes commandes, mes annonces vs ceux des autres — tout est un utilisateur unique mock « me »
- Cloisonnement des données privées hors du bundle statique : API authentifiée filtrée par utilisateur (RLS) au lieu de mock compilé
- Anti-abus : rate limiting sur tentatives de code, détection bots, verrouillage de compte
- Récupération de compte (mot de passe/magic link perdus) et suppression de compte (droit RGPD art. 17)

**5.3+5.6+5.7 — Injections/XSS, uploads, secrets/dépendances/headers**
- Aucun pipeline d'upload de médias : les boutons photo de /vendre et /creer sont factices — validation MIME/taille, strip EXIF/GPS (RGPD) et re-encodage serveur entièrement à construire pour un lancement réel
- Aucune sanitisation serveur du contenu UGC (annonces, commentaires, messages, chat live) : la sûreté XSS repose à 100% sur l'auto-échappement React côté client, sans seconde ligne de défense
- CSRF, CORS et rate-limiting sans objet aujourd'hui (zéro API, zéro cookie de session) mais indispensables dès le premier endpoint backend
- Aucune gestion de secrets outillée (pas de .env.example, pas de scan pre-commit type gitleaks) — sain aujourd'hui car zéro secret, à cadrer avant toute intégration Stripe/Supabase
- Aucune CI d'audit de dépendances (npm audit, Dependabot/Renovate) : les 7 vulns actuelles n'ont été vues par personne
- Aucune configuration d'hébergement fixant les en-têtes en production (HSTS notamment) ni de politique frame-ancestors anti-clickjacking

**5.4+5.5 Paiements, logique financière, concurrence**
- Statut d'inventaire (disponible/réservé/vendu) et réservation d'article pendant le checkout — absents, double vente garantie en conditions réelles
- Machine à états des commandes (payée → expédiée → livrée → litige/remboursée) — absente, badge « Payé » codé en dur
- Recalcul serveur autoritaire des montants (prix, protection, commission, total) — tout est dérivé côté client du mock
- Flux d'annulation/remboursement et gestion des litiges acheteur-vendeur — absents
- Séquestre/escrow réel : la « répartition Stripe Connect » n'est qu'un affichage, aucun versement vendeur ni logique de déblocage à la livraison
- Idempotence/déduplication des commandes — addOrder empile sans contrôle, re-achat illimité du même article
- Persistance des commandes — perdues au refresh (useState en mémoire)
- Reçu/facture, TVA, et obligations KYC vendeur (Stripe Connect onboarding, LCB-FT) — absents du parcours

**5.8 Conformité légale FR/UE**
- Pages légales complètes : mentions légales (LCEN), CGU, CGV, politique de confidentialité, page contact — rien n'existe
- Mécanisme de signalement DSA (notice-and-action), point de contact, modération et traçabilité des vendeurs professionnels (art. 30)
- Information précontractuelle consommateur (L.221-5 c. conso) et droit de rétractation 14 jours réellement outillé avant toute vente
- Statut d'encaissement marketplace : PSP type Stripe Connect/Mangopay, KYC/KYB vendeurs, LCB-FT via le PSP, cantonnement des fonds
- Déclaration DAC7 / art. 242 bis CGI des revenus des vendeurs (obligation des plateformes C2C type Vinted)
- Vérification d'âge / âge minimum CGU et protection des mineurs (DSA art. 28, RGPD art. 8)
- Outillage RGPD au lancement : registre des traitements, procédure d'exercice des droits (accès/effacement), DPO à évaluer
- Qualification juridique des 'ventes aux enchères' annoncées dans l'offre Premium (courtage aux enchères électronique vs enchères publiques réglementées)
- Bandeau 'démo — aucune transaction réelle' global + noindex tant que le build est une démo publique
- AVERTISSEMENT : ceci est une alerte technique issue d'un audit de code, pas un avis juridique — un avocat (e-commerce/plateformes/RGPD) est requis avant tout lancement réel, en particulier pour les CGU/CGV, le statut de paiement et la conformité DSA

**5.9 Trust & Safety, modération, social**
- Aucun mécanisme de signalement d'annonce, de contenu, de profil ou de message (obligation DSA art. 16 et exigence App Store pour app UGC)
- Aucun blocage/sourdine d'utilisateur malgré la messagerie privée
- Aucune modération humaine ou automatisée des annonces, commentaires, threads communauté et chat live (aucune file, aucun back-office)
- Aucune détection d'incitation au paiement hors plateforme (IBAN/tél/liens) dans la messagerie
- Aucun système d'avis/notations lié aux transactions (les notes affichées sont des constantes mock)
- Aucun processus réel de vérification vendeur (KYC) ni d'authentification produit derrière les badges et les claims
- Aucune vérification d'âge ni mesure de protection des mineurs (auth contournable par « Passer »)
- Aucune limite anti-spam sur follows/likes/commentaires
- Aucune CGU, charte communautaire, politique de retour ou page légale dans tout le site
- Aucun profil vendeur public consultable (route unique /profil rendant l'utilisateur courant) — impossible de vetter un vendeur avant achat
- Aucun mécanisme anti-usurpation d'identité (unicité/vérification des handles, marques déposées)

**5.10+5.11 — UX, parcours, accessibilité, design**
- Aucun état « vendu » : la « Pièce unique » reste achetable à l'infini, y compris ses propres articles (k11/k13/k16/k17 appartiennent à me.handle et affichent « Acheter »)
- Pas de page profil public par vendeur (/profil/[handle]) — le graphe social n'a qu'un seul nœud réel
- Aucun signalement/blocage de contenu ou d'utilisateur, aucune trace de modération (attendu sur un feed social C2C)
- Aucun flux litige/remboursement/preuve de remise derrière la « protection acheteur » facturée 5 %
- Pas d'adresse de livraison ni de choix transporteur au checkout
- Aucune persistance des actions utilisateur (likes, follows, messages envoyés, commandes) au-delà de la session — seul le flag d'onboarding survit au refresh
- Pas d'avis/notation vendeur fonctionnels (rating statique du mock) ni d'historique de transactions
- Pas de skip-link « aller au contenu » ni de gestion de focus à l'ouverture des sheets (CommentSheet, ShopTheLook)
- i18n absente : app monolingue FR câblée en dur (lang="fr", aucun framework de messages) — à acter si le marché visé dépasse la France
- Aucun onboarding produit après l'AuthScreen (pas d'explication du switch Feed/Boutique ni des gestes du feed)

**5.12+5.13+5.14 — Performance, qualité de code, observabilité/ops**
- Aucune CI/CD (lint, tests, build, déploiement automatisé)
- Aucun monitoring d'erreurs client (Sentry ou équivalent) ni analytics actif en production
- Aucune configuration d'hébergement versionnée (vercel.json/netlify.toml/Dockerfile) ni environnement de staging
- Pas de pipeline d'optimisation d'images (next/image inutilisé, pas de srcset/AVIF, pas de CDN)
- Aucun test E2E des parcours critiques (onboarding, checkout, vente) ni test du store client
- Pas de budget performance ni de vérification Lighthouse/Web Vitals automatisée
- Pas de logging structuré ni de piste d'audit (attendu pour une marketplace manipulant des transactions)

---

## 6. Quick wins (fort impact, effort S)

| # | Correction | Impact | Où |
|---|---|---|---|
| 1 | Neutraliser le champ carte : `readOnly` + suppression des `autoComplete="cc-*"` | Plus aucun risque qu'un visiteur tape/autofill sa vraie carte | `CheckoutView.tsx` |
| 2 | Bandeau global permanent « Prototype de démonstration — aucune vente réelle » | Toutes les promesses fictives deviennent honnêtes d'un coup | `layout.tsx` |
| 3 | Page `/mentions-legales` + lien pied de page | Conformité LCEN de base (faire valider par avocat) | nouvelle page |
| 4 | Corriger le mapping article→vendeur de « Faire une offre » | Fin du bug mauvais vendeur (12/17) | `ArticleDetail.tsx` |
| 5 | `npm install next@16.3.3` puis `npm audit` | 7 vulnérabilités → 0 (fix direct disponible) | `package.json` |
| 6 | Retirer les offres JSON-LD (`Offer`/`price`) du HTML | Google n'indexe plus de fausses offres commerciales | pages article |
| 7 | Arrondi du taux de commission affiché (3,5 % ≠ « 4 % ») | Cohérence des chiffres montrés | `CheckoutView.tsx` |
| 8 | CI GitHub Actions : lint + test + build sur push | Le repo public cesse d'accepter du code cassé | `.github/workflows` |

---

## 7. Plan d'action priorisé

### (a) Avant toute mise en ligne de la démo — effort total ≈ 1-2 jours
1. Quick wins 1 à 7 ci-dessus.
2. Étiqueter les impasses : `/vendre` et `/creer` affichent « Démo — la publication réelle arrive » au lieu d'un faux succès (ou : brancher la création au store client, effort M).
3. « Vendeur vérifié » : retirer le badge ou le remplacer par un badge neutre « Profil démo ».
4. Persister le store (commandes/likes/follows) en `localStorage` pour que « Paiement réussi » survive au refresh (S/M).

### (b) Juste après la mise en ligne — ≈ 1-2 semaines
- `next/image` sur tout le catalogue (JPEG jusqu'à 576 Ko servis bruts) ; gating des 3 autoplay de `/live` ; fix du calque eager de `CarouselMedia`.
- Navigation mobile : rendre Favoris et Messages accessibles, décider du sort de `/drops` (orphelin).
- Accessibilité : focus trap + Escape sur FilterDrawer, cibles tactiles ≥ 44 px sur les Chips, remonter la micro-typo 9 px, feed pilotable au clavier.
- Profils tiers réels (cliquer @maya.curates ne doit plus afficher le profil de « me ») ; onglet « Aimés » branché au store ; adresse de livraison au checkout.
- Tests sur la math d'argent du checkout et le store ; nettoyage code mort (`ProductHotspots.tsx`), README à jour, `metadataBase` sur un domaine possédé.

### (c) Moyen terme — le vrai produit (≈ 3-6 mois, projet backend)
1. **Socle** : base de données + API authentifiée (Supabase/Postgres avec RLS, ou équivalent) ; les données privées ne transitent plus jamais par le bundle statique.
2. **Auth réelle** : sessions serveur httpOnly, OTP généré/vérifié côté serveur (RNG crypto, expiration, rate limit), suppression du bouton « Passer ».
3. **Paiement** : Stripe Connect (ou Mangopay/Lemonway) — l'app ne touche jamais l'argent ni les cartes ; webhooks signés + idempotents ; KYC vendeurs (LCB-FT). **Avis d'avocat requis** sur le statut d'intermédiaire.
4. **Intégrité** : statut disponible/réservé/vendu transactionnel (anti double-vente), machine à états des commandes, escrow et calendrier de versement.
5. **Trust & Safety / DSA** : signalement d'annonce et d'utilisateur, blocage, modération (contrefaçons), filtre anti-paiement-hors-plateforme dans la messagerie, avis liés aux transactions, vérification d'âge.
6. **RGPD** : registre des traitements, droit à l'effacement vs conservation légale des transactions, politique de confidentialité — **avec un avocat**.
7. **Ops** : monitoring d'erreurs (Sentry), analytics réels, logs, backups testés, health checks, plan de rollback.

---

## 8. Tableau de bord

| Domaine | CRITIQUE | ÉLEVÉ | MOYEN | FAIBLE | AMÉLIO. | Total |
|---|---|---|---|---|---|---|
| 5.1+5.2 Authentification, sessions, contrôle d'accès & IDOR | 0 | 0 | 2 | 2 | 1 | 5 |
| 5.3+5.6+5.7 — Injections/XSS, uploads, secrets/dépendances/headers | 0 | 0 | 3 | 2 | 2 | 7 |
| 5.4+5.5 Paiements, logique financière, concurrence | 0 | 0 | 4 | 4 | 1 | 9 |
| 5.8 Conformité légale FR/UE | 0 | 0 | 4 | 2 | 2 | 8 |
| 5.9 Trust & Safety, modération, social | 0 | 0 | 8 | 2 | 0 | 10 |
| 5.10+5.11 — UX, parcours, accessibilité, design | 0 | 3 | 9 | 3 | 1 | 16 |
| 5.12+5.13+5.14 — Performance, qualité de code, observabilité/ops | 0 | 0 | 6 | 4 | 2 | 12 |
| **Total (après contre-vérification)** | **0** | **3** | **36** | **19** | **9** | **67** |

> **Note de lecture.** La contre-vérification a déclassé la majorité des ÉLEVÉ initiaux : dans un prototype assumé sans backend, « garde-fou absent » n'est pas « faille exploitable » — le même constat redevient bloquant au moment du vrai lancement. Les 3 ÉLEVÉ restants sont des défauts réels du code actuel, confirmés ligne par ligne.
>
> **Limites de cet audit** : réalisé en statique (lecture de code + build) ; pas de test de charge, pas de pentest dynamique sur une instance déployée, pas d'audit RGAA outillé complet. Les points juridiques (LCEN, DSA, LCB-FT, RGPD) sont des alertes techniques et organisationnelles, **pas un avis juridique** — consulter un avocat avant lancement commercial.
