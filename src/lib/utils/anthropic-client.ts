/**
 * Anthropic Client Utilities
 *
 * Direct Anthropic SDK usage for simple, fast API calls.
 * Use this instead of Claude Agent SDK when:
 * - You need single-turn completions (no multi-turn conversation)
 * - You need fast responses (haiku model)
 * - You don't need tool use or complex orchestration
 */

import Anthropic from '@anthropic-ai/sdk'

// Singleton client
let client: Anthropic | null = null

/**
 * Check if Anthropic API key is available
 * When running inside Claude Code, ANTHROPIC_API_KEY won't be set
 */
export function hasAnthropicApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

/**
 * Check if we're running inside Claude Code
 * This happens when the dev server is started from within Claude Code (VS Code extension)
 */
export function isInsideClaudeCode(): boolean {
  return !!(process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT)
}

/**
 * Get environment status for debugging and error messages
 */
export function getEnvironmentStatus(): {
  hasApiKey: boolean
  insideClaudeCode: boolean
  canUseDirectApi: boolean
  canUseAgentSdk: boolean
  recommendation: string
} {
  const hasApiKey = hasAnthropicApiKey()
  const insideClaudeCode = isInsideClaudeCode()

  return {
    hasApiKey,
    insideClaudeCode,
    canUseDirectApi: hasApiKey,
    canUseAgentSdk: !insideClaudeCode, // Agent SDK can't work inside Claude Code
    recommendation: hasApiKey
      ? 'Using direct Anthropic API (fast, recommended)'
      : insideClaudeCode
        ? 'ERROR: Running inside Claude Code without API key. Either: (1) Add ANTHROPIC_API_KEY to .env.local, or (2) Run "pnpm dev:standalone" instead'
        : 'Using Claude Agent SDK (requires Claude Code installed)',
  }
}

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set. Use Claude Agent SDK instead when running inside Claude Code.')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

interface GenerateJsonOptions {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  model?: 'haiku' | 'sonnet' | 'opus'
  maxRetries?: number
  retryDelayMs?: number
}

/**
 * Generate JSON using Anthropic API directly
 * - Uses haiku by default (fast, cheap, high rate limits)
 * - Includes retry logic with exponential backoff
 * - Returns parsed JSON or null if extraction fails
 */
export async function generateJson<T = unknown>(
  options: GenerateJsonOptions
): Promise<{ json: T | null; rawText: string; error?: string }> {
  const {
    prompt,
    systemPrompt = 'You are a helpful assistant that outputs valid JSON.',
    maxTokens = 8000,
    model = 'haiku',
    maxRetries = 3,
    retryDelayMs = 1000,
  } = options

  const modelId = {
    haiku: 'claude-sonnet-4-6',  // Using Sonnet 4.6 instead of Haiku
    sonnet: 'claude-sonnet-4-6',
    opus: 'claude-opus-4-6',
  }[model]

  const anthropic = getAnthropicClient()
  let lastError: Error | null = null
  let rawText = ''

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Anthropic] Attempt ${attempt + 1}/${maxRetries} with ${model}`)

      const response = await anthropic.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      })

      // Extract text from response
      rawText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('')

      console.log(`[Anthropic] Response received, length: ${rawText.length}`)

      // Try to extract JSON
      const patterns = [
        /```json\n([\s\S]*?)\n```/,           // Standard markdown
        /```\n(\{[\s\S]*?\})\n```/,           // Plain code block
        /(\{[\s\S]*"hero"[\s\S]*\})/,         // Raw JSON with expected keys
        /(\{[\s\S]*\})/,                       // Any JSON object
      ]

      for (const pattern of patterns) {
        const match = rawText.match(pattern)
        if (match) {
          try {
            const json = JSON.parse(match[1]) as T
            console.log(`[Anthropic] ✅ JSON extracted successfully`)
            return { json, rawText }
          } catch {
            // Try next pattern
          }
        }
      }

      // If we got a response but couldn't parse JSON, return raw text
      console.log(`[Anthropic] ⚠️ Could not extract JSON from response`)
      return { json: null, rawText, error: 'Could not extract JSON from response' }

    } catch (error) {
      lastError = error as Error
      console.error(`[Anthropic] ❌ Attempt ${attempt + 1} failed:`, error)

      // Check if it's a rate limit error
      const isRateLimit = error instanceof Anthropic.RateLimitError ||
        (error instanceof Error && error.message.includes('rate'))

      if (isRateLimit && attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000
        console.log(`[Anthropic] Rate limited, waiting ${Math.round(delay)}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // For non-rate-limit errors or last attempt, throw
      if (attempt === maxRetries - 1) {
        break
      }
    }
  }

  return {
    json: null,
    rawText,
    error: lastError?.message || 'Failed after max retries',
  }
}

/**
 * Generate text completion (no JSON parsing)
 * For use cases where the response might be either text or JSON
 */
export async function generateText(
  options: GenerateJsonOptions
): Promise<{ text: string; error?: string }> {
  const {
    prompt,
    systemPrompt = 'You are a helpful assistant.',
    maxTokens = 4000,
    model = 'haiku',
    maxRetries = 3,
    retryDelayMs = 1000,
  } = options

  const modelId = {
    haiku: 'claude-sonnet-4-6',  // Using Sonnet 4.6 instead of Haiku
    sonnet: 'claude-sonnet-4-6',
    opus: 'claude-opus-4-6',
  }[model]

  const anthropic = getAnthropicClient()
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Anthropic] Text generation attempt ${attempt + 1}/${maxRetries} with ${model}`)

      const response = await anthropic.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('')

      console.log(`[Anthropic] ✅ Text response received, length: ${text.length}`)
      return { text }

    } catch (error) {
      lastError = error as Error
      console.error(`[Anthropic] ❌ Attempt ${attempt + 1} failed:`, error)

      const isRateLimit = error instanceof Anthropic.RateLimitError ||
        (error instanceof Error && error.message.includes('rate'))

      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000
        console.log(`[Anthropic] Rate limited, waiting ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      if (attempt === maxRetries - 1) break
    }
  }

  return { text: '', error: lastError?.message || 'Failed after max retries' }
}

/**
 * Stream JSON generation (for progress feedback)
 */
export async function* streamGenerateJson(
  options: GenerateJsonOptions
): AsyncGenerator<{ type: 'text' | 'done'; text?: string; json?: unknown }> {
  const {
    prompt,
    systemPrompt = 'You are a helpful assistant that outputs valid JSON.',
    maxTokens = 8000,
    model = 'haiku',
  } = options

  const modelId = {
    haiku: 'claude-sonnet-4-6',  // Using Sonnet 4.6 instead of Haiku
    sonnet: 'claude-sonnet-4-6',
    opus: 'claude-opus-4-6',
  }[model]

  const anthropic = getAnthropicClient()
  let fullText = ''

  const stream = anthropic.messages.stream({
    model: modelId,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text
      yield { type: 'text', text: event.delta.text }
    }
  }

  // Try to extract JSON from full text
  const patterns = [
    /```json\n([\s\S]*?)\n```/,
    /```\n(\{[\s\S]*?\})\n```/,
    /(\{[\s\S]*"hero"[\s\S]*\})/,
    /(\{[\s\S]*\})/,
  ]

  for (const pattern of patterns) {
    const match = fullText.match(pattern)
    if (match) {
      try {
        const json = JSON.parse(match[1])
        yield { type: 'done', json }
        return
      } catch {
        // Try next pattern
      }
    }
  }

  yield { type: 'done' }
}
