/**
 * Example: Using ShopSavvy tools with the Vercel AI SDK
 *
 * Run: npx tsx src/example.ts
 *
 * Requires:
 *   SHOPSAVVY_API_KEY - Get one at shopsavvy.com/data
 *   OPENAI_API_KEY - Your OpenAI API key
 */

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createShopSavvyTools } from './index'

async function main() {
  const tools = createShopSavvyTools({
    apiKey: process.env.SHOPSAVVY_API_KEY!,
  })

  console.log('Asking the AI to find the best deal on Sony headphones...\n')

  const result = await generateText({
    model: openai('gpt-4o'),
    tools,
    maxSteps: 5,
    prompt: 'Find the best price for Sony WH-1000XM5 headphones and tell me if it\'s a good deal.',
  })

  console.log(result.text)
  console.log('\n--- Tool calls made ---')
  for (const step of result.steps) {
    for (const toolCall of step.toolCalls) {
      console.log(`  ${toolCall.toolName}(${JSON.stringify(toolCall.args)})`)
    }
  }
}

main().catch(console.error)
