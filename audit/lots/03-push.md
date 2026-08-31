# Lot 3 — Notifications push PWA

## Objectif

Une notification arrive sur l'écran verrouillé, avec un lien profond, au
bon moment, sans harceler. Un seul point d'émission (le `pushNotif` de
`core.mts` déjà utilisé par TOUS les lots) alimente cloche + email + push.

## Parcours utilisateur

1. **Personne ne demande rien au premier lancement.** L'invitation
   n'apparaît qu'après une première action qui compte : première pièce
   aimée, première vente, premier Cercle rejoint (déclencheur posé par le
   client, une seule fois, mémorisé localement).
2. **Invitation in-app** (Sheet, voix DA) : ce que la personne y gagne
   concrètement (« Sache quand ta pièce se vend, sans ouvrir l'app »).
   « Activer » → alors seulement la demande native. « Plus tard » → on ne
   redemande pas de la session, et au plus une fois par mois.
3. **iOS** : le push exige l'app installée sur l'écran d'accueil. Si on
   détecte iOS hors mode standalone, l'invitation devient un guide
   d'installation (Partager → Sur l'écran d'accueil), sans demande native
   impossible à satisfaire.
4. **Préférences** (`/profil` › Notifications) : un interrupteur par type
   d'événement + heures calmes, désactivation globale en un geste.
5. **Réception** : la notification porte un titre, un corps, un badge et un
   lien profond ; le tap ouvre l'app à l'endroit exact (focus de l'onglet
   existant s'il y en a un).

## Modèle de données (store `push`)

```
s:<userId>   [{ endpoint, p256dh, auth, ua?, createdAt, lastOkAt }]   (par appareil)
p:<userId>   { enabled, types: {sale,order,message,circle,follow,report}, quietFrom, quietTo }
q:<userId>   { hour: <epochHeure>, count }        (plafond horaire)
g:<userId>:<tag>  { count, firstAt }              (regroupement)
```

Un abonnement n'est lisible que par son propriétaire (jamais renvoyé par
une API publique) ; la suppression de compte purge `s:`/`p:`/`q:`/`g:`.

## Crypto — zéro dépendance, prouvée (D-020)

Web Push = RFC 8292 (VAPID, JWT ES256) + RFC 8291 (chiffrement du contenu,
ECDH P-256 → HKDF → AES-128-GCM). `jose` est **déjà** au projet (sessions)
et couvre le JWT ; Node WebCrypto couvre le reste. Ajouter `web-push`
n'apporterait rien qu'on n'ait pas, et le vrai risque du fait-maison
(crypto subtilement fausse) est **éliminé par un test contre le vecteur
officiel du RFC 8291 §5** : mêmes clés, même sel, même sortie octet pour
octet. Une dépendance non testée serait un acte de foi ; un vecteur
officiel est une preuve.

## Anti-spam (D-021)

- **Plafond** : 8 push/heure/personne. Au-delà, l'événement vit dans la
  cloche seulement (jamais perdu).
- **Regroupement** : les événements de même `tag` dans les 10 minutes
  fusionnent (« 3 personnes ont aimé ta pièce ») au lieu de vibrer 3 fois.
- **Heures calmes** : 22 h → 8 h par défaut, modifiables. Rien ne part
  pendant ; la cloche et l'email restent inchangés.
- Ces trois règles vivent dans `src/lib/push-rules.ts` — fonctions pures,
  testées, partagées client (affichage des réglages) / serveur (décision).

## Événements poussés

`sale` (vente), `order` (expédiée/reçue/rappels — lot 1), `message`,
`circle` (réponse/mention — lot 2), `follow`, `like` (nouveau : la pièce
aimée n'émettait rien), `report` (admins, lot 4). Chacun porte son lien
profond, déjà défini par les lots précédents — rien à réécrire.

## Permissions et vie privée

- S'abonner/se désabonner : session requise, l'abonnement est lié au
  compte, jamais listé publiquement.
- Un abonnement mort (404/410 du service de push) est supprimé au premier
  échec — pas d'accumulation d'endpoints fantômes.
- La clé publique VAPID est publique par nature (`GET /api/push`), la
  privée ne quitte jamais l'environnement serveur.

## Drapeau et variables d'environnement

Sans `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `sendPush` ne fait rien et
l'UI n'invite à rien (le lot est livré **éteint**, tout le reste marche).
À poser dans Netlify (scope functions, contexte production) :

| Variable            | Rôle                                                |
| ------------------- | --------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | clé publique (base64url), servie au navigateur      |
| `VAPID_PRIVATE_KEY` | clé privée (base64url), signature des requêtes push |
| `VAPID_SUBJECT`     | `mailto:` de contact exigé par le protocole         |

Génération fournie : `npm run push:keys` (script local, aucune clé dans le
dépôt, aucune affichée dans un log partagé).

## Plan de tests

- **RFC 8291 §5** : vecteur officiel → sortie identique (preuve d'interop).
- Round-trip : chiffrer puis déchiffrer avec la clé du destinataire.
- Règles : heures calmes (dont plage à cheval sur minuit), plafond,
  regroupement, respect des préférences par type.
- E2E prod : abonnement réel depuis un appareil, réception d'une
  notification avec lien profond, désabonnement.

## Mesure de succès

Taux d'abonnés parmi les membres actifs, et taux de clic sur les push
(les liens profonds portent déjà `track()`). Zéro push envoyé hors
préférences : vérifié par les tests de règles.
