# Learning Center & Export Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Learning Center page to provide full-stack knowledge and add export capabilities (Markdown/PDF) for review results.

**Architecture:** 
1. **Learning Center**: A new page in the React renderer that fetches and displays cross-stack learning content from local JSON/Markdown files. Includes a searchable knowledge base of common issues found during reviews.
2. **Export Feature**: Add an IPC handler to convert a review and its issues into a Markdown string. Add a button in the ReviewPage results view to trigger the export, which will use Electron's `dialog.showSaveDialog` to save the file.

**Tech Stack:** React, Zustand, Lucide React, Electron IPC, Node.js fs

---

## Part 1: Learning Center

### Task 1: Add Learning Center Page State and Routing

**Files:**
- Modify: `src/renderer/src/store/index.ts`
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`
- Modify: `src/renderer/src/App.tsx`
- Verify: `npm run typecheck`

**Step 1: Update Page Type**

In `src/renderer/src/store/index.ts`, add `'learning'` to the Page type:

```typescript
export type Page = 'dashboard' | 'projects' | 'review' | 'history' | 'settings' | 'learning'
```

**Step 2: Update Sidebar**

In `src/renderer/src/components/layout/Sidebar.tsx`:
- Import `BookOpen` from `lucide-react`
- Add the learning page to `navItems`:

```typescript
const navItems: { page: Page; key: string; icon: React.ElementType }[] = [
  { page: 'dashboard', key: 'dashboard', icon: LayoutDashboard },
  { page: 'projects', key: 'projects', icon: FolderGit2 },
  { page: 'review', key: 'review', icon: GitPullRequest },
  { page: 'history', key: 'history', icon: History },
  { page: 'learning', key: 'learning', icon: BookOpen },
  { page: 'settings', key: 'settings', icon: Settings },
]
```

**Step 3: Update App.tsx**

In `src/renderer/src/App.tsx`:
- Import `LearningPage` (we'll create it next)
- Add it to the page router:

```typescript
// import ...
import { LearningPage } from './pages/LearningPage'

// inside App component:
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />
      case 'projects': return <ProjectsPage />
      case 'review': return <ReviewPage />
      case 'history': return <HistoryPage />
      case 'settings': return <SettingsPage />
      case 'learning': return <LearningPage />
      default: return <DashboardPage />
    }
  }
```

**Step 4: Commit**

```bash
git add src/renderer/src/store/index.ts src/renderer/src/components/layout/Sidebar.tsx src/renderer/src/App.tsx
git commit -m "feat: add learning center routing and state"
```

### Task 2: Add Translations for Learning Center

**Files:**
- Modify: `src/renderer/src/locales/en/pages.json`
- Modify: `src/renderer/src/locales/zh/pages.json`

**Step 1: Update English translations**

Add to `src/renderer/src/locales/en/pages.json`:
```json
  "learning": {
    "title": "Learning Center",
    "description": "Cross-stack knowledge base and common issues",
    "searchPlaceholder": "Search topics...",
    "categories": {
      "security": "Security",
      "performance": "Performance",
      "architecture": "Architecture",
      "type-safety": "Type Safety"
    },
    "fullstackTips": "Full-stack Tips",
    "readMore": "Read more"
  }
```

**Step 2: Update Chinese translations**

Add to `src/renderer/src/locales/zh/pages.json`:
```json
  "learning": {
    "title": "学习中心",
    "description": "全栈知识库与常见问题解析",
    "searchPlaceholder": "搜索主题...",
    "categories": {
      "security": "安全性",
      "performance": "性能优化",
      "architecture": "架构设计",
      "type-safety": "类型安全"
    },
    "fullstackTips": "全栈提示",
    "readMore": "阅读更多"
  }
```

**Step 3: Commit**

```bash
git add src/renderer/src/locales/en/pages.json src/renderer/src/locales/zh/pages.json
git commit -m "feat: add learning center translations"
```

### Task 3: Create Learning Center Page Component

**Files:**
- Create: `src/renderer/src/pages/LearningPage.tsx`
- Verify: `npm run typecheck && npm run build`

**Step 1: Create the basic component**

Create `src/renderer/src/pages/LearningPage.tsx`:

```typescript
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, BookOpen, Shield, Zap, Layers, FileCode2 } from 'lucide-react'

