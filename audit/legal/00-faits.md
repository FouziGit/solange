# Phase 0 — Faits établis avant toute rédaction

<!-- CE DOCUMENT DOIT ÊTRE VALIDÉ PAR UN PROFESSIONNEL DU DROIT AVANT
     PUBLICATION DES TEXTES QUI EN DÉCOULENT. Les qualifications
     proposées ici (statut d'intermédiaire, régime de rétractation)
     engagent l'exploitant et ne sont pas des avis juridiques. -->

Tout ce qui suit est soit **constaté dans le code** (référence de fichier
donnée), soit marqué `[À COMPLÉTER]`. Aucune donnée n'a été supposée.

## 1. Identité de l'exploitant

| Point                              | État                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forme juridique                    | `[À COMPLÉTER : personne physique (micro-entreprise) ou société ?]` — **bloquant pour la suite**                                                                            |
| Raison sociale / nom commercial    | `[À COMPLÉTER]` — le produit s'appelle SOLANGE, l'exploitant n'est pas identifié                                                                                            |
| SIREN / SIRET                      | `[À COMPLÉTER]`                                                                                                                                                             |
| Capital social (si société)        | `[À COMPLÉTER]`                                                                                                                                                             |
| Adresse du siège                   | `[À COMPLÉTER]`                                                                                                                                                             |
| RCS (ville + numéro)               | `[À COMPLÉTER]`                                                                                                                                                             |
| TVA intracommunautaire             | `[À COMPLÉTER]` — dépend du régime (franchise en base ?)                                                                                                                    |
| Directeur de la publication        | `[À COMPLÉTER : nom + qualité]`. Les mentions actuelles citent Nouh Benzidane et Youssef Ayari comme porteurs, sans qualité ni entité (`src/app/mentions-legales/page.tsx`) |
| Contact                            | `solange@nouhbenzidane.fr` — **constaté** (`mentions-legales/page.tsx`)                                                                                                     |
| Assurance professionnelle (RC pro) | `[À COMPLÉTER]`                                                                                                                                                             |

**Constat important.** Les mentions légales publiées ne désignent
aujourd'hui **aucune entité juridique** : elles parlent d'un « projet en
développement porté par » deux personnes. C'est insuffisant au regard de
l'article 6-III de la LCEN, et cela laisse les deux personnes
personnellement exposées.

## 2. Hébergement

| Point                        | État                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Hébergeur de l'application   | **Netlify, Inc.**, 512 2nd Street, San Francisco, CA, États-Unis — **constaté** (`netlify.toml`, mentions actuelles) |
| Hébergement des **données**  | Netlify Blobs — **constaté** (`netlify/functions/_shared/core.mts`, `getStore`)                                      |
| Région de stockage des Blobs | `[À COMPLÉTER : à vérifier dans la console Netlify — détermine s'il y a transfert hors UE]`                          |
| Nom de domaine de production | `solange-beta.netlify.app` — **constaté**                                                                            |
| Domaine propre               | `[À COMPLÉTER : un domaine solange.* est-il prévu ?]`                                                                |

## 3. Marché — qualification de l'activité (le point déterminant)

Éléments **constatés dans le code**, qui plaident dans les deux sens :

**Ce qui va vers le simple intermédiaire technique :**

- **Aucun fonds n'est détenu ni encaissé.** Le paiement est intégralement
  simulé : `capturePayment()` retourne une référence `sim_…` sans aucun
  mouvement (`netlify/functions/_shared/payment.mts`). Aucune donnée
  bancaire ne transite ni n'est stockée — les champs carte du checkout
  sont en lecture seule sur des valeurs de démonstration
  (`src/app/checkout/[id]/CheckoutView.tsx`).
- La Plateforme **ne fixe pas les prix** : le vendeur les saisit
  (`netlify/functions/products.mts`).
- La Plateforme **n'expédie rien** : aucune intégration transporteur, les
  points relais sont simulés (`src/lib/shipping.ts`, commentaire explicite).
- La Plateforme **ne stocke ni ne manipule les Pièces**.

**Ce qui va vers une intervention active (et affaiblit le régime allégé) :**

- **La Plateforme tranche les litiges.** Un administrateur peut annuler ou
  clôturer une commande en litige (`src/lib/order-state.ts`,
  transitions `resolve_cancel` / `resolve_close`, rôle `admin`).
- **La Plateforme prélève une commission** — barème dégressif 4 % / 3,5 % /
  2,5 % / 2 % selon le prix (`src/lib/utils.ts`, `commissionRate`).
  Elle est **calculée et affichée** mais **non encaissée** aujourd'hui.
- **La Plateforme automatise le cycle de vente** : annulation d'office à
  J+7 sans expédition, clôture d'office à J+14 (`orders-cron.mts`).
- **La Plateforme modère** : masquage de contenu, suspension, bannissement
  (`netlify/functions/admin.mts`).

`[À COMPLÉTER — À TRANCHER PAR UN AVOCAT]` : la combinaison
« commission + arbitrage des litiges + automatisation du cycle » rend
fragile une qualification de pur hébergeur au sens de l'article 6-I-2 de
la LCEN. La rédaction retenue en Phase 2 ne revendiquera donc **pas** un
statut d'hébergeur passif : elle décrira la Plateforme comme un
**opérateur de plateforme en ligne** (art. L111-7 du Code de la
consommation) mettant en relation des particuliers, ce qui est à la fois
plus sûr et vérifiable.

## 4. Données personnelles réellement collectées

Relevé exhaustif des 15 espaces de stockage (`grep store(" netlify/`) :

| Espace          | Contenu réel                                                                                   | Donnée personnelle ?                 |
| --------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| `users`         | id, **email**, pseudo, nom affiché, rôle, suspension/bannissement                              | oui                                  |
| `otps`          | code à 6 chiffres **haché** + email haché                                                      | oui (transitoire)                    |
| `products`      | annonces : titre, marque, prix, état, **photos**, id vendeur                                   | oui (indirect)                       |
| `orders`        | **adresse de livraison** (domicile uniquement), montants, historique horodaté, ids des parties | **oui, sensible au sens commercial** |
| `msgs`          | **contenu des conversations privées** entre membres                                            | oui                                  |
| `circles`       | fils, réponses, likes, dernières visites                                                       | oui                                  |
| `posts`         | publications : légende, **photos**, **vidéos**, pièces taguées                                 | oui                                  |
| `imgs` / `vids` | fichiers média envoyés par les membres                                                         | oui (peuvent contenir des personnes) |
| `notifs`        | historique des notifications                                                                   | oui                                  |
| `push`          | **abonnements push par appareil** (endpoint + clés), préférences                               | oui                                  |
| `social`        | likes, gardés, abonnements, membres bloqués                                                    | oui                                  |
| `reports`       | **signalements** (auteur, cible, motif) + journal d'audit de modération                        | oui, sensible                        |
| `rates`         | compteurs anti-abus par identifiant                                                            | oui (indirect)                       |
| `counters`      | compteurs agrégés de likes                                                                     | non                                  |

**Ce qui N'EST PAS collecté** (vérifié, et donc à affirmer sans risque) :

- **aucune donnée bancaire** — le paiement est simulé, rien n'est saisi ni transmis ;
- **aucune géolocalisation** — aucune API de position dans le code ;
- **aucun analytics, aucun traceur publicitaire** : `src/lib/track.ts` est
  un point d'ancrage **vide en production** (il ne journalise qu'en
  développement, dans la console). Aucun tiers ne reçoit de données de
  comportement ;
