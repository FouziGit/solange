# Lot 8 (spécification) — paiement réel par Stripe Connect

> **Statut : SPÉCIFICATION, pas une implémentation.** Aucun appel Stripe
> n'est écrit dans le dépôt à ce jour. Ce document dit quoi construire,
> dans quel ordre, et ce qui doit être tranché avant.
>
> Deux préalables NON TECHNIQUES bloquent la mise en production, et ils
> sont détaillés au chapitre 7 : l'immatriculation de l'exploitant comme
> plateforme Connect, et la qualification DSP2 du transit des fonds par
> le solde de la plateforme. Le second est le plus sérieux : il n'est pas
> acquis que Stripe Connect dispense SOLANGE d'un statut d'établissement
> de paiement dans le montage à rétention.
>
> Ce qui EST fait dans le dépôt à la date de ce document : `src/lib/fees.ts`,
> source unique du barème de commission, en centimes entiers (le barème
> vivait jusque-là en double, client et serveur).

# Plan d'intégration Stripe Connect — SOLANGE

**Statut : spécification d'exécution. Rédigée à partir du dossier vérifié et du code réel de `/Users/fouzi/solange`.**

Deux avertissements à lire avant la première ligne de code :

1. **Le montage décrit ici est constructible et démontrable en sandbox dès aujourd'hui. Sa mise en production est bloquée par deux verrous non techniques** (immatriculation de l'exploitant comme plateforme Connect, et qualification DSP2 du transit des fonds par le solde plateforme). Chapitre 6 et 7.
2. **Le vocabulaire « séquestre » / « escrow » est banni** du code, de l'UI, des CGU et des e-mails. Stripe : _« Stripe doesn't provide escrow services or support escrow accounts. »_ Le terme à employer partout est **« fonds retenus par SOLANGE jusqu'à confirmation de réception »**, cas d'usage explicitement admis par Stripe.

---

## 1. Le montage retenu

### 1.1 Décision, en une ligne

**Comptes connectés Accounts v1 à controller properties, dashboard Express, capability `transfers` seule, service agreement `full` ; encaissement en `separate charges and transfers` sur le compte plateforme ; rétention sur le solde plateforme ; versement par `POST /v1/transfers` avec `source_transaction` ; commission prélevée en réduisant le montant du transfert.**

### 1.2 Les cinq choix, et pourquoi

| Choix                       | Décision                                                                                                                                                                           | Justification (source dossier)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Type de compte connecté** | Accounts **v1** + `controller[*]`, jamais `type=standard/express/custom`                                                                                                           | Standard/Express/Custom sont marqués DEPRECATED, avec instruction explicite aux agents et LLM de ne plus les utiliser. Le type de dashboard est **immuable après création** — se tromper ici est irréversible par compte.                                                                                                                                                                                                                                                                                                                                                |
|                             | `controller[losses][payments]=application`<br>`controller[fees][payer]=application`<br>`controller[requirement_collection]=stripe`<br>`controller[stripe_dashboard][type]=express` | Contrainte dérivée confirmée : `losses.payments=application` + `requirement_collection=stripe` **impose** `stripe_dashboard.type=express` — la combinaison est fermée, il n'y a pas d'arbitrage à faire. Et la page `separate-charges-and-transfers` dit elle-même : _« We recommend using separate charges and transfers only when you're responsible for negative balances of your connected accounts. »_ Choisir `losses.payments=stripe` sortirait SOLANGE du cas d'usage recommandé pour ce pattern **et** fermerait le reversal quand un vendeur a vidé son solde. |
|                             | Capability **`transfers` seule**, pas `card_payments`                                                                                                                              | `transfers` suffit pour separate charges and transfers ; le vendeur n'encaisse jamais, c'est SOLANGE qui est marchand sur la charge. Conséquence assumée : `on_behalf_of` devient inutilisable (il exige une capability de paiement côté compte connecté) — ce n'est pas une perte, `on_behalf_of` ne change rien à la responsabilité litige, qui reste plateforme dans tous les cas.                                                                                                                                                                                    |
|                             | Service agreement **`full`**                                                                                                                                                       | Non négociable : `country_map.FR.tos_types = ['full']`. **Le recipient service agreement n'existe pas en France.** Toute la branche « recipient-only » du dossier est hors sujet ici.                                                                                                                                                                                                                                                                                                                                                                                    |
| **Encaisser**               | PaymentIntent **sur le compte plateforme**, avec `transfer_group`. Ni `transfer_data`, ni `application_fee_amount`, ni `on_behalf_of`.                                             | Seul `separate charges and transfers` permet d'encaisser puis de verser plus tard. En destination charges, le transfert part **immédiatement à la capture** — incompatible avec le cycle SOLANGE.                                                                                                                                                                                                                                                                                                                                                                        |
| **Retenir**                 | Les fonds restent sur le **solde Stripe de la plateforme** entre le paiement et l'entrée en `terminee`. **Pas** de `capture_method=manual`.                                        | La fenêtre d'autorisation carte est de 7 jours (Visa CIT ; 4 j 18 h en MIT) — J+14 est hors d'atteinte. Le mode `payment_method_options[card][capture_method]=automatic_delayed` ne sauve rien : _« If the authorization window is shorter than the specified delay period, we capture the PaymentIntent before expiration, ignoring the delay period. »_ **Il faut capturer tout de suite et retenir sur le solde.** Plafond dur : **90 jours** pour la France.                                                                                                         |
| **Verser**                  | `POST /v1/transfers` avec `amount`, `currency`, `destination`, `transfer_group`, `source_transaction`, en-tête `Idempotency-Key`                                                   | `source_transaction` fait réussir le transfert **même si le solde disponible est insuffisant** (le transfert hérite du pending de la charge). En France le solde est disponible à T+3 jours ouvrés (7 j calendaires pour les premiers paiements) : sans `source_transaction`, un acheteur qui confirme à J+1 provoquerait un `balance_insufficient`, **que Stripe ne réessaie jamais**. `source_transaction` est immuable après création : il se passe à la création ou jamais.                                                                                          |
| **Commission**              | `feeCents = Math.round(amountCents * rate)` ; `sellerCents = amountCents - feeCents` ; on transfère `sellerCents`. **Aucun objet ApplicationFee n'est créé.**                      | _« The platform can collect fees on a charge by reducing the amount it transfers to the destination accounts. »_ `application_fee_amount` et `transfer_data[amount]` sont des paramètres de **destination charges** — ils exigent `transfer_data[destination]` sur le PaymentIntent, donc le versement immédiat. **Rétention et ApplicationFee ne se cumulent pas.** On choisit la rétention.                                                                                                                                                                            |

### 1.3 Alternatives écartées, explicitement

