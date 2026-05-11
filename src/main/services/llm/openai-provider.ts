import OpenAI from 'openai'
import { ReviewResultSchema } from '@shared/schemas/review'
import type { LLMConfig } from '@shared/types'
import type { LLMProvider, ReviewResponse } from './types'
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from '../prompts'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null
  private config: LLMConfig | null = null

  configure(config: LLMConfig): void {
    this.config = config
    this.client = new OpenAI({
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
      await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Reply with "ok"' }],
        max_tokens: 5,
      })
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.config?.apiKey) return []
    try {
      // Use fetch directly to handle custom proxy URLs
      const baseUrl = (this.config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
      // Try /v1/models first, then fallback to /models
      let url = baseUrl.includes('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
      })

      if (!res.ok) {
        // Try without /v1 prefix
        url = `${baseUrl}/models`
        const res2 = await fetch(url, {
          headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
        })
        if (!res2.ok) return []
        const data = await res2.json()
        return (data.data || []).map((m: any) => m.id).sort()
      }

      const data = await res.json()
      return (data.data || []).map((m: any) => m.id).sort()
    } catch (err) {
      console.error('[OpenAIProvider] listModels error:', err)
      return []
    }
  }

  async review(diff: string, projectContext?: string, outputLanguage: 'en' | 'zh' = 'en'): Promise<ReviewResponse> {
    if (!this.client || !this.config) {
      throw new Error('LLM not configured. Please set your API key.')
    }

    const languageInstruction = outputLanguage === 'zh'
      ? '\n\nIMPORTANT: Please respond in Simplified Chinese (简体中文). All issue titles, descriptions, suggestions, and fullstack tips should be in Chinese. Keep the JSON structure unchanged.'
      : ''

    const systemPrompt = `${REVIEW_SYSTEM_PROMPT}${languageInstruction}`

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildReviewUserPrompt(diff, projectContext) },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: { type: 'json_object' },
    })

    const text = response.choices[0]?.message?.content ?? '{}'

    // Extract JSON from response (LLM might add explanation text after JSON)
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

    // Try to extract just the JSON object if there's extra text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    console.log('[OpenAIProvider] Extracted JSON:', jsonStr.substring(0, 500))

    let parsed: any
    try {
      parsed = JSON.parse(jsonStr)
    } catch (err) {
      // Try to fix common JSON issues
      console.warn('[OpenAIProvider] Initial JSON parse failed, attempting to fix...')

      try {
        // Fix unescaped newlines in string values
        const fixed = jsonStr.replace(
          /"([^"]*(?:\\.[^"]*)*)"/g,
          (match, content) => {
            // Escape unescaped newlines and other control characters
            const escaped = content
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
            return `"${escaped}"`
          }
        )
        parsed = JSON.parse(fixed)
        console.log('[OpenAIProvider] Successfully parsed after fixing')
      } catch (fixErr) {
        console.error('[OpenAIProvider] JSON parse failed even after fixing:', fixErr)
        console.error('[OpenAIProvider] Raw JSON string:', jsonStr.substring(0, 1000))
        throw new Error('LLM returned invalid JSON')
      }
    }

    // Add defaults if LLM response is incomplete
    const safeResult = {
      score: typeof parsed.score === 'number' ? parsed.score : undefined,
      issues: Array.isArray(parsed.issues) ? parsed.issues : []
    }

    console.log('[OpenAIProvider] Parsed result:', { score: safeResult.score, issueCount: safeResult.issues.length })

    // Use safeParse to handle validation errors gracefully
    const validation = ReviewResultSchema.safeParse(safeResult)
    if (!validation.success) {
      console.error('[OpenAIProvider] Schema validation failed:', validation.error.errors)
      // Filter out invalid issues and retry
      const validIssues = safeResult.issues.filter((issue: any) => {
        const issueValidation = ReviewResultSchema.shape.issues.element.safeParse(issue)
        if (!issueValidation.success) {
          console.warn('[OpenAIProvider] Skipping invalid issue:', issue, issueValidation.error.errors)
          return false
        }
        return true
      })
      console.log(`[OpenAIProvider] Kept ${validIssues.length}/${safeResult.issues.length} valid issues`)
      safeResult.issues = validIssues
    }

    const result = ReviewResultSchema.parse(safeResult)
    const tokenUsed = response.usage?.total_tokens ?? 0

    return { result, tokenUsed }
  }
}