- **aucun profilage automatisé**, aucune décision automatisée produisant
  des effets juridiques, hors les automatismes de commande (annulation /
  clôture par délai), qui doivent être décrits.

## 5. Tiers destinataires

| Tiers                                                             | Ce qu'il reçoit                                                                                                                              | Localisation                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Netlify, Inc.**                                                 | hébergement de l'app et de **toutes** les données                                                                                            | États-Unis `[À COMPLÉTER : région de stockage Blobs]` — transfert hors UE à encadrer |
| **Resend** (envoi d'e-mails)                                      | adresse e-mail du destinataire + contenu du message transactionnel — **constaté** : seul appel réseau sortant du back-end (`api.resend.com`) | `[À COMPLÉTER : entité et localisation contractuelle]`                               |
| **Services de push des navigateurs** (Google FCM, Mozilla, Apple) | l'adresse d'abonnement de l'appareil et la charge **chiffrée de bout en bout** (RFC 8291) — le contenu ne leur est pas lisible               | hors UE pour Google et Apple                                                         |
| Prestataire de paiement                                           | **aucun aujourd'hui** — à ajouter le jour de l'activation                                                                                    | —                                                                                    |

## 6. Âge

**Aucun contrôle d'âge n'existe dans le produit** — vérifié : ni champ de
date de naissance, ni case déclarative, ni barrière à l'inscription.
L'inscription se fait par simple e-mail + code
(`netlify/functions/auth-verify.mts`).

`[À COMPLÉTER : âge minimum voulu ?]` Rappel factuel : en France, un
mineur de moins de 15 ans ne peut pas consentir seul au traitement de ses
données pour un service en ligne (art. 45 loi Informatique et Libertés).
Un service de vente entre particuliers pose en outre la question de la
capacité à contracter. **Si un âge minimum est annoncé dans les CGU, il
doit exister au moins une déclaration à l'inscription** — sinon le
document annonce un contrôle qui n'existe pas, ce qui est le type de
mensonge que ce chantier proscrit.

## 7. Modération (existant, lot 4)

- Signalables : pièces, publications, membres, messages, fils de Cercle
  (`netlify/functions/report.mts`).
- Décideurs : les comptes listés dans `ADMIN_EMAILS` — aujourd'hui
  **Nouh Benzidane seul**.
- Mesures possibles : classement sans suite, avertissement, masquage du
  contenu, suspension (3/7/30 jours), bannissement.
- **Journal d'audit** : chaque mesure est tracée (qui, quoi, quand,
  motif) — `netlify/functions/admin.mts`.
