export const prerender = false

import type { APIRoute } from 'astro'
import Stripe from 'stripe'
import { SITE } from '../../config/store'
import products from '../../data/products.json'

const PRODUCTS: Record<string, { name: string; price: number; image: string }> = {}
for (const p of products) {
  PRODUCTS[p.id] = { name: p.name, price: p.price, image: p.image || '/placeholder.svg' }
}

function getStripe() {
  return new Stripe(import.meta.env.STRIPE_SECRET_KEY!)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const stripe = getStripe()
    const { items } = await request.json()
    if (!items?.length) return new Response(JSON.stringify({ error: 'Cart is empty' }), { status: 400 })

    const origin = new URL(request.url).origin

    const line_items = items.map((item: { id: string; quantity: number }) => {
      const p = PRODUCTS[item.id]
      if (!p) throw new Error(`Unknown product: ${item.id}`)
      const imageUrl = p.image.startsWith('http') ? p.image : `${origin}${p.image}`
      return {
        price_data: {
          currency: 'usd',
          product_data: { name: p.name, images: [imageUrl], metadata: { product_id: item.id } },
          unit_amount: p.price,
        },
        quantity: Math.min(Math.max(Math.trunc(item.quantity) || 1, 1), 100),
      }
    })

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
    }

    if (SITE.hasShipping) {
      sessionParams.shipping_address_collection = { allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'NZ'] }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(JSON.stringify({ url: session.url }))
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
}
