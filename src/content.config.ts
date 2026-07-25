import { defineCollection } from 'astro:content'
import { file } from 'astro/loaders'
import { z } from 'astro/zod'

const products = defineCollection({
  loader: file('src/data/products.json'),
  schema: z.object({
    name: z.string(),
    price: z.number().int(),
    image: z.string(),
    category: z.string(),
    description: z.string(),
  }),
})

export const collections = { products }
