# Security & Best-Practices Audit — astro-store-lite

**Path:** `C:\Users\steve\Desktop\astro\lite`
**Date:** 2026-07-25
**Scope:** read-only audit. No files in the project were modified.

## How this report was produced

- **Best-practices / correctness / a11y / maintainability** — produced by the **Code Reviewer** agent (delivered in chat earlier this session).
- **Payment-flow application security (C1–C2, H1–H4, M1–M4, L1–L5 below)** — produced by the **Application Security Engineer** agent following its adversarial checklist. The agent completed successfully; its findings are reproduced here.
- **Secrets / headers / deploy / infra (S1–S9 below)** — the **Senior SecOps Engineer** agent could not complete (upstream API gateway failures across ~7 dispatch attempts on every model route). This section was produced by direct read-only inspection of `netlify.toml`, `astro.config.mjs`, `public/robots.txt`, `package.json`, `.env.example`, `.gitignore`, `products.json`, `contact.astro`, `products.xml.ts`, plus repo-wide greps for secret prefixes and env-var usage. Marked `[direct]`.

---

## SECRETS SCAN RESULT: CLEAN

Repo-wide grep (excluding `node_modules`) for `sk_live_`, `sk_test_`, `rk_live_`, `rk_test_`, `pk_live_`, `pk_test_`, `whsec_`:
- `.env.example:1` — `STRIPE_SECRET_KEY=sk_test_your_key_here` (placeholder, not a live key)
- `README.md:120,129,218` — instructional text describing `sk_test_` / `sk_live_` prefixes (not keys)

No live secret keys committed. No `whsec_` (webhook secret) anywhere — consistent with **no webhook endpoint existing** (see H1).

Env-var usage grep: only two hits, both `import.meta.env.STRIPE_SECRET_KEY!` — `src/pages/success.astro:7` and `src/pages/api/create-checkout.ts:8`. No `PUBLIC_` prefix usage. No `process.env`. The secret is server-only (both files are SSR). Good — but untyped (see H4 / S8).

---

# Part A — Payment-Flow Application Security
*(Application Security Engineer agent)*

## CRITICAL

### C1. Digital downloads granted without confirming payment — `src/pages/success.astro:12-24`
**Problem:** The success page grants downloadable files based purely on `stripe.checkout.sessions.retrieve(session_id)` and its line items. It never checks `session.payment_status === 'paid'`. A Checkout Session can legitimately reach this page in `payment_status: 'unpaid'` (pre-payment / async methods), `'no_payment_required'` (zero-amount or coupon to $0), or after a `setup`/pre-auth. The success_url is reachable the instant Stripe redirects the customer — for some payment methods that happens **before** capture settles.

**Concrete exploit:**
1. Attacker adds the digital product (`photo-preset-pack`, `/downloads/presets.zip`, line 33 of products.json) to cart.
2. Checks out, picks a delayed-funded method / abandons after the redirect fires / uses a test-disputed card. The redirect URL `success_url = {origin}/success?session_id={CHECKOUT_SESSION_ID}` (create-checkout.ts:39) is hit with a valid, non-null session id.
3. `success.astro:14` retrieves it, line 17 loops items, line 19 reads `productId` from the expanded product's `.metadata.product_id` (set at create-checkout.ts:29). `p.file` resolves to `/downloads/presets.zip`. The `<a href={p.file!} download>` is rendered (lines 37-42).
4. Attacker closes the tab without completing payment; the download was already delivered.

This is **service / product theft**, the canonical defect for a digital-goods store: the trust boundary is the redirect, not the money.

**Fix direction:** Require `session.payment_status === 'paid'` before rendering any download link; otherwise show "Awaiting payment confirmation" with no file leaks. Make `payment_status` the *only* authority for delivery. **Preferred:** replace redirect-based fulfillment with a Stripe **webhook** (`checkout.session.completed` + guards) that flips an order record to "fulfilled" server-side, and have the success page read that order state — not the raw session (see H1).

### C2. Downloadable files served from the public static root, unauthenticated — `src/data/products.json:33`, `src/pages/success.astro:40`
**Problem:** The digital product's `file` is `/downloads/presets.zip`, an absolute path served by Astro/Netlify as a static asset from `public/`. The success page's `<a href="/downloads/presets.zip" download>` resolves to a plain GET against a public URL. No signed URL, no per-session token, no IP binding, no expiry.

