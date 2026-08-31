# Lot 7 — Balayage final

## Balayages (commandes et résultats)

```bash
grep -rn 'console\.log'                src/ netlify/  → 0
grep -rn 'TODO\|FIXME'                 src/ netlify/  → 0
grep -rnE ': any\b|<any>'              src/ netlify/  → 0
grep -rn 'catch {}'                    src/ netlify/  → 0
grep -rnE 'window\.(prompt|alert|confirm)' src/       → 1 (un COMMENTAIRE
                                          documentant leur suppression)
grep -rnE 'text-red-|bg-red-|border-red-' src/        → 0
grep -rn 'ProductTile'                 src/           → 0
grep -rn 'CommunityThread'             src/           → 0
git grep -lE 'VAPID_PRIVATE_KEY *=|RESEND_API_KEY *='  → 0
```

Qualité : `tsc` app 0 · `tsc` functions 0 · lint 0 erreur · **81/81 tests**
(15 au départ du brief).

## Parcours vérifiés en production

Chaque lot a été éprouvé sur la prod avec de vrais comptes, puis purgé.
Le détail par lot est dans `audit/lots/0*.md` ; en résumé :

| Parcours                        | Vérifié                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Acheter                         | commande créée, montants recalculés serveur, anti-double-vente                                                     |
| Vendre et expédier              | 409 si l'acheteur tente d'expédier, double-clic sans double effet                                                  |
| Recevoir                        | `reçue` puis `terminée`, historique à 4 entrées avec les bons auteurs                                              |
| Annuler                         | motif tracé, **pièce remise en vente** automatiquement                                                             |
| Signaler                        | les 5 types, dont les annonces (trou comblé au lot 4)                                                              |
| Modérer                         | 404 pour un non-admin, masquage effectif, suspension « lit mais ne publie pas », bannissement qui coupe la session |
| Publier une vidéo               | `Range` 206/416, octets identiques au fichier source                                                               |
| Rejoindre un Cercle et répondre | 403 sans adhésion, notification à l'auteur, mention détectée                                                       |
| Activer le push                 | VAPID accepté par FCM, abonnement mort purgé au premier échec                                                      |

## Ce qui n'a pas pu être rejoué

Le brief demandait de rejouer les parcours « en 375 / 768 / 1440, mode
sombre, clavier seul, réseau lent, compte neuf et compte rempli ».

Ont été faits : **375 px** (toutes les captures), **réseau lent** (toutes
les mesures Lighthouse), **compte neuf** (chaque E2E crée puis supprime
ses comptes), **mode sombre** (le feed est sombre par construction, les
pages claires — les deux mondes de la DA sont exercés à chaque capture).

N'ont **pas** été rejoués intégralement : le **clavier seul** sur les
nouveaux écrans (`/commande`, `/admin`, `/communaute/…/fil`) et les
largeurs 768/1440 sur ces mêmes écrans. Les primitives utilisées portent
déjà la sémantique (Sheet avec Échap et piège de focus, boutons natifs,
`:focus-visible` global), mais **ce n'est pas la même chose que de
l'avoir vérifié** — c'est consigné comme dette, pas comme fait.

## Documents à jour

`design/DA.md` · `design/composants.md` (TogglePill, PushInvite,
PushSettings) · `audit/02-etats.md` (5 écrans ajoutés, légende étendue
jusqu'au lot 5) · `DECISIONS.md` (**32 décisions**, D-014 → D-032).
