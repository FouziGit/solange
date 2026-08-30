# Matrice écran × six états

Légende : ✓ couvert (fichier) · ✓* couvert par ce lot (E4) · — non applicable
(justifié) · ✗ manquant, consigné pour un lot suivant.

| Écran | Chargement | Vide | Erreur | Partiel | Succès | Hors-ligne |
|---|---|---|---|---|---|---|
| **Looks** (`/`) | — (mock instantané ; posts serveur s'ajoutent sans jank, cartes off-screen = panneau noir `FeedCard:150`) | — (le fil mock n'est jamais vide) | ✗ posts serveur : échec silencieux assumé (`VideoFeed` — le fil reste complet) ; à annoncer si les posts deviennent la source principale | ✓ posts filtrés par blocage (`VideoFeed`) | ✗ tampon « Publié » relié au feed : Phase 4 | — (contenu déjà chargé) |
| **Marché** (`/decouvrir`) | — (catalogue seed statique, rendu immédiat) | ✓ résultat 0 + suggestions (`decouvrir/page.tsx`, conservé) | ✗ échec `/api/products` silencieux — les annonces membres disparaissent sans message ; consigné | ✓ annonces membres injectées quand elles arrivent, badge Vendu (`ProductCard`) | — | ✗ idem erreur |
| **Article** (`/article/[id]`) | — (SSG) | — (`notFound()` couvre l'id inconnu) | — | ✓ état Vendu → CTA désactivé (`ArticleDetail`) | — | — |
| **Checkout** | ✓ « Paiement en cours… » sur le CTA (`CheckoutView`) | — (id inconnu → `notFound()`) | ✓ 409 « vient d'être vendue », 401 connexion, erreurs serveur affichées | ✓ mode invité étiqueté « démo locale » | ✓ écran de confirmation dédié, montants serveur | ✓ message générique « Hors ligne ou serveur indisponible » (`api.ts`) |
| **Vendre** | ✓ « Publication… » + bouton désactivé | — (formulaire) | ✓ `res.error` affiché près du CTA | ✓ validation champ à champ (`missing`) | ✓ écran succès honnête + 2 sorties | ✗ brouillon perdu au refresh — consigné (persistance sessionStorage, lot suivant) |
| **Créer** | ✓ « Publication… » | — | ✓ erreurs serveur + reconnexion 401 | ✓ aperçu photos progressif | ✓ « Publié — visible dans le feed » | ✗ brouillon perdu au refresh — consigné |
| **Messages** | — (fils mock instantanés ; fils serveur fusionnent à l'arrivée) | ✓* liste vide → invite « Écris à un vendeur depuis une pièce du Marché » | ✗ échec `api.conversations` silencieux — consigné | ✓ optimistic local + serveur fire-and-forget | ✓ message posé immédiatement (optimistic) | ✗ envoi hors-ligne perdu sans retour — consigné |
| **Profil** (soi) | ✗ sections « Mes annonces/ventes » apparaissent sans squelette — consigné (S) | ✓ invité : encart démo + connexion ; sections masquées si vides | ✓ suppression de compte : erreur affichée | ✓ stats réelles vs mock selon session | ✓ retraits/déconnexion immédiats | — |
| **Membre** (`/membre/[handle]`) | ✓* squelette fidèle (avatar, nom, boutons, 2 tuiles) | ✓ « Profil introuvable » + grilles conditionnelles | ✓ cause + « Réessayer » (`Button`) | ✓ profils démo bannière dédiée | — | ✗ retombe sur l'état erreur générique |
| **Notifications** | ✓* 4 `SkeletonRow` (`aria-busy`) | ✓ « Rien pour l'instant » + icône | ✓ message + « Réessayer » | ✓ pastilles non-lu conservées pendant la session | ✓ marquage lu silencieux (l'écran EST le feedback) | ✗ idem erreur |
| **Gardées** | — (store local) | ✓* invite + CTA « Chiner le Marché » | — | ✓ pièces serveur + mock fusionnées (`savedItems`) | — | — |
| **Cercles / Live / Journal / Drops / Premium** | — (mock statique, rendu immédiat) | — (jamais vides par construction) | — | — | ✗ Rejoindre/Rappels : feedback local uniquement, honnêteté à revoir avec leur passe écran (Phase 5, écrans secondaires) | — |

## Reste à faire consigné (par priorité)
1. Brouillons `vendre`/`creer` persistés (sessionStorage) — perte de saisie réelle.
2. Squelette léger sur les sections serveur du profil.
3. Échecs réseau silencieux (Marché/Messages/posts) : bandeau discret « affichage
   partiel — réessayer » plutôt que silence, quand le serveur devient la source
   principale de contenu.
