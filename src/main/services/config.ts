import Store from 'electron-store'
import { safeStorage } from 'electron'
import type { UserConfig, LLMConfig, UIConfig } from '@shared/types'

const defaults: UserConfig = {
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
    temperature: 0.3,
    maxTokens: 200000,
    outputLanguage: 'zh'
  },
  ui: {
    theme: 'system',
    diffMode: 'unified',
    uiLanguage: 'en'
  }
}

export class ConfigService {
  private store: Store<UserConfig>

  constructor() {
    this.store = new Store<UserConfig>({
      name: 'config',
      defaults
    })
  }

  getConfig(): UserConfig {
    const config = this.store.store
    if (config.llm.apiKey) {
      try {
        const decrypted = safeStorage.decryptString(
          Buffer.from(config.llm.apiKey, 'base64')
        )
        return { ...config, llm: { ...config.llm, apiKey: decrypted } }
      } catch {
        return { ...config, llm: { ...config.llm, apiKey: '' } }
      }
    }
    return config
  }

  updateConfig(partial: Partial<UserConfig>): void {
    const current = this.store.store
    const updated = { ...current }

    if (partial.llm) {
      updated.llm = { ...current.llm, ...partial.llm }
      if (partial.llm.apiKey !== undefined) {
        if (partial.llm.apiKey && safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(partial.llm.apiKey)
          updated.llm.apiKey = encrypted.toString('base64')
        } else {
          updated.llm.apiKey = partial.llm.apiKey
        }
      }
    }

    if (partial.ui) {
      updated.ui = { ...current.ui, ...partial.ui }
    }

    this.store.set(updated)
  }

  getLLMConfig(): LLMConfig {
    return this.getConfig().llm
  }

  getUIConfig(): UIConfig {
    return this.getConfig().ui
  }
}