**Concrete exploit (independent of C1, simpler):** The attacker never needs to interact with the success page — `curl https://{origin}/downloads/presets.zip` fetches a static file. Confirmed: `public/` currently contains only `placeholder.svg` and `robots.txt`; no `downloads/` dir exists, so the path 404s today — meaning the **product is misconfigured** and the file isn't there yet, but the **design** puts an unprotected file on the origin. The instant anyone drops a real `presets.zip` into `public/downloads/` per the README's product instructions, it's world-readable at a guessable path.

**Fix direction:** Stop serving fulfillment assets from `public/`. Move them behind an authenticated, single-use, short-TTL signed route minted only after `payment_status === 'paid'` is verified server-side. At minimum, gate with a server endpoint that re-validates `payment_status` against Stripe (or its own order state) on each click and rejects on tampering/expiry.

## HIGH

### H1. No webhook — payment state never fulfilled, only inferred from the redirect — `src/pages/api/` (only `create-checkout.ts` present)
**Problem:** `Glob src/pages/api/**` returns exactly one file. No Stripe webhook endpoint, no `STRIPE_WEBHOOK_SECRET`, no signature verification, no `checkout.session.completed` handler. The success page is a client-driven trust point; Stripe's own guidance treats the webhook as the authoritative fulfillment event precisely because the redirect is unreliable (skipped on network drop / ad-blocker / tab close, replayed, or out-of-order for async methods like SEPA/iDEAL/Klarna/Boleto/ACH — exactly the window C1 exploits).

**Impact:** No order is durably recorded. Async-funded customers may not have paid yet but can download; fully-paid customers who drop the redirect never get marked as paid. The shop runs on a soft coherence model. This is the architectural root cause that makes C1 exploitable.

**Fix direction:** Add `src/pages/api/stripe-webhook.ts` that verifies `stripe.webhooks.constructEvent(rawBody, sig, secret)` (read the body with `request.text()`, not `.json()`), handles `checkout.session.completed`, confirms `event.data.object.payment_status === 'paid'`, and only then records order + entitlements to a store (DB / Netlify Blobs / KV). Keep a `STRIPE_WEBHOOK_SECRET` env; never print it. Move all state-changing decisions out of success.astro once the webhook owns them.

### H2. Quantity has no upper bound → cost amplification and self-harm cart — `src/pages/api/create-checkout.ts:32`
**Problem:** `quantity: item.quantity || 1`. The `||` falsy guard blocks `0`/`null`/`undefined`/`NaN`/`""` but imposes **no upper limit**. `item.quantity` comes from the client cart (localStorage) and is never clamped server-side.

**Exploits:**
1. Client sends `{ id, quantity: 999999 }` → Stripe Checkout Session with a ~$1.5M line (mug $24.99 × 99,999). A handful of these rack up Stripe API/pricing-quota usage; in live mode risks a real authorization for a 7-figure amount.
2. Attacker spams `fetch('/api/create-checkout', {body:{items:[{id:'ceramic-mug',quantity:100000}]}})` to mint Stripe Checkout Sessions — each a billable operation against the merchant's account, with no auth and no rate limit (see H3).

**Fix direction:** Clamp: `Math.min(Math.max(Math.trunc(Number(item.quantity) || 0), 0), MAX_PER_LINE)` with a sane per-line cap (e.g. 100) and a total-items cap. **Reject** (400) if exceeded rather than silently clamping. Validate `item.quantity` is a finite integer; reject `<= 0` explicitly.

### H3. No rate limiting, no auth, no abuse protections on `/api/create-checkout` — `src/pages/api/create-checkout.ts:15`
**Problem:** The POST handler has no auth, no session check, no IP/identity rate limit, no body-size cap, no CAPTCHA. It opens a new `checkouts.sessions.create` per request; with no webhook (H1) there's no idempotency linkage.

**Exploit:** `while(true) fetch('/api/create-checkout', {body:{items:[{id:'ceramic-mug',quantity:1}]}})` mints Stripe Sessions as fast as the network allows — denial-of-wallet / quota exhaustion against the merchant account. Combined with H2 each call does more work.

**Fix direction:** Per-IP/per-fingerprint rate limit at the edge (token bucket) before calling Stripe; return 429 with `Retry-After`. Add Cloudflare Turnstile (free) on the checkout button, validated server-side *before* `sessions.create`. Set `maxDuration` and cap incoming body size. Alert on bursts.

