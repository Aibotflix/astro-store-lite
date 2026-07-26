# Astro Store Lite

The only free Astro theme with built-in Stripe checkout — no Shopify, no React, no database. Add products in JSON and deploy to Netlify.

**[Live demo →](https://astro-store-lite.aibotflix.workers.dev/)**

> **Demo notice:** The live demo shows the storefront UI only. Checkout is not connected to Stripe — this is a template demo, not a functioning store. To run your own store, follow the setup steps below.

## What you'll need

**Software to install (all free):**
- **Node.js** — the engine that runs your store. Download from https://nodejs.org (get the LTS version).
- **VS Code** — where you edit your store. Download from https://code.visualstudio.com.
- **GitHub Desktop** — uploads your store to the internet. Download from https://desktop.github.com.

**Accounts to create (all free):**
- **GitHub** — stores your code in the cloud. Sign up at https://github.com.
- **Stripe** — lets customers pay you. Sign up at https://stripe.com.
- **Netlify** — hosts your store online. Sign up at https://netlify.com (you'll do this in Step 4).
- **Formspree** — forwards contact form messages to your email. Sign up at https://formspree.io (you'll do this in Step 3).

You don't need to create all of these now. The steps below tell you when and where.

---

## Step 1: Get the project

1. Click the green "Use this template" button near the top of this page. GitHub will ask you to sign in if you aren't already.
2. Click "Create a new repository", name it something like `my-store`, and click "Create repository".
3. On the next page, click "Code" then "Download ZIP".
4. Unzip the folder, then open it in VS Code (File → Open Folder).

---

## Step 2: Install and see your store

In VS Code, open the terminal (Terminal → New Terminal) and run:

```
npm install
```

Wait for it to finish (about 30 seconds). Then run:

```
npm run dev
```

Open `http://localhost:4321` in your browser. You should see your store.

Press **Ctrl+C** in the terminal to stop it.

---

## Step 3: Make it your store

### How to open files in VS Code

There are two ways:
- Click folders in the left sidebar (`src` → `config` → `store.ts`)
- Press **Ctrl+P** and type the filename

### Change the store name and info

Open **`src/config/store.ts`** (in the left sidebar, open `src`, then `config`, then click `store.ts`).

Change these:

| What to find | What it is | Change to |
|-------------|-----------|-----------|
| `name: 'My Store'` | Your store name | Your actual store name |
| `url: 'https://your-store.netlify.app'` | Your website address | Your actual URL (set this after you deploy) |
| `address: '123 Main...'` | Your business address | Your actual address |
| `phone: '(555) 123-4567'` | Your phone number | Your actual number |
| `email: 'hello@mystore.com'` | Your email | Your actual email |

### Add your products

Open **`src/data/products.json`**. You'll see something like this:

```json
{
  "id": "ceramic-mug",
  "name": "Ceramic Mug",
  "price": 2499,
  "image": "https://images.unsplash.com/...",
  "category": "Drinkware",
  "description": "A ceramic mug."
}
```

What each field means:

| Field | What to put | Example |
|-------|-------------|---------|
| `id` | Short code, no spaces | `"blue-hat"` |
| `name` | Product name | `"Blue Hat"` |
| `price` | Price in cents ($24.99 = 2499) | `2499` |
| `image` | Web address of a photo | `"https://..."` |
| `category` | Group name | `"Accessories"` |
| `description` | A few sentences | `"A nice blue hat."` |
| `file` | (Optional) Download link for digital products | `"/downloads/ebook.pdf"` |

**To edit a product** — change the values inside the quotes. Save the file.

**To add a product** — copy the whole block (from `{` to `}`), paste it after the last block, add a comma after the block before it, then change the values.

**Important:** There must be a comma between every block except the last one. If there's only one product, no comma is needed.

**One more thing about descriptions:** If you need a double quote inside the description (like `22"` inches), put a backslash before it: write `22\"` instead of `22"`.

### Digital vs physical products

Open **`src/config/store.ts`** and find `hasShipping: true`:
- `true` (default) — customers enter a shipping address. Use for physical products.
- `false` — no shipping address needed. Use if you only sell digital downloads.

Products with a `file` field are digital. After purchase, customers see a download button.

**To add a digital product,** set the `file` field to a path like `"/downloads/presets.zip"`, then place the actual file at `private/downloads/presets.zip`. The theme verifies payment with Stripe before serving the file through a protected endpoint — the file is never publicly accessible.

**Important:** The download link on the success page points to `/api/download?session_id=...&product=...` which verifies `payment_status === 'paid'` with Stripe before serving the file from the `private/` directory. This prevents unpaid access and direct URL guessing. For high-value digital goods, consider a third-party fulfillment service with DRM or signed URLs.

### Connect Stripe (so customers can pay you)

1. Go to https://dashboard.stripe.com and log in
2. On the left, click "Developers" → "API keys"
3. Copy the key that starts with `sk_test_`
4. In VS Code, find the file **`.env.example`** (in the root folder, not inside `src/`)
5. Right-click it → "Rename". Change it to **`.env`** (delete the `.example` part)

   > **Windows users:** If you see just `env.example` without the dot, you're looking at the filename without its extension. Rename it to `.env` — if Windows warns you the file might become unusable, click Yes. That's normal.

6. Open `.env` and paste your Stripe key after the `=`:

```
STRIPE_SECRET_KEY=sk_test_your_key_here
```

### Set up the contact form (free, 30 seconds)

The contact page uses **Formspree** — a free service that forwards messages to your email.

1. Go to https://formspree.io and create a free account
2. Create a new form — you'll get a form ID like `xyzabc12`
3. Open **`src/pages/contact.astro`**
4. Find `YOUR_FORM_ID` and replace it with your actual form ID

### Change the homepage hero

Open **`src/components/Hero.astro`**. Edit any of these:

| What to change | Where it is |
|---------------|-------------|
| Background image | The `src="..."` near the top — swap the URL for your own photo |
| Small tagline | `Curated for you` |
| Big heading | `Designed for daily life` |
| Subtext | `Every piece...` |
| Button text | `Shop now` |

---

## Step 4: Put your store online

Your store needs a host that can run Node.js (for payment processing). Basic shared hosting won't work.

**The easiest (and free) option is Netlify.**

1. Download **GitHub Desktop** from https://desktop.github.com — it's free
2. Open GitHub Desktop and sign in with your GitHub account
3. Click "File" → "Add local repository" → choose your project folder
4. At the bottom, write a summary like "first version" and click "Commit to main"
5. Click "Publish repository" → keep it private or public, your choice
6. Go to https://netlify.com and create a free account
7. Click "Add new site" → "Import an existing project"
8. Click "GitHub" and select your new repository
9. Netlify will detect the settings automatically — click "Deploy"
10. Wait about a minute. Your store is now live at a random Netlify URL

Then:

1. Go to Site settings → Environment variables → Add a variable
   - Key: `STRIPE_SECRET_KEY`
   - Value: paste your Stripe key (the same one from your `.env` file)

2. Open **`src/config/store.ts`** and update `url:` to your actual Netlify URL (looks like `https://random-name-123456.netlify.app`)

3. In GitHub Desktop, you'll see the change you just made. Write "updated URL" and click "Commit to main", then "Push origin" to send it to GitHub. Netlify will automatically rebuild.

### Use your own domain (optional)

You can use a custom domain like `yourstore.com` instead of the random Netlify URL.

1. Buy a domain from anywhere (Google Domains, Namecheap, GoDaddy, etc.)
2. On Netlify, go to your site → Domain settings → Add custom domain
3. Type your domain and follow Netlify's instructions to update your DNS settings
4. Update the `url:` in **`src/config/store.ts`** to your new domain
5. Commit and push in GitHub Desktop — Netlify rebuilds

Netlify handles HTTPS automatically (free SSL certificate).

**Want to use a different host?** Your host needs to support Node.js server-side rendering. Vercel and Cloudflare Pages work (you'll need to change the adapter). Hostinger, GoDaddy, and Bluehost shared plans won't work — they can't run the payment backend. Stick with Netlify for the easiest setup.

---

## Step 5: Test it

First, test on your computer:

1. Run `npm run dev` in the terminal
2. Open `http://localhost:4321`
3. Add a product to the cart
4. Click the cart button, then "Checkout with Stripe"
5. On the Stripe payment page, use card number **4242 4242 4242 4242** with any future date and any 3-digit code
6. You'll be sent back to your store's success page

Then test on your live site the same way on your Netlify URL.

No real money is charged — Stripe gives you test keys for testing.

---

## Step 6: Take real money

1. In your Stripe Dashboard, toggle "Test mode" off (top right corner)
2. Copy your live key (starts with `sk_live_`)
3. Update your `.env` file with the live key
4. On Netlify, update the `STRIPE_SECRET_KEY` environment variable to the live key
5. In GitHub Desktop, commit and push — Netlify rebuilds automatically
6. You're live

---

## Files you'll edit most often

| File | What it does |
|------|-------------|
| `src/data/products.json` | Your products |
| `src/config/store.ts` | Store name, URL, currency, shipping on/off, address, phone, email |

---

## Quick reference for redeploying after changes

1. Make your changes in VS Code
2. Open GitHub Desktop — it shows what changed
3. Write a summary (like "updated products") and click "Commit to main"
4. Click "Push origin" — Netlify automatically rebuilds

That's it. No need to upload anything or repeat the setup.

---

## Pro Version ($99)

Need more than Lite offers? The Pro version includes everything in Lite plus:

- **Email notifications** — customers get order confirmations and download links sent to their inbox (via Resend)
- **Multiple themes** — switch between warm terracotta, cool sage, dark charcoal, and pure white with one toggle
- **Page transitions** — smooth animations between pages (Astro View Transitions)
- **Product search + filters** — customers can find what they want fast
- **SEO structured data** — rich snippets for Google product search
- **Analytics dashboard** — see your orders and revenue in one place
- **Priority support** — I'll help you set it up

To purchase, open an issue on this repository's GitHub page — I'll send you the Pro files. Your email stays private, I'll reply through the issue.

---

## License

Free to use for any personal or commercial project. You can modify it and use it for your own store.

You may not redistribute this template or sell it as your own theme. That's what the Pro version is for.

Go make something.
