import { tool, type Tool } from 'ai'
import { ShopSavvyDataAPI } from '@shopsavvy/sdk'
import { z } from 'zod'

const searchProductsInput = z.object({
  query: z.string().describe('Search query (product name, keyword, or description)'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results (default 10)'),
})

const getOffersInput = z.object({
  identifier: z.string().describe('Product identifier (barcode, ASIN, URL, model number, or ShopSavvy ID)'),
  retailer: z.string().optional().describe('Only return offers from this retailer domain, e.g. "amazon.com" or "bestbuy.com"'),
})

const getPriceHistoryInput = z.object({
  identifier: z.string().describe('Product identifier (barcode, ASIN, URL, model number, or ShopSavvy ID)'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date in YYYY-MM-DD format'),
  retailer: z.string().optional().describe('Only return history from this retailer domain, e.g. "amazon.com"'),
})

const getDealsInput = z.object({
  sort: z.enum(['hot', 'new', 'top-hour', 'top-day', 'top-week']).optional().describe('Sort order (default hot)'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of deals'),
  category: z.string().optional().describe('Filter by category'),
  retailer: z.string().optional().describe('Filter by retailer'),
})

export type SearchProductsInput = z.infer<typeof searchProductsInput>
export type GetOffersInput = z.infer<typeof getOffersInput>
export type GetPriceHistoryInput = z.infer<typeof getPriceHistoryInput>
export type GetDealsInput = z.infer<typeof getDealsInput>

// Product and offer fields are passed straight through from the Data API, which sends
// an explicit JSON `null` (not an absent key) for an unknown value — hence `| null`.
export interface SearchProductsOutput {
  products: Array<{
    title: string
    brand: string | null | undefined
    category: string | null | undefined
    barcode: string | null | undefined
    asin: string | null | undefined
    shopsavvy_id: string
    images: string[] | undefined
  }>
  total: number
}

export type GetOffersOutput = Array<{
  title: string
  offers: Array<{
    retailer: string | null | undefined
    price: number | null | undefined
    currency: string | null | undefined
    availability: string | undefined
    condition: string | null | undefined
    url: string | null | undefined
  }>
}>

/**
 * One entry per product, each with its offers, each offer carrying its price history
 * (newest first) — the shape of the Data API's /products/offers/history response.
 */
export type GetPriceHistoryOutput = Array<{
  title: string
  offers: Array<{
    retailer: string | null | undefined
    condition: string | null | undefined
    url: string | null | undefined
    history: Array<{
      timestamp: string
      price: number
      /** Null when the archived point recorded no currency. */
      currency: string | null | undefined
      availability: string | undefined
    }>
  }>
}>

export interface GetDealsOutput {
  deals: Array<{
    title: string
    grade: string
    price: number
    original_price: number | undefined
    currency: string
    retailer: string
    url: string
    score: number
  }>
}

/** The tool set returned by createShopSavvyTools. */
export type ShopSavvyTools = {
  searchProducts: Tool<SearchProductsInput, SearchProductsOutput>
  getOffers: Tool<GetOffersInput, GetOffersOutput>
  getPriceHistory: Tool<GetPriceHistoryInput, GetPriceHistoryOutput>
  getDeals: Tool<GetDealsInput, GetDealsOutput>
}

export interface ShopSavvyToolsConfig {
  /** Your ShopSavvy Data API key (get one at https://shopsavvy.com/data) */
  apiKey: string
  /** Optional API base URL override, e.g. to route calls through your own proxy */
  baseUrl?: string
  /** Optional request timeout in milliseconds */
  timeout?: number
}

/**
 * Create ShopSavvy tools for the Vercel AI SDK.
 *
 * These tools give any LLM access to product search, price comparison,
 * price history, and deal browsing via the ShopSavvy Data API.
 *
 * @example
 * ```typescript
 * import { generateText, stepCountIs } from 'ai'
 * import { openai } from '@ai-sdk/openai'
 * import { createShopSavvyTools } from 'vercel-ai-shopsavvy'
 *
 * const tools = createShopSavvyTools({ apiKey: process.env.SHOPSAVVY_API_KEY! })
 *
 * const result = await generateText({
 *   model: openai('gpt-4o'),
 *   tools,
 *   stopWhen: stepCountIs(5),
 *   prompt: 'Find the best price for AirPods Pro',
 * })
 * ```
 */
export function createShopSavvyTools({ apiKey, baseUrl, timeout }: ShopSavvyToolsConfig): ShopSavvyTools {
  const client = new ShopSavvyDataAPI({ apiKey, baseUrl, timeout })

  return {
    searchProducts: tool({
      description:
        'Search for products by keyword. Returns product details including title, brand, category, and identifiers like barcode and ASIN.',
      inputSchema: searchProductsInput,
      execute: async ({ query, limit }) => {
        const result = await client.searchProducts(query, { limit: limit ?? 10 })
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
      inputSchema: getOffersInput,
      execute: async ({ identifier, retailer }) => {
        const result = await client.getCurrentOffers(identifier, { retailer })
        return result.data.map((product) => ({
          title: product.title,
          offers: (product.offers ?? []).map((o) => ({
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
        'Get historical price data for a product over a date range, per retailer offer (newest point first). Helps determine if the current price is a good deal. The start date must be before today and the end date must be today or earlier.',
      inputSchema: getPriceHistoryInput,
      execute: async ({ identifier, startDate, endDate, retailer }) => {
        const result = await client.getPriceHistory(identifier, startDate, endDate, { retailer })
        return result.data.map((product) => ({
          title: product.title,
          offers: product.offers.map((offer) => ({
            retailer: offer.retailer,
            condition: offer.condition,
            url: offer.URL,
            history: offer.history.map((h) => ({
              timestamp: h.timestamp,
              price: h.price,
              currency: h.currency,
              availability: h.availability,
            })),
          })),
        }))
      },
    }),

    getDeals: tool({
      description:
        'Browse current shopping deals with expert grades, pricing, and community votes. Sort by hot, new, top-hour, top-day, or top-week.',
      inputSchema: getDealsInput,
      execute: async ({ sort, limit, category, retailer }) => {
        const result = await client.getDeals({ sort, limit, category, retailer })
        return {
          deals: result.deals.map((d) => ({
            title: d.title,
            grade: `${d.grade.letter}${d.grade.suffix ?? ''}`,
            price: d.pricing.current,
            original_price: d.pricing.original,
            currency: d.pricing.currency,
            retailer: d.retailer.name,
            url: d.url,
            score: d.votes.score,
          })),
        }
      },
    }),
  }
}

