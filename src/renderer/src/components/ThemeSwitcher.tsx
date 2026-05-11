import { Sun, Moon, Monitor } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu'
import { useReviewerStore } from '../store'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

export function ThemeSwitcher() {
  const { config, saveConfig } = useReviewerStore()
  const { t } = useTranslation('settings')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(config?.ui.theme || 'system')

  useEffect(() => {
    if (config?.ui.theme) setTheme(config.ui.theme)
  }, [config?.ui.theme])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    if (config) {
      await saveConfig({ ui: { ...config.ui, theme: newTheme } })
    }
  }

  const icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  const Icon = icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[hsl(var(--secondary))] transition-colors text-sm"
          aria-label="Change theme"
        >
          <Icon size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[140px] bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md shadow-lg p-1 z-50"
      >
        <DropdownMenuItem
          onClick={() => handleThemeChange('light')}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-[hsl(var(--secondary))] outline-none"
        >
          <Sun size={14} />
          {t('ui.themeLight')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleThemeChange('dark')}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-[hsl(var(--secondary))] outline-none"
        >
          <Moon size={14} />
          {t('ui.themeDark')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleThemeChange('system')}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-[hsl(var(--secondary))] outline-none"
        >
          <Monitor size={14} />
          {t('ui.themeSystem')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
