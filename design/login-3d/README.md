# Login 3D — Maillage filaire + logo Solange

Écran de connexion premium : logo officiel Solange (blanc, fixe) posé sur un
**maillage 3D filaire** (grille de points + lignes) qui ondule en continu sur
fond noir, **réactif à la souris / au toucher**.

## Fichiers
- **`index.html`** — écran de connexion complet (fond maillage + logo + champ
  e-mail → code de vérification). Autonome : le logo est embarqué en data-URI,
  aucune dépendance externe (hors Google Fonts). Moteur Canvas 2D écrit à la
  main, aucune lib lourde.
- **`solange-logo.png`** — logo officiel, blanc sur fond transparent (1:1),
  recadré sur ses contours. Non modifié.
- **`logo-3d-component.html`** — variante : Web Component `<solange-logo>`
  (logo en fausse 3D extrudée, glossy, rotation lente) à copier-coller.

## Caractéristiques
- Réactif souris + tactile ; dérive douce autonome au repos.
- Responsive (canvas adapté au `devicePixelRatio`, densité de grille réduite
  sur mobile).
- `prefers-reduced-motion` respecté (rendu figé).
- N'altère pas le formulaire e-mail / code de vérification.

## Réglages (dans le `<script>` de `index.html`)
- `AMP` — amplitude des vagues · `SP` — taille des mailles
- `FOCAL` / `CAMZ` — perspective · `field()` — forme des ondulations

## Intégration Next.js (piste)
Le rendu peut être porté en composant React : un `<canvas>` + le même moteur
dans un `useEffect` (cleanup sur `cancelAnimationFrame`), le logo servi depuis
`/public`. Ce dossier reste la référence visuelle validée.
