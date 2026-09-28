import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { generateText, stepCountIs } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { createShopSavvyTools } from '../src/index'
import { FIXTURE_API_KEY, startDataApiServer } from './test-fixture-data-api-server'

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
}

function toolCallResult(calls: Array<{ toolName: string; input: unknown }>) {
  return {
    content: calls.map((c, i) => ({
      type: 'tool-call' as const,
      toolCallId: `call-${i}`,
      toolName: c.toolName,
      input: JSON.stringify(c.input),
    })),
    finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
    usage,
    warnings: [],
  }
}

const finalText = {
  content: [{ type: 'text' as const, text: 'Done.' }],
  finishReason: { unified: 'stop' as const, raw: 'stop' },
  usage,
  warnings: [],
}

let api: ReturnType<typeof startDataApiServer>

beforeAll(() => {
  api = startDataApiServer()
})

afterAll(() => {
  api.stop()
})

describe('createShopSavvyTools', () => {
  test('returns the four tools with descriptions, input schemas and executors', () => {
    const tools = createShopSavvyTools({ apiKey: FIXTURE_API_KEY, baseUrl: api.baseUrl })
    expect(Object.keys(tools).sort()).toEqual(['getDeals', 'getOffers', 'getPriceHistory', 'searchProducts'])
    for (const t of Object.values(tools)) {
      expect(typeof t.description).toBe('string')
      expect(t.inputSchema).toBeDefined()
      expect(typeof t.execute).toBe('function')
    }
  })

  test('every tool runs through generateText and hits the right Data API endpoint', async () => {
    api.requests.length = 0
    const tools = createShopSavvyTools({ apiKey: FIXTURE_API_KEY, baseUrl: api.baseUrl })

    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCallResult([
          { toolName: 'searchProducts', input: { query: 'airpods pro', limit: 5 } },
          { toolName: 'getOffers', input: { identifier: '0194253397137', retailer: 'amazon.com' } },
          { toolName: 'getPriceHistory', input: { identifier: '0194253397137', startDate: '2026-08-01', endDate: '2026-09-01' } },
          { toolName: 'getDeals', input: { sort: 'top-day', limit: 3, category: 'electronics' } },
        ]),
        finalText,
      ],
    })

    const result = await generateText({
      model,
      tools,
      stopWhen: stepCountIs(3),
      prompt: 'Find me a deal on AirPods Pro',
    })

    // The model was offered all four tools as JSON-schema function tools.
    const offered = model.doGenerateCalls[0].tools ?? []
    expect(offered.map((t) => t.name).sort()).toEqual(['getDeals', 'getOffers', 'getPriceHistory', 'searchProducts'])
    const searchTool = offered.find((t) => t.name === 'searchProducts')
    expect(searchTool?.type).toBe('function')
    expect((searchTool as { inputSchema: { properties: Record<string, unknown>; required?: string[] } }).inputSchema.required).toEqual(['query'])

    expect(result.text).toBe('Done.')
    expect(result.steps[0].toolResults).toHaveLength(4)
    expect(result.steps[0].content.filter((c) => c.type === 'tool-error')).toHaveLength(0)

    // Wire contract: Bearer auth, correct paths and query params.
    const byPath = Object.fromEntries(api.requests.map((r) => [r.path, r]))
    for (const r of api.requests) expect(r.authorization).toBe(`Bearer ${FIXTURE_API_KEY}`)
    expect(byPath['/v1/products/search'].params).toMatchObject({ q: 'airpods pro', limit: '5' })
    expect(byPath['/v1/products/offers'].params).toMatchObject({ ids: '0194253397137', retailer: 'amazon.com' })
    expect(byPath['/v1/products/offers/history'].params).toMatchObject({ ids: '0194253397137', start: '2026-08-01', end: '2026-09-01' })
    expect(byPath['/v1/deals'].params).toMatchObject({ sort: 'top-day', limit: '3', category: 'electronics' })

    // Output mapping.
    const outputs = Object.fromEntries(result.steps[0].toolResults.map((r) => [r.toolName, r.output]))
    expect(outputs.searchProducts).toEqual({
      products: [
        {
          title: 'Apple AirPods Pro (2nd Generation)',
          brand: 'Apple',
          category: 'Headphones',
          barcode: '0194253397137',
          asin: 'B0CHWRXH8B',
          shopsavvy_id: 'ss-airpods-pro-2',
          images: ['https://x.shopsavvy.com/airpods.jpg'],
        },
      ],
      total: 42,
    })
    expect(outputs.getOffers).toEqual([
      {
        title: 'Apple AirPods Pro (2nd Generation)',
        offers: [
          { retailer: 'Amazon', price: 189.99, currency: 'USD', availability: 'in', condition: 'new', url: 'https://www.amazon.com/dp/B0CHWRXH8B' },
          { retailer: 'Best Buy', price: 199.99, currency: 'USD', availability: 'in', condition: 'new', url: 'https://www.bestbuy.com/site/1' },
        ],
      },
    ])
    expect(outputs.getPriceHistory).toEqual([
      {
        title: 'Apple AirPods Pro (2nd Generation)',
        offers: [
          {
            retailer: 'Amazon',
            condition: 'new',
            url: 'https://www.amazon.com/dp/B0CHWRXH8B',
            history: [
              { timestamp: '2026-08-15T00:00:00Z', price: 189.99, currency: 'USD', availability: 'in' },
              { timestamp: '2026-08-01T00:00:00Z', price: 249.0, currency: null, availability: undefined },
            ],
          },
          { retailer: 'eBay', condition: 'used', url: 'https://www.ebay.com/itm/1234567890', history: [] },
        ],
      },
    ])
    expect(outputs.getDeals).toEqual({
      deals: [
        {
          title: 'AirPods Pro 2 at a record low',
          grade: 'A+',
          price: 169.0,
          original_price: 249.0,
          currency: 'USD',
          retailer: 'Amazon',
          url: 'https://shopsavvy.com/deals/deal-1',
          score: 11,
        },
      ],
    })
  })

  test('searchProducts defaults to 10 results when the model omits limit', async () => {
    api.requests.length = 0
    const tools = createShopSavvyTools({ apiKey: FIXTURE_API_KEY, baseUrl: api.baseUrl })
    const model = new MockLanguageModelV4({
      doGenerate: [toolCallResult([{ toolName: 'searchProducts', input: { query: 'tv' } }]), finalText],
    })
    await generateText({ model, tools, stopWhen: stepCountIs(2), prompt: 'tv' })
    expect(api.requests).toHaveLength(1)
    expect(api.requests[0].params).toMatchObject({ q: 'tv', limit: '10' })
  })

  test('input the API would reject never leaves the process', async () => {
    api.requests.length = 0
    const tools = createShopSavvyTools({ apiKey: FIXTURE_API_KEY, baseUrl: api.baseUrl })
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCallResult([
          { toolName: 'getDeals', input: { sort: 'trending' } },
          { toolName: 'getPriceHistory', input: { identifier: 'x', startDate: 'last week', endDate: '2026-09-01' } },
        ]),
        finalText,
      ],
    })
    const result = await generateText({ model, tools, stopWhen: stepCountIs(2), prompt: 'deals' })
    const errors = result.steps[0].content.filter((c) => c.type === 'tool-error')
    expect(errors.map((e) => e.toolName).sort()).toEqual(['getDeals', 'getPriceHistory'])
    expect(api.requests).toHaveLength(0)
  })

  test('an API authentication failure surfaces as a tool error, not a silent empty result', async () => {
    const tools = createShopSavvyTools({ apiKey: 'ss_live_wrongkey456', baseUrl: api.baseUrl })
    const model = new MockLanguageModelV4({
      doGenerate: [toolCallResult([{ toolName: 'getOffers', input: { identifier: '0194253397137' } }]), finalText],
    })
    const result = await generateText({ model, tools, stopWhen: stepCountIs(2), prompt: 'offers' })
    const errors = result.steps[0].content.filter((c) => c.type === 'tool-error')
    expect(errors).toHaveLength(1)
    expect(result.steps[0].toolResults).toHaveLength(0)
  })
})
