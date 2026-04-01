# Vercel AI SDK + ShopSavvy

Tool definitions for the Vercel AI SDK that give any LLM access to product search and price comparison via the [ShopSavvy Data API](https://shopsavvy.com/data).

## Installation

```bash
npm install vercel-ai-shopsavvy @shopsavvy/sdk ai @ai-sdk/openai
```

## Setup

Get an API key at [shopsavvy.com/data](https://shopsavvy.com/data).

```bash
export SHOPSAVVY_API_KEY=ss_live_your_key_here
export OPENAI_API_KEY=your_openai_key
```

## Usage

```typescript
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createShopSavvyTools } from 'vercel-ai-shopsavvy'

const tools = createShopSavvyTools({
  apiKey: process.env.SHOPSAVVY_API_KEY!,
})

const result = await generateText({
  model: openai('gpt-4o'),
  tools,
  maxSteps: 5,
  prompt: 'Find the best price for Sony WH-1000XM5 headphones',
})

console.log(result.text)
```

## Tools

### `searchProducts`

Search for products by keyword. Returns product details including title, brand, category, and identifiers.

### `getOffers`

Get current offers from retailers for a product. Accepts barcode, ASIN, URL, model number, or ShopSavvy ID.

### `getPriceHistory`

Get historical price data for a product over a date range.

### `getDeals`

Browse current shopping deals with sorting and filtering options.

## Example

Run the included example:

```bash
npx tsx src/example.ts
```

## License

MIT