- **Accounts v2 / onboarding recipient-only** : `stripe_balance.payouts` est documenté dans la configuration _merchant_, pas _recipient_. Rien dans la doc n'établit qu'un compte recipient-only peut être versé sur un compte bancaire. Écarté jusqu'à validation Stripe.
- **Funds segregation (allocated funds)** : répond exactement au risque réglementaire du chapitre 7, mais c'est une **private preview** nécessitant un account manager, limitée à Visa/MC/Discover/Amex/Swish (le réseau **CB** français n'est pas cité), non identifiable dans le Dashboard, facturation asynchrone, test sandbox uniquement. Une plateforme naissante ne bâtit pas dessus. À réévaluer post-lancement.
- **Destination charges** : plus défendables au regard du considérant 11 DSP2, mais structurellement incapables de retenir. Si un avocat impose ce flux, **c'est le produit qui change, pas l'implémentation** — la rétention disparaît.

### 1.4 Ordre exact des appels API, cycle nominal

```
① À l'inscription vendeur (avant toute mise en vente)
   POST /v1/accounts
     business_type=individual
     controller[losses][payments]=application
     controller[fees][payer]=application
     controller[requirement_collection]=stripe
     controller[stripe_dashboard][type]=express
     capabilities → transfers
   → acct_xxx  (persisté dans Blobs : users/u:<id>.stripeAccountId)

② POST /v1/account_links
     account=acct_xxx
     type=account_onboarding
     refresh_url=…  return_url=…
     collection_options[fields]=eventually_due
   → url à usage unique, expire à created + 300 s. JAMAIS stockée, JAMAIS envoyée par e-mail ou SMS.

③ Achat — capturePayment()
   POST /v1/payment_intents
     amount=<amountCents>  currency=eur  transfer_group=<orderId>
   (les paramètres de confirmation côté client sont hors périmètre de ce plan)

④ Webhook plateforme : payment_intent.succeeded
   → lire latest_charge → chargeId persisté → commande passe en « payee »

⑤ Entrée en « terminee » (receive acheteur | close J+14 | resolve_close admin)
   POST /v1/transfers                       [Idempotency-Key: <clé stockée>]
     amount=<sellerCents>
     currency=eur
     destination=acct_xxx
     transfer_group=<orderId>
     source_transaction=<chargeId>
   → tr_xxx persisté

⑥ Entrée en « annulee » (cancel | auto_cancel J+7 | resolve_cancel admin)
   POST /v1/refunds sur la charge           [Idempotency-Key: <clé stockée>]
   → re_xxx persisté
```

### 1.5 Économie du montage — à trancher avant de coder

`controller[fees][payer]=application` : **SOLANGE paie tous les frais Stripe**, en plus de la commission, et supporte le surcoût Connect des comptes Express (_« There's an additional cost for using Express or Custom connected accounts »_ — montant non vérifié). Sur des paniers de mode d'occasion à faible montant, une commission à 2 % peut être **inférieure** au coût Stripe de la transaction. La grille 4 / 3,5 / 2,5 / 2 % doit être validée contre la grille tarifaire réelle avant le lancement. Chiffres non vérifiés → chapitre 7.

---

## 2. Correspondance avec le cycle existant

Le code réel (`/Users/fouzi/solange/src/lib/order-state.ts`) donne une propriété précieuse : **toutes les routes d'argent convergent vers deux états terminaux**.

- `receive` (acheteur) écrit `recue` puis **immédiatement** `terminee` dans la même transition.
- `close` (cron J+14) va de `expediee` directement à `terminee`.
- `resolve_close` (admin) va de `litige` à `terminee`.
- `cancel`, `auto_cancel` (J+7), `resolve_cancel` (admin) vont tous à `annulee`.

**Donc : un seul point de versement (entrée en `terminee`), un seul point de remboursement (entrée en `annulee`).** Aucun autre état ne déclenche d'appel Stripe. C'est le cœur de la sûreté du montage : deux chokepoints, deux verrous.

### 2.1 Table de correspondance exhaustive

| Transition (état → état)                                  | Déclencheur                                                   | Appel Stripe                                                                                                          | Écriture Blobs                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| _(néant)_ → **payee**                                     | `payment_intent.succeeded` (webhook plateforme)               | **Aucun** — le paiement est déjà capturé                                                                              | `o:<id>.status=payee`, `paymentIntentId`, `chargeId`, `amountCents`, `feeRateBps`, `feeCents`, `sellerCents`, `sellerAcctId` **gelés** |
| payee → **expediee** (`ship`, vendeur)                    | Vendeur déclare l'envoi                                       | **Aucun.** Purement interne. L'argent ne bouge pas.                                                                   | `shippedAt`, `shipment`                                                                                                                |
| payee → **annulee** (`cancel`, vendeur)                   | Vendeur annule avec motif                                     | **`POST /v1/refunds`** intégral sur la charge                                                                         | Intent `pay:<id>` en `onlyIfNew` (type=refund)                                                                                         |
| payee → **annulee** (`auto_cancel`, cron J+7)             | Non expédié à J+7                                             | **`POST /v1/refunds`** intégral                                                                                       | idem                                                                                                                                   |
| expediee → **recue** → **terminee** (`receive`, acheteur) | Acheteur confirme réception                                   | **`POST /v1/transfers`** de `sellerCents`                                                                             | Intent `pay:<id>` en `onlyIfNew` (type=transfer)                                                                                       |
| expediee → **terminee** (`close`, cron J+14)              | Clôture d'office                                              | **`POST /v1/transfers`** de `sellerCents`                                                                             | idem                                                                                                                                   |
| expediee → **litige** (`dispute`, acheteur)               | Acheteur signale non-reçue / non-conforme                     | **Aucun.** L'argent reste retenu sur le solde plateforme. **Et le compte à rebours des 90 jours continue de courir.** | `dispute{reason,note,at}`, `holdDeadlineAt = paidAt + 85 j`                                                                            |
| litige → **annulee** (`resolve_cancel`, admin)            | Arbitrage en faveur de l'acheteur                             | **`POST /v1/refunds`** intégral                                                                                       | Intent `pay:<id>` (type=refund)                                                                                                        |
| litige → **terminee** (`resolve_close`, admin)            | Arbitrage en faveur du vendeur                                | **`POST /v1/transfers`** de `sellerCents`                                                                             | Intent `pay:<id>` (type=transfer)                                                                                                      |
| recue → litige                                            | _inatteignable aujourd'hui_ (`receive` clôture immédiatement) | —                                                                                                                     | Voir §2.3                                                                                                                              |
| **terminee → toute autre**                                | _n'existe pas dans la machine_                                | —                                                                                                                     | **Trou identifié — §2.3**                                                                                                              |

### 2.2 Règles transverses de la table

- **Une commande n'entre dans la machine qu'après `payment_intent.succeeded`.** Un panier abandonné, un 3DS échoué, un `payment_intent.payment_failed` ne crée aucune commande. Cela supprime tout un pan de cas d'annulation avant paiement.
- **`amountCents`, `feeRateBps`, `feeCents`, `sellerCents` sont calculés une seule fois, à l'entrée en `payee`, et gelés sur la commande.** Un changement de grille tarifaire ne doit jamais modifier une commande en vol. Ces valeurs ne sont **jamais** recalculées depuis `totalEUR` au moment du transfert.
- **Aucune transition n'appelle Stripe en ligne.** `applyTransition` écrit une _intention de mouvement d'argent_ dans le store `payouts` avec `onlyIfNew`, et rend la main. Un exécuteur (webhook `transfer.created`/`charge.refunded` + cron de rattrapage) réalise l'appel. Motif : une transition doit rester rapide et atomique, et l'écriture conditionnelle `onlyIfNew` est **le** verrou anti-double-versement (§5.1).
- **Le litige interne SOLANGE n'est pas un dispute Stripe.** Côté Stripe, un arbitrage rendu en faveur de l'acheteur est un simple refund. Les objets `charge.dispute.*` désignent exclusivement une contestation **bancaire**, qui suit un chemin parallèle (§5.3).

### 2.3 Deux trous dans la machine à états actuelle — à combler dans le même lot

**a) Il n'existe aucune sortie de `terminee`.** Or après versement, trois événements peuvent exiger un mouvement inverse : un chargeback bancaire, un `radar.early_fraud_warning.created`, une décision d'arbitrage tardive. Le versement étant fait, il faut `POST /v1/refunds` **et** `POST /v1/transfers/{id}/reversals` — deux appels, sans état pour les porter.

