import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu'
import { useReviewerStore } from '../store'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const { config, saveConfig } = useReviewerStore()

  const currentLanguage = config?.ui.uiLanguage || 'en'
  const displayLanguage = currentLanguage === 'zh' ? '中' : 'EN'

  const handleLanguageChange = async (lang: 'en' | 'zh') => {
    await saveConfig({ ui: { ...config!.ui, uiLanguage: lang } })
    i18n.changeLanguage(lang)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[hsl(var(--secondary))] transition-colors text-sm"
          aria-label="Change language"
        >
          <Globe size={16} />
          <span className="font-medium">{displayLanguage}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[140px] bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md shadow-lg p-1 z-50"
      >
        <DropdownMenuItem
          onClick={() => handleLanguageChange('en')}
          className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-[hsl(var(--secondary))] outline-none"
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLanguageChange('zh')}
          className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-[hsl(var(--secondary))] outline-none"
        >
          中文
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
