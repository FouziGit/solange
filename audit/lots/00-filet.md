# Lot 0 — Filet de sécurité

> Périmètre = exactement les points 3 et 4 du reste-à-faire (`audit/99-rapport.md` §5)
> plus le « catch vide » du brief. Aucune fonctionnalité nouvelle.

## Objectif

Aucun échec réseau muet dans l'interface, et plus un seul écran hors des
primitives du système (`Button`, `ProductCard`) avant d'attaquer les lots
fonctionnels — pour ne pas bâtir les nouveaux écrans sur de la dette.

## Parcours utilisateur touchés

- **Membre au Marché** : si `/api/products` échoue, les annonces membres
  disparaissaient sans un mot. Désormais un bandeau inline (pattern erreur DA :
  cause + remède + réessayer) : « Les annonces membres n'ont pas chargé. Le
  catalogue reste complet. Réessayer ».
- **Membre au feed Looks** : si `/api/posts` échoue, le fil restait complet
  (looks) mais les publications membres manquaient en silence. Désormais une
  chip discrète sous la barre haute, même pattern, `aria-live="polite"`.
- **Membre aux Messages** : (a) échec de `api.conversations` → état erreur de
  liste avec « Réessayer » ; (b) échec d'envoi → le texte RESTE dans le champ
  et l'erreur s'affiche (avant : message perdu sans retour).
- **Mon profil** : les sections Commandes / Annonces / Ventes naissent sur
  `SkeletonRow` (`aria-busy`) au lieu d'apparaître d'un coup.

## Modèle de données

Aucun changement serveur. Côté store : deux booléens d'échec
(`productsError`, `postsError`) posés par les refresh, remis à zéro au succès ;
les fonctions `refreshProducts` / `refreshPosts` servent de « Réessayer ».

## Machine à états

Sans objet (pas de transition serveur). États d'écran : la matrice
`audit/02-etats.md` passe de ✗ à ✓ sur Looks/erreur, Marché/erreur+hors-ligne,
Messages/erreur+hors-ligne, Profil/chargement.

## Permissions / cas limites

- Les bandeaux d'erreur n'apparaissent qu'en cas d'échec réel (`ok:false`),
  jamais pour une liste vide.
- « Réessayer » est idempotent (re-fetch, pas de mutation).
- Hors-ligne : `api.ts` renvoie déjà « Hors ligne ou serveur indisponible » —
  le même bandeau le montre.

## Migrations primitives

1. **Nouvelle primitive `ui/TogglePill`** (documentée `design/composants.md`,
   décision D-014) : LE toggle social — pill (rond = organique, DA §4),
   `aria-pressed`, état on = filet + texte atténué, état off = bloc renversé.
   Remplace 7 implémentations divergentes : Suivre (CreatorHeader, FeedCard,
   favoris `FollowToggle`, membre, decouvrir — seule version carrée,
   normalisée), Rejoindre (CommunityView, CommunityDetail), Réserver (Drops),
   Me prévenir (Live `RemindToggle`, garde `role="switch"`).
2. **CTA → `Button`** : not-found (Retour), error (Réessayer), ArticleDetail
   (Acheter / Vendu / Faire une offre), ShopCard (Acheter / Contacter / Vendu /
   Faire une offre — au passage le bouton MORT « Faire une offre » est branché
   vers `/messages?item=`, comme sur la fiche), ShopTheLook (Acheter ligne,
   Tout ajouter), FilterDrawer (Voir les pièces), PlanCards (CTA de plan).
3. **`ProductTile` (membre) supprimé** → `ProductCard` (le doublon documenté
   composants.md §ProductCard).
4. Catches silencieux non-réseau (sessionStorage brouillons, autoplay refusé) :
   commentaire justificatif — comportement voulu, pas un échec à annoncer.

Hors périmètre, consigné : boutons d'envoi ronds (messages/commentaires/live)
gardés en icône-bouton cohérente (pas des CTA texte) ; le composer de
commentaires no-op (mock assumé, revu avec les Cercles au Lot 2).

## Plan de tests

- Unitaires existants intacts (15/15) ; pas de logique nouvelle testable
  unitairement (des booléens d'état + du markup).
- Vérification manuelle en dev : bandeau Marché visible quand l'API échoue
  (fonctions absentes en `next dev` → l'échec réel se produit naturellement),
  texte conservé dans le composer messages après échec d'envoi.
- Balayages de sortie (résultats en bas de ce fichier après exécution).

## Mesure de succès

- `grep -rn "ProductTile" src/` → 0.
- Aucun toggle social hors `TogglePill`, aucun CTA texte hors `Button`
  (balayage ci-dessous).
- CI verte, prod vérifiée à 375 px.

## Balayages de sortie (exécutés au commit)

```bash
grep -rn "ProductTile" src/ --include="*.tsx"          # → 0 (hors commentaire)
grep -rn "catch {}"    src/ --include="*.ts*"          # → 0
# toggles sociaux hors TogglePill (aucun bouton local restant) :
grep -rn '"Suivre"\|"Rejoindre"\|"Me prévenir"' src/ --include="*.tsx" \
  | grep -v "labelOff\|labelOn\|aria-label"            # → 2 commentaires JSDoc
# CTA texte bruts (bg-bone + libellé) hors Button/TogglePill :
grep -rn "bg-bone text-ink\|bg-bone px-" src/app src/components \
  --include="*.tsx" | grep -v "ui/Button\|ui/TogglePill\|ui/Chip\|Brandmark" \
  # → uniquement des badges (−%, VENDU, EN DIRECT, N°) et boutons-icônes ronds
```

Vérifs : tsc 0 · lint 0 erreur · 15/15 tests · build OK.

## Corrigé en passant (consigné)

- Bouton MORT « Faire une offre » du feed Pièces (`ShopCard`) branché vers
  `/messages?item=` (même destination que la fiche pièce) — relevé à
  l'inventaire §1, c'était un échec d'UX muet du même ordre.
- Copy hors lexique sur membre introuvable : « Découvrir la boutique » →
  « Chiner le Marché » (D-006).
- Le NotifySwitch de Drops et le switch dmOpen du profil restent des
  interrupteurs à piste (2 usages) — primitive `Switch` au Lot 3 quand les
  préférences de notification créeront le 3ᵉ.
