import type { LLMProvider } from './types'
import type { LLMConfig } from '@shared/types'
import { AnthropicProvider } from './anthropic-provider'
import { OpenAIProvider } from './openai-provider'

const providers: Record<string, () => LLMProvider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  const factory = providers[config.provider]
  if (!factory) throw new Error(`Unknown LLM provider: ${config.provider}`)
  const provider = factory()
  provider.configure(config)
  return provider
}