### H4. `STRIPE_SECRET_KEY` untyped and unbundled-unverified — `src/pages/api/create-checkout.ts:8`, `src/pages/success.astro:7`; no `src/env.d.ts`
**Problem:** No `src/env.d.ts` exists (Glob `src/**/*.d.ts` returns nothing). `import.meta.env.STRIPE_SECRET_KEY!` is untyped and non-null-asserted. If the env var is missing, `new Stripe(undefined!)` throws "Secret keys must..." and that message is returned to the client (see M4). There is no compile-time guarantee the key never lands in a client bundle — it's load-bearing on Astro's module-graph classification of two files, with no guard against a future refactor pulling the Stripe init into a shared module imported by a client island (which would embed the secret client-side → `sk_live_` → total account compromise).

**Fix direction:** Add `src/env.d.ts` with `interface ImportMetaEnv { readonly STRIPE_SECRET_KEY: string; readonly STRIPE_WEBHOOK_SECRET?: string }`; drop the `!`. **Preferred:** adopt Astro's `astro:env` server-only secret schema — compile-time guaranteed not to land in a client bundle. Add a fail-fast boot guard if `!process.env.STRIPE_SECRET_KEY`.

## MEDIUM

### M1. Currency hardcoded `'usd'`, drifts from `SITE.currency === 'USD'` — `src/pages/api/create-checkout.ts:28`, `src/config/store.ts:6`, `src/pages/products.xml.ts:14`
**Problem:** Line item currency is the string literal `'usd'` (create-checkout.ts:28). `SITE.currency` is `'USD'` (store.ts:6) and is printed as `${SITE.currency}` in the XML feed (products.xml.ts:14). Stripe requires lowercase; the storefront displays uppercase. Today they agree in value. **But** the invariant lives in two unrelated places. If a merchant edits `SITE.currency` to `'EUR'`, the price formatter displays "€24.99" while Stripe charges USD — a mismatched-currency display that misrepresents the transaction.

**Fix direction:** Single source of truth: derive the Stripe currency from `SITE.currency.toLowerCase()` in one place; assert consistency in a boot check.

### M2. POST body parsed with no schema, bad-shape errors thrown through to the client — `src/pages/api/create-checkout.ts:17-24,50-52`
**Problem:** `await request.json()` throws on non-JSON (caught → returned as `err.message`). `if (!items?.length)` guards emptiness but not type — `items` could be a number/string, then `items.map` throws `.map is not a function`. Unknown product id throws `Unknown product: ${item.id}` — attacker-controlled text interpolated into the message and echoed back (id enumeration: probe ids, distinguish valid vs invalid by response).

**Fix direction:** Validate the body with a schema (reuse `zod`, already in the tree via `content.config.ts`) before touching Stripe: `{ items: array of { id: string, quantity: int 1..MAX } }`. Reject anything else with a generic 400 (no echoed id, no SDK message). Require `Content-Type: application/json` (415 if absent). Don't interpolate user input into client-facing error messages.

### M3. `expand` + `(li.price as any)?.product` casts — catalog edited post-purchase → integrity drift — `src/pages/success.astro:15-20`
**Problem:** The expanded `price.product` metadata is the only hop from the Stripe line item back to the local catalog. If the merchant renames/updates `products.json` between purchase and download-visit, the `products.find(pr => pr.id === productId)` lookup may miss → no download; or an attacker buys item A, the admin updates A's `file` to a new `presets.zip` → buyer receives the *newer* file. **Which file a customer receives depends on catalog state at download-time, not purchase-time.** No test asserts the expanded shape.

**Fix direction:** Pin the purchased file at fulfillment time (when `payment_status === 'paid'` is verified server-side via webhook), not at page-visit time. Store the delivered file's name/hash with the order record. Type the expanded product via SDK types; assert `typeof product === 'object'` before `.metadata`.

### M4. Raw SDK errors returned to the client / success swallows errors — `src/pages/api/create-checkout.ts:50-52`, `src/pages/success.astro:23`
**Problem:** `catch (err) { ... (err as Error).message }` returns the SDK's unmodified message to the browser — potential key-prefix leak (`"Invalid API Key provided: sk_live_***xyz"`) and stack/version fingerprinting. success.astro:23 is `catch {}` — the inverse: swallows everything, leaving a uniformly happy page plus empty downloads, masking exploitation from monitoring.

