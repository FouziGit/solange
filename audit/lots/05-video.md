# Lot 5 — Vidéos des membres

## Objectif

La promesse « TikTok de la mode » n'est tenue qu'à moitié : le feed ne
contient de vidéos que les nôtres, les membres n'y postent que des photos.
Ce lot leur ouvre la vidéo, avec les pièces achetables dessus.

## Contraintes assumées — D-028, pas de transcodage

Le stack n'a **aucun** service de transcodage, et le brief interdit d'en
ajouter un sans le demander. Conséquence assumée : **on valide côté
client et on refuse ce qui ne passe pas**, plutôt que d'accepter un
fichier qu'on ne saurait pas convertir.

| Règle           | Valeur                              | Pourquoi                                                                                                                           |
| --------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Formats         | MP4/H.264 en priorité, WebM accepté | H.264 est le seul lu partout, iOS compris                                                                                          |
| Durée           | ≤ 15 s                              | c'est la durée d'un look ; au-delà on quitte le format                                                                             |
| Poids           | ≤ 4 Mo                              | la charge utile d'une Netlify Function plafonne à 6 Mo, et le base64 gonfle de 33 % — 4 Mo est le maximum réellement transmissible |
| Image d'attente | générée **dans le navigateur**      | on cherche la 1ʳᵉ image (t≈0,1 s), on la dessine sur un canvas, on l'envoie en JPEG : aucun serveur à ajouter                      |

Si un fichier dépasse, on le dit avec le chiffre exact (« 6,2 Mo — 4 Mo
maximum ») plutôt qu'un refus opaque.

## Service des fichiers — D-029, le Range est obligatoire

`/api/vid/:id` implémente les requêtes partielles (`Range`, 206). Ce n'est
pas un raffinement : **Safari refuse de lire une vidéo servie sans Range**
(il commence par demander `bytes=0-1`). Sans ça, la fonctionnalité serait
morte sur iPhone, c'est-à-dire sur la moitié du public.

## Lecture dans le feed

- Lecture automatique **muette**, en boucle, son au tap (le geste attendu).
- L'image d'attente s'affiche d'abord : jamais de trou noir.
- **Préchargement de la suivante uniquement** (`preload="none"` au-delà) :
  un feed qui précharge tout vide la batterie et le forfait.
- `prefers-reduced-data` et `prefers-reduced-motion` respectés : on
  s'arrête à l'image d'attente et on ne lance rien.
- Une seule vidéo joue à la fois (la carte hors écran se met en pause) —
  le mécanisme existe déjà pour les looks, il est réutilisé.

## Pièces taguées

Un post membre peut désormais **lier des pièces** (`linkedProductIds`,
déjà présent côté looks éditoriaux). Le rail « Shop the look » et sa
feuille s'ouvrent sur une vidéo membre exactement comme sur un look : même
primitive, aucun chemin parallèle.

## Règle de mélange du feed — D-030

Ordre : **publications membres d'abord (les plus récentes en tête), puis
les looks éditoriaux**. Pas de score d'engagement inventé : à ce volume,
un « algorithme » serait du théâtre, et le brief interdit de fabriquer de
l'engagement. Les abonnements ne remontent rien pour l'instant — ce serait
un tri sur trois éléments. La règle est écrite pour être remplacée quand
il y aura assez de contenu pour que ça veuille dire quelque chose.

## Modération et suppression

Une vidéo est un post : elle hérite du signalement, du masquage (lot 4) et
de la suppression par l'auteur. Rien de spécifique à écrire.

## Drapeau

`NEXT_PUBLIC_VIDEO_UPLOAD` — sans elle, le bouton vidéo n'apparaît pas et
le serveur refuse les envois vidéo. Les vidéos déjà publiées restent
lisibles : couper l'envoi ne casse pas l'existant.

## Plan de tests

- Unitaires : validation (durée, poids, type), formatage des messages
  d'erreur, calcul des octets d'une requête Range.
- Prod : envoi d'une vraie vidéo, lecture sur mobile, plage Range servie
  en 206, pièces taguées ouvrables, suppression.

## Mesure de succès

Part des publications membres contenant une vidéo, et score Lighthouse du
feed qui **ne recule pas** (mesuré avant/après, mêmes conditions).

## Vérification E2E en PROD (2026-08-31, consignée puis purgée)

Vraie vidéo H.264 générée avec ffmpeg (360×640, 4 s, 23 940 octets),
publiée par un compte réel, drapeau `NEXT_PUBLIC_VIDEO_UPLOAD=1` posé.

| Contrôle                                    | Résultat                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Publication (charge 31 Ko en base64)        | post créé, `video: /api/vid/v_…`, `productIds: [k1, k8]` ✓                       |
| `GET` sans Range                            | 200, `content-type: video/mp4`, **`accept-ranges: bytes`** ✓                     |
| **`Range: bytes=0-1`** (la sonde de Safari) | **206**, `content-range: bytes 0-1/23940` ✓ — sans ça, rien ne se lit sur iPhone |
| `Range: bytes=10000-` (plage ouverte)       | 206, `bytes 10000-23939/23940` ✓                                                 |
| `Range: bytes=999999-` (hors fichier)       | **416**, `content-range: bytes */23940` ✓                                        |
| Octets servis                               | identiques au fichier source (`ftypisom`, comparaison hexadécimale) ✓            |
| Id malformé / inexistant                    | 404 ✓                                                                            |
| Envoi vidéo sans session                    | 401 (l'authentification passe avant le drapeau) ✓                                |

Purge : post supprimé, vidéo supprimée du store `vids`, index des posts
nettoyé. Aucun reste en production.

## Reste à vérifier sur appareil réel

La lecture elle-même (auto muette, son au tap, boucle, image d'attente)
demande un vrai téléphone : le protocole HTTP est prouvé, le rendu ne
peut l'être que par un œil. À faire en même temps que la vérification
push : publier une courte vidéo depuis `/creer`, la retrouver dans le
feed, toucher pour le son, toucher le cintre pour les pièces taguées.
