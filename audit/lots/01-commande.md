# Lot 1 — Cycle de vie de la commande

## Objectif

Une commande traverse un vrai cycle, visible et actionnable des deux côtés :
`payée → expédiée → reçue → terminée`, plus `annulée` et `litige`. Machine à
états UNIQUE côté serveur, historique complet, automatismes planifiés.

## Parcours utilisateur

**Acheteur** : paie (simulé) → voit sa commande dans Profil › Mes commandes
avec un statut → ouvre `/commande/[id]` : frise (payée → expédiée → reçue),
historique horodaté, « Écrire au vendeur » → à la réception : « Bien reçu »
(→ reçue puis terminée) ou « Signaler un problème » (non reçue / non
conforme → litige, traité au Lot 4).

**Vendeur** : reçoit la notification de vente → Profil › Mes ventes : statut
en un coup d'œil → ouvre `/commande/[id]` : adresse de livraison copiable
(visible de LUI SEUL), bouton « J'ai expédié » (transporteur + n° de suivi
facultatifs), « Annuler la vente » avec motif tant que non expédiée,
« Écrire à l'acheteur ».

**Système** : rappelle le vendeur qui n'expédie pas, annule passé le délai,
clôt automatiquement après expédition si l'acheteur reste silencieux
(rappels avant), gèle tout si litige.

## Modèle de données

`orders` store, record `o:<id>` étendu :

```
status: "payee" | "expediee" | "recue" | "terminee" | "annulee" | "litige"
history: [{ at, by: userId|"system"|"admin", from, to, note? }]
shipping: { method, carrier, relayLabel? , address? { name, line, postal, city } }
shipment?: { carrier?, tracking?, at }
dispute?: { reason: "non_recue"|"non_conforme", note?, at }
cancel?: { by, reason, at }
remindShipAt?, remindReceiveAt?   (idempotence des rappels)
```

**Migration (règle écrite, non destructive)** : les commandes existantes ont
`status: "confirmee"` — mapping EN LECTURE `confirmee → payee` dans
`normalizeStatus()` ; aucune réécriture de masse ; un record est mis au
nouveau format à sa première transition. La commande réelle de kiraishi10
reste intacte octet pour octet tant qu'elle ne bouge pas.

**Adresse de livraison** : le checkout la demande UNIQUEMENT pour la
livraison à domicile (Chronopost) ; en point relais, l'adresse du relais
fait foi (comportement Vinted). Elle n'apparaît que dans les lectures du
vendeur de CETTE commande (règle brief n°3).

## Machine à états (serveur, unique — `_shared/order-state.mts`)

| De              | Vers                | Qui                                                  | Effet                     |
| --------------- | ------------------- | ---------------------------------------------------- | ------------------------- |
| (création)      | payee               | module `payment.mts` (simulé ; stub webhook exporté) | pièce → vendue            |
| payee           | expediee            | vendeur                                              | shipment posé             |
| payee           | annulee             | vendeur (motif) ou système (délai)                   | pièce remise en vente     |
| expediee        | recue               | acheteur (« Bien reçu »)                             | —                         |
| expediee, recue | litige              | acheteur (motif)                                     | gèle la clôture auto      |
| recue           | terminee            | système (immédiat)                                   | —                         |
| expediee        | terminee            | système (délai, si silence)                          | —                         |
| litige          | annulee \| terminee | admin (Lot 4)                                        | annulée → remise en vente |

`recue → terminee` est immédiat (pas de système d'avis : il n'existe pas,
on ne l'invente pas — proposé au rapport). L'état distinct reste pour
brancher les avis plus tard sans migration.

**Délais (fixés et justifiés — D-016)** : rappel vendeur **J+3**, annulation
auto **J+7** (Vinted annule à 7 jours sans expédition — repère marché
qu'attendent nos utilisateurs) ; après expédition : rappel acheteur **J+7**,
clôture auto **J+14** (pas de suivi transporteur réel en beta → marge large,
2× le délai postal courant).

**Planification** : Netlify Scheduled Function (`orders-cron.mts`,
`schedule: "@hourly"`) — ce que le stack offre déjà, zéro dépendance. Le
cron liste `o:*` (volume beta), applique les règles ; chaque rappel est
marqué sur la commande (idempotent — un run doublé ne renvoie rien).

## Événements de notification (cloche + email existants, un seul module)

`_shared/order-events.mts` : `emitOrderEvent(order, transition)` → pushNotif

- email aux DEUX parties (sauf l'auteur de l'action pour l'email), lien
  profond `/commande/[id]`. Événements : vendue (existant, conservé),
  expédiée, reçue, terminée, annulée, litige ouvert, rappel expédition,
  rappel réception. Le Lot 3 branchera le push sur CE module sans dupliquer.

## Permissions (testées)

- Lecture `GET /api/orders?id=X` : buyer OU seller de X, sinon 404 (pas 403 :
  ne pas confirmer l'existence).
- L'adresse domicile n'est renvoyée qu'au seller.
- Transition : `canTransition(order, action, userId)` — la même fonction
  sert le handler ET les tests ; le client ne décide jamais.
- Idempotence : re-POST d'une transition déjà faite → 409 sans double effet ;
  le bouton client se désactive pendant l'appel.

## Cas limites

- Annulation d'une pièce seed vendue : shadow record supprimé + retrait de
  `sold-seeds` (remise en vente exacte).
- Litige pendant le run du cron : le cron re-lit le statut avant d'écrire.
- Commande invité (démo locale) : AUCUN cycle — bandeau « démo » existant,
  aucune écriture serveur (inchangé).
- Conversation : la commande est référencée dans le fil de la pièce
  (`orderId` posé sur la conv) — pas de messages fabriqués.

## Écrans (primitives, 6 états, mobile 375)

- **`/commande/[id]`** (client + squelette DA — voir D-017 : les données
  vivent derrière un cookie httpOnly + Blobs accessibles aux seules
  functions ; UN fetch, pas de cascade) : frise de statut (`aria-live`
  sur les changements), historique, actions par rôle (Button/danger),
  adresse copiable (vendeur), Sheet « J'ai expédié » (FieldLabel + .field),
  Sheet litige (motifs en Chip). États : chargement (squelette), erreur
  (cause + Réessayer), introuvable, succès (l'écran), hors-ligne (message
  api.ts) ; vide sans objet (id inconnu → introuvable).
- **Profil** : Mes commandes / Mes ventes — statut + lien vers la commande.
- **Checkout** : champs adresse (domicile uniquement), validés serveur.

## Plan de tests

- Vitest sur `order-state` : toutes les transitions autorisées/refusées par
  rôle, normalizeStatus, délais (fonctions pures à horloge injectée).
- Vérif manuelle E2E en prod après déploiement (deux comptes réels, achat
  simulé, expédition, réception) — consignée ici.

## Mesure de succès

Temps médian payée→expédiée et expédiée→reçue + taux de clôture propre :
calculables depuis `history` (requête admin au Lot 4). Zéro commande
bloquée sans issue (toute commande a toujours ≥ 1 action ou un automatisme).
