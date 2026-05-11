import { z } from 'zod'

export const LLMConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  model: z.string(),
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  temperature: z.number(),
  maxTokens: z.number(),
  outputLanguage: z.enum(['en', 'zh'])
})

export const UIConfigSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  diffMode: z.enum(['unified', 'split']),
  uiLanguage: z.enum(['en', 'zh'])
})

export const UserConfigSchema = z.object({
  llm: LLMConfigSchema,
  ui: UIConfigSchema
})