**Fix direction:** Never echo SDK messages to clients. Map to a stable generic error code (500) with a correlation id; log server-side. In success.astro, distinguish user-recoverable ("invalid session id") from server errors (500 + monitoring) instead of swallowing.

## LOW / INFORMATIONAL

### L1. `success_url` / `cancel_url` from request `origin` — not exploitable — `src/pages/api/create-checkout.ts:20,39,41`
`origin` is scheme+host+port (not path/query); not attacker-controllable. The `{CHECKOUT_SESSION_ID}` template is Stripe's recommended pattern. **Not open-redirect.** Optional hardening: pin `success_url` to `new URL(SITE.url).origin` so it tracks the configured canonical site rather than the request host.

### L2. Unbounded `items` array / no total cap — `src/pages/api/create-checkout.ts:22-34`
No cap on `items.length` or aggregate total. Cap `items.length` (e.g. ≤ 50) and validate all ids before `sessions.create` so a bad id fails fast with 400 rather than 500.

### L3. `escapeXml` omits single-quote; Zod schema doesn't validate `file` — `src/pages/products.xml.ts:37-39`, `content.config.ts`
`escapeXml` covers `& < > "` but not `'`. Inputs are admin-set (not attacker-controlled today) so not a live XSS vector. Note `file` is an extra JSON property **not** constrained by the Zod schema — the apparent "Zod-validated" safety of product data is weaker than it looks. Fix: add `'` escaping; extend the Zod schema to validate `file?: z.string().regex(/^\/downloads\/.../)`.

### L4. Contact form / email exfil surface — `src/pages/contact.astro:27`
`<form action="https://formspree.io/f/YOUR_FORM_ID">` — placeholder likely shipped live; off-origin POST of visitor PII (name, email, phone, address, message) to a third party with no privacy notice. Fix: wire to a Netlify-native form or owned endpoint; add a privacy link; validate `YOUR_FORM_ID` isn't shipped live.

### L5. Dependency CVEs — pinned versions — `package.json` / `package-lock.json`
- `stripe` 22.3.2 — no known Critical/High CVE in scope.
- `@astrojs/netlify` 8.1.2, `astro` 7.1.3, `tailwindcss` 4.3.3 — no Critical/High CVE matches in scope.
- Transitive surface includes `@netlify/blobs`, `@netlify/functions`, `vite`, `esbuild` — worth periodic SCA scan.

**The risk posture is NOT dependency CVEs — it is the first-party application logic (C1, C2, H1–H4).** Recommended: add `npm audit --omit=dev --audit-level=high` to CI as a regression gate + Dependabot.

## Composite exploit (most likely real-world path)
A non-paying attacker obtains the digital preset file **without paying**:
1. Initiate checkout for the preset; ignore payment.
2. Stripe redirects to `/success?session_id=cs_...` with `payment_status` possibly `unpaid`.
3. `success.astro:14-21` resolves `p.file === '/downloads/presets.zip'`, renders the download link — no `payment_status` check (C1).
4. Click the link or hit `https://{origin}/downloads/presets.zip` directly (C2). File delivered — no payment.

Fixing **only C1** leaves C2 open. Fixing **only C2** leaves C1 open. The single root-cause fix is **H1 (webhook owning fulfillment) + gated, signed, server-side download URL** that rechecks `payment_status` and is minted only after the webhook marks the order paid.

---

# Part B — Secrets, Headers, Deploy / Infra
*[direct analysis — SecOps agent unavailable due to upstream API limits]*

## MEDIUM

### S1. No security headers in `netlify.toml` — `netlify.toml:1-2`  `[direct]`
`netlify.toml` contains only `[build] command = "npm run build"`. No CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy are configured. Netlify applies a small set of defaults, but **CSP and HSTS are not among them** by default. Without CSP, any future injected markup (e.g. via the contact form reflection or a dependency XSS) executes unrestricted. Without HSTS, the site is vulnerable to SSL-strip on networks that downgrade.

**Fix direction:** add a `[[headers]]` block:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; img-src 'self' https://images.unsplash.com; form-action 'self' https://formspree.io; ..."
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

### S2. `publish` directory not declared in `netlify.toml` — `netlify.toml:1-2`  `[direct]`
No `publish` key. With the `@astrojs/netlify` SSR adapter the deploy is function-based, but Netlify still needs to know what to publish (and static assets like `public/downloads/*` — see C2 — are served from the publish/root). Omitting it leaves Netlify to auto-detect, which can serve stale or incomplete builds silently.

