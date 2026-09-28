# Vercel AI SDK + ShopSavvy

Tool definitions for the [Vercel AI SDK](https://ai-sdk.dev) that give any LLM access to product search, price comparison, price history, and deals via the [ShopSavvy Data API](https://shopsavvy.com/data).

[Documentation](https://shopsavvy.com/integrations/vercel-ai) · [Get an API key](https://shopsavvy.com/data) · [Other integrations](https://shopsavvy.com/integrations)

## Installation

```bash
npm install vercel-ai-shopsavvy ai zod
```

`ai` (v5, v6 or v7) and `zod` (v3.25+ or v4) are peer dependencies. Add a model provider too, e.g. `npm install @ai-sdk/openai`.

## Setup

Get an API key at [shopsavvy.com/data](https://shopsavvy.com/data).

```bash
export SHOPSAVVY_API_KEY=ss_live_your_key_here
export OPENAI_API_KEY=your_openai_key
```

## Usage

```typescript
import { generateText, stepCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createShopSavvyTools } from 'vercel-ai-shopsavvy'

const tools = createShopSavvyTools({
  apiKey: process.env.SHOPSAVVY_API_KEY!,
})

const result = await generateText({
  model: openai('gpt-4o'),
  tools,
  stopWhen: stepCountIs(5),
  prompt: 'Find the best price for Sony WH-1000XM5 headphones',
})

console.log(result.text)
```

The tools work the same way with `streamText`, `ToolLoopAgent`, and any other AI SDK entry point that accepts `tools`.

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `apiKey` | Yes | Your ShopSavvy Data API key |
| `baseUrl` | No | API base URL override, e.g. to route calls through your own proxy |
| `timeout` | No | Request timeout in milliseconds |

## Tools

### `searchProducts`

Search for products by keyword. Input: `query`, optional `limit` (default 10). Returns title, brand, category, barcode, ASIN, ShopSavvy ID, and images.

### `getOffers`

Get current offers from retailers for a product. Input: `identifier` (barcode, ASIN, URL, model number, or ShopSavvy ID), optional `retailer` domain (e.g. `amazon.com`).

### `getPriceHistory`

Get historical prices for a product. Input: `identifier`, `startDate` and `endDate` (`YYYY-MM-DD`; start must be before today, end today or earlier), optional `retailer` domain. Returns one entry per product (`title`, `offers`), each offer with `retailer`, `condition`, `url` and its `history` of `{ timestamp, price, currency, availability }` points, newest first.

### `getDeals`

Browse current shopping deals with expert grades and community votes. Input: optional `sort` (`hot`, `new`, `top-hour`, `top-day`, `top-week`), `limit`, `category`, `retailer`.

## Example

Clone the repo and run the included example:

```bash
bun install
bun src/example.ts
```

## Development

```bash
bun install
bun run typecheck
bun run build
bun test
```

## License

MIT — see [LICENSE](./LICENSE).
