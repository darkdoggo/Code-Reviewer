import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import { Layout } from './components/layout/Layout'
import { useReviewerStore } from './store'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReviewPage } from './pages/ReviewPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { LearningPage } from './pages/LearningPage'

const pages = {
  dashboard: DashboardPage,
  projects: ProjectsPage,
  review: ReviewPage,
  history: HistoryPage,
  settings: SettingsPage,
  learning: LearningPage,
} as const

function App() {
  const { currentPage, config, initialize } = useReviewerStore()
  const { i18n } = useTranslation()

  useEffect(() => {
    initialize()
  }, [])

  // Sync i18n language with config
  useEffect(() => {
    if (config?.ui.uiLanguage) {
      i18n.changeLanguage(config.ui.uiLanguage)
    }
  }, [config?.ui.uiLanguage, i18n])

  // Apply theme from config
  useEffect(() => {
    if (!config) return
    const theme = config.ui.theme
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
  }, [config?.ui.theme])

  const Page = pages[currentPage]

  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <Layout>
        <Page />
      </Layout>
    </>
  )
}

export default App
