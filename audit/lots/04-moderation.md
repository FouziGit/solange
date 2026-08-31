# Lot 4 — Modération

## Objectif

Toi et Youssef pouvez traiter un signalement de chaque type depuis un
téléphone, en voyant le contenu incriminé sans quitter la file, et chaque
geste laisse une trace. Ce lot débloque aussi deux mécanismes déjà écrits
mais inertes : l'épinglage des fils (D-018) et les litiges de commande
que le Lot 1 sait ouvrir mais que personne ne pouvait trancher.

## Qui est admin — D-024, l'env plutôt qu'un script

Le brief demandait « un script ou une migration qui attribue le rôle à
partir d'un email ». Je livre **mieux** : une variable d'environnement
`ADMIN_EMAILS` (liste séparée par des virgules). Pourquoi c'est
supérieur à un script :

- **rien à migrer** : aucun enregistrement touché, donc rien à défaire ;
- **révocation instantanée** : retirer un email coupe l'accès au
  redéploiement suivant, sans script inverse à écrire ;
- **pas de privilège figé dans la donnée** : un dump de la base ne
  contient aucun droit d'administration.

`isAdmin()` accepte aussi un champ `role: "admin"` sur le compte, pour
rester compatible avec D-018 (l'épinglage écrit avant ce lot) et pour
permettre plus tard une promotion depuis l'interface sans redéploiement.

## Parcours admin

Ouvre `/admin` (route absente de toute navigation, 404 pour quiconque
n'est pas admin) → la file : **signalements** et **litiges** mêlés, triés
du plus ancien au plus récent (le plus vieux est le plus urgent), filtrable
par état (à traiter / traités) et par type.

Chaque entrée montre le contexte SANS quitter la file : le contenu
incriminé (titre, extrait, photo), son auteur, le motif du signalement, et
**l'historique de signalements de cet auteur** (un premier écart n'est pas
une récidive).

Actions, du plus doux au plus dur :

| Action    | Effet                                                                      |
| --------- | -------------------------------------------------------------------------- |
| Classer   | le signalement passe à « traité », rien d'autre                            |
| Avertir   | message type à l'auteur (cloche + email + push), le contenu reste          |
| Masquer   | le contenu disparaît des lectures publiques, l'auteur le voit encore barré |
| Suspendre | l'auteur ne peut plus rien publier pendant N jours ; il peut lire          |
| Bannir    | le compte ne passe plus l'authentification                                 |

Pour un litige de commande : **annuler** (la pièce repart en vente,
l'acheteur est remboursé — simulé), **clôturer** (la vente tient), ou
**renvoyer aux parties** (dégeler sans trancher, la commande repart d'où
elle venait).

## Modèle de données

```
reports/  r:<id>   { id, targetType, targetId, reason, reporterId,
                     reporterHandle, status: open|done, at, resolvedBy?,
                     resolvedAt?, action? }
          idx      [reportIds]                    ← NOUVEAU (il n'existait
                                                     aucun index : les
                                                     signalements étaient
                                                     écrits sans pouvoir
                                                     être relus)
          a:<id>   { id, at, adminId, adminHandle, action, targetType,
                     targetId, reportId?, note? }  ← journal d'audit
          aidx     [auditIds]
users/    u:<id>   { …, role?, suspendedUntil?, banned? }
```

Le masquage pose `hidden: true` sur le contenu lui-même (annonce, post,
fil) : une seule vérité, lue par toutes les surfaces publiques.

## Permissions (testées)

- `/api/admin` et `/admin` : **404** pour un non-admin (jamais 403 — on ne
  confirme pas l'existence d'un espace d'administration).
- Un banni ne passe plus `currentUser()` : il est déconnecté partout, sans
  exception à écrire endpoint par endpoint.
- Un suspendu lit tout mais n'écrit rien : garde unique `canWrite()`
  appliquée aux écritures (annonces, posts, fils, réponses, messages).
- Les transitions de litige passent par la MÊME machine à états que le
  Lot 1 (`resolve_cancel` / `resolve_close`, rôle `admin`) : aucun chemin
  parallèle qui contournerait les règles.

## Trou comblé

Les **annonces** n'étaient signalables nulle part (messages, membres,
posts et fils l'étaient). Ajout du signalement sur la fiche pièce.

## Notifications

Chaque nouveau signalement prévient les admins (cloche + email + push,
type `report` déjà déclaré au Lot 3). Chaque action de modération prévient
l'auteur concerné, sauf le classement (rien ne lui est arrivé).

## Plan de tests

- Unitaires : `isAdmin` (env, rôle, casse et espaces des emails),
  `canWrite` (suspension expirée / en cours / bannissement).
- E2E prod : un non-admin reçoit 404 sur `/api/admin` ; un admin liste,
  masque un contenu et vérifie qu'il disparaît des lectures publiques ;
  un litige est tranché et la pièce repart en vente.

## Mesure de succès

Délai médian entre signalement et traitement (calculable : `at` →
`resolvedAt`), et part des signalements traités. Zéro action de
modération sans trace : le journal d'audit est écrit dans la même
fonction que l'action.

## Vérification E2E en PROD (2026-08-31, consignée puis purgée)

`ADMIN_EMAILS` a été posée avec l'adresse de Nouh (scope functions,
contexte production). Le compte admin a été utilisé réellement.

### Les gardes d'accès

| Contrôle                                     | Résultat                                               |
| -------------------------------------------- | ------------------------------------------------------ |
| Anonyme sur `/api/admin`                     | **404 « Introuvable »** ✓                              |
| Connecté mais NON admin                      | **404** — même réponse, aucune différence observable ✓ |
| Action de modération tentée par un non-admin | **404** (pas 403 : rien ne fuit) ✓                     |
| Connexion avec l'adresse listée              | accès à la file, `@fouzi.benzidane` ✓                  |

### Le cycle de modération

| Étape                   | Résultat                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File                    | 1 signalement, avec le contexte complet (type, titre, auteur, motif, antécédents de l'auteur) ✓                                                              |
| **Masquer** une annonce | disparue des lectures publiques ✓, **son auteur la voit encore** ✓ (il doit comprendre), **achat refusé 409** ✓                                              |
| **Suspendre** 3 jours   | le membre LIT toujours (`/api/me` valide) ✓, mais publier une annonce **403 « Publication suspendue jusqu'au 3 septembre »** ✓, envoyer un message **403** ✓ |
| **Bannir**              | session **coupée partout** malgré un cookie encore valide ✓, aucune donnée privée renvoyée ✓                                                                 |
| Journal d'audit         | `@fouzi.benzidane · hide · product p_…` ✓                                                                                                                    |

### Écart consigné

Un banni reçoit **200 avec une réponse vide** sur les lectures privées
(`/api/notifications`) plutôt qu'un 401 : il est traité comme un visiteur
déconnecté. Aucune fuite — mais forme incohérente, le même écart que
celui relevé au Lot 1 sur `GET /api/orders?id=` sans session. Les deux se
règlent d'un coup au passage serveur du Lot 7.

Purge : annonce de test supprimée (et retirée de l'index), store
`reports` vidé, compte de test supprimé. Aucun reste en production.

## Reste à faire — l'accès de Youssef

`ADMIN_EMAILS` ne contient pour l'instant **que l'adresse de Nouh**.
Pour ajouter Youssef, une seule commande (les deux adresses, séparées par
une virgule, sans espace superflu — la comparaison les tolère de toute
façon) :

```bash
netlify env:set ADMIN_EMAILS "fouzi.benzidane@gmail.com,<email-de-youssef>" --scope functions --context production
```

Puis un redéploiement (le prochain commit suffit). Pour révoquer un
accès : la même commande sans l'adresse concernée.
