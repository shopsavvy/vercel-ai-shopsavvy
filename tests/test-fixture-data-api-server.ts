// A local HTTP server that speaks the ShopSavvy Data API wire contract
// (paths, query params, Bearer auth, response envelopes) so the tools can be
// exercised end-to-end through the real @shopsavvy/sdk client without a live
// API key. Response bodies mirror the shapes documented at
// https://shopsavvy.com/data/documentation.

export interface RecordedRequest {
  method: string
  path: string
  params: Record<string, string>
  authorization: string | null
}

export const FIXTURE_API_KEY = 'ss_test_fixturekey123'

export function startDataApiServer() {
  const requests: RecordedRequest[] = []

  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      const authorization = req.headers.get('authorization')
      requests.push({
        method: req.method,
        path: url.pathname,
        params: Object.fromEntries(url.searchParams),
        authorization,
      })

      if (authorization !== `Bearer ${FIXTURE_API_KEY}`) {
        return Response.json(
          { success: false, error: { code: 'ERR_UNAUTHORIZED', message: 'Invalid API key' } },
          { status: 401 },
        )
      }

      const meta = { credits_used: 1, credits_remaining: 999 }

      switch (url.pathname) {
        case '/v1/products/search':
          return Response.json({
            success: true,
            data: [
              {
                title: 'Apple AirPods Pro (2nd Generation)',
                shopsavvy: 'ss-airpods-pro-2',
                brand: 'Apple',
                category: 'Headphones',
                barcode: '0194253397137',
                amazon: 'B0CHWRXH8B',
                images: ['https://x.shopsavvy.com/airpods.jpg'],
              },
            ],
            pagination: { total: 42, limit: Number(url.searchParams.get('limit') ?? 20), offset: 0, returned: 1 },
            meta,
          })
        case '/v1/products/offers':
          return Response.json({
            success: true,
            data: [
              {
                title: 'Apple AirPods Pro (2nd Generation)',
                shopsavvy: 'ss-airpods-pro-2',
                offers: [
                  { id: 'o1', retailer: 'Amazon', price: 189.99, currency: 'USD', availability: 'in', condition: 'new', seller: null, URL: 'https://www.amazon.com/dp/B0CHWRXH8B' },
                  { id: 'o2', retailer: 'Best Buy', price: 199.99, currency: 'USD', availability: 'in', condition: 'new', seller: null, URL: 'https://www.bestbuy.com/site/1' },
                ],
              },
            ],
            meta,
          })
        case '/v1/products/offers/history':
          // One entry PER PRODUCT, each offer carrying its own `history`, newest first.
          // `currency` is null on an archived point with none recorded, `availability`
          // is absent when unknown, and eBay listings never carry history.
          return Response.json({
            success: true,
            data: [
              {
                title: 'Apple AirPods Pro (2nd Generation)',
                shopsavvy: 'ss-airpods-pro-2',
                brand: 'Apple',
                category: 'Headphones',
                barcode: '0194253397137',
                amazon: 'B0CHWRXH8B',
                mpn: null,
                images: ['https://x.shopsavvy.com/airpods.jpg'],
                offers: [
                  {
                    id: 'o1',
                    availability: 'in',
                    condition: 'new',
                    retailer: 'Amazon',
                    currency: 'USD',
                    price: 189.99,
                    seller: null,
                    URL: 'https://www.amazon.com/dp/B0CHWRXH8B',
                    timestamp: '2026-08-15T00:00:00Z',
                    history: [
                      { availability: 'in', price: 189.99, currency: 'USD', timestamp: '2026-08-15T00:00:00Z' },
                      { price: 249.0, currency: null, timestamp: '2026-08-01T00:00:00Z' },
                    ],
                  },
                  {
                    id: 'o3',
                    availability: 'in',
                    condition: 'used',
                    retailer: 'eBay',
                    currency: 'USD',
                    price: 149.0,
                    seller: 'audio_reseller',
                    URL: 'https://www.ebay.com/itm/1234567890',
                    timestamp: '2026-08-14T00:00:00Z',
                    history: [],
                  },
                ],
              },
            ],
            meta,
          })
        case '/v1/deals':
          return Response.json({
            success: true,
            deals: [
              {
                path: 'deal-1',
                title: 'AirPods Pro 2 at a record low',
                grade: { letter: 'A', suffix: '+', value: 97 },
                pricing: { current: 169.0, original: 249.0, currency: 'USD' },
                retailer: { name: 'Amazon' },
                url: 'https://shopsavvy.com/deals/deal-1',
                votes: { upvotes: 12, downvotes: 1, score: 11 },
                comment_count: 3,
                created_at: '2026-09-01T00:00:00Z',
              },
            ],
            pagination: { total: 1, has_more: false, limit: 25, offset: 0 },
            meta,
          })
        default:
          return Response.json(
            { success: false, error: { code: 'ERR_NOT_FOUND', message: `No route for ${url.pathname}` } },
            { status: 404 },
          )
      }
    },
  })

  return {
    baseUrl: `http://127.0.0.1:${server.port}/v1`,
    requests,
    stop: () => server.stop(true),
  }
}
