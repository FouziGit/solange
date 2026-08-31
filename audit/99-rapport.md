# Rapport v2 — brief 2 : finir la roadmap

> Sept lots livrés sur `main`, chacun déployé et vérifié en production.
> Chaque affirmation ci-dessous a un diff, une mesure ou une trace d'appel.
> Ce qui n'a pas été atteint est dit comme tel, avec le chiffre.

## 1. Ce qui a été livré, lot par lot

| Lot                | Livré                                                                                                                                                                                       | Preuve                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **0 — Filet**      | Plus un seul échec réseau muet (Marché, feed, Messages, Profil) ; primitive `TogglePill` remplaçant 9 boutons divergents ; tous les CTA sur `Button` ; doublon `ProductTile` supprimé       | `audit/lots/00-filet.md`                                                                            |
| **1 — Commande**   | Cycle `payée → expédiée → reçue → terminée` + `annulée`/`litige`, machine à états unique partagée client/serveur, historique horodaté, automatismes (rappels, annulation J+7, clôture J+14) | E2E prod : 409 sur rôle interdit, double-clic sans double effet, annulation → pièce remise en vente |
| **2 — Cercles**    | Fils réels (texte + photo), réponses, j'aime, mentions, non-lus ; le mock supprimé                                                                                                          | E2E prod : 403 sans adhésion, 404 pour un tiers, badge non-lus                                      |
| **3 — Push**       | Web Push sans dépendance, prouvé contre le vecteur RFC 8291 §5 ; invitation jamais au premier lancement ; préférences par type + heures calmes                                              | **FCM a répondu 404 et non 401** : Google accepte notre signature VAPID                             |
| **4 — Modération** | `/admin` : file signalements + litiges, contexte inclus, actions tracées ; bannir coupe l'authentification, suspendre coupe l'écriture, masquer sort des lectures publiques                 | E2E prod : 404 pour non-admin, masquage vérifié, suspension « lit mais ne publie pas »              |
| **5 — Vidéo**      | Vidéos membres (validation client, image d'attente en canvas), service avec `Range`, pièces taguées, mélange du feed écrit                                                                  | **206 sur `bytes=0-1`** (la sonde Safari), 416 sur plage invalide, octets identiques au fichier     |
| **6 — Perf**       | Vidéos −57 %, chargement conditionnel, préchargement du LCP                                                                                                                                 | 87 / 78 / 81 — **objectif 90 non atteint**, voir §3                                                 |

## 2. Ce qui a été trouvé en chemin, et corrigé

Des défauts que le brief ne demandait pas, découverts en travaillant :

- **Les signalements n'avaient aucun index** : ils étaient écrits sans que
  personne ne puisse jamais les relire. Toute la modération reposait sur
  un email.
- **Les annonces étaient le seul contenu non signalable** de l'app.
- **Les pièces taguées d'une publication n'étaient jamais envoyées** au
  serveur : « Shop the look » ne pouvait pas s'ouvrir dessus.
- **Trois fuites RGPD à la suppression de compte**, dont deux antérieures
  à ce brief : les publications du feed et les fils de Cercle survivaient
  avec pseudo, nom et photos. Les publications sont purgées ; les fils
  sont **anonymisés** plutôt que détruits — effacer un fil auquel d'autres
  ont répondu détruirait la parole d'autrui.
- **Une SSRF** dans l'abonnement push (endpoint non filtré) et une
  **amplification** (le plafond ne comptait que les envois réussis).
- **Les heures calmes ne fonctionnaient pas du tout** : en français,
  `Intl` écrit « 03 h », donc la conversion donnait `NaN`.
- **Un bouton mort** (« Faire une offre » du feed Pièces).

Le lot 3 a été soumis à une revue adversariale de 30 agents (4 angles,
chaque défaut ensuite confié à un sceptique chargé de le réfuter) :
12 verdicts, 11 réels, tous corrigés avant l'allumage.

## 3. Ce qui n'est PAS atteint

**La performance.** Objectif ≥ 90, résultat **87 / 78 / 81** (prod,
mobile bridé, 3 passes, médiane).

Le diagnostic est complet et mesuré. Après avoir corrigé tout le réseau —
vidéos allégées de 57 %, préchargement du LCP qui ramène le « Load Delay »
de 6 499 ms à 328 ms — il reste **10 s de « Render Delay »** : l'image est
prête en moins d'une seconde et ne peut pas peindre, parce que l'élément
qui la porte n'existe pas dans le HTML servi.

La cause précise : `AuthGate` est un composant client qui, au rendu
serveur, ignore si la personne a déjà passé l'accueil — le drapeau est en
`localStorage`. Il rend donc le splash, et rien d'autre.

**Le correctif restant tient en une phrase** : déplacer ce drapeau vers un
cookie, pour que le serveur sache qui il sert. Non fait ici parce que cela
touche le chemin d'authentification et mérite sa propre passe, avec ses
propres preuves, plutôt qu'une modification de fin de chantier.

## 4. Balayages de sortie

```
console.log 0 · TODO/FIXME 0 · any 0 · catch vides 0 · prompt/alert 0
red-* Tailwind 0 · ProductTile 0 · CommunityThread (mock) 0 · secrets 0
tsc app 0 · tsc functions 0 · lint 0 erreur · 81 tests / 81
```

Tests passés de 15 à **81** : machines à états, permissions, crypto
(vecteur RFC), règles anti-spam, validation vidéo, découpe `Range`.

## 5. Drapeaux et variables d'environnement

| Variable                                                   | État                  | Rôle                                                                                 |
| ---------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | **posées**            | Notifications push (générées sans jamais transiter en clair)                         |
| `ADMIN_EMAILS`                                             | **posée** (Nouh seul) | Accès à `/admin`. Ajouter Youssef : une commande, dans `audit/lots/04-moderation.md` |
| `NEXT_PUBLIC_VIDEO_UPLOAD`                                 | **posée**             | Publication vidéo                                                                    |

Tout est allumé. Aucun secret dans le dépôt (seules les valeurs
**publiées** du RFC 8291 figurent dans un test).

## 6. Ce qui demande des mains humaines

1. **Push sur un vrai téléphone** — le protocole est prouvé jusqu'à FCM,
   la réception demande un appareil. Android : aimer une pièce, accepter,
   Profil › Notifications › Tester. iPhone : ajouter à l'écran d'accueil
   d'abord.
2. **Lecture vidéo sur un vrai téléphone** — le `Range` est prouvé, le
   rendu (auto muette, son au tap) ne peut l'être que par un œil.
3. **Test des 5 secondes sur 3 personnes réelles** — inscrit au rapport v1,
   toujours pas fait : hors de portée d'un agent.
4. **L'email de Youssef** pour son accès admin.

## 7. Ce que je ferais avec une session de plus

1. **Le cookie d'onboarding** (§3) — c'est le seul obstacle mesuré entre
   l'app et un score ≥ 90.
2. **Aligner les réponses aux non-authentifiés** : deux endpoints
   renvoient 200 avec un corps vide là où un 401 serait cohérent
   (`/api/orders?id=`, lectures privées d'un banni). Aucune fuite, mais
   une incohérence de forme relevée deux fois.
3. **Écritures conditionnelles** sur les compteurs push (`onlyIfMatch`),
   consignées comme acceptées à l'échelle beta.
4. **Le paiement réel** — le point d'entrée est isolé dans un module avec
   son webhook prêt. Ce n'est plus une question technique mais une
   décision : société, KYC, CGV.
