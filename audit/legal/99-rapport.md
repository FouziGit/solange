# Rapport de mission — cadre juridique de SOLANGE

<!-- CE RAPPORT REND COMPTE D'UN TRAVAIL DE RÉDACTION, PAS D'UN CONSEIL
     JURIDIQUE. Aucun des documents produits n'est final avant relecture
     par un avocat. -->

Objet : doter Solange d'un cadre juridique complet, protecteur pour
l'exploitant et **exact**. Rien n'a été inventé pour combler un trou :
37 mentions `[À COMPLÉTER]` en attestent, listées dans
[99-a-completer.md](99-a-completer.md).

## Ce qui a été trouvé (Phase 0)

L'état des lieux, tiré du code et non d'une intention, a mis à jour cinq
problèmes de fond :

1. **La politique de confidentialité publiée était fausse.** Elle
   affirmait ne collecter que « l'email de connexion ». Le service stocke
   depuis des adresses de livraison, des conversations privées, des
   photos et vidéos, des abonnements push et des signalements. Une
   politique inexacte est en soi un manquement au RGPD (art. 12 et 13).
2. **Aucune acceptation n'existait nulle part.** On créait un compte et
   on passait une commande sans rien accepter, et rien n'était enregistré.
   En cas de litige, l'exploitant ne pouvait démontrer l'opposabilité
   d'aucune condition.
3. **Les mentions légales ne désignaient aucune entité juridique** — un
   « projet porté par » deux personnes, qui restaient donc personnellement
   exposées.
4. **Les documents n'étaient atteignables que depuis le profil.** Un
   visiteur ne les rencontrait jamais.
5. **La Plateforme arbitre les litiges et automatise le cycle de vente**,
   ce qui rendait indéfendable une revendication d'hébergeur passif.

## Ce qui a été livré

| Phase | Livrable                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | [00-faits.md](00-faits.md) — relevé exhaustif : 15 espaces de stockage, un seul tiers sortant (Resend), aucun analytics, un seul cookie, aucun contrôle d'âge, aucun système d'avis, aucun fonds détenu |
| 1     | [01-architecture.md](01-architecture.md) — sept documents, chacun adossé à une obligation ou un risque constaté ; liste explicite des clauses que la rédaction s'interdit                               |
| 2     | `legal/` — sept documents, ~8 000 mots                                                                                                                                                                  |
| 3     | Intégration produit : acceptation prouvable, documents atteignables                                                                                                                                     |
| 4     | Vérification croisée, ce rapport, et [99-a-completer.md](99-a-completer.md)                                                                                                                             |

### Les sept documents

`mentions-legales` · `cgu` · `cgv` · `confidentialite` · `cookies` ·
`charte-moderation` · `mineurs`

Trois partis pris méritent d'être signalés :

- **Le paiement simulé est dit en tête des CGV** (article 2), pas en note
  de bas de page. Le régime du paiement réel vit dans un **article 12
  daté et non applicable** : le jour de la bascule, il suffira d'y
  inscrire une date et de notifier, sans réécrire les CGV.
- **Aucun bandeau de cookies.** Il n'y a aucun traceur : un bandeau
  ferait croire à un choix inexistant. Une page d'information le dit, et
  prévoit par écrit ce qui se passera si un outil de mesure est ajouté un
  jour — « y compris une solution présentée comme sans cookie ».
- **La qualification d'opérateur de plateforme en ligne est assumée**,
  pas contournée. Elle coûte quelques obligations d'information ; elle
  évite de bâtir la défense sur un statut que le produit dément.

### Intégration produit (Phase 3)

- Deux cases **distinctes et non pré-cochées** à l'inscription :
  conditions d'une part, déclaration d'âge de l'autre. Recueillies
  **avant** l'envoi du code.
- **La version enregistrée est celle du serveur.** Le client dit
  « j'accepte », il ne dit pas « j'accepte la version 7 » — sinon il
  suffirait d'envoyer un grand nombre pour ne plus jamais revoir l'écran.
- **Écran de réacceptation** : tous les comptes existants n'ayant jamais
  rien accepté y passent une fois. Il ne se ferme pas d'un geste, mais
  laisse deux issues honnêtes — lire les documents, ou se déconnecter.
- **Acceptation des CGV à la commande**, horodatée **sur la commande** :
  elle reste valable si les CGV changent ensuite.
- **Page `/informations-legales`** + sept routes, liées depuis le profil
  **et** depuis l'écran d'inscription, atteignables **sans compte** —
  l'`AuthGate` laisse passer ces routes, sans quoi les liens de la case
  d'acceptation ne menaient nulle part. Ajoutées au sitemap.
- Le texte est lu depuis `legal/*.md` au rendu : **une seule source**
  (D-033). Un micro-analyseur Markdown maison (14 tests) plutôt qu'une
  dépendance : l'entrée n'est jamais du contenu membre, et la sortie est
  un arbre que React rend en éléments — aucune injection possible par
  construction. Les commentaires de réserve du source sont retirés au
  rendu.

## Ce que la vérification croisée a corrigé (Phase 4)

Sept affirmations que j'avais écrites étaient **fausses au regard du
code**. Elles ont été corrigées dans le sens de la réalité, jamais
l'inverse.

