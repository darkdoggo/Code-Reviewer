import { useState, useEffect } from 'react'
import { useReviewerStore } from '../store'
import { Save, Plug, Check, X, Loader2, RotateCcw, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function SettingsPage() {
  const { config, saveConfig, loadConfig, isLoadingConfig } = useReviewerStore()
  const { t } = useTranslation('settings')

  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [temperature, setTemperature] = useState(0.3)
  const [maxTokens, setMaxTokens] = useState(4096)
  const [outputLanguage, setOutputLanguage] = useState<'en' | 'zh'>('en')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [remoteModels, setRemoteModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      setProvider(config.llm.provider)
      setModel(config.llm.model)
      setApiKey(config.llm.apiKey)
      setBaseUrl(config.llm.baseUrl ?? '')
      setTemperature(config.llm.temperature)
      setMaxTokens(config.llm.maxTokens)
      setOutputLanguage(config.llm.outputLanguage)
      setTheme(config.ui.theme)
      setDiffMode(config.ui.diffMode)
    }
  }, [config])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    const root = document.documentElement
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', t === 'dark')
    }
  }

  const handleProviderChange = (newProvider: 'anthropic' | 'openai') => {
    setProvider(newProvider)
    setModel('')
    setRemoteModels([])
    setModelError(null)
  }

  const handleFetchModels = async () => {
    if (!apiKey) return
    setLoadingModels(true)
    setModelError(null)
    try {
      const models = await window.api.listLLMModels(provider, apiKey, baseUrl || undefined)
      if (models.length === 0) {
        setModelError(t('llm.noModelsFound'))
        setRemoteModels([])
        return
      }
      setRemoteModels(models)
      if (!models.includes(model)) {
        setModel(models[0])
      }
    } catch {
      setModelError(t('llm.fetchModelsFailed'))
      setRemoteModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  const handleSave = async () => {
    if (remoteModels.length === 0 || !model) {
      setModelError(t('llm.mustFetchModels'))
      return
    }
    setSaving(true)
    setSaveSuccess(false)
    try {
      await saveConfig({
        llm: { provider, model, apiKey, baseUrl: baseUrl || undefined, temperature, maxTokens, outputLanguage },
        ui: { theme, diffMode, uiLanguage: config?.ui.uiLanguage ?? 'en' },
      })
      await loadConfig()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (remoteModels.length === 0 || !model) {
      setModelError(t('llm.mustFetchModels'))
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      await saveConfig({
        llm: { provider, model, apiKey, baseUrl: baseUrl || undefined, temperature, maxTokens, outputLanguage },
      })
      const result = await window.api.testLLMConnection()
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setTesting(false)
    }
  }

  if (isLoadingConfig) {
    return <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))]">{t('loading')}</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Save success toast */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-green-500 text-white text-sm rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2">
          <Check size={16} />
          {t('saveSuccess')}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">配置 LLM 提供商和界面偏好</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing || !apiKey}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--secondary))] disabled:opacity-50 transition-colors"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            {t('llm.testConnection')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            className="flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t('save')}
          </button>
          <button
            onClick={() => window.api.restartApp()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            <RotateCcw size={14} />
            {t('restartApp')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Card 1: LLM Config */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h3 className="text-base font-semibold mb-1">{t('llm.title')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">配置 LLM 提供商和 API 密钥</p>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">{t('llm.provider')}</span>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as 'anthropic' | 'openai')}
                  className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 pr-12 text-sm"
                >
                  <option value="anthropic">{t('llm.providerAnthropic', { defaultValue: 'Anthropic' })}</option>
                  <option value="openai">{t('llm.providerOpenAI', { defaultValue: 'OpenAI' })}</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium">{t('llm.apiKey')}</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setRemoteModels([]); setModel(''); setModelError(null) }}
                  placeholder="sk-ant-..."
                  className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">{t('llm.baseUrl')} <span className="text-[hsl(var(--muted-foreground))]">{t('llm.baseUrlHint')}</span></span>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => { setBaseUrl(e.target.value); setRemoteModels([]); setModel(''); setModelError(null) }}
                  placeholder="https://api.anthropic.com"
                  className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                />
              </label>

              {/* Model - must fetch first */}
              <div className="block">
                <span className="text-sm font-medium">{t('llm.model')}</span>
                <div className="flex gap-2 mt-1">
                  {remoteModels.length > 0 ? (
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 pr-12 text-sm"
                    >
                      {remoteModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex-1 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.3)] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                      {t('llm.clickToFetch')}
                    </div>
                  )}
                  <button
                    onClick={handleFetchModels}
                    disabled={!apiKey || loadingModels}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] disabled:opacity-50 transition-colors text-sm"
                    title={t('llm.fetchModels')}
                  >
                    {loadingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {t('llm.fetchModels')}
                  </button>
                </div>
                {remoteModels.length > 0 && (
                  <span className="text-[10px] text-green-600 dark:text-green-400 mt-1 block">
                    {t('llm.remoteModelsLoaded', { count: remoteModels.length })}
                  </span>
                )}
                {modelError && (
                  <span className="text-[10px] text-red-500 mt-1 block">{modelError}</span>
                )}
              </div>
            </div>

            {testResult && (
              <div className={`flex items-center gap-1.5 text-sm mt-4 ${testResult.success ? 'text-green-600' : 'text-red-500'}`}>
                {testResult.success ? <Check size={14} /> : <X size={14} />}
                {testResult.success ? t('llm.connected') : testResult.error}
              </div>
            )}
          </div>

          {/* Card 2: Inference Parameters */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h3 className="text-base font-semibold mb-1">推理参数</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">调整模型推理行为</p>

            <div className="space-y-3">
              <div className="flex gap-4">
                <label className="block flex-1">
                  <span className="text-sm font-medium">{t('llm.temperature')}</span>
                  <input
                    type="number"
                    min={0} max={1} step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block flex-1">
                  <span className="text-sm font-medium">{t('llm.maxTokens')}</span>
                  <input
                    type="number"
                    min={1024} max={8192} step={512}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium">{t('llm.outputLanguage')}</span>
                <select
                  value={outputLanguage}
                  onChange={(e) => setOutputLanguage(e.target.value as 'en' | 'zh')}
                  className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 pr-12 text-sm"
                >
                  <option value="en">{t('llm.languageEnglish', { defaultValue: 'English' })}</option>
                  <option value="zh">{t('llm.languageChinese', { defaultValue: '中文' })}</option>
                </select>
                <span className="text-xs text-[hsl(var(--muted-foreground))] mt-1 block">{t('llm.outputLanguageHint')}</span>
              </label>
            </div>
          </div>

          {/* Card 3: UI Preferences */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h3 className="text-base font-semibold mb-1">界面偏好</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">自定义界面外观</p>

            <div className="flex gap-6">
              <label className="block flex-1">
                <span className="text-sm font-medium">{t('ui.theme')}</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as typeof theme)}
                  className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 pr-12 text-sm"
                >
                  <option value="system">{t('ui.themeSystem')}</option>
                  <option value="light">{t('ui.themeLight')}</option>
                  <option value="dark">{t('ui.themeDark')}</option>
                </select>
              </label>

              <label className="block flex-1">
                <span className="text-sm font-medium">{t('ui.diffMode')}</span>
                <select
                  value={diffMode}
                  onChange={(e) => setDiffMode(e.target.value as typeof diffMode)}
                  className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 pr-12 text-sm"
                >
                  <option value="unified">{t('ui.diffUnified')}</option>
                  <option value="split">{t('ui.diffSplit')}</option>
                </select>
              </label>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