**Fix direction:** explicitly set `publish = "dist"` (or the adapter's expected output dir) and verify in the Netlify deploy log.

## LOW

### S3. No Node version pinned — `netlify.toml`  `[direct]`
No `[build.environment] NODE_VERSION` and no `.nvmrc`. Netlify's default Node major shifts over time; a future bump can break the build or change runtime behavior (Stripe SDK, Astro) without warning.

**Fix direction:** pin in `netlify.toml`:
```toml
[build.environment]
  NODE_VERSION = "20"
```

### S4. Placeholder canonical URL duplicated across 3 files — `astro.config.mjs:7`, `src/config/store.ts:5`, `public/robots.txt:4`  `[direct]`
`https://your-store.netlify.app` is hardcoded in three independent places:
- `astro.config.mjs:7` → `site:` (drives `@astrojs/sitemap` output)
- `src/config/store.ts:5` → `SITE.url` (drives `products.xml.ts:15,16` feed URLs and anything reading SITE)
- `public/robots.txt:4` → `Sitemap:` line

Three sources of truth. After the merchant sets the real domain, forgetting to update any one leaves stale `your-store.netlify.app` URLs in the Google Merchant feed, the sitemap, and robots — search engines index the wrong host. `products.xml.ts:15,16` already emits `${SITE.url}/product/...` — so a stale `SITE.url` poisons the whole feed.

**Fix direction:** single source of truth — drive `astro.config.mjs` `site` and `robots.txt` from `SITE.url` at build time (or vice versa). At minimum, document the three-file update in the README and add a boot assertion that `SITE.url` is not the placeholder before production.

### S5. `robots.txt` allows everything including `/api` and `/success` — `public/robots.txt:1-2`  `[direct]`
`User-agent: * / Allow: /` exposes `/api/create-checkout` and the `/success?session_id=...` URL to crawlers. `/success` with a session id in the query can leak session ids into search-engine caches and referrer logs. Not a direct vuln (the API is POST-only), but defense-in-depth.

**Fix direction:** add:
```
Disallow: /api/
Disallow: /success
Disallow: /cancel
```

### S6. No `image.remotePatterns` / `image.domains` in `astro.config.mjs` — `astro.config.mjs:8`  `[direct]`
Product images are remote Unsplash URLs. `imageCDN: false` today means images are passthrough `<img>` (no SSRF via Astro's image service right now). **But** the moment someone enables `imageCDN: true` or switches to Astro `<Image>` components without an allowlist, remote image optimization becomes unbounded — SSRF-adjacent (an attacker who can set a product `image` could point optimization at internal URLs).

**Fix direction:** if image optimization is enabled, add `image.remotePatterns` allowlisting `images.unsplash.com` (and any other approved host).

## INFORMATIONAL

### S7. Malformed image URLs in the Google feed — `src/pages/products.xml.ts:16`  `[direct]`
`<g:image_link>${SITE.url}${p.data.image}</g:image_link>` concatenates the placeholder origin with already-absolute Unsplash URLs → `https://your-store.netlify.apphttps://images.unsplash.com/...` (broken for **all** products). `create-checkout.ts:25` guards this with `startsWith('http')` but `products.xml.ts` does not. Severity: correctness (broken feed), not security, but Google will reject/skip the items.

**Fix direction:** same `startsWith('http')` guard in `products.xml.ts` — emit `p.data.image` verbatim when it's already absolute.

### S8. No `src/env.d.ts` — untyped `import.meta.env.STRIPE_SECRET_KEY!` — `success.astro:7`, `create-checkout.ts:8`  `[direct]`
(Overlaps AppSec H4.) The `!` non-null assertion hides the real `undefined` runtime state if the env var is missing; nothing catches this at build time. Confirmed: no `PUBLIC_` prefix, so the key stays server-side (good). But there's no compile-time `ImportMetaEnv` interface and no guard against a refactor importing the Stripe init into a client island.

**Fix direction:** add `src/env.d.ts`:
```ts
interface ImportMetaEnv { readonly STRIPE_SECRET_KEY: string; readonly STRIPE_WEBHOOK_SECRET?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
```
Drop the `!`. **Preferred:** `astro:env` server-only secret schema (compile-time guaranteed server-only).

### S9. `.gitignore` covers `.env` but not `.env.local` / `.env.*` variants — `.gitignore:3`  `[direct]`
If a user creates `.env.local` (a common Astro convention for local overrides) it could be committed. Minor.

**Fix direction:** add `.env*` (or `.env.*`) to `.gitignore`.

---

# Summary matrix

| ID | Sev | File:line | Core defect |
|----|-----|-----------|-------------|
| **C1** | Critical | `src/pages/success.astro:12-24` | Downloads granted w/o `payment_status==='paid'` |
| **C2** | Critical | `src/data/products.json:33` + `success.astro:40` | Digital file on public static root, unauthenticated & guessable |
| **H1** | High | `src/pages/api/` (no webhook) | Fulfillment inferred from redirect, never authoritative |
| **H2** | High | `src/pages/api/create-checkout.ts:32` | `quantity: item.quantity \|\| 1` — no clamp |
| **H3** | High | `src/pages/api/create-checkout.ts:15` | No auth/rate-limit/CAPTCHA → Stripe cost amplification |
| **H4** | High | `create-checkout.ts:8`, `success.astro:7`, no `env.d.ts` | Untyped `STRIPE_SECRET_KEY!`; no client-bundle guard |
| **S1** | Medium | `netlify.toml:1-2` | No security headers (CSP/HSTS/…)  `[direct]` |
| **S2** | Medium | `netlify.toml:1-2` | `publish` dir not declared  `[direct]` |
| **M1** | Medium | `create-checkout.ts:28` vs `store.ts:6` | Hardcoded `'usd'` diverges from `SITE.currency` |
| **M2** | Medium | `create-checkout.ts:17-24,50-52` | No body schema; bad input echoes id / SDK msg |
| **M3** | Medium | `success.astro:15-20` | Expanded-product `any` cast + catalog drift → file-integrity |
| **M4** | Medium | `create-checkout.ts:50-52`, `success.astro:23` | Raw SDK errors to client / success swallows errors |
| **S3** | Low | `netlify.toml` | Node version not pinned  `[direct]` |
| **S4** | Low | `astro.config.mjs:7`, `store.ts:5`, `robots.txt:4` | Placeholder URL in 3 files — single source missing  `[direct]` |
| **S5** | Low | `public/robots.txt:1-2` | Allows `/api` + `/success` — session-id crawl exposure  `[direct]` |
| **S6** | Low | `astro.config.mjs:8` | No `image.remotePatterns` (SSRF-adjacent if CDN enabled)  `[direct]` |
| **L1** | Low | `create-checkout.ts:20,39,41` | Open-redirect: not exploitable; consider pinning to SITE.url |
| **L2** | Low | `create-checkout.ts:22-34` | No `items.length` / aggregate-total cap |
| **L3** | Low | `products.xml.ts:37-39`, `content.config.ts` | `escapeXml` omits `'`; Zod schema doesn't validate `file` |
| **L4** | Low | `contact.astro:27` | `YOUR_FORM_ID` likely live; off-origin PII to Formspree |
| **S7** | Info | `products.xml.ts:16` | Malformed image URLs in feed (no http guard)  `[direct]` |
| **S8** | Info | `success.astro:7`, `create-checkout.ts:8` | No `env.d.ts` — untyped `!` (overlaps H4)  `[direct]` |
| **S9** | Info | `.gitignore:3` | `.env.local` / `.env.*` variants not ignored  `[direct]` |
| **L5** | Info | `package.json` / lockfile | No Critical/High CVE on pinned deps; add `npm audit` to CI |

---

# Recommended fix order

1. **C1 + C2 + H1 as one design change** — add the webhook, gate fulfillment on `payment_status === 'paid'`, and serve downloads only via a signed, server-minted, short-TTL URL (no files in `public/`). This single change closes the critical theft path.
2. **H4 / S8** — typed env (`src/env.d.ts` or `astro:env`); fail-fast boot guard on missing key. Smallest diff, removes a real leak class.
3. **H2 + H3** — quantity bounds + rate limit/CAPTCHA on `/api/create-checkout`; reject bad input with 400 (ties into M2).
4. **S1** — security headers in `netlify.toml` (CSP/HSTS/…). One file, big hardening payoff.
5. **M1–M4** — currency single-source, body schema, error hygiene, file-integrity pinning.
6. **S2–S7, L1–L5** — publish dir, node pin, URL de-duplication, robots hardening, image allowlist, feed URL guard, `.gitignore` variants, CI audit gate.

**Secrets scan:** CLEAN. **No live keys committed.**
