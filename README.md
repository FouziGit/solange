# SOLANGE — frontend prototype

> La mode circulaire & connectée. Une marketplace sociale de mode de seconde main : on s'inspire, on achète, on revend — **chaque look est shoppable**.

Hybrid app combining a **C2C second-hand fashion marketplace** with a **TikTok-style social feed**, per the SOLANGE business plan (founders: Youssef Ayari & Nouh Benzidane).

This repo is a **UI/UX prototype**: the focus is a stunning, interactive, pixel-crafted frontend on **mock data**. Backend, real DB, payments and recommendation algorithms are intentionally out of scope for now.

## What's built

Five connected views with real routing (the side rail / bottom tab bar navigate, with a sliding active indicator):

- **Feed** (`/`) — the **social video feed** (_fil d'actualité_): TikTok-style vertical snap-scroll with active-card detection, cinematic B&W "editorial film stills" (studio light + Didone campaign type + Ken-Burns + light-sweep), **shoppable hotspots** → product chip → **Shop the look** sheet, action rail (double-tap heart burst), staggered overlay reveals.
- **Découvrir** (`/decouvrir`) — the **marketplace + search engine**: live search, category filters, trending tags, masonry grid of product cards (discount, save, quick-buy).
- **Profil** (`/profil`) — the creator **vitrine**: hero, stats (abonnés / ventes / note), tabs (À vendre / Looks / Aimés).
- **Messages** (`/messages`) — the **messagerie**: conversation list + working chat thread with product context (type & send).
- **Vendre** (`/vendre`) — the **listing flow** with a live **commission calculator** (the BP's degressive 2–4 % tiers), boost toggle, Premium upsell.
- **Premium** (`/premium`) — the subscription plans (0 € / 4,99 € / 9,99 €).

Shared chrome: desktop side rail + mobile bottom tab bar, custom inverting cursor, film grain, glassmorphism. Fully responsive, dark-mode native, **strict noir & blanc** (warm ivory + greys, no chroma) — straight from the brand deck.

## Stack

|              |                                              |
| ------------ | -------------------------------------------- |
| Framework    | Next.js 16 (App Router) · React 19           |
| Language     | TypeScript (strict)                          |
| Styling      | Tailwind CSS v4 (CSS-first `@theme`)         |
| Motion       | [Motion](https://motion.dev) (Framer Motion) |
| Fonts        | Archivo (wordmark) · Bodoni Moda (Didone editorial) · Hanken Grotesk (UI) |

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