| Document               | Affirmation initiale                                                              | Réalité constatée                                                                         |
| ---------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| charte art. 2          | « Vous êtes informé de la suite donnée » à votre signalement                      | `report.mts` notifie les administrateurs, **jamais** le signalant                         |
| charte art. 5          | « Toute mesure vous est notifiée dans le service et par courriel, avec le motif » | Faux pour trois mesures sur quatre. Le **bannissement ne déclenche rien du tout**         |
| charte art. 6          | Contestation « depuis le service ou par courriel »                                | Aucun bouton n'existe : le courriel est la seule voie                                     |
| CGU art. 10            | « Notification motivée » de toute mesure                                          | Même écart ; renvoyé au tableau de la charte                                              |
| confidentialité art. 2 | Collecte d'une « photo de profil » et d'une « biographie »                        | Ni l'une ni l'autre n'existent : l'avatar est **composé à partir du pseudonyme**          |
| confidentialité art. 7 | Rectification « depuis votre profil »                                             | `settings.mts` ne gère que l'ouverture des messages privés — aucun écran de rectification |
| cookies art. 3         | Stockage local des « membres bloqués et préférences d'affichage »                 | Ces choix sont **côté serveur**, rattachés au compte                                      |

J'ai également retiré de mes propres mentions légales un complément
d'adresse et un code postal que j'avais écrits pour Netlify **sans les
avoir vérifiés** : ils sont désormais marqués `[À COMPLÉTER]`.

Deux écarts sont **assumés et écrits tels quels** plutôt que maquillés,
parce que les corriger supposait de toucher au code fonctionnel, hors du
périmètre fixé : l'absence de notification du bannissement (D1) et
l'affichage de marques de transporteurs sans accord commercial (D6). Tous
deux sont en priorité haute dans `99-a-completer.md`.

## Vérifications faites

| Vérification                                                 | Résultat                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Liens internes des sept documents                            | 7/7 pointent vers une route existante                                                 |
| Registre « vous » dans les documents (D-032)                 | aucun tutoiement résiduel                                                             |
| Fuite des commentaires de réserve vers le lecteur            | aucune, sur les 7 pages                                                               |
| Case d'inscription : email valide seul                       | bouton **bloqué**                                                                     |
| Case d'inscription : une seule case cochée                   | bouton **bloqué**                                                                     |
| Case d'inscription : les deux cases                          | bouton ouvert                                                                         |
| Visiteur sans compte ni onboarding sur `/cgu`                | document lisible, écran d'inscription **non** affiché                                 |
| **PROD** — inscription sans acceptation                      | **400** « Tu dois accepter les conditions… »                                          |
| **PROD** — cases envoyées en chaîne de caractères (`"true"`) | **400** — le serveur ne se paie pas de mots                                           |
| **PROD** — une seule case                                    | **400**                                                                               |
| **PROD** — `/api/legal/accept` sans session                  | **401** (endpoint nouveau : prouve que le bundle déployé est bien celui de ce commit) |
| Tests                                                        | **110** (+29)                                                                         |
| Build, lint, TypeScript                                      | verts, 0 erreur                                                                       |

**Ce qui n'a PAS été exercé, et pourquoi.** Le refus d'une commande sans
acceptation des CGV n'a pas pu être vérifié de bout en bout en
production : la barrière d'authentification répond **401** avant que la
règle CGV ne soit atteinte, et créer une session réelle aurait supposé
d'envoyer un code par courriel à la boîte de Nouh puis de le lui
réclamer. La règle est couverte par tests unitaires (dont un qui vérifie
qu'accepter le socle ne vaut **pas** acceptation des CGV) et par lecture
du code, où le contrôle précède la création de la commande. **À faire
confirmer par un achat réel.**

L'écran de réacceptation n'a pas davantage été exercé avec une session
réelle, pour la même raison. Sa logique est couverte par 10 tests.

## Ce qu'il reste à faire

Le détail est dans [99-a-completer.md](99-a-completer.md). Les quatre
points **bloquants** :

1. **Identité juridique de l'exploitant** (forme, raison sociale, SIREN,
   siège). Sans elle, les mentions légales restent invalides et les deux
   porteurs sont personnellement exposés. C'est le point le plus
   important de tout le chantier.
2. **Directeur de la publication.**
3. **Âge minimum** : le produit affiche **18 ans**, valeur par défaut
   prudente que j'ai posée pour ne pas livrer une case vide. Elle n'a pas
   été validée. Un seul endroit à changer (`src/lib/legal.ts`).
4. **Adresse postale exacte de Netlify**, à relever à la source.

Aucun de ces quatre points n'a bloqué la rédaction : les sept documents
sont complets et intégrés, ils portent leurs `[À COMPLÉTER]` en évidence.

## Réserve

Ces documents sont des **projets**. Ils n'ont pas été relus par un
avocat. Chaque fichier source porte, en commentaire invisible pour le
lecteur, la mention de cette réserve et, le cas échéant, les articles
appelant une relecture prioritaire — au premier rang desquels
l'intervention de la Plateforme en litige (CGV art. 9), la limitation de
responsabilité (CGU art. 9) et la qualification retenue.
