/**
 * Example: Using ShopSavvy tools with the Vercel AI SDK
 *
 * Run: bun src/example.ts
 *
 * Requires:
 *   SHOPSAVVY_API_KEY - Get one at shopsavvy.com/data
 *   OPENAI_API_KEY - Your OpenAI API key
 */

import { generateText, stepCountIs } from 'ai'
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
    stopWhen: stepCountIs(5),
    prompt: 'Find the best price for Sony WH-1000XM5 headphones and tell me if it\'s a good deal.',
  })

  console.log(result.text)
  console.log('\n--- Tool calls made ---')
  for (const step of result.steps) {
    for (const toolCall of step.toolCalls) {
      console.log(`  ${toolCall.toolName}(${JSON.stringify(toolCall.input)})`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