// Mock data for the learning center
const KNOWLEDGE_BASE = [
  {
    id: 'sec-01',
    title: 'SQL Injection Prevention',
    category: 'security',
    icon: Shield,
    description: 'Why string concatenation in SQL is dangerous and how to use parameterized queries.',
    fullstackTip: 'Frontend engineers often trust API input. Backend must validate everything and never execute raw user strings. Use ORMs like Prisma or parameterized queries.'
  },
  {
    id: 'perf-01',
    title: 'N+1 Query Problem',
    category: 'performance',
    icon: Zap,
    description: 'Understanding and fixing database query inefficiency in ORMs.',
    fullstackTip: 'In frontend, fetching in a loop is bad, but N+1 in backend is catastrophic because each iteration hits the DB over the network. Use DataLoader or JOINs.'
  },
  {
    id: 'arch-01',
    title: 'Separation of Concerns',
    category: 'architecture',
    icon: Layers,
    description: 'Keeping business logic out of controllers/route handlers.',
    fullstackTip: 'Just like putting business logic in React components makes them hard to test, putting logic directly in Express routes makes the backend rigid. Use service layers.'
  },
  {
    id: 'type-01',
    title: 'IPC Type Safety',
    category: 'type-safety',
    icon: FileCode2,
    description: 'Ensuring frontend calls match backend Electron handlers.',
    fullstackTip: 'Electron IPC crosses process boundaries. Any mismatch leads to runtime errors that TypeScript won\'t catch natively. Always use a shared IpcContract.'
  }
]

