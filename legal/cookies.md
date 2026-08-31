---
title: Cookies et stockage local
version: 1.0
effectiveDate: "[À COMPLÉTER : date de publication]"
---

<!-- RÉSERVE — PROJET À FAIRE VALIDER PAR UN PROFESSIONNEL DU DROIT AVANT
     PUBLICATION.

     Point à faire confirmer : l'absence de bandeau de consentement. Elle
     repose sur un constat vérifiable — aucun traceur, aucune mesure
     d'audience, aucun cookie tiers. Elle cesse d'être exacte le jour où
     un outil de mesure est ajouté, y compris une solution dite « sans
     cookie » : voir l'article 4. -->

# Cookies et stockage local

## 1. Pourquoi vous ne voyez pas de bandeau

SOLANGE n'affiche pas de bandeau de consentement aux cookies, pour une
raison simple : **il n'y a rien à consentir.**

Le service n'utilise ni cookie publicitaire, ni cookie de mesure
d'audience, ni traceur d'un tiers. Les seuls éléments déposés sur votre
appareil sont strictement nécessaires au fonctionnement que vous
demandez, et sont à ce titre dispensés de consentement par l'article
82 de la loi Informatique et Libertés.

Afficher un bandeau alors qu'aucun choix réel ne vous est ouvert
reviendrait à vous faire cliquer pour rien, et à vous laisser croire que
vous êtes suivi alors que vous ne l'êtes pas.

## 2. Le seul cookie déposé

| Nom     | Rôle                                           | Durée    | Caractéristiques                                                                                                                               |
| ------- | ---------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `sol_s` | vous maintenir connecté d'une visite à l'autre | 30 jours | inaccessible au code exécuté dans la page (`HttpOnly`), transmis uniquement en HTTPS (`Secure`), non transmis aux sites tiers (`SameSite=Lax`) |

Sans lui, vous seriez déconnecté à chaque chargement de page. Le refuser
revient à ne pas pouvoir utiliser de compte ; vous pouvez le supprimer à
tout moment depuis les réglages de votre navigateur, ou en vous
déconnectant.

## 3. Ce que le service garde dans votre navigateur

Ces éléments ne sont **pas des cookies** : ils ne sont jamais envoyés à
nos serveurs et restent sur votre appareil. Ils servent uniquement au
confort d'usage.

| Élément                                             | Rôle                                                                            | Effacement                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| `solange:onboarded`                                 | ne pas vous réafficher l'écran d'accueil à chaque ouverture                     | réglages du navigateur             |
| `solange:push-asked`, `solange:push-acted`          | ne pas vous redemander l'activation des notifications si vous avez déjà répondu | idem                               |
| `solange:brouillon-vente`, `solange:brouillon-post` | ne pas perdre ce que vous avez commencé à écrire si vous quittez l'écran        | effacés à la fermeture de l'onglet |

Cette liste est exhaustive à la date de cette page. Les autres choix que
vous faites dans le service — membres bloqués, pièces gardées,
abonnements, préférences de notification — sont enregistrés sur nos
serveurs et rattachés à votre compte, pas à votre navigateur : ils sont
décrits dans la [politique de confidentialité](/confidentialite).

## 4. Si cela change

Le jour où un outil de mesure d'audience serait ajouté, **y compris une
solution présentée comme « sans cookie » ou « respectueuse de la vie
privée »**, cette page serait mise à jour avant sa mise en service et un
mécanisme de consentement conforme serait proposé si l'outil l'exige.
Aucun traceur ne sera activé en silence.
