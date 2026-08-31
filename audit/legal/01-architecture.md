# Phase 1 — Architecture documentaire

<!-- L'ARCHITECTURE PROPOSÉE ICI, ET EN PARTICULIER LA QUALIFICATION
     D'OPÉRATEUR DE PLATEFORME PLUTÔT QUE D'HÉBERGEUR, DOIT ÊTRE VALIDÉE
     PAR UN AVOCAT AVANT PUBLICATION. -->

Fondé sur `00-faits.md`. Aucun document n'est ajouté « pour faire
sérieux » : chacun répond à une obligation identifiée ou à un risque
constaté dans le code.

## 1. Le principe qui commande tout le reste

Solange met en relation des particuliers pour vendre des vêtements
d'occasion. **La Plateforme n'est jamais vendeuse.** Le contrat de vente
se forme entre deux membres ; la Plateforme fournit un service technique
et perçoit (à terme) une commission.

Deux contrats distincts, à ne jamais mélanger :

| Contrat                | Parties                          | Document                                                                            |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| Utilisation du service | membre ↔ **Plateforme**          | **CGU**                                                                             |
| Vente d'une pièce      | acheteur ↔ **vendeur** (membres) | **CGV**, qui encadrent la vente entre membres et décrivent le rôle de la Plateforme |

Confondre les deux est l'erreur classique des plateformes C2C : elle fait
glisser l'opérateur vers la position de vendeur professionnel, avec toutes
les obligations (garantie légale de conformité, rétractation à sa charge)
qui vont avec. La rédaction sépare donc strictement.

## 2. Les sept documents

| #   | Fichier                      | Objet                                                                                                                                                                           | Fondement                                                |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | `legal/mentions-legales.md`  | Identité de l'éditeur, directeur de publication, hébergeur, contact                                                                                                             | LCEN art. 6-III ; C. com. art. R123-237                  |
| 2   | `legal/cgu.md`               | Accès au service, compte, règles de conduite, contenus publiés, modération, responsabilité, résiliation                                                                         | Contrat de service ; DSA pour la modération              |
| 3   | `legal/cgv.md`               | Vente entre membres : formation du contrat, prix, commission, livraison, réception, litiges, **paiement simulé aujourd'hui**, article séparé et daté sur le paiement réel futur | C. consommation ; DSP2 le jour venu                      |
| 4   | `legal/confidentialite.md`   | Traitements réels, bases légales, durées, sous-traitants, transferts, droits                                                                                                    | RGPD art. 12 à 14                                        |
| 5   | `legal/cookies.md`           | Le cookie de session et le stockage local, et pourquoi il n'y a pas de bandeau                                                                                                  | Directive ePrivacy ; lignes directrices CNIL             |
| 6   | `legal/charte-moderation.md` | Ce qui est interdit, comment on signale, qui décide, quelles sanctions, **comment contester**                                                                                   | DSA art. 14, 16, 17, 20                                  |
| 7   | `legal/mineurs.md`           | Âge d'accès, capacité à contracter, ce qui se passe si un compte est mineur                                                                                                     | Loi Informatique et Libertés art. 45 ; C. civ. art. 1146 |

**Volontairement écartés** — les inventer serait mentir :

- charte des avis : aucun système d'avis n'existe (fait n° 8) ;
- politique de retours au sens du e-commerce : la Plateforme ne vend rien
  et ne reçoit aucun retour ;
- conditions vendeurs professionnels : le service n'accepte pas de
  professionnels aujourd'hui ; le jour où il en accepte, le règlement
  P2B (UE 2019/1150) s'appliquera et un document dédié sera nécessaire.

## 3. Hiérarchie et articulation

```
Mentions légales ──── qui est responsable, opposable à tous
        │
        ├── CGU ─────── membre ↔ Plateforme (socle)
        │     ├── Charte de modération   (annexe des CGU, même force)
        │     └── Politique mineurs      (annexe des CGU)
        │
        ├── CGV ─────── acheteur ↔ vendeur, sous l'empire des CGU
        │
        └── Confidentialité ── traitement des données, autonome
              └── Cookies      (annexe)
```

En cas de contradiction : mentions légales, puis CGU, puis CGV, puis
annexes. **Écrit explicitement dans chaque document** — une hiérarchie
implicite ne règle aucun litige.

## 4. Le paiement, traité en deux temps

Exigence directe du brief, et point le plus délicat.

- **Article « État actuel du service »** dans les CGV : le paiement est
  **simulé**, aucune somme n'est débitée, aucune donnée bancaire n'est
  collectée, aucun bien n'est livré par la Plateforme. Formulé sans
  ambiguïté possible, en tête du document, pas en note de bas de page.
