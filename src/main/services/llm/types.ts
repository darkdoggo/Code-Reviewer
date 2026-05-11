import type { LLMConfig } from '@shared/types'
import type { ReviewResult } from '@shared/schemas/review'

export interface ReviewResponse {
  result: ReviewResult
  tokenUsed: number
}

export interface LLMProvider {
  configure(config: LLMConfig): void
  isConfigured(): boolean
  testConnection(): Promise<{ success: boolean; error?: string }>
  listModels(): Promise<string[]>
  review(diff: string, projectContext?: string, outputLanguage?: 'en' | 'zh'): Promise<ReviewResponse>
}
