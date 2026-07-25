# Astro Store Lite — Project State

## Stack
- Astro 7 (static output), Tailwind CSS v4, vanilla JS
- No React, no framework — pure `.astro` files

## Current State (July 24, 2026)
- 8 HTML pages + 1 XML feed, all building clean
- localStorage cart with slide-out drawer
- Qty selector on product detail page
- Toast notification on add-to-cart
- Stripe Checkout via `api/create-checkout.mjs` (serverless function)
- Dark mode (system preference)

## Design — July 25, 2026 redesign
- **Niche**: Warm-minimal e-commerce starter (free/MIT tier)
- **Buyer**: Astro dev needing a small store fast; wants something that looks curated not templated
- **Homepage one job**: "Here are the products, they're worth buying" — clear grid, trustworthy accent
- **Palette**: Warm terracotta + off-white neutrals (OKLCH, hue 80 background / hue 30 accent)
- **Type**: Outfit (single face, 300–700 weight range)
- **Signature motif**: `.accent-underline` — 3rem × 4px accent bar under major headings
- **Motion**: Existing card lift + button scale kept; no additions
- **No previous theme DESIGN.md** — first themed design in this repo tree
- **Marketplace-ready gap**: Needs meta/OG tags, sitemap, robots.txt, Lighthouse pass before submission
- **No git repo** — user declined version control
- **Two directories, not branches** — `lite/` (free/MIT) and root `astro/` (Pro, $99)
- **No Snipcart** — replaced with localStorage cart + Stripe Checkout
- **Server-side price validation** — `api/create-checkout.mjs` has canonical PRODUCTS map, ignores client prices
- **Netlify primary deploy target** — function in `api/` with `netlify.toml` instructions

## Files
| File | Purpose |
|------|---------|
| `src/data/products.json` | Buyer adds/edits products here |
| `src/config/store.ts` | Site name, URL, currency, nav |
| `src/layouts/StoreLayout.astro` | Main layout with inline cart JS (~100 lines) |
| `src/pages/product/[slug].astro` | Product detail with qty selector |
| `src/components/ProductCard.astro` | Card with add-to-cart button |
| `api/create-checkout.mjs` | Serverless fn — create Stripe Checkout Session |
| `src/pages/products.xml.ts` | Google Shopping XML feed |
| `src/styles/global.css` | Tailwind + CSS variables for light/dark |
| `README.md` | Buyer instructions |

## To-Do Next
1. Edit `src/data/products.json` with real products
2. Add matching entries to `PRODUCTS` map in `api/create-checkout.mjs` (same ids + prices)
3. Drop real product images in `public/`
4. Set up Stripe account → get `sk_test_...` key
5. Deploy serverless function with `STRIPE_SECRET_KEY` env var
6. Test full checkout flow with `4242 4242 4242 4242`
7. Polish for astro.build/themes submission (SEO, meta tags, sitemap)
8. Start Pro version with more components

## Build Commands
```powershell
cd C:\Users\steve\Desktop\astro\lite
npm run dev    # dev server at localhost:4321
npm run build  # static output to dist/
```
