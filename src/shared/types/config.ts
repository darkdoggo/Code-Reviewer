export interface UserConfig {
  llm: LLMConfig
  ui: UIConfig
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai'
  model: string
  apiKey: string
  baseUrl?: string
  temperature: number
  maxTokens: number
  outputLanguage: 'en' | 'zh'
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'system'
  themeColor?: string  // preset name ('purple', 'blue', etc.) or hex value ('#8b5cf6')
  diffMode: 'unified' | 'split'
  uiLanguage: 'en' | 'zh'
}