→ **Ajouter un état `rembourse_apres_versement`**, atteignable depuis `terminee` par le rôle `admin` et par le rôle `system` (webhook dispute). C'est une modification de `/Users/fouzi/solange/src/lib/order-state.ts` : nouvel `OrderStatus`, nouvelle `OrderAction` (`reverse`), entrée dans `TRANSITIONS` avec `from: ["terminee"], roles: ["admin","system"]`.

**b) `dispute` n'est pas atteignable après `receive`,** puisque `receive` écrit `terminee` dans la même passe. Aujourd'hui c'est cohérent (rien à récupérer). Avec de l'argent réel, l'acheteur qui clique « bien reçu » puis découvre un problème 10 minutes plus tard n'a **aucun recours produit** — il ira directement à la banque, ce qui est le pire cas pour SOLANGE.

→ **Découpler `recue` de `terminee`** : `receive` s'arrête à `recue`, et une clôture système (`close`) intervient après un délai court à définir (24 h ou 48 h). Le transfert se déclenche alors sur l'entrée en `terminee`, comme prévu, mais avec une fenêtre de rétractation qui absorbe les regrets immédiats. `dispute` redevient atteignable depuis `recue`, comme la table le prévoit déjà.

---

## 3. Ce qui doit exister côté vendeur

### 3.1 Onboarding — quand, et bloquant sur quoi

**Un compte connecté est créé au premier passage en mode vendeur, et la publication d'une annonce est bloquée tant que l'onboarding n'est pas complet.** C'est la seule position tenable : laisser vendre puis découvrir au moment de payer qu'on ne peut pas verser, c'est créer une dette d'argent retenu avec une échéance à 90 jours.

Séquence : `POST /v1/accounts` → `POST /v1/account_links` (`collection_options[fields]=eventually_due`) → redirection Stripe-hosted → retour sur `return_url`.

Contraintes dures :

- **La création via le Dashboard est interdite en France** : _« Platforms in France can't create connected accounts in the Dashboard. »_ Tout passe par l'API.
- **L'Account Link est à usage unique et expire à `created + 300 s`.** Elle est consommée même par un simple aperçu de lien dans une messagerie. Elle n'est jamais persistée, jamais envoyée par e-mail ou SMS : elle est générée à la demande, sur un clic authentifié, et renvoyée en redirection immédiate.
- **Le retour sur `return_url` ne signifie pas que l'onboarding est terminé.** Il faut re-lire le compte via l'API et inspecter `requirements`, ou s'appuyer sur `account.updated`. Ne jamais marquer un vendeur « vérifié » sur la foi du redirect.
- **`collection_options[fields]=eventually_due` à l'onboarding**, pas `currently_due` : on collecte tout d'un coup pour éviter un blocage six semaines plus tard, au moment précis où de l'argent attend. `currently_due` est réservé aux relances de remédiation.

### 3.2 Vérification d'identité — qui collecte quoi

