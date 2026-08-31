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

## Vérification en PROD (2026-08-31) — lot déployé ÉTEINT

| Contrôle                      | Résultat                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/push` sans clés     | `{enabled:false, publicKey:null, subscribed:false}` — le drapeau tient (D-023) ✓            |
| `/sw.js` servi à la racine    | 200, `application/javascript` ✓                                                             |
| `POST subscribe` sans session | **401** ✓                                                                                   |
| Réglages dans `/profil`       | **rien n'est affiché** tant que le serveur n'a pas de clés — aucun interrupteur mensonger ✓ |
| Vecteur RFC 8291 §5           | reproduit octet pour octet (test) ✓                                                         |
| Secrets au dépôt              | aucun ; seules les valeurs **publiées** du RFC figurent dans le test ✓                      |

## Allumage — ce qu'il reste à faire (2 minutes, côté Nouh)

1. `npm run push:keys` en local. Le script affiche les 3 variables et les
   commandes `netlify env:set` prêtes à coller. **Rien n'est écrit sur le
   disque, rien ne doit être commité.**
2. Coller les 3 commandes (scope `functions`, contexte `production`).
3. Redéployer (un `git push` vide ou le prochain commit suffit) — dès que
   les clés sont là, `enabled` passe à `true`, la section Notifications
   apparaît dans le profil et l'invitation devient possible.
4. Vérification sur appareil : Android Chrome (directement) et iPhone **après**
   ajout à l'écran d'accueil. Bouton « Tester » dans les réglages.

Tant que l'étape 2 n'est pas faite, tout le reste de l'app fonctionne
normalement : le lot est inerte, pas cassé.

## Revue adversariale du lot (30 agents, 4 angles) — 11 défauts confirmés, tous corrigés

Le lot a été relu par 4 revues indépendantes (crypto, vie privée,
anti-spam, service worker/client), chaque défaut soulevé étant ensuite
soumis à un sceptique chargé de le RÉFUTER. 12 verdicts rendus, 11 réels.
Le lot étant déployé **éteint**, aucun n'était exploitable en production —
tous sont corrigés avant l'allumage.

### Sécurité (les deux plus graves)

| Défaut                                                                                                                                                                                     | Correctif                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSRF** : l'endpoint d'abonnement n'était validé que par `startsWith("https://")`. Un membre pouvait faire émettre par le serveur des requêtes signées VAPID vers l'hôte de son choix.    | Liste blanche des services de push réels (`isAllowedPushEndpoint`, testée sur 12 cas dont `169.254.169.254` et le suffixe trompeur `fcm.googleapis.com.attaquant.example`), appliquée **à l'abonnement ET à l'envoi** (un endpoint stocké avant la garde est supprimé), plus `redirect: "manual"` (un 307 rejouerait le corps ailleurs). |
| **Amplification** : le plafond ne comptait que les envois RÉUSSIS. En enregistrant 10 endpoints qui échouent, le plafond devenait inatteignable : 1 requête → 10 POST sortants, en boucle. | On compte désormais la **tentative**, pas le succès + `rateLimit(60/h)` sur `/api/push` comme sur les autres endpoints d'écriture.                                                                                                                                                                                                       |

### Correction fonctionnelle

| Défaut                                                                                                                                                             | Correctif                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Les heures calmes ne marchaient pas du tout** : en `fr-FR`, `Intl.format` rend « 03 h », donc `Number()` → `NaN`, et toutes les comparaisons devenaient fausses. | `formatToParts` + filet UTC. La fonction a été **déplacée dans le module testé** (`src/lib/push-rules.ts`) : le bug existait précisément parce qu'elle vivait côté serveur, hors couverture. 4 tests ajoutés, dont l'heure d'été et minuit. |
| `rs=4096` annoncé sans borner le clair : au-delà de 4079 octets, l'enregistrement dépassait la taille déclarée → notification perdue en silence.                   | Garde explicite qui **échoue fort** (`encryptPayload` est exportée : le prochain appelant doit se cogner au mur, pas envoyer dans le vide).                                                                                                 |

### Vie privée / RGPD (suppression de compte)

| Ce qui survivait à la suppression                                                                                                              | Correctif                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Les publications du feed** (pseudo, nom, légende, photos) — servies publiquement par `/api/posts` sans authentification. Antérieur au lot 3. | Purge des posts + de leurs images, sur le modèle des annonces.                                                                                                                                                                   |
| **Les fils de Cercle** (pseudo, nom, likes). Antérieur au lot 3.                                                                               | **Anonymisation** plutôt que suppression : effacer un fil auquel d'autres ont répondu détruirait la parole d'autrui. Le fil reste, signé « Membre supprimé », sans handle ni id ; les réponses du partant, elles, disparaissent. |
| Les compteurs de regroupement `g:<uid>:<type>` (7 clés). Introduit par le lot 3.                                                               | Purge des 7 clés.                                                                                                                                                                                                                |
| Le `user-agent` stocké à l'abonnement, jamais lu.                                                                                              | Champ supprimé (minimisation).                                                                                                                                                                                                   |

### Hygiène

Le champ `grouped` de `decidePush` n'était jamais lu (code mort) — retiré
avec son test. Sur iOS, les deux branches de la détection renvoyaient
`ios-install` : dans un navigateur intégré (Instagram, TikTok), on
envoyait la personne installer une app qui n'aurait pas les API — corrigé
en `unsupported`.

### Consigné, non corrigé (assumé)

Les écritures `q:`/`g:` sont des lectures-modifications-écritures sans
écriture conditionnelle : deux événements simultanés pour la même personne
peuvent faire perdre un incrément. Conséquence maximale : un push de plus
que le plafond, ou un regroupement qui repart à 1. À l'échelle beta
(un membre reçoit rarement deux événements dans la même milliseconde), le
coût d'un compare-and-swap avec relances dépasse le bénéfice. À revoir si
le volume augmente — `@netlify/blobs` expose `onlyIfMatch`.

## Vérification en prod APRÈS correctifs (2026-08-31)

Les endpoints hostiles (`attaquant.example`, `169.254.169.254`,
`fcm.googleapis.com.attaquant.example`) sont tous **refusés** — mais par
la garde « lot éteint » (503), qui passe avant la liste blanche. La
liste blanche elle-même reste donc prouvée par ses **12 cas unitaires**
tant que les clés ne sont pas posées ; elle s'exercera en prod dès
l'allumage, et elle protège de toute façon aussi le chemin d'envoi
(`sendPush` la revérifie avant chaque requête sortante).

Compte de test supprimé, stores `push` et `circles` vides.

## ALLUMÉ en production (2026-08-31)

Les clés VAPID ont été générées et posées dans l'environnement Netlify
(scope `functions`, contexte `production`) **sans jamais transiter en
clair** : la sortie du générateur a été parsée en variables shell,
transmise à `netlify env:set`, puis effacée. Aucune clé n'a été affichée,
journalisée ni commitée.

| Contrôle, push ACTIF                                                                                              | Résultat                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/push`                                                                                                   | `enabled: true`, clé publique servie (87 caractères) ✓                                                                                                                                                                                     |
| Endpoints hostiles (`attaquant.example`, `169.254.169.254`, `fcm.googleapis.com.attaquant.example`, `http://` nu) | **400 « Abonnement invalide »** — la liste blanche est cette fois la seule garde en jeu, elle tient ✓                                                                                                                                      |
| Endpoint FCM légitime                                                                                             | accepté, `devices: 1` ✓                                                                                                                                                                                                                    |
| `op:"test"` → chaîne crypto complète                                                                              | **FCM a répondu 404 et non 401/403** : Google a donc ACCEPTÉ notre signature VAPID et nous a simplement dit que cet abonnement de test n'existe pas. C'est la preuve d'interopérabilité en conditions réelles, au-delà du vecteur du RFC ✓ |
| Purge des abonnements morts                                                                                       | l'abonnement a été retiré automatiquement au 404 (`devices: 0`) ✓                                                                                                                                                                          |
| Préférences par défaut                                                                                            | heures calmes 22 h → 8 h, actif ✓                                                                                                                                                                                                          |

Compte de test supprimé, store `push` vide.

### Reste à vérifier sur appareil réel (5 minutes, côté Nouh)

Le protocole ne peut pas aller plus loin sans un vrai téléphone : il faut
un abonnement délivré par un navigateur réel.

1. **Android / Chrome** : ouvrir le site, aimer une pièce (déclencheur),
   accepter l'invitation, puis Profil › Notifications › **Tester**.
2. **iPhone** : Partager → « Sur l'écran d'accueil », rouvrir depuis
   l'icône, puis mêmes étapes (l'invitation détecte le mode installé).
