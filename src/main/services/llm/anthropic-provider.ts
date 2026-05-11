import Anthropic from '@anthropic-ai/sdk'
import { ReviewResultSchema } from '@shared/schemas/review'
import type { LLMConfig } from '@shared/types'
import type { LLMProvider, ReviewResponse } from './types'
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from '../prompts'

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic | null = null
  private config: LLMConfig | null = null

  configure(config: LLMConfig): void {
    this.config = config
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    })
  }

  isConfigured(): boolean {
    return this.client !== null && !!this.config?.apiKey
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client || !this.config) {
      return { success: false, error: 'LLM not configured. Please set your API key.' }
    }
    try {
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Reply with "ok"' }],
      })
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.config?.apiKey) return []
    const baseUrl = (this.config.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '')

    // Try Anthropic SDK first (official API)
    if (this.client) {
      try {
        const response = await this.client.models.list({ limit: 100 })
        if (response.data?.length > 0) {
          return response.data.map((m: any) => m.id).sort()
        }
      } catch {
        // SDK failed, try fetch fallback below
      }
    }

    // Fallback: fetch /v1/models with both auth styles
    const urls = baseUrl.includes('/v1')
      ? [`${baseUrl}/models`]
      : [`${baseUrl}/v1/models`, `${baseUrl}/models`]

    for (const url of urls) {
      for (const headers of [
        { 'Authorization': `Bearer ${this.config.apiKey}` } as Record<string, string>,
        { 'x-api-key': this.config.apiKey } as Record<string, string>,
      ]) {
        try {
          const res = await fetch(url, { headers })
          if (!res.ok) continue
          const data = await res.json()
          const models = (data.data || []).map((m: any) => m.id).sort()
          if (models.length > 0) return models
        } catch {
          continue
        }
      }
    }

    return []
  }

  async review(diff: string, projectContext?: string, outputLanguage: 'en' | 'zh' = 'en'): Promise<ReviewResponse> {
    if (!this.client || !this.config) {
      throw new Error('LLM not configured. Please set your API key.')
    }

    const languageInstruction = outputLanguage === 'zh'
      ? '\n\nIMPORTANT: Please respond in Simplified Chinese (简体中文). All issue titles, descriptions, suggestions, and fullstack tips should be in Chinese. Keep the JSON structure unchanged.'
      : ''

    const systemPrompt = `${REVIEW_SYSTEM_PROMPT}${languageInstruction}`

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: buildReviewUserPrompt(diff, projectContext) }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Extract JSON from response (LLM might add explanation text after JSON)
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

    // Try to extract just the JSON object if there's extra text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    console.log('[AnthropicProvider] Extracted JSON:', jsonStr.substring(0, 500))

    let parsed: any
    try {
      parsed = JSON.parse(jsonStr)
    } catch (err) {
      // Try to fix common JSON issues
      console.warn('[AnthropicProvider] Initial JSON parse failed, attempting to fix...')

      try {
        // Fix unescaped newlines in string values
        let fixed = jsonStr

        // Remove incomplete trailing objects/arrays if JSON is truncated
        const lastBrace = fixed.lastIndexOf('}')
        const lastBracket = fixed.lastIndexOf(']')
        if (lastBrace > lastBracket) {
          // Likely truncated in issues array, try to close it
          const issuesStart = fixed.indexOf('"issues"')
          if (issuesStart !== -1) {
            const arrayStart = fixed.indexOf('[', issuesStart)
            if (arrayStart !== -1) {
              // Count open braces after array start
              let openBraces = 0
              let lastValidPos = arrayStart
              for (let i = arrayStart; i < fixed.length; i++) {
                if (fixed[i] === '{') openBraces++
                if (fixed[i] === '}') {
                  openBraces--
                  if (openBraces === 0) lastValidPos = i
                }
              }
              // Truncate to last complete object and close array
              if (openBraces > 0) {
                fixed = fixed.substring(0, lastValidPos + 1) + ']}'
              }
            }
          }
        }

        // Escape unescaped control characters in strings
        fixed = fixed.replace(
          /"([^"]*(?:\\.[^"]*)*)"/g,
          (match, content) => {
            const escaped = content
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
            return `"${escaped}"`
          }
        )

        parsed = JSON.parse(fixed)
        console.log('[AnthropicProvider] Successfully parsed after fixing')
      } catch (fixErr) {
        console.error('[AnthropicProvider] JSON parse failed even after fixing:', fixErr)
        console.error('[AnthropicProvider] Raw JSON string:', jsonStr.substring(0, 1000))
        throw new Error('LLM returned invalid JSON. Try increasing maxTokens in settings.')
      }
    }

    // Add defaults if LLM response is incomplete
    const safeResult = {
      score: typeof parsed.score === 'number' ? parsed.score : undefined,
      issues: Array.isArray(parsed.issues) ? parsed.issues : []
    }

    console.log('[AnthropicProvider] Parsed result:', { score: safeResult.score, issueCount: safeResult.issues.length })

    // Use safeParse to handle validation errors gracefully
    const validation = ReviewResultSchema.safeParse(safeResult)
    if (!validation.success) {
      console.error('[AnthropicProvider] Schema validation failed:', validation.error.errors)
      // Filter out invalid issues and retry
      const validIssues = safeResult.issues.filter((issue: any) => {
        const issueValidation = ReviewResultSchema.shape.issues.element.safeParse(issue)
        if (!issueValidation.success) {
          console.warn('[AnthropicProvider] Skipping invalid issue:', issue, issueValidation.error.errors)
          return false
        }
        return true
      })
      console.log(`[AnthropicProvider] Kept ${validIssues.length}/${safeResult.issues.length} valid issues`)
      safeResult.issues = validIssues
    }

    const result = ReviewResultSchema.parse(safeResult)
    const tokenUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

    return { result, tokenUsed }
  }
}