- **Voie de recours pour la personne sanctionnée : AUCUNE aujourd'hui.**
  Elle est notifiée (cloche + e-mail) mais ne dispose d'aucun mécanisme
  de contestation. `[À COMPLÉTER]` — à créer en Phase 3, un recours étant
  attendu de tout service de ce type.

## 8. Avis et notes

**Il n'existe aucun système d'avis ou de notation** entre membres
(vérifié). Les obligations de transparence sur les avis en ligne
(art. L111-7-2 du Code de la consommation) **ne s'appliquent donc pas**,
et aucun document ne doit prétendre le contraire.

## 9. Cookies et stockage sur l'appareil

- **Un seul cookie** : `sol_s`, cookie de session `httpOnly`, `Secure`,
  `SameSite=Lax`, 30 jours (`core.mts`). Strictement nécessaire à
  l'authentification.
- **Stockage local** : `solange:onboarded` (écran d'accueil déjà vu),
  `solange:push-asked` / `push-acted` (ne pas redemander les
  notifications), brouillons de dépôt et de publication (sessionStorage).
- **Aucun traceur tiers, aucun cookie publicitaire ou de mesure
  d'audience.**

**Conséquence à assumer :** aucun de ces éléments n'étant destiné à autre
chose que le service expressément demandé, **un bandeau de consentement
aux cookies n'est pas requis** et serait même trompeur (il ferait croire
à un choix inexistant). La Phase 3 livrera donc une **page d'information**
sur les cookies, et non un bandeau — sauf si un outil de mesure
d'audience est ajouté un jour, cas prévu par écrit.

## 10. Public visé

