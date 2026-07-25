import type { CollectionEntry } from 'astro:content'

export const SITE = {
  name: 'My Store',
  url: 'https://your-store.netlify.app',
  currency: 'USD',
  hasShipping: true,
  description: 'Clean, minimalist online store powered by Astro.',
  address: '123 Main Street, Portland, OR 97201',
  phone: '(555) 123-4567',
  email: 'hello@mystore.com',
}

export const NAV = [
  { label: 'Contact', href: '/contact' },
]

export function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: SITE.currency,
  }).format(cents / 100)
}