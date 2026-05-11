import {
  LayoutDashboard,
  FolderGit2,
  History,
  Settings,
  GitPullRequest,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Globe,
  Palette,
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useReviewerStore, type Page } from '@renderer/store'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { ColorPicker } from '../ColorPicker'
import { PRESET_THEME_COLORS, applyThemeColor, hexToHsl } from '@renderer/lib/themeColor'
import { AppIcon } from '../AppIcon'

const navItems: { page: Page; key: string; icon: React.ElementType }[] = [
  { page: 'dashboard', key: 'dashboard', icon: LayoutDashboard },
  { page: 'projects', key: 'projects', icon: FolderGit2 },
  { page: 'review', key: 'review', icon: GitPullRequest },
  { page: 'history', key: 'history', icon: History },
  { page: 'learning', key: 'learning', icon: BookOpen },
  { page: 'settings', key: 'settings', icon: Settings },
]

export function Sidebar() {
  const { currentPage, navigate, sidebarCollapsed, toggleSidebar, config, saveConfig } = useReviewerStore()
  const { t } = useTranslation('pages')
  const { t: tCommon } = useTranslation('common')
  const { i18n } = useTranslation()

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(config?.ui.theme || 'system')
  const [themeColor, setThemeColor] = useState<string>(config?.ui.themeColor || 'purple')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  useEffect(() => {
    if (config?.ui.theme) setTheme(config.ui.theme)
    if (config?.ui.themeColor) setThemeColor(config.ui.themeColor)
  }, [config?.ui.theme, config?.ui.themeColor])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])

  useEffect(() => {
    // Apply theme color from preset or custom hex
    const preset = PRESET_THEME_COLORS.find(c => c.value === themeColor)
    if (preset) {
      applyThemeColor(preset.h, preset.s, preset.l)
    } else if (themeColor.startsWith('#')) {
      const [h, s, l] = hexToHsl(themeColor)
      applyThemeColor(h, s, l)
    }
    // Force white foreground for all theme colors
    document.documentElement.style.setProperty('--primary-foreground', '0 0% 100%')
  }, [themeColor, theme])

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    if (config) {
      await saveConfig({ ui: { ...config.ui, theme: newTheme } })
    }
  }

  const currentLanguage = config?.ui.uiLanguage || 'en'

  const handleLanguageToggle = async () => {
    const newLang = currentLanguage === 'zh' ? 'en' : 'zh'
    await saveConfig({ ui: { ...config!.ui, uiLanguage: newLang } })
    i18n.changeLanguage(newLang)
  }

  const handleThemeColorChange = async (newColor: string) => {
    setThemeColor(newColor)
    if (config) {
      await saveConfig({ ui: { ...config.ui, themeColor: newColor } })
    }
  }

  return (
    <aside className={cn(
      'shrink-0 h-screen flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--background))] relative group/sidebar',
      !sidebarCollapsed && 'transition-[width] duration-200',
      sidebarCollapsed ? 'w-[52px]' : 'w-[200px]'
    )}>
      {/* App title */}
      {!sidebarCollapsed && (
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          <AppIcon size={28} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold tracking-tight">{tCommon('appName')}</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{tCommon('appSubtitle')}</p>
          </div>
        </div>
      )}
      {sidebarCollapsed && <div className="py-4" />}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ page, key, icon: Icon }) => (
          <button
            key={page}
            onClick={() => navigate(page)}
            title={sidebarCollapsed ? t(`${key}.title`) : undefined}
            className={cn(
              'w-full flex items-center rounded-lg text-[13px] transition-all duration-150',
              sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2 text-left',
              currentPage === page
                ? 'bg-[hsl(var(--primary))] text-white font-medium shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            <Icon size={17} strokeWidth={currentPage === page ? 2.2 : 1.8} />
            {!sidebarCollapsed && t(`${key}.title`)}
          </button>
        ))}
      </nav>

      {/* Bottom section: Theme + Language */}
      {!sidebarCollapsed ? (
        <div className="px-3 pb-4 pt-3 border-t-2 border-gray-200 dark:border-gray-800 mt-2">
          <div className="flex items-center gap-1.5 mb-2.5 px-1">
            <Monitor size={11} className="text-gray-400" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">外观</p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[hsl(var(--secondary))]">
            <button
              onClick={() => handleThemeChange('light')}
              className={cn(
                'flex-1 flex items-center justify-center py-1.5 rounded-md text-xs transition-all',
                theme === 'light' ? 'bg-[hsl(var(--background))] shadow-sm font-medium' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => handleThemeChange('dark')}
              className={cn(
                'flex-1 flex items-center justify-center py-1.5 rounded-md text-xs transition-all',
                theme === 'dark' ? 'bg-[hsl(var(--background))] shadow-sm font-medium' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              <Moon size={14} />
            </button>
            <button
              onClick={() => handleThemeChange('system')}
              className={cn(
                'flex-1 flex items-center justify-center py-1.5 rounded-md text-xs transition-all',
                theme === 'system' ? 'bg-[hsl(var(--background))] shadow-sm font-medium' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              <Monitor size={14} />
            </button>
          </div>
          
          {/* Theme Color Selector */}
          <div className="mt-2 relative">
            <button
              onClick={() => setColorPickerOpen(!colorPickerOpen)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600 shrink-0"
                style={{ backgroundColor: themeColor.startsWith('#') ? themeColor : PRESET_THEME_COLORS.find(c => c.value === themeColor)?.hex }}
              />
              <span className="text-[hsl(var(--muted-foreground))]">主题色</span>
              <Palette size={12} className="ml-auto text-gray-400" />
            </button>
            {colorPickerOpen && (
              <ColorPicker
                value={themeColor.startsWith('#') ? themeColor : (PRESET_THEME_COLORS.find(c => c.value === themeColor)?.hex ?? '#8b5cf6')}
                onChange={(hex) => handleThemeColorChange(hex)}
                onClose={() => setColorPickerOpen(false)}
              />
            )}
          </div>
          
          <button
            onClick={handleLanguageToggle}
            className="mt-2 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <Globe size={13} />
            <span>{currentLanguage === 'zh' ? '中文' : 'English'}</span>
          </button>
        </div>
      ) : (
        <div className="pb-3 pt-2 border-t border-[hsl(var(--border))] mt-2 flex flex-col items-center gap-1">
          <button
            onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button
            onClick={() => {
              const preset = PRESET_THEME_COLORS.find(c => c.value === themeColor)
              const currentHex = preset?.hex ?? (themeColor.startsWith('#') ? themeColor : '#8b5cf6')
              const idx = PRESET_THEME_COLORS.findIndex(c => c.hex === currentHex)
              const next = PRESET_THEME_COLORS[(idx + 1) % PRESET_THEME_COLORS.length]
              handleThemeColorChange(next.value)
            }}
            className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
            title="切换主题色"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-[hsl(var(--foreground))]/30"
              style={{ backgroundColor: themeColor.startsWith('#') ? themeColor : PRESET_THEME_COLORS.find(c => c.value === themeColor)?.hex }}
            />
          </button>
          <button
            onClick={handleLanguageToggle}
            className="p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <Globe size={15} />
          </button>
        </div>
      )}

      {/* Edge toggle button */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 -right-[7px] z-10',
          'flex items-center justify-center',
          'w-[14px] h-[36px] rounded-full',
          'bg-[hsl(var(--background))] border border-[hsl(var(--border))]',
          'text-[hsl(var(--muted-foreground))]',
          'hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]',
          'transition-all duration-150',
          'opacity-0 group-hover/sidebar:opacity-100'
        )}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
