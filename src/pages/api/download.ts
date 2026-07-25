export const prerender = false

import type { APIRoute } from 'astro'
import Stripe from 'stripe'
import products from '../../data/products.json'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY!)

const PRODUCT_FILES: Record<string, string> = {}
for (const p of products) {
  if (p.file) PRODUCT_FILES[p.id] = p.file
}

export const GET: APIRoute = async ({ url }) => {
  const session_id = url.searchParams.get('session_id')
  const product_id = url.searchParams.get('product')

  if (!session_id || !product_id) {
    return new Response('Missing session_id or product', { status: 400 })
  }

  const filePath = PRODUCT_FILES[product_id]
  if (!filePath) {
    return new Response('Unknown product', { status: 404 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (session.payment_status !== 'paid') {
      return new Response('Payment not confirmed', { status: 403 })
    }
  } catch {
    return new Response('Invalid session', { status: 403 })
  }

  const privatePath = join(process.cwd(), 'private', filePath.replace(/^\//, ''))
  try {
    const buffer = readFileSync(privatePath)
    const filename = filePath.split('/').pop() || 'download'
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return new Response('File not found — place it in private/' + filePath, { status: 404 })
  }
}
