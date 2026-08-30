# Lot 2 — Cercles réels

## Objectif

Plus une ligne de discussion mockée : dans un Cercle, de VRAIS fils
(texte + photo), de vraies réponses, une fraîcheur honnête (« nouveau »,
non-lus), des notifications quand on te répond ou te mentionne. Le mock
supprimé devient une fonctionnalité réelle ou un état vide qui invite.

## Parcours utilisateur

**Membre** : ouvre un Cercle → lit les fils (tri : épinglés puis dernière
activité) → a rejoint ? il peut « Ouvrir un fil » (titre + texte + photo
facultative) et répondre → il supprime SES messages, signale ceux des
autres (ReportSheet, type `thread`, relié au Lot 4) → il aime un fil
(pattern like existant) → un point « nouveau » marque ce qui a bougé
depuis sa dernière visite ; l'onglet Cercles porte un badge de non-lus.

**Visiteur / non-membre** : lit tout (les Cercles sont publics en lecture),
mais publier exige d'avoir rejoint (l'adhésion `joined` est déjà persistée
serveur — c'est elle qui fait foi). Invité : invitation à se connecter.

**Auteur d'un fil** : cloche + email (throttle 1 h/fil) à chaque réponse.
**Mentionné** (`@handle` dans une réponse) : cloche avec lien profond.

## Modèle de données (store `circles`)

```
t:<id>        { id, circleId, authorId, authorHandle, authorName,
                title (≤80), text (≤1000)?, image?, createdAt,
                lastActivityAt, replyCount, likedBy: string[],
                pinned?: bool, lastEmailAt? }
r:<threadId>  [{ id, authorId, authorHandle, text (≤1000), at }]
idx:<circleId>  [threadIds]
seen:<userId>   { [circleId]: lastVisitAt }
```

Pas de migration : store neuf. Le mock `Community.threads` est SUPPRIMÉ de
`mock.ts` (et le compteur « discussions » devient le compte réel ; le
faux « en ligne » disparaît — engagement fabriqué, contraire au brief).

## Machine à états

Un fil : `actif` → `supprimé` (auteur ; tombstone `deleted`, filtré en
lecture, réponses conservées pour le Lot 4). `pinned` on/off — réservé au
rôle `admin` (les animateurs mock sont fictifs ; les vrais animateurs sont
Nouh et Youssef, qui recevront le rôle au Lot 4 — l'endpoint est prêt,
403 pour tous d'ici là ; consigné D-018).

## API — `/api/circles` (une function, ops explicites)

- `GET ?circle=cm1` → fils triés (épinglés d'abord, puis lastActivityAt
  desc), + `lastSeenAt` du lecteur connecté. Lecture publique.
- `GET ?thread=<id>` → fil + réponses. Lecture publique.
- `GET ?unread=1` → badge : nb de Cercles REJOINTS avec activité depuis la
  dernière visite (lecture privée, session requise).
- `POST {op:"seen", circleId}` → marque la visite (session).
- `POST {op:"thread", circleId, title, text?, image?}` — membre du Cercle
  uniquement (vérif serveur sur `joined`), 10 fils/jour, image via le
  pipeline média mutualisé (`_shared/media.mts`, extrait de posts.mts).
- `POST {op:"reply", threadId, text}` — membre, 60 réponses/h ; met à jour
  lastActivityAt + replyCount ; notifie l'auteur (cloche + email throttlé
  1 h/fil) et les @mentions résolues via `handle:` (cloche).
- `POST {op:"like", threadId}` — toggle membre (likedBy sur le fil — même
  geste que le like existant, stockage local au fil).
- `POST {op:"delete", threadId, replyId?}` — auteur du message uniquement.
- `POST {op:"pin", threadId, on}` — rôle admin uniquement (403 sinon).

Permissions testées : membre requis pour écrire, auteur requis pour
supprimer, admin requis pour épingler, tiers → 403/404 sans fuite.
Idempotence : like = toggle, seen = upsert, delete d'un supprimé = 404.

## Écrans (primitives, 6 états, 375 d'abord)

- **`/communaute/[id]`** : la section « À la une » mockée devient « Fils »
  réels — chargement (SkeletonRow), vide (« Ouvre le premier fil » + CTA),
  erreur (cause + Réessayer), hors-ligne (idem), succès. Bouton « Ouvrir
  un fil » (membre) → Sheet composer (FieldLabel, .field, photo
  facultative). Marqueur « nouveau » sur les fils récents. Stats : membres
  (seed assumé) + compte réel de fils.
- **`/communaute/[id]/fil/[tid]`** : le fil — post complet, réponses,
  composer de réponse (membre), like, supprimer (les siens), signaler.
  Client + un fetch + squelette (extension D-017 : Blobs = functions).
- **Badge non-lus** : point sur l'onglet Cercles (MobileTabBar + SideNav),
  compteur via le store (rafraîchi à la session et après visite).
- Rafraîchissement discret : revalidation au montage + toutes les 30 s
  quand l'écran du Cercle est visible — pas de rechargement, pas de saut.

## Notifications

Nouveau type `circle` (cloche + email existants, un seul point d'émission
dans la function) ; le push (Lot 3) s'y branchera. Liens profonds vers
`/communaute/[id]/fil/[tid]`.

## Plan de tests

- Vitest : tri des fils (épinglé > activité), détection de mentions,
  calcul non-lus (fonctions pures extraites dans `src/lib/circles.ts`).
- E2E prod après déploiement (comptes de test, purgés) : publier exige
  l'adhésion (403 avant join, 200 après), réponse → notif auteur,
  mention → notif, delete par un tiers → 404, badge non-lus.

## Mesure de succès

Membres actifs 7 j et taux de réponse : calculables depuis les fils
(authorId/réponses horodatées) — requête admin au Lot 4. Zéro mock
restant : `grep -rn "CommunityThread" src/` → 0.

## Vérification E2E en PROD (2026-08-31, consignée puis purgée)

| Étape                                    | Résultat                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Publier un fil SANS avoir rejoint        | **403** « Rejoins le Cercle pour ouvrir un fil » ✓                                                                      |
| Rejoindre (social `joined`) puis publier | fil créé `th_63d5c256904b` ✓                                                                                            |
| Répondre sans adhésion (2ᵉ compte)       | **403** ✓                                                                                                               |
| Réponse avec mention `@lot2-membre`      | posée ; l'auteur reçoit UNE notif `circle` (pas de doublon réponse+mention) avec lien profond `/communaute/cm1/fil/…` ✓ |
| J'aime                                   | toggle serveur, compte 1 ✓                                                                                              |
| Suppression du fil par un TIERS          | **404** sans fuite ✓                                                                                                    |
| Épingler sans rôle admin                 | **403** « Réservé aux animateurs » ✓ (D-018)                                                                            |
| Badge non-lus                            | `?unread=1` → `{count:1, circleIds:["cm1"]}` ✓                                                                          |
| Rendu prod 375                           | captures `lot2-cercle-fil-reel-prod-375.png` / `lot2-fil-detail-prod-375.png` — mentions liées, like, barrière invité   |
| Purge                                    | fil supprimé par l'auteur, comptes supprimés (RGPD), store `circles` vide, cm1 rend 0 fil                               |
