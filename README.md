# SOLANGE — frontend prototype

> La mode circulaire & connectée. Une marketplace sociale de mode de seconde main : on s'inspire, on achète, on revend — **chaque look est shoppable**.

Hybrid app combining a **C2C second-hand fashion marketplace** with a **TikTok-style social feed**, per the SOLANGE business plan (founders: Youssef Ayari & Nouh Benzidane).

This repo is a **UI/UX prototype**: the focus is a stunning, interactive, pixel-crafted frontend on **mock data**. Backend, real DB, payments and recommendation algorithms are intentionally out of scope for now.

## What's built

Ten connected routes with real navigation (side rail / bottom tab bar, sliding active indicator) + page transitions:

- **Feed** (`/`) — the **social video feed**: TikTok-style snap-scroll, cinematic B&W "editorial film stills" (seed-varied campaign type + Ken-Burns + light-sweep), **shoppable hotspots** → **Shop the look** sheet, functional Pour toi / Suivis / Drops tabs, double-tap heart.
- **Découvrir** (`/decouvrir`) — marketplace + search + **advanced filter drawer** (size / price / condition / brand / sort), masonry grid.
- **Article** (`/article/[id]`) — **product detail**: gallery, price, verified seller, _Acheter_ / _Faire une offre_, similar pieces (every buy CTA now lands here).
- **Profil** (`/profil`) — creator **vitrine**: hero, stats, tabs (À vendre / Looks / Aimés).
- **Messages** (`/messages`) — **messagerie**: list + working chat thread with product context.
- **Vendre** (`/vendre`) — **listing flow** with a live **commission calculator** (degressive 2–4 % tiers), boost toggle, dynamic Premium upsell, validation + success state.
- **Premium** (`/premium`) — subscription plans (0 € / 4,99 € / 9,99 €) + Product JSON-LD.
- **Drops** (`/drops`) — **partenariats / collabs**: featured live drop + countdown.
- **Créer** (`/creer`) — **content composer** with a live look preview.
- **Favoris** (`/favoris`) & **Notifications** (`/notifications`).

Shared chrome: desktop side rail + mobile bottom tab bar (`+` opens Vendre/Créer), couture **S** monogram, custom inverting cursor, film grain, glassmorphism. **Strict noir & blanc** (warm ivory + greys, zero chroma), dark-mode native. A11y: focus-visible rings, `prefers-reduced-motion`, ARIA tabs/toggles, ≥44px touch targets, safe-area insets. SEO/PWA: per-route metadata, OG/Twitter share images, manifest, robots, sitemap, JSON-LD.

## Stack

|           |                                                                           |
| --------- | ------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router) · React 19                                        |
| Language  | TypeScript (strict)                                                       |
| Styling   | Tailwind CSS v4 (CSS-first `@theme`)                                      |
| Motion    | [Motion](https://motion.dev) (Framer Motion)                              |
| Fonts     | Archivo (wordmark) · Bodoni Moda (Didone editorial) · Hanken Grotesk (UI) |

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (type-checked)
npm run lint
```

## Structure

```
src/
  app/
    layout.tsx            fonts + global chrome (cursor, grain, nav rails)
    page.tsx              feed (+ desktop editorial flourish)
    decouvrir/            marketplace + search + filters
    profil/               creator vitrine
    messages/            messagerie (list + chat thread)
    vendre/               listing flow + commission calculator
    premium/              subscription plans
    globals.css           design tokens, surfaces, keyframes
  components/
    chrome/               Brandmark, Avatar, SideNav, MobileTabBar, CustomCursor, GrainOverlay, icons
    feed/                 VideoFeed, FeedCard, KenBurnsMedia, ProductHotspots, ActionRail, CreatorHeader, ShopTheLook, FeedTopBar
    ui/                   PageShell, PageHeader, ProductCard
  lib/
    mock.ts               looks, creators, catalog, conversations, profile, plans (all fake)
    utils.ts              formatting + commission tiers + generative helpers
```

## Notes

- All imagery is **generated locally** from seeds (no network), so the prototype renders identically offline.
- Mock data lives in `src/lib/mock.ts` — edit there to change any view.

## Next candidates

Product detail page · auth / onboarding · real media uploads · live drops · checkout · saved/favorites view.
