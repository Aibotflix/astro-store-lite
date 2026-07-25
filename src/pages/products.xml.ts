export const prerender = true

import { getCollection } from 'astro:content'
import { SITE } from '../config/store'

export async function GET() {
  const products = await getCollection('products')

  const items = products.map(p => `
    <item>
      <g:id>${p.id}</g:id>
      <g:title>${escapeXml(p.data.name)}</g:title>
      <g:description>${escapeXml(p.data.description)}</g:description>
      <g:price>${(p.data.price / 100).toFixed(2)} ${SITE.currency}</g:price>
      <g:link>${SITE.url}/product/${p.id}/</g:link>
      <g:image_link>${SITE.url}${p.data.image}</g:image_link>
      <g:brand>${escapeXml(SITE.name)}</g:brand>
      <g:condition>new</g:condition>
      <g:availability>in_stock</g:availability>
    </item>`).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${SITE.url}/</link>
    <description>Products from ${escapeXml(SITE.name)}</description>
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