`controller[requirement_collection]=stripe` : **c'est Stripe qui collecte et vérifie le KYC**, pas SOLANGE. SOLANGE ne voit, ne stocke et ne transporte aucune pièce d'identité. (Le KYC serait à la charge de la plateforme uniquement si `losses_collector=application` **et** `dashboard=none` — ce n'est pas notre configuration.)

Champs requis pour un compte FR/FR `individual`, dashboard Express, agreement `full`. Le dossier en nomme **11 sur 15** :

`business_profile.mcc` · `business_profile.url` · `individual.first_name` · `individual.last_name` · `individual.address` · `individual.dob` · `individual.phone` · `individual.email` · `tos_acceptance.ip` · `tos_acceptance.date` · `external_account`

**Ne sont PAS requis** : `individual.id_number`, `individual.verification.document`, `company.tax_id`. **Aucun champ SIRET ou numéro d'entreprise n'apparaît** pour un vendeur particulier français.

Les 4 champs restants doivent être lus à l'exécution dans `requirements.currently_due` du premier compte de test — ils ne sont pas dans le dossier, et ils ne doivent pas être devinés. L'hypothèse selon laquelle demander `transfers` seule réduirait cette liste (12 champs, disparition de `business_profile.mcc`) a été **réfutée** : prévoir les 15.

### 3.3 Contrôle obligatoire avant tout transfert

Aucun `POST /v1/transfers` sans avoir relu le compte et vérifié, sur l'objet Account frais :

```
payouts_enabled === true
details_submitted === true
capabilities.transfers === "active"
requirements.currently_due  vide
requirements.past_due       vide
requirements.disabled_reason null
```

Note d'implémentation : la doc liste aussi `charges_enabled` dans ce contrôle, mais avec la seule capability `transfers` ce drapeau n'a pas de raison d'être vrai — **à observer en sandbox sur le premier compte réel avant de l'inclure dans le prédicat bloquant** (chapitre 7).

C'est un contrôle **continu**, pas un contrôle d'onboarding : on écoute `account.updated` et `capability.updated`, on met à jour un miroir local `sellerPayable: boolean` sur l'utilisateur, et on le relit avant chaque transfert.

### 3.4 Si un vendeur vend sans être vérifié

Le cas doit rester rare (publication bloquée en §3.1) mais reste possible : capability perdue en cours de route, `current_deadline` dépassée, `external_account` invalidé, compte fermé.

Ce qui se passe réellement : **la vente et le paiement fonctionnent normalement** — SOLANGE est marchand sur la charge, le compte connecté n'intervient pas à l'encaissement. L'argent arrive sur le solde plateforme. **C'est au versement que ça casse**, avec `capability_not_active`, `payouts_not_allowed` ou `transfers_not_allowed`.

Procédure, dans cet ordre :

1. **Ne jamais laisser le transfert échouer en silence.** Toute erreur de `POST /v1/transfers` marque la commande `payoutBlocked` avec le code d'erreur et notifie l'admin.
2. La commande reste en `terminee`, l'argent reste retenu. Le vendeur est notifié et reçoit un lien de remédiation : `POST /v1/account_links` fraîche, `collection_options[fields]=currently_due`.
3. Une tâche rejoue l'intent de versement à chaque `account.updated`/`capability.updated` qui rend le vendeur à nouveau payable, et périodiquement.
4. **Échéance dure : `paidAt + 85 jours`.** Le plafond de rétention France est de 90 jours ; on garde 5 jours de marge opérationnelle. Passé 85 jours sans vendeur payable : **`POST /v1/refunds` intégral à l'acheteur**, commande basculée en `annulee`, vente réputée non aboutie. SOLANGE perd les frais Stripe. C'est un coût assumé, pas un incident.
5. Ce compte à rebours est **le même** pour un litige qui s'éternise. Un arbitrage SOLANGE ne peut pas dépasser 85 jours. À écrire dans les CGU et dans les règles internes de modération.

_Ce que la doc ne dit pas : ce que fait Stripe au 91ᵉ jour (versement d'office, blocage du compte, contact plateforme). Chapitre 7._

### 3.5 Ce qui n'est pas l'affaire de Stripe mais qui reste l'affaire de SOLANGE

Aucun SIRET n'est demandé par Stripe pour un vendeur particulier. Cela **ne dispense pas** SOLANGE de :

- **DAC7** (art. 1649 ter A à 1649 ter E CGI, applicable aux opérations depuis le 1ᵉʳ janvier 2023) : diligence, déclaration annuelle **au plus tard le 31 janvier** de l'année suivante, information du vendeur. Un vendeur n'est exclu que s'il réalise **moins de 30 activités ET** une contrepartie totale n'excédant pas 2 000 € — condition **cumulative**. Sanctions : 20 € par erreur non régularisée, plafonds 10 000 / 25 000 / 50 000 € ; régime allégé en correction spontanée (1ʳᵉ infraction sans sanction, puis 10 € par erreur, plafonds 5 000 / 15 000 / 50 000 €).
- **Art. 242 bis CGI** : information **loyale, claire et transparente** sur les obligations fiscales et sociales, **à chaque transaction**.
- **Art. L111-7 et D111-8 du Code de la consommation** (D111-8 en vigueur depuis le 9 juillet 2024) : rubrique dédiée facilement accessible, et mentions spécifiques aux offres **entre consommateurs**. C'est exactement le cas SOLANGE.

Ces obligations sont indépendantes de Stripe et doivent figurer dans le même lot que l'intégration — elles conditionnent la légalité de l'exploitation, pas seulement sa conformité fiscale. Le dossier `/Users/fouzi/solange/legal/` est le bon endroit.

---

## 4. Les webhooks

### 4.1 Deux endpoints, deux secrets — le piège de scope

Le stub actuel `/Users/fouzi/solange/netlify/functions/payment-webhook.mts` (un endpoint, `/api/payment/webhook`, 501) **doit être scindé en deux fonctions distinctes avec deux `whsec_` distincts**.

Motif, confirmé et contre-intuitif : en separate charges and transfers, **les `payment_intent.*` et `charge.dispute.*` arrivent sur l'endpoint « Your account », pas sur « Connected accounts »**. Les événements de compte connecté (`connect=true`) portent une propriété racine `account` et arrivent ailleurs. Brancher un seul endpoint fait manquer silencieusement la moitié des signaux.

### 4.2 Endpoint A — plateforme (« Your account »)

| Événement                           | Déclenche                                                                                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment_intent.succeeded`          | **Crée la commande en `payee`.** Lit `latest_charge` → `chargeId`. Gèle `amountCents`/`feeCents`/`sellerCents`. Point d'entrée unique du cycle.                                                                      |
| `charge.succeeded`                  | Confirmation d'encaissement effectif. **Pour tout moyen de paiement asynchrone, c'est cet événement — pas `payment_intent.succeeded` — qui autorise un transfert.**                                                  |
| `payment_intent.processing`         | Trace uniquement. Aucune commande créée, aucun transfert.                                                                                                                                                            |
| `payment_intent.payment_failed`     | Trace + notification acheteur. Aucune commande.                                                                                                                                                                      |
| `payment_intent.canceled`           | Trace. Aucune commande.                                                                                                                                                                                              |
| `charge.updated`                    | Filet de sécurité : détecte un transfert sauté (`transfer_data` à `null`). Comportement documenté pour les destination charges ; conservé ici parce qu'il coûte une ligne et couvre une classe d'erreur silencieuse. |
| `charge.refunded`                   | Confirme un remboursement. Clôt l'intent `pay:<id>` (type=refund), écrit `refundId`, passe la commande en `annulee` si ce n'est pas déjà fait.                                                                       |
| `transfer.created`                  | **Confirme le versement.** Clôt l'intent `pay:<id>` (type=transfer), écrit `transferId`. Seul événement qui autorise à afficher « payé » au vendeur.                                                                 |
| `transfer.reversed`                 | Confirme un reversal. Écrit `reversalId`.                                                                                                                                                                            |
| `charge.dispute.created`            | **Alarme rouge.** Gèle tout mouvement sur la commande. Si non encore versé → blocage du transfert. Si déjà versé → crée un intent de reversal. Notifie l'admin.                                                      |
| `charge.dispute.funds_withdrawn`    | Acte le débit effectif du solde plateforme (montant + frais). Comptabilité.                                                                                                                                          |
| `charge.dispute.closed`             | Résultat de la contestation.                                                                                                                                                                                         |
| `charge.dispute.funds_reinstated`   | Contestation gagnée : fonds restitués. Débloque la commande, rejoue le transfert vendeur si applicable.                                                                                                              |
| `payout.paid` / `payout.failed`     | Santé du solde plateforme. `payout.failed` est un signal d'incident, pas de cycle.                                                                                                                                   |
| `radar.early_fraud_warning.created` | **Signal précoce de fraude, avant le chargeback.** Gèle le versement de la commande concernée et notifie l'admin. C'est la seule occasion d'agir avant que l'argent parte.                                           |

### 4.3 Endpoint B — comptes connectés (`connect=true`)

| Événement                          | Déclenche                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account.updated`                  | Recalcule `sellerPayable` (§3.3). Si le vendeur redevient payable → rejoue les intents de versement en attente. S'il cesse de l'être → bloque la publication de ses annonces. |
| `capability.updated`               | Idem, ciblé sur `transfers`.                                                                                                                                                  |
| `person.updated`                   | Trace KYC. Peut précéder un changement de `requirements`.                                                                                                                     |
| `account.external_account.updated` | Changement de compte bancaire vendeur. Ne bloque pas, mais journalise (signal de prise de contrôle de compte).                                                                |
| `payout.failed`                    | Le versement du vendeur vers **sa** banque a échoué. N'affecte pas la commande (le transfert SOLANGE→vendeur a réussi) mais doit être remonté au vendeur.                     |
| `account.application.deauthorized` | Le vendeur a coupé le lien. Bloque immédiatement toute publication et tout versement futur ; déclenche la procédure §3.4 sur les commandes en cours.                          |

**N'écouter que ces événements.** Certains types ne sont créés que si un webhook les écoute explicitement (« Selection required »), et un endpoint « tous les événements » **ne satisfait pas** cette condition.

### 4.4 Implémentation Netlify — non négociable

```ts
// PREMIÈRE ligne du handler, avant tout le reste.
const raw = await req.text();
const event = stripe.webhooks.constructEvent(
  raw,
  req.headers.get("stripe-signature"),
  process.env.STRIPE_WEBHOOK_SECRET_PLATFORM, // ou _CONNECT
);
```

- Netlify Functions 2.0 reçoit un `Request` web standard : **son corps est un flux à lecture unique**. Un `.json()` suivi d'un `.text()` lève « Body is unusable ». Jamais de `JSON.parse` puis `JSON.stringify` : tout réencodage casse la signature.
- Format de l'en-tête : `t=<timestamp>,v1=<hmac>,v0=<fake>`. HMAC-SHA256 sur `` `${t}.${rawBody}` `` avec le `whsec_` comme clé, comparaison à **temps constant**. Ignorer tout schéma autre que `v1` (`v0` est réservé aux événements de test). Plusieurs `v1=` peuvent coexister pendant une rotation, jusqu'à 24 h.
- **Tolérance par défaut : 5 minutes. Ne jamais la mettre à 0.** Serveur à l'heure (NTP). Un réessai Stripe régénère signature **et** timestamp : un rejeu légitime n'est jamais rejeté par la tolérance.
- **L'erreur numéro un est le mauvais secret** : celui de `stripe listen` diffère de celui du Dashboard, et chaque endpoint a le sien (test et live inclus). Quatre variables d'environnement distinctes, nommées sans ambiguïté.
- **Exempter la route de toute protection CSRF** (`sameOrigin()` de `/Users/fouzi/solange/netlify/functions/_shared/core.mts` ne doit pas s'y appliquer). Combiner vérification de signature **et** allowlist d'IP, comme Stripe le recommande.
- **Renvoyer un 2xx avant toute logique lourde.** Retries : 3 jours en live avec backoff exponentiel, 3 fois sur quelques heures en sandbox. **Un 3xx est compté comme un échec.** Limites Netlify, non configurables : 60 s en synchrone, 30 s en planifié, 15 min en background.
- Motif retenu : _vérifier → déduplication `onlyIfNew` sur `event.id` → écrire l'intent → répondre 200_. L'exécution des appels Stripe se fait dans un drainer séparé. Un handler de webhook ne fait jamais plus d'un appel API.

---

## 5. Ce qui peut mal tourner

### 5.1 Double versement — le risque numéro un

**Rien, côté Stripe, n'empêche deux `POST /v1/transfers` sur la même charge.** Plusieurs transferts par `source_transaction` sont autorisés, et la commission étant faible, un second transfert du montant net passera toujours sous le plafond du montant source. **Ce garde-fou est intégralement à la charge de SOLANGE.**

Trois verrous superposés, dans cet ordre :

1. **Verrou d'intention (le vrai).** Store `payouts`, `getStore({ name: "payouts", consistency: "strong" })`. À l'entrée en `terminee`, écriture de `pay:<orderId>` en **`onlyIfNew`**. Si la réponse porte `{ modified: false }`, une intention existe déjà : **on s'arrête, sans exception**. L'intent contient une `Idempotency-Key` (UUID v4) générée une seule fois et persistée.
2. **`Idempotency-Key` sur l'appel.** Stripe mémorise code HTTP et corps de la première requête et rejoue le même résultat, y compris un 500. UUID v4, 255 caractères max, aucune donnée sensible. **Mais les clés sont purgées après ~24 h** — or les retries webhook durent 3 jours et un resend manuel jusqu'à 15 j (Dashboard) / 30 j (CLI). **L'`Idempotency-Key` ne suffit donc pas** ; c'est le verrou 1 qui porte la garantie.
3. **État terminal.** Dès `transfer.created`, `transferId` est écrit sur la commande. Tout exécuteur qui trouve un `transferId` non nul refuse d'agir.

Le store `orders` est déjà en consistance forte (`store()` dans `core.mts`) — la moitié du travail est faite. **À corriger en revanche : `applyTransition` écrit la commande avec `setJSON` non conditionnel après une relecture fraîche.** Deux appels concurrents (double-clic acheteur, ou clic acheteur pendant le passage du cron horaire) peuvent tous deux observer `expediee` et tous deux écrire. Passer cette écriture en **`onlyIfMatch` (ETag)**, et sur `{ modified: false }` relire et réévaluer. Le verrou 1 protège déjà l'argent, mais un historique de commande incohérent est un problème à part entière.

Rappel Blobs : cohérence éventuelle par défaut (les nouvelles clés sont visibles immédiatement, les mises à jour et suppressions jusqu'à 60 s). Toute clé qui porte de l'argent est en `consistency: "strong"`. Limites : clé 600 octets, métadonnées 2 Ko, objet 5 Go.

### 5.2 Impayés et paiements asynchrones

- **Ne jamais transférer sur `payment_intent.processing`.** Avec un moyen de paiement asynchrone, `charge.succeeded` est la seule autorisation.
- **Avec `source_transaction` sur un paiement qui finit par échouer, c'est la plateforme qui est débitée**, et contrairement aux destination charges, **Stripe n'inverse pas automatiquement le transfert en separate charges and transfers**.
- **Décision de lancement : cartes uniquement.** Ne pas activer `automatic_payment_methods`, qui ferait entrer SEPA Debit par la porte de service. Les moyens asynchrones ne seront ouverts qu'après que le chemin `charge.succeeded` aura été prouvé en sandbox.

### 5.3 Litige bancaire (chargeback)

C'est le trou de risque le plus coûteux d'une marketplace C2C mode (contrefaçon, non-réception).

**En separate charges and transfers, avec ou sans `on_behalf_of`, Stripe débite automatiquement le compte de la PLATEFORME du montant contesté ET des frais.** Seules les direct charges tentent d'abord le compte connecté — et nous ne faisons pas de direct charges.

- **Avant versement** : le débit tombe sur le solde plateforme, mais l'argent de la commande y est encore. Geler l'intent, ne pas verser, attendre `charge.dispute.closed`.
- **Après versement** : SOLANGE est débitée et le vendeur a l'argent. Seul recours : `POST /v1/transfers/{id}/reversals`. _« It's only possible to reverse a transfer if the connected account's available balance is greater than the reversal amount or has connected reserves enabled. »_ Un vendeur qui a retiré ses fonds rend le reversal impossible.
- **Filets** : `settings.payouts.debit_negative_balances` (v1) / `payments[debit_negative_balances]` — le prélèvement sur le compte bancaire externe du vendeur est possible en zone SEPA. **Il est à `false` par défaut quand la plateforme collecte les requirements** : c'est un réglage à poser explicitement, pas un acquis. Aucun payout tant que le solde est négatif ; pas de carte de débit.
- **Levier structurel** : retarder le payout du vendeur de son solde Stripe vers sa banque, pour que l'argent reste atteignable par un reversal. `payments[settlement_timing][delay_days_override]` sur `POST /v1/balance_settings` avec en-tête `Stripe-Account` (v1 : `settings.payouts.schedule.delay_days`), ou payouts manuels (`payments[payouts][schedule][interval]=manual` puis `POST /v1/payouts`). Éditable **uniquement** sur les comptes où la plateforme porte la responsabilité fraude et litige — ce qui est notre cas avec `controller[losses][payments]=application`. **Attention : la limite de 90 jours s'applique aussi à ce mode de rétention.** Ce n'est pas une mitigation prescrite par Stripe, c'est une décision d'architecture.
- **Exposition structurelle résiduelle** : la clôture d'office à J+14 verse bien avant la fin de la fenêtre de contestation bancaire. **La durée réelle de cette fenêtre n'a pas été vérifiée** (chapitre 7) — elle conditionne le dimensionnement de la provision et le réglage du `delay_days_override`. Ne pas lancer sans ce chiffre.
- **Si SOLANGE conteste et gagne** : le re-transfert au vendeur échoue si le solde plateforme est insuffisant. Il faut alimenter le solde Stripe.

Une réserve est de toute façon retenue par Stripe sur le solde disponible de la plateforme pour couvrir les soldes négatifs dont elle est responsable, avec une règle de 180 jours. Ce mécanisme ne s'applique **que** parce que nous portons les soldes négatifs.

### 5.4 Remboursement après versement

Deux appels, jamais un :

```
POST /v1/refunds                              (rembourse l'acheteur, depuis le solde plateforme)
POST /v1/transfers/{TRANSFER_ID}/reversals    (récupère chez le vendeur)
```

**Rembourser la charge n'annule pas le transfert en separate charges and transfers.** Le paramètre `reverse_transfer=true` sur `POST /v1/refunds` existe mais vise les destination charges : **coder le reversal explicite par défaut.** Le reversal accepte `amount` (partiel et répétable), `description`, `metadata`, `refund_application_fee` ; la réponse porte `transfer_reversal` et `destination_payment_refund`.

Chaque appel porte son propre verrou `onlyIfNew` et sa propre `Idempotency-Key` : un remboursement réussi suivi d'un reversal échoué ne doit jamais provoquer un second remboursement au rejeu.

**Avant versement, c'est infiniment plus simple** : un seul `POST /v1/refunds`, débité du solde plateforme, l'acheteur récupère 100 %, SOLANGE ne perd que les frais Stripe. C'est un argument produit décisif en faveur d'une fenêtre de rétractation courte (§2.3b) : elle déplace des cas coûteux vers le cas pas cher.

### 5.5 Rejeu et désordre des webhooks

- **Aucune garantie d'ordre. Doublons possibles.** `charge.succeeded` peut arriver avant `payment_intent.succeeded`.
- **Ne jamais utiliser `created` pour ordonner ou dédupliquer.** Suivre les `event.id`. Pour les doublons portant deux objets Event distincts, dédupliquer sur `data.object.id` + `event.type`.
- Store `events` en consistance forte : `evt:<event.id>` écrit en `onlyIfNew`. `{ modified: false }` → 200 immédiat, aucun traitement.
- **Réclamation en deux temps** : `onlyIfNew` marque « en cours », une écriture finale marque « terminé ». Un crash entre les deux laisserait un événement perdu — un balayeur reprend les réclamations « en cours » de plus de N minutes. Sans cela, la déduplication crée elle-même une classe de perte silencieuse.
- La machine à états ne recule jamais : toute transition revalide l'état de départ via `nextStatus()` avant d'écrire. Un rejeu tardif de `payment_intent.succeeded` sur une commande déjà `terminee` ne fait rien.

### 5.6 Arrondi de commission

```ts
const feeCents = Math.round(amountCents * rate); // UN seul arrondi
const sellerCents = amountCents - feeCents; // jamais un second Math.round
```

- **Tout en entiers, en centimes.** Les montants Stripe sont des entiers en plus petite unité monétaire.
- **Les seuils de palier (4 % / 3,5 % / 2,5 % / 2 %) se comparent en centimes entiers**, jamais en euros flottants.
- **Point d'attention issu du code réel** : `capturePayment` reçoit aujourd'hui `totalEUR: number`, un flottant en euros (`/Users/fouzi/solange/netlify/functions/_shared/payment.mts`). La conversion `amountCents = Math.round(totalEUR * 100)` doit être faite **une seule fois, à la création de la commande**, et `amountCents` devient dès lors la seule source de vérité. Aucun recalcul depuis le flottant ensuite.
- **`feeRateBps` est gelé sur la commande** à l'entrée en `payee`. Un changement de grille ne touche aucune commande en vol.
- **Deux décisions produit à figer avant de coder** (aucune contrainte Stripe ne les tranche) : les seuils exacts des quatre paliers, et l'assiette de la commission (`priceEUR` seul ou `totalEUR` frais de port inclus — les deux champs coexistent dans `OrderRecord`). À écrire dans `/Users/fouzi/solange/DECISIONS.md`.

### 5.7 Récapitulatif des garde-fous

| Risque                                    | Garde-fou                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Double versement                          | `onlyIfNew` sur `pay:<orderId>` + `Idempotency-Key` persistée + `transferId` terminal |
| Écriture concurrente de statut            | `onlyIfMatch` (ETag) sur `o:<id>`, relecture sur `{ modified: false }`                |
| Transfert refusé (`balance_insufficient`) | `source_transaction` systématique                                                     |
| Transfert refusé (vendeur non payable)    | Prédicat §3.3 avant appel + rejeu sur `account.updated` + échéance 85 j               |
| Paiement asynchrone qui échoue            | Cartes uniquement au lancement ; sinon attendre `charge.succeeded`                    |
| Chargeback avant versement                | Gel sur `charge.dispute.created` et `radar.early_fraud_warning.created`               |
| Chargeback après versement                | Reversal + `debit_negative_balances` + délai de payout vendeur + provision            |
| Rejeu webhook                             | Déduplication `event.id`, réclamation deux temps, balayeur                            |
| Perte d'événement                         | Cron de rattrapage qui relit les intents non clos                                     |
| Dépassement des 90 jours                  | Échéance à 85 j → remboursement d'office                                              |
| Arrondi                                   | Un seul `Math.round`, entiers en centimes, taux gelé                                  |

---

## 6. Le chemin en mode TEST

### 6.1 Ce qui se construit et se prouve **sans société immatriculée**

Stripe documente le sandbox comme environnement de test et réserve le KYC et les exigences d'activation au **live mode**. On peut donc développer et faire tourner une intégration Connect complète avant toute immatriculation.

| Phase                     | Ce qu'on construit                                                                                                                               | Preuve attendue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T0 — outillage**        | `stripe listen --forward-to` (plateforme) **et** `stripe listen --forward-connect-to` (comptes connectés), deux fonctions Netlify, deux `whsec_` | Un `stripe trigger payment_intent.succeeded` atteint l'endpoint A ; un `stripe trigger --stripe-account acct_xxx account.updated` atteint l'endpoint B. Signature valide sur le corps brut.                                                                                                                                                                                                                                                                                                    |
| **T1 — comptes vendeurs** | `POST /v1/accounts` avec les 4 `controller[*]`, `POST /v1/account_links`                                                                         | Un compte de test franchit l'onboarding avec les valeurs de test : `dob` **1901-01-01** (ou 1902-01-01), `id_number` **000000000** (ou 222222222), `company.address.line1` = **address_full_match** / **address_no_match** / **address_line1_no_match**, SMS **000-000**, cartes **4000000000004202** / **4000000000004210** / **4000000000004236**. **Commencer par la condition la moins permissive.** Puis lire `requirements.currently_due` et **relever les 4 champs manquants du §3.2**. |
| **T2 — encaissement**     | PaymentIntent avec `transfer_group`                                                                                                              | **4242424242424242** succès · **4000000000000002** `generic_decline` · **4000000000009995** `insufficient_funds` · **4000002500003155** / **4000000000003220** 3DS requise. Date d'expiration future quelconque, CVC quelconque. La commande n'existe qu'après `payment_intent.succeeded`.                                                                                                                                                                                                     |
| **T3 — versement**        | `POST /v1/transfers` + verrou d'intention                                                                                                        | **Il faut d'abord alimenter le solde plateforme de test** : dialogue « Add to balance » du sandbox, ou tokens `btok_us_verified` / `btok_us_verified_insufficientFunds` (**équivalent FR non vérifié** — voir ch. 7). Codes d'échec à provoquer : `no_account`, `account_closed`, `insufficient_funds`, `balance_insufficient`, `capability_not_active`, `payouts_not_allowed`, `transfers_not_allowed`.                                                                                       |
| **T4 — idempotence**      | Le point critique                                                                                                                                | `stripe events resend <event_id> --webhook-endpoint=<endpoint_id>` (30 j) ou resend Dashboard (15 j). **Critère de succès : rejouer trois fois `transfer.created` et le déclencheur de clôture ne produit qu'UN seul `tr_xxx`.** Puis rejouer **au-delà de 24 h** pour prouver que le verrou tient une fois l'`Idempotency-Key` purgée. Ce test est le plus important de la liste.                                                                                                             |
| **T5 — remboursements**   | `POST /v1/refunds` avant versement ; `POST /v1/refunds` + reversal après                                                                         | Vérifier notamment le comportement réel de `reverse_transfer=true` sur un transfert créé avec `source_transaction` (indéterminé dans la doc — ch. 7), et le reversal sur un compte au solde vide.                                                                                                                                                                                                                                                                                              |
| **T6 — litiges**          | Chemin chargeback complet                                                                                                                        | **4000000000000259** (fraudulent) · **4000000000002685** (product_not_received) · **4000000000001976** (inquiry) · **4000000000005423** (early fraud warning) · **4000000404000079** (litiges multiples). Preuves via `evidence[uncategorized_text]` = `winning_evidence` / `losing_evidence` / `escalate_inquiry_evidence`. Vérifier que le débit tombe bien sur le solde **plateforme**.                                                                                                     |
| **T7 — cycle complet**    | Les six états + les deux automatismes                                                                                                            | Six scénarios de bout en bout, horloge injectée pour J+7 et J+14 (`dueActions` est déjà pure et testée — s'appuyer dessus).                                                                                                                                                                                                                                                                                                                                                                    |

**Limite majeure du sandbox, à écrire dans les tests :** _les capabilities peuvent ne pas être appliquées en sandbox_ — **un versement à un vendeur non vérifié peut réussir en test et échouer en production**. Le prédicat §3.3 ne peut donc pas être validé par un test de bout en bout ; il doit être couvert par des tests unitaires sur objets Account simulés, et le chemin d'erreur testé en injectant les codes d'erreur.

### 6.2 Ce qui exige l'immatriculation pour passer en production

| Bloqueur                                                               | Nature                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Activation live du compte plateforme Connect**                       | **Bloqueur n°1, non résolu.** Toute la doc consultée traite du statut des comptes **connectés**, jamais des conditions d'éligibilité d'une **plateforme** Connect. Se tranche avec Stripe (platform profile, revue Connect, Connect Platform Agreement), pas dans la doc. Le pays d'origine n'est plus modifiable après activation live. |
| **Avis juridique DSP2**                                                | Voir ch. 7. À obtenir **avant** d'écrire le module de rétention en production, pas après.                                                                                                                                                                                                                                                |
| **KYC réel des vendeurs**                                              | Impossible en sandbox par construction.                                                                                                                                                                                                                                                                                                  |
| **Éligibilité de l'activité**                                          | La revente de mode d'occasion entre particuliers au regard de la liste des _restricted businesses_ Stripe — non vérifiée.                                                                                                                                                                                                                |
| **Tarification réelle**                                                | Frais Stripe, surcoût Connect Express, frais de litige en EUR. Conditionne la viabilité de la commission (§1.5).                                                                                                                                                                                                                         |
| **Obligations d'exploitant**                                           | DAC7 (enregistrement, diligence, déclaration au 31 janvier), art. 242 bis CGI, L111-7 / D111-8 Code de la consommation, LCB-FT. Aucune n'est portée par Stripe.                                                                                                                                                                          |
| **Exercice d'actes de commerce à titre habituel sans immatriculation** | Constitue le **travail dissimulé par dissimulation d'activité** (art. L8221-3 Code du travail), élément intentionnel requis. Une entreprise individuelle ou micro-entreprise via le guichet unique INPI suffit ; SIREN et SIRET sont attribués automatiquement. Ce n'est pas un obstacle lourd — c'est un préalable.                     |

---

## 7. Ce que ce plan n'a pas pu établir

Écrit franchement. Aucun de ces points n'a été comblé par une hypothèse plausible dans les chapitres précédents.

### 7.1 Les deux bloqueurs de production

1. **Stripe accepte-t-il qu'une plateforme Connect française, qui encaisse pour le compte de tiers, soit opérée par une personne physique non immatriculée ?** Aucune page consultée ne traite des conditions d'éligibilité d'une plateforme. Se tranche avec Stripe, pas dans la doc. **C'est le point de blocage n°1.**

2. **Le transit des fonds par le solde plateforme constitue-t-il une « possession ou un contrôle des fonds » au sens du considérant 11 de la DSP2 ?** Le considérant est clair sur le critère (l'intermédiaire agissant pour le payeur **et** le bénéficiaire n'est exclu que s'il n'entre jamais en possession des fonds ni n'en exerce le contrôle), et le pattern retenu fait précisément transiter les fonds par le solde de la plateforme. **Aucune position publiée de l'ACPR ou de l'EBA n'a été trouvée sur ce point précis.** Brancher `capturePayment` sur Stripe plutôt que sur un compte bancaire SOLANGE est **nécessaire mais non suffisant** : le critère est la possession et le contrôle, pas le lieu de dépôt. Question aggravée par le fait qu'un administrateur SOLANGE **arbitre** les litiges, donc décide du sort de l'argent — **aucune source trouvée sur l'effet de ce critère sur la qualification.** Avocat en droit bancaire, voire saisine du pôle Fintech Innovation de l'ACPR (possibilité et délai non vérifiés). Échéance PSD3/PSR : application attendue fin 2027 / 2028, avec durcissement annoncé de l'exclusion agent commercial.

### 7.2 Chiffres et conditions manquants pour dimensionner

- **Durée réelle de la fenêtre de contestation bancaire.** Le chiffre de 120 jours est couramment cité mais **n'a pas été vérifié**. Il conditionne le réglage du délai de payout vendeur et la provision. **À vérifier avant le lancement.**
- **Tarification Connect en France** : frais par compte connecté actif, frais de transfert, frais de payout, montant et déclenchement des frais de litige en EUR. **Non vérifiés.** Détermine si une commission à 2 % est viable.
- **Ce que fait Stripe au 91ᵉ jour** : versement d'office, blocage du compte, ou contact plateforme ? La doc dit _« we can hold funds in reserve »_ et _« you must pay out the funds within the time period »_ sans préciser le mécanisme d'application. À confirmer auprès du support si un litige peut dépasser 85 jours.
- **La limite de 90 jours s'applique-t-elle au `delay_days_override`** comme elle s'applique aux payouts manuels ? Non vérifié. Impacte directement le levier anti-chargeback du §5.3.
- **Un SIREN/SIRET est-il exigé pour activer un compte français ?** La page support Stripe consultée n'a pas répondu clairement ; des sources tierces l'affirment sans valeur de source Stripe.
- **Le Connect Platform Agreement impose-t-il une durée maximale de rétention** distincte des 90 jours ? Non vérifié.
- **Montant de l'amende sanctionnant le non-respect de l'art. L111-7 du Code de la consommation** : non confirmé sur Légifrance.
- **Contenu exact de l'information fiscale et sociale** exigée par l'arrêté prévu à l'art. 242 bis CGI : texte non consulté.
- **Obligations DSA** applicables à une place de marché dont tous les vendeurs sont des particuliers (traçabilité art. 30 à 32, conception d'interface) : non vérifiées.
- **Obligations LCB-FT propres à SOLANGE** (vigilance, déclaration Tracfin) ou intégralement portées par Stripe : aucune source consultée.
- **Plafonds micro-entreprise** applicables à l'exploitant : la commission seule constitue le chiffre d'affaires de la plateforme, et non le montant brut des ventes — **cela n'a pas été confirmé sur une source officielle.**

### 7.3 Comportements techniques à trancher en sandbox, pas à supposer

- **`reverse_transfer=true` sur un transfert créé avec `source_transaction` en separate charges and transfers** : la doc API décrit le paramètre, la doc Connect dit que le refund n'impacte pas les transferts. Test sandbox requis avant de choisir un appel ou deux (§5.4 code deux appels par prudence).
- **`charges_enabled` sur un compte à capability `transfers` seule** : à observer avant de l'inclure dans le prédicat bloquant du §3.3.
- **Tokens bancaires de test pour alimenter un solde plateforme FR** : les `btok_` documentés sont américains, l'équivalent français n'est pas vérifié.
- **`constructEvent` (crypto Node, synchrone) vs `constructEventAsync` (SubtleCrypto) sur le runtime Netlify Functions** : la recommandation d'utiliser la variante asynchrone a été **réfutée** comme obligation ; le plan prescrit `constructEvent`, à valider par le premier webhook reçu.
- **Limites de débit de Netlify Blobs** : non documentées. Le comportement sous rafale de webhooks rejoués n'est pas garanti — d'où le balayeur du §5.5 plutôt qu'une confiance aveugle dans le drainer.
- **Compatibilité de funds segregation avec le réseau CB** : les allocated funds sont limités à Visa/MC/Discover/Amex/Swish ; **CB n'est pas cité**, alors que `cartes_bancaires_payments` figure bien dans les capabilities FR. À lever avec Stripe si cette voie est un jour reprise.
- **Statut GA, calendrier et tarification de funds segregation** : private preview, aucun élément documenté. Ne pas en dépendre.

### 7.4 Noms de paramètres à lire dans la référence API au moment de coder

Ces paramètres sont nécessaires au plan mais **ne figurent pas nommément dans le dossier vérifié**. Ils n'ont volontairement pas été devinés :

- le paramètre de pays sur `POST /v1/accounts` ;
- le paramètre identifiant la charge ou le PaymentIntent sur `POST /v1/refunds`, et le paramètre de montant pour un remboursement partiel ;
- le paramètre de restriction explicite des moyens de paiement sur le PaymentIntent (le plan prescrit seulement de **ne pas** activer `automatic_payment_methods`) ;
- le filtre de listing des Transfers par `transfer_group`, envisagé comme troisième filet de récupération anti-double-versement ;
- l'annulation d'un PaymentIntent non confirmé (rendue non nécessaire par la règle « la commande n'existe qu'après `payment_intent.succeeded` ») ;
- `metadata` sur `Create Transfer` — le plan tient le lien commande ↔ objets Stripe **dans Blobs**, ce qui est de toute façon la bonne pratique ici.

---

## Fichiers concernés

| Fichier                                                         | Action                                                                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/Users/fouzi/solange/netlify/functions/_shared/payment.mts`    | Réécrire `capturePayment` : PaymentIntent réel avec `transfer_group`, conversion `amountCents` unique                                                     |
| `/Users/fouzi/solange/netlify/functions/payment-webhook.mts`    | **Scinder en deux** : endpoint plateforme + endpoint comptes connectés, deux `whsec_`                                                                     |
| `/Users/fouzi/solange/netlify/functions/_shared/order-core.mts` | Écriture conditionnelle `onlyIfMatch` ; écriture de l'intent `pay:<id>` en `onlyIfNew` sur entrée en `terminee` / `annulee` ; aucun appel Stripe en ligne |
| `/Users/fouzi/solange/src/lib/order-state.ts`                   | Ajouter `rembourse_apres_versement` et l'action `reverse` ; découpler `recue` de `terminee` (§2.3)                                                        |
| `/Users/fouzi/solange/netlify/functions/orders-cron.mts`        | Ajouter le drainage des intents en attente et l'échéance 85 jours                                                                                         |
| **Nouveau** — module `fees`                                     | `feeRateBps` par palier, `Math.round` unique, entiers en centimes                                                                                         |
| **Nouveau** — module `stripe-seller`                            | Création de compte, Account Links, prédicat `sellerPayable`                                                                                               |
| **Nouveau** — module `stripe-money`                             | Exécuteur des intents : transfert, remboursement, reversal, avec `Idempotency-Key` persistées                                                             |
| `/Users/fouzi/solange/legal/`                                   | DAC7, art. 242 bis CGI, L111-7 / D111-8                                                                                                                   |
| `/Users/fouzi/solange/DECISIONS.md`                             | Seuils des paliers, assiette de la commission, fenêtre de rétractation, délai de payout vendeur                                                           |
