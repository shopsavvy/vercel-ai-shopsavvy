import { tool } from 'ai'
import { ShopSavvyDataAPI } from '@shopsavvy/sdk'
import { z } from 'zod'

export interface ShopSavvyToolsConfig {
  apiKey: string
}

/**
 * Create ShopSavvy tools for the Vercel AI SDK.
 *
 * These tools give any LLM access to product search, price comparison,
 * price history, and deal browsing via the ShopSavvy Data API.
 *
 * @example
 * ```typescript
 * import { generateText } from 'ai'
 * import { openai } from '@ai-sdk/openai'
 * import { createShopSavvyTools } from 'vercel-ai-shopsavvy'
 *
 * const tools = createShopSavvyTools({ apiKey: process.env.SHOPSAVVY_API_KEY! })
 *
 * const result = await generateText({
 *   model: openai('gpt-4o'),
 *   tools,
 *   maxSteps: 5,
 *   prompt: 'Find the best price for AirPods Pro',
 * })
 * ```
 */
export function createShopSavvyTools({ apiKey }: ShopSavvyToolsConfig) {
  const client = new ShopSavvyDataAPI({ apiKey })

  return {
    searchProducts: tool({
      description:
        'Search for products by keyword. Returns product details including title, brand, category, and identifiers like barcode and ASIN.',
      parameters: z.object({
        query: z.string().describe('Search query (product name, keyword, or description)'),
        limit: z.number().optional().default(10).describe('Maximum number of results'),
      }),
      execute: async ({ query, limit }) => {
        const result = await client.searchProducts(query, { limit })
        return {
          products: result.data.map((p) => ({
            title: p.title,
            brand: p.brand,
            category: p.category,
            barcode: p.barcode,
            asin: p.amazon,
            shopsavvy_id: p.shopsavvy,
            images: p.images,
          })),
          total: result.pagination?.total ?? result.data.length,
        }
      },
    }),

    getOffers: tool({
      description:
        'Get current offers from retailers for a product. Accepts barcode, ASIN, URL, model number, or ShopSavvy ID. Returns prices sorted by price.',
      parameters: z.object({
        identifier: z.string().describe('Product identifier (barcode, ASIN, URL, model number, or ShopSavvy ID)'),
        retailer: z.string().optional().describe('Filter to a specific retailer'),
      }),
      execute: async ({ identifier, retailer }) => {
        const result = await client.getCurrentOffers(identifier, { retailer })
        return result.data.map((product) => ({
          title: product.title,
          offers: product.offers?.map((o) => ({
            retailer: o.retailer,
            price: o.price,
            currency: o.currency,
            availability: o.availability,
            condition: o.condition,
            url: o.URL,
          })),
        }))
      },
    }),

    getPriceHistory: tool({
      description:
        'Get historical price data for a product over a date range. Helps determine if the current price is a good deal.',
      parameters: z.object({
        identifier: z.string().describe('Product identifier (barcode, ASIN, URL, model number, or ShopSavvy ID)'),
        startDate: z.string().describe('Start date in YYYY-MM-DD format'),
        endDate: z.string().describe('End date in YYYY-MM-DD format'),
        retailer: z.string().optional().describe('Filter to a specific retailer'),
      }),
      execute: async ({ identifier, startDate, endDate, retailer }) => {
        const result = await client.getPriceHistory(identifier, startDate, endDate, { retailer })
        return result.data
      },
    }),

    getDeals: tool({
      description:
        'Browse current shopping deals with expert grades, pricing, and community votes. Sort by hot, new, top-hour, top-day, or top-week.',
      parameters: z.object({
        sort: z.enum(['hot', 'new', 'top-hour', 'top-day', 'top-week']).optional().describe('Sort order'),
        limit: z.number().optional().describe('Maximum number of deals'),
        category: z.string().optional().describe('Filter by category'),
        retailer: z.string().optional().describe('Filter by retailer'),
      }),
      execute: async ({ sort, limit, category, retailer }) => {
        const result = await client.getDeals({ sort, limit, category, retailer })
        return {
          deals: result.deals?.map((d) => ({
            title: d.title,
            grade: `${d.grade?.letter}${d.grade?.suffix || ''}`,
            price: d.pricing?.current,
            original_price: d.pricing?.original,
            retailer: d.retailer?.name,
            url: d.url,
            score: d.votes?.score,
          })),
        }
      },
    }),
  }
}
