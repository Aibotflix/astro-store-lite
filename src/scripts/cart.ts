// ponytail: cart shape is unversioned; if props change, bump CART_KEY and migrate inside getCart

export type CartItem = {
  id: string; name: string; price: number; image: string; quantity: number
}

const CART_KEY = 'cart'

export function getCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] }
}

export function addToCart(item: Omit<CartItem, 'quantity'>, qty = 1) {
  const cart = getCart()
  const existing = cart.find(i => i.id === item.id)
  if (existing) existing.quantity += qty
  else cart.push({ ...item, quantity: qty })
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  window.dispatchEvent(new Event('cart-updated'))
}

const fmt = (c: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100)

export function initCart() {
  const $ = (id: string) => document.getElementById(id)
  const drawer = $('cart-drawer')!
  const overlay = $('cart-overlay')!
  const openBtn = $('cart-button')!
  const closeBtn = $('cart-close')!
  const itemsEl = $('cart-items')!
  const countEl = $('cart-count')!
  const totalEl = $('cart-total')!
  const checkoutBtn = $('checkout-button')!

  const open = () => { drawer.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); document.body.style.overflow = 'hidden'; closeBtn.focus() }
  const close = () => { drawer.classList.add('translate-x-full'); overlay.classList.add('hidden'); document.body.style.overflow = ''; openBtn.focus() }

  openBtn.addEventListener('click', open)
  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', close)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.classList.contains('translate-x-full')) close() })

  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return
    const f = drawer.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])')
    if (!f.length) return
    const first = f[0], last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault() }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault() }
  })

  // event delegation for qty/remove buttons
  itemsEl.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
    if (!t) return
    const idx = Number(t.dataset.idx)
    const cart = getCart()
    if (t.dataset.act === 'rm') cart.splice(idx, 1)
    else { cart[idx].quantity += t.dataset.act === 'inc' ? 1 : -1; if (cart[idx].quantity <= 0) cart.splice(idx, 1) }
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
    window.dispatchEvent(new Event('cart-updated'))
  })

  checkoutBtn.addEventListener('click', async () => {
    const res = await fetch('/api/create-checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: getCart() }),
    })
    if (!res.ok) { alert('Checkout failed. Make sure Stripe is configured.'); return }
    const { url } = await res.json()
    window.location.href = url
  })

  const render = () => {
    const cart = getCart()
    countEl.textContent = String(cart.reduce((s, i) => s + i.quantity, 0))
    totalEl.textContent = fmt(cart.reduce((s, i) => s + i.price * i.quantity, 0))
    itemsEl.innerHTML = cart.map((item, idx) => `
      <div class="flex items-center gap-4 glass p-3 rounded-lg">
        <img src="${item.image}" alt="" class="h-16 w-16 rounded object-cover" onerror="this.style.visibility='hidden'">
        <div class="flex-1">
          <div class="text-sm font-semibold">${item.name}</div>
          <div class="text-xs text-text-muted">${fmt(item.price)}</div>
        </div>
        <div class="flex items-center gap-1">
          <button data-act="dec" data-idx="${idx}" aria-label="Decrease quantity" class="w-7 h-7 flex items-center justify-center rounded border border-border text-sm">−</button>
          <span class="w-5 text-center text-sm font-medium">${item.quantity}</span>
          <button data-act="inc" data-idx="${idx}" aria-label="Increase quantity" class="w-7 h-7 flex items-center justify-center rounded border border-border text-sm">+</button>
          <button data-act="rm" data-idx="${idx}" aria-label="Remove ${item.name}" class="w-7 h-7 flex items-center justify-center rounded border border-border text-sm ml-2 text-red-600">✕</button>
        </div>
      </div>
    `).join('')
  }

  window.addEventListener('cart-updated', render)
  render()
}