- **Article distinct et daté « Régime applicable à compter de
  l'activation du paiement réel »**, explicitement non applicable
  aujourd'hui, décrivant le futur régime (encaissement par un prestataire
  agréé, séquestre le cas échéant, commission prélevée, remboursements).
  Il ne prend effet qu'à la date que l'exploitant y inscrit, avec
  information préalable des membres.

Ainsi les CGV n'ont pas à être réécrites le jour de la bascule : il suffit
de dater l'article et de notifier. Et à aucun moment le document ne
laisse croire qu'un paiement réel existe.

## 5. Le point de qualification — assumé, pas contourné

Le code montre que la Plateforme **arbitre les litiges** et **automatise
le cycle de vente** (fait n° 3). Revendiquer le statut d'hébergeur passif
serait fragile et, surtout, contredit par le produit lui-même.

Les documents décrivent donc la Plateforme comme un **opérateur de
plateforme en ligne** au sens de l'article L111-7 du Code de la
consommation, avec les conséquences assumées :

- obligation d'information loyale sur le fonctionnement du classement et
  sur la qualité des vendeurs (particuliers) — à écrire, c'est vérifiable ;
- responsabilité limitée aux **services qu'elle fournit réellement**, non
  à la conformité des Pièces qu'elle ne détient jamais ;
- l'intervention en litige est présentée pour ce qu'elle est : un
  **service de facilitation** qui ne fait pas de la Plateforme une partie
  au contrat de vente, et dont la décision ne prive personne de son droit
  d'agir en justice. C'est la clause à faire relire en priorité.

## 6. Ce que la rédaction s'interdit

Vérifié document par document en Phase 4.

| Interdit                                                                               | Pourquoi                                                                                |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Exclusion générale de responsabilité de la Plateforme                                  | Clause noire, art. R212-1 1° C. consommation — réputée non écrite                       |
| Modification unilatérale sans préavis ni droit de résilier                             | Clause noire, R212-1 3°                                                                 |
| Suppression de compte sans motif, sans notification ni recours                         | Déséquilibre significatif ; contraire au DSA art. 17                                    |
| Renonciation à la garantie légale entre particuliers                                   | Impossible à imposer par la Plateforme, qui n'est pas partie                            |
| Attribution de compétence à un tribunal choisi par l'exploitant contre un consommateur | Clause noire, R212-1 10° ; le consommateur garde le tribunal de son domicile            |
| Preuve unilatérale par les seuls journaux de l'exploitant                              | Clause grise R212-2 9° — admise seulement comme présomption simple, jamais irréfragable |
| « Nous ne collectons que ton email »                                                   | **Faux** (fait n° 4) — le mensonge actuel à corriger                                    |
| Bandeau de cookies alors qu'aucun traceur n'existe                                     | Consentement fictif, trompeur                                                           |
| Annonce d'un contrôle d'âge inexistant                                                 | Mensonge ; corrigé en créant la déclaration en Phase 3                                  |

## 7. Décisions de forme

- **Registre : « vous ».** Le produit tutoie (DA), mais les documents
  contractuels emploient le « vous », convention du domaine, plus lisible
  en cas de litige. Tracé dans `DECISIONS.md` (D-032).
- **Versionnage.** Chaque document porte `version` et `date d'effet` en
  tête. La version est une constante partagée avec le code, pour que
  l'acceptation stockée serve de preuve.
- **Une source unique.** Le texte vit dans `legal/*.md` ; les pages du
  produit affichent ce texte, sans copie divergente.
- **Commentaires de réserve.** Chaque fichier source ouvre sur un
  commentaire HTML — invisible pour la personne qui lit la page —
  rappelant que le document doit être validé par un professionnel.
- **Langue : français**, seule langue du produit aujourd'hui.

## 8. Intégration produit prévue (Phase 3)

| Point           | Ce qui sera fait                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inscription     | Case **non pré-cochée** d'acceptation des CGU + confidentialité, liens réels, bouton bloqué tant qu'elle n'est pas cochée                            |
| Preuve          | Le serveur enregistre `{ version, date }` sur le compte au moment de la vérification du code — pas le client                                         |
| Achat           | Rappel du paiement simulé + acceptation des CGV à la commande, horodatée sur la commande                                                             |
| Accès permanent | Page `/informations-legales` regroupant les sept documents, atteignable depuis le profil **et** depuis l'écran d'inscription                         |
| Cookies         | Page d'information, **pas de bandeau** (aucun traceur à consentir)                                                                                   |
| Réacceptation   | Si la version acceptée est antérieure à la version en vigueur, un écran de reprise s'affiche à la connexion suivante, avec le résumé des changements |
| Modération      | La charte est liée depuis la feuille de signalement et depuis la notification de sanction                                                            |
| Recours         | Le membre sanctionné peut contester ; la contestation arrive dans le journal d'audit existant                                                        |