export function LearningPage() {
  const { t } = useTranslation('pages')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = KNOWLEDGE_BASE.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--background))]">
      <header className="px-6 py-5 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-[hsl(var(--primary))]" />
          <h1 className="text-xl font-semibold tracking-tight">{t('learning.title')}</h1>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t('learning.description')}
        </p>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder={t('learning.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            />
          </div>

          {/* Grid of articles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map(item => (
              <div key={item.id} className="border border-[hsl(var(--border))] rounded-lg p-5 bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.5)] transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-[hsl(var(--secondary))] rounded-md text-[hsl(var(--primary))]">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[hsl(var(--foreground))]">{item.title}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">
                      {t(`learning.categories.${item.category}`)}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                  {item.description}
                </p>

                <div className="bg-[hsl(var(--secondary)/0.5)] p-3 rounded-md border border-[hsl(var(--border))]">
                  <div className="text-xs font-semibold text-[hsl(var(--primary))] mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" />
                    {t('learning.fullstackTips')}
                  </div>
                  <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">
                    {item.fullstackTip}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
              No articles found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/renderer/src/pages/LearningPage.tsx
git commit -m "feat: create Learning Center page component"
```

---

## Part 2: Export Feature

### Task 4: Add Export IPC Handler

**Files:**
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Verify: `npm run typecheck`

**Step 1: Add type to ElectronAPI**

In `src/shared/types/ipc.ts`, add to the `ElectronAPI` interface:

```typescript
  exportReview(reviewId: string): Promise<boolean>
```

**Step 2: Add IPC handler**

In `src/main/ipc-handlers.ts`, import `dialog` and `BrowserWindow` from 'electron' if not already there, and add:

```typescript
import { dialog, BrowserWindow } from 'electron'

// inside registerIpcHandlers:
  ipcMain.handle('export-review', async (e, reviewId: string) => {
    const review = db.getReview(reviewId)
    if (!review) throw new Error('Review not found')
    
    const project = db.getProject(review.projectId)
    const issues = db.getReviewIssues(reviewId)
    
    // Generate Markdown
    let md = `# Code Review Report\n\n`
    md += `**Project:** ${project?.name || review.projectId}\n`
    md += `**Date:** ${new Date(review.createdAt).toLocaleString()}\n`
    md += `**Score:** ${review.score}/10\n`
    md += `**Model:** ${review.llmModel} (${review.llmProvider})\n\n`
    
    md += `## Summary\n\n`
    md += `- Errors: ${review.errorCount}\n`
    md += `- Warnings: ${review.warningCount}\n`
    md += `- Suggestions: ${review.suggestionCount}\n\n`
    
    md += `## Issues\n\n`
    
    if (issues.length === 0) {
      md += `No issues found! 🎉\n`
    } else {
      issues.forEach((issue) => {
        md += `### [${issue.severity.toUpperCase()}] ${issue.title}\n\n`
        md += `**File:** \`${issue.file}:${issue.line}\`\n`
        md += `**Category:** ${issue.category} | **Source:** ${issue.source}\n\n`
        md += `${issue.description}\n\n`
        
        if (issue.suggestion) {
          md += `**Suggestion:**\n\`\`\`\n${issue.suggestion}\n\`\`\`\n\n`
        }
        
        if (issue.fullstackTip) {
          md += `> **💡 Full-stack Tip:**\n> ${issue.fullstackTip.replace(/\n/g, '\n> ')}\n\n`
        }
        
        md += `---\n\n`
      })
    }
    
    // Show save dialog
    const window = BrowserWindow.fromWebContents(e.sender)
    if (!window) return false
    
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: 'Export Review Report',
      defaultPath: `review-report-${review.id.substring(0, 8)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    
    if (canceled || !filePath) return false
    
    const fs = require('fs/promises')
    await fs.writeFile(filePath, md, 'utf-8')
    return true
  })
```

**Step 3: Update preload**

In `src/preload/index.ts`, add:

```typescript
  exportReview: (reviewId: string) => ipcRenderer.invoke('export-review', reviewId),
```

**Step 4: Commit**

```bash
git add src/shared/types/ipc.ts src/main/ipc-handlers.ts src/preload/index.ts
git commit -m "feat: add export review IPC handler to generate markdown"
```

### Task 5: Add Export Button to Review Page

**Files:**
- Modify: `src/renderer/src/locales/en/pages.json`
- Modify: `src/renderer/src/locales/zh/pages.json`
- Modify: `src/renderer/src/pages/ReviewPage.tsx`
- Verify: `npm run typecheck && npm run build`

**Step 1: Add translations**

In `en/pages.json`, add under `"review"`:
```json
    "exportReport": "Export Markdown",
    "exportSuccess": "Report exported successfully",
    "exportFailed": "Failed to export report"
```

In `zh/pages.json`, add under `"review"`:
```json
    "exportReport": "导出 Markdown",
    "exportSuccess": "报告导出成功",
    "exportFailed": "报告导出失败"
```

**Step 2: Add export function and button**

In `src/renderer/src/pages/ReviewPage.tsx`:
- Import `Download` icon from `lucide-react`
- Add export handler inside the component:

```typescript
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!activeReview) return
    try {
      setIsExporting(true)
      const success = await window.api.exportReview(activeReview.id)
      // Optional: show toast notification if success
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }
```

- Add the button to the Results Header (find the `<div className="flex items-center gap-4">` in the Results state section and add the button next to "New Review"):

```tsx
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] border border-[hsl(var(--border))] rounded-md transition-colors"
            >
              <Download size={14} />
              {t('review.exportReport')}
            </button>
            <button
              onClick={clearReviewState}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] rounded-md transition-colors"
            >
              <RefreshCw size={14} />
              {t('review.newReview')}
            </button>
          </div>
```

**Step 3: Commit**

```bash
git add src/renderer/src/locales/en/pages.json src/renderer/src/locales/zh/pages.json src/renderer/src/pages/ReviewPage.tsx
git commit -m "feat: add export markdown button to review results"
```

---

## Execution Order

```
Task 1 (Routing) → Task 2 (Translations) → Task 3 (Learning Page)
Task 4 (Export IPC) → Task 5 (Export UI)
```

**Total: 5 tasks**