`[À COMPLÉTER : France seule, ou Union européenne ?]` — détermine la
langue des documents, la juridiction compétente et l'obligation de
médiation de la consommation. Le produit est aujourd'hui **entièrement en
français**, sans sélecteur de langue (constaté).

## 11. Documents existants à corriger d'urgence

La politique de confidentialité actuelle affirme que seules sont
collectées les données d'« email de connexion **uniquement** »
(`src/app/confidentialite/page.tsx`). **C'est devenu faux** : le produit
stocke depuis des adresses de livraison, des conversations privées, des
photos et vidéos, des abonnements push et des signalements. Une politique
de confidentialité inexacte est en elle-même un manquement au RGPD
(principe de transparence, art. 12 et 13). **Correction prioritaire.**

## 12. Acceptation des conditions — état réel

**Aucune acceptation de conditions n'existe nulle part dans le produit.**
Vérifié par recherche exhaustive : aucune occurrence de « CGU », « CGV »,
« conditions générales » ou « j'accepte » dans une interface.

Conséquences constatées :

- On crée un compte avec un e-mail et un code, sans avoir rien accepté
  (`src/components/chrome/AuthScreen.tsx`) ;
- On achète sans avoir accepté de conditions de vente
  (`src/app/checkout/[id]/CheckoutView.tsx`) ;
- **Aucune trace d'acceptation n'est stockée** : ni date, ni version, ni
  adresse. En cas de litige, l'exploitant ne peut donc **pas prouver** que
  ses conditions étaient opposables — c'est le point faible principal du
  dispositif actuel, et la raison d'être de la Phase 3.

**Il existe par ailleurs un « mode démo sans compte »** (bouton « Passer »
sur l'écran d'accueil) qui donne accès au produit sans inscription. Les
documents doivent donc distinguer **visiteur** et **membre**, et ne pas
prétendre que toute personne présente a accepté quoi que ce soit.

## 13. Accès actuel aux documents légaux

Les deux pages existantes ne sont atteignables **que depuis le profil**
(`src/app/profil/page.tsx`, lignes 720 et 729). Il n'y a **pas de pied de
page** dans l'application, et donc :

- un visiteur en mode démo ne les rencontre jamais ;
- rien n'est accessible depuis l'écran d'inscription ni depuis le
  paiement.

L'article 6-III de la LCEN exige un accès « facile, direct et permanent ».
Deux liens enfouis dans un onglet de profil ne le satisfont pas.

## 14. Récapitulatif des points bloquants

Les documents seront rédigés intégralement malgré ces manques, avec les
mentions `[À COMPLÉTER]` en évidence. Repris tels quels dans
`audit/legal/99-a-completer.md` à la fin du chantier.

| #   | Manque                                                                            | Sans quoi                                                                                                |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Statut juridique de l'exploitant (personne physique ou société) + SIREN + adresse | Les mentions légales restent invalides ; les deux porteurs sont exposés personnellement                  |
| 2   | Directeur de la publication (nom + qualité)                                       | Obligation LCEN non remplie                                                                              |
| 3   | Région de stockage des Blobs chez Netlify                                         | Impossible de décrire honnêtement les transferts hors UE                                                 |
| 4   | Entité contractuelle et localisation de Resend                                    | Idem, et sous-traitant non identifié dans la politique                                                   |
| 5   | Âge minimum voulu + mise en place d'une déclaration                               | Toute mention d'âge dans les CGU serait un mensonge                                                      |
| 6   | Pays visés (France seule ou UE)                                                   | Détermine la médiation de la consommation et la juridiction                                              |
| 7   | Médiateur de la consommation adhéré                                               | Obligation d'affichage (art. L616-1 code de la consommation) le jour où la vente est réelle              |
| 8   | Assurance responsabilité civile professionnelle                                   | Non exigé pour publier, mais à connaître avant l'ouverture                                               |
| 9   | Décision sur le paiement réel et le PSP retenu                                    | Les CGV décrivent le régime futur dans un article daté et non applicable tant que le paiement est simulé |
