# Unified Knowledge Base Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified knowledge base system that aggregates content from three sources (historical review issues, local Markdown files, remote documentation) and displays them in a consistent format in the Learning Center.

**Architecture:** Create a KnowledgeService in the main process that aggregates data from three adapters: HistoryAdapter (analyzes SQLite review_issues for high-frequency problems), LocalMarkdownAdapter (reads .md files from docs/knowledge-base/), and RemoteAdapter (fetches from a remote source). Each adapter maps its source data to a unified KnowledgeItem interface. The service exposes this via IPC to the renderer.

**Tech Stack:** TypeScript, Node.js fs, SQLite, Electron IPC, React

---

## Part 1: Define Unified Data Model

### Task 1: Create Knowledge Base Types

**Files:**
- Create: `src/shared/types/knowledge.ts`
- Modify: `src/shared/types/index.ts`
- Verify: `npm run typecheck`

**Step 1: Define KnowledgeItem interface**

Create `src/shared/types/knowledge.ts`:

```typescript
export type KnowledgeCategory = 
  | 'security' 
  | 'performance' 
  | 'architecture' 
  | 'type-safety' 
  | 'code-quality' 
  | 'complexity'
  | 'robustness'

export type KnowledgeSource = 'history' | 'local' | 'remote'

export interface KnowledgeItem {
  id: string
  title: string
  category: KnowledgeCategory
  description: string
  fullstackTip: string
  source: KnowledgeSource
  
  // Optional metadata
  frequency?: number      // For history source: how many times this issue appeared
  url?: string           // For remote source: original URL
  filePath?: string      // For local source: relative path to .md file
  tags?: string[]        // Additional tags for filtering
  createdAt: number
  updatedAt?: number
}

export interface KnowledgeStats {
  total: number
  bySource: Record<KnowledgeSource, number>
  byCategory: Record<KnowledgeCategory, number>
}
```

**Step 2: Export from index**

In `src/shared/types/index.ts`, add:
```typescript
export * from './knowledge'
```

**Step 3: Commit**

```bash
git add src/shared/types/knowledge.ts src/shared/types/index.ts
git commit -m "feat: add unified knowledge base types"
```

---

## Part 2: History Adapter (Analyze Review Issues)

### Task 2: Create History Adapter

**Files:**
- Create: `src/main/services/knowledge/history-adapter.ts`
- Verify: `npm run typecheck`

**Step 1: Create the adapter**

Create `src/main/services/knowledge/history-adapter.ts`:

```typescript
import type { DatabaseService } from '../database'
import type { KnowledgeItem, KnowledgeCategory } from '@shared/types/knowledge'
import { nanoid } from 'nanoid'

export class HistoryAdapter {
  constructor(private db: DatabaseService) {}

  async getKnowledgeItems(): Promise<KnowledgeItem[]> {
    const issues = this.db.getAllIssues() // We'll need to add this method
    
    // Group by category and title to find high-frequency issues
    const grouped = new Map<string, { 
      category: KnowledgeCategory
      title: string
      descriptions: string[]
      tips: string[]
      count: number 
    }>()
    
    for (const issue of issues) {
      const key = `${issue.category}-${issue.title}`
      const existing = grouped.get(key)
      
      if (existing) {
        existing.count++
        if (issue.description && !existing.descriptions.includes(issue.description)) {
          existing.descriptions.push(issue.description)
        }
        if (issue.fullstackTip && !existing.tips.includes(issue.fullstackTip)) {
          existing.tips.push(issue.fullstackTip)
        }
      } else {
        grouped.set(key, {
          category: issue.category as KnowledgeCategory,
          title: issue.title,
          descriptions: issue.description ? [issue.description] : [],
          tips: issue.fullstackTip ? [issue.fullstackTip] : [],
          count: 1
        })
      }
    }
    
    // Convert to KnowledgeItems, only include issues that appeared 2+ times
    const items: KnowledgeItem[] = []
    
    for (const [key, data] of grouped.entries()) {
      if (data.count >= 2) {
        items.push({
          id: `history-${nanoid(8)}`,
          title: data.title,
          category: data.category,
          description: data.descriptions[0] || 'Common issue found in code reviews',
          fullstackTip: data.tips[0] || 'Review this pattern carefully in your codebase',
          source: 'history',
          frequency: data.count,
          createdAt: Date.now()
        })
      }
    }
    
    // Sort by frequency (most common first)
    return items.sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
  }
}
```

**Step 2: Add getAllIssues to DatabaseService**

In `src/main/services/database.ts`, add:

```typescript
  getAllIssues(): ReviewIssue[] {
    return this.db.prepare('SELECT * FROM review_issues').all() as ReviewIssue[]
  }
```

**Step 3: Commit**

```bash
git add src/main/services/knowledge/history-adapter.ts src/main/services/database.ts
git commit -m "feat: add history adapter for knowledge base"
```

---

## Part 3: Local Markdown Adapter

### Task 3: Create Local Markdown Adapter

**Files:**
- Create: `src/main/services/knowledge/local-adapter.ts`
- Create: `docs/knowledge-base/example-article.md` (example)
- Verify: `npm run typecheck`

**Step 1: Create the adapter**

Create `src/main/services/knowledge/local-adapter.ts`:

```typescript
import fs from 'fs/promises'
import path from 'path'
import type { KnowledgeItem } from '@shared/types/knowledge'
import { nanoid } from 'nanoid'

interface MarkdownFrontmatter {
  title: string
  category: string
  description: string
  tags?: string[]
}

export class LocalMarkdownAdapter {
  private knowledgeDir: string

  constructor(projectRoot: string) {
    this.knowledgeDir = path.join(projectRoot, 'docs', 'knowledge-base')
  }

  async getKnowledgeItems(): Promise<KnowledgeItem[]> {
    const items: KnowledgeItem[] = []
    
    try {
      await fs.access(this.knowledgeDir)
    } catch {
      // Directory doesn't exist yet
      return items
    }
    
    const files = await fs.readdir(this.knowledgeDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    
    for (const file of mdFiles) {
      try {
        const filePath = path.join(this.knowledgeDir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const item = this.parseMarkdown(content, file)
        if (item) items.push(item)
      } catch (err) {
        console.error(`Failed to parse ${file}:`, err)
      }
    }
    
    return items
  }

  private parseMarkdown(content: string, filename: string): KnowledgeItem | null {
    // Simple frontmatter parser (assumes YAML-like format)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!frontmatterMatch) return null
    
    const [, frontmatterText, body] = frontmatterMatch
    const frontmatter: any = {}
    
    // Parse frontmatter
    frontmatterText.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':')
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim()
        frontmatter[key.trim()] = value.replace(/^["']|["']$/g, '')
      }
    })
    
    // Extract fullstack tip from body (look for a section starting with "## Full-stack Tip")
    const tipMatch = body.match(/## Full-stack Tip\s*\n([\s\S]*?)(?=\n##|\n$)/i)
    const fullstackTip = tipMatch ? tipMatch[1].trim() : 'See article for details'
    
    return {
      id: `local-${nanoid(8)}`,
      title: frontmatter.title || filename.replace('.md', ''),
      category: frontmatter.category || 'code-quality',
      description: frontmatter.description || 'Local knowledge base article',
      fullstackTip,
      source: 'local',
      filePath: filename,
      tags: frontmatter.tags ? frontmatter.tags.split(',').map((t: string) => t.trim()) : [],
      createdAt: Date.now()
    }
  }
}
```

**Step 2: Create example Markdown file**

Create `docs/knowledge-base/async-error-handling.md`:

```markdown
---
title: Async Error Handling
category: robustness
description: Proper error handling in async/await code to prevent unhandled rejections
tags: async, promises, error-handling
---

# Async Error Handling

Unhandled promise rejections are a common source of bugs in both frontend and backend JavaScript/TypeScript applications.

## The Problem

```typescript
async function fetchData() {
  const response = await fetch('/api/data')
  return response.json() // What if this fails?
}
```

## The Solution

Always wrap async operations in try-catch blocks:

```typescript
async function fetchData() {
  try {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch data:', error)
    throw error // Re-throw or handle appropriately
  }
}
```

## Full-stack Tip

Frontend developers often forget that network requests can fail in many ways (timeout, 404, 500, network error). Backend developers sometimes forget that database queries can also fail. Always handle errors explicitly rather than letting them bubble up as unhandled rejections. Use error boundaries in React and global error handlers in Express/Node.
```

**Step 3: Commit**

```bash
git add src/main/services/knowledge/local-adapter.ts docs/knowledge-base/async-error-handling.md
git commit -m "feat: add local markdown adapter for knowledge base"
```

---

## Part 4: Remote Adapter (Placeholder)

### Task 4: Create Remote Adapter Stub

**Files:**
- Create: `src/main/services/knowledge/remote-adapter.ts`
- Verify: `npm run typecheck`

**Step 1: Create stub adapter**

Create `src/main/services/knowledge/remote-adapter.ts`:

```typescript
import type { KnowledgeItem } from '@shared/types/knowledge'

export class RemoteAdapter {
  private remoteUrl: string

  constructor(remoteUrl?: string) {
    // Default to a GitHub repo or API endpoint
    this.remoteUrl = remoteUrl || 'https://raw.githubusercontent.com/example/knowledge-base/main/articles.json'
  }

  async getKnowledgeItems(): Promise<KnowledgeItem[]> {
    // TODO: Implement remote fetching
    // For now, return empty array
    // In the future, this could fetch from:
    // - GitHub repo (raw JSON or Markdown files)
    // - Notion API
    // - Custom backend API
    return []
  }
}
```

**Step 2: Commit**

```bash
git add src/main/services/knowledge/remote-adapter.ts
git commit -m "feat: add remote adapter stub for knowledge base"
```

---

## Part 5: Knowledge Service (Aggregator)

### Task 5: Create Knowledge Service

**Files:**
- Create: `src/main/services/knowledge/knowledge-service.ts`
- Verify: `npm run typecheck`

**Step 1: Create the service**

Create `src/main/services/knowledge/knowledge-service.ts`:

```typescript
import type { KnowledgeItem, KnowledgeStats } from '@shared/types/knowledge'
import { HistoryAdapter } from './history-adapter'
import { LocalMarkdownAdapter } from './local-adapter'
import { RemoteAdapter } from './remote-adapter'
import type { DatabaseService } from '../database'

export class KnowledgeService {
  private historyAdapter: HistoryAdapter
  private localAdapter: LocalMarkdownAdapter
  private remoteAdapter: RemoteAdapter
  private cache: KnowledgeItem[] | null = null
  private cacheTimestamp = 0
  private cacheTTL = 5 * 60 * 1000 // 5 minutes

  constructor(db: DatabaseService, projectRoot: string) {
    this.historyAdapter = new HistoryAdapter(db)
    this.localAdapter = new LocalMarkdownAdapter(projectRoot)
    this.remoteAdapter = new RemoteAdapter()
  }

  async getKnowledgeBase(): Promise<KnowledgeItem[]> {
    // Check cache
    if (this.cache && Date.now() - this.cacheTimestamp < this.cacheTTL) {
      return this.cache
    }

    // Fetch from all sources in parallel
    const [historyItems, localItems, remoteItems] = await Promise.all([
      this.historyAdapter.getKnowledgeItems().catch(() => []),
      this.localAdapter.getKnowledgeItems().catch(() => []),
      this.remoteAdapter.getKnowledgeItems().catch(() => [])
    ])

    // Combine and deduplicate
    const allItems = [...historyItems, ...localItems, ...remoteItems]
    
    // Sort: history items first (by frequency), then local, then remote
    const sorted = allItems.sort((a, b) => {
      if (a.source === 'history' && b.source !== 'history') return -1
      if (a.source !== 'history' && b.source === 'history') return 1
      if (a.source === 'history' && b.source === 'history') {
        return (b.frequency || 0) - (a.frequency || 0)
      }
      return 0
    })

    // Update cache
    this.cache = sorted
    this.cacheTimestamp = Date.now()

    return sorted
  }

  async getStats(): Promise<KnowledgeStats> {
    const items = await this.getKnowledgeBase()
    
    const stats: KnowledgeStats = {
      total: items.length,
      bySource: { history: 0, local: 0, remote: 0 },
      byCategory: {
        security: 0,
        performance: 0,
        architecture: 0,
        'type-safety': 0,
        'code-quality': 0,
        complexity: 0,
        robustness: 0
      }
    }

    for (const item of items) {
      stats.bySource[item.source]++
      stats.byCategory[item.category]++
    }

    return stats
  }

  clearCache(): void {
    this.cache = null
    this.cacheTimestamp = 0
  }
}
```

**Step 2: Commit**

```bash
git add src/main/services/knowledge/knowledge-service.ts
git commit -m "feat: add knowledge service to aggregate all sources"
```

---

## Part 6: IPC Integration

### Task 6: Add Knowledge Base IPC Handlers

**Files:**
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Verify: `npm run typecheck`

**Step 1: Update IPC types**

In `src/shared/types/ipc.ts`, add:

```typescript
import type { KnowledgeItem, KnowledgeStats } from './knowledge'

export interface ElectronAPI {
  // ... existing methods
  
  getKnowledgeBase(): Promise<KnowledgeItem[]>
  getKnowledgeStats(): Promise<KnowledgeStats>
  refreshKnowledgeCache(): Promise<void>
}
```

**Step 2: Add handlers**

In `src/main/ipc-handlers.ts`, add handlers:

```typescript
  ipcMain.handle('get-knowledge-base', async () => {
    return knowledgeService.getKnowledgeBase()
  })

  ipcMain.handle('get-knowledge-stats', async () => {
    return knowledgeService.getStats()
  })

  ipcMain.handle('refresh-knowledge-cache', async () => {
    knowledgeService.clearCache()
  })
```

**Step 3: Instantiate KnowledgeService in main/index.ts**

```typescript
import { KnowledgeService } from './services/knowledge/knowledge-service'

// After db initialization:
const knowledgeService = new KnowledgeService(db, app.getAppPath())

// Pass to registerIpcHandlers
registerIpcHandlers(git, db, config, reviewEngine, staticAnalyzer, bridgeChecker, contextBuilder, knowledgeService)
```

**Step 4: Update preload**

In `src/preload/index.ts`, add:

```typescript
  getKnowledgeBase: () => ipcRenderer.invoke('get-knowledge-base'),
  getKnowledgeStats: () => ipcRenderer.invoke('get-knowledge-stats'),
  refreshKnowledgeCache: () => ipcRenderer.invoke('refresh-knowledge-cache'),
```

**Step 5: Commit**

```bash
git add src/shared/types/ipc.ts src/main/ipc-handlers.ts src/main/index.ts src/preload/index.ts
git commit -m "feat: add knowledge base IPC handlers"
```

---

## Part 7: Update Learning Page

### Task 7: Use Real Data in Learning Page

**Files:**
- Modify: `src/renderer/src/pages/LearningPage.tsx`
- Modify: `src/renderer/src/locales/en/pages.json`
- Modify: `src/renderer/src/locales/zh/pages.json`
- Verify: `npm run typecheck && npm run build`

**Step 1: Update LearningPage to fetch real data**

In `src/renderer/src/pages/LearningPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, BookOpen, Shield, Zap, Layers, FileCode2, Database, AlertTriangle, Code2 } from 'lucide-react'
import type { KnowledgeItem } from '@shared/types/knowledge'

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  security: Shield,
  performance: Zap,
  architecture: Layers,
  'type-safety': FileCode2,
  'code-quality': Code2,
  complexity: Database,
  robustness: AlertTriangle
}

export function LearningPage() {
  const { t } = useTranslation('pages')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadKnowledgeBase()
  }, [])

  const loadKnowledgeBase = async () => {
    try {
      setIsLoading(true)
      const data = await window.api.getKnowledgeBase()
      setItems(data)
    } catch (err) {
      console.error('Failed to load knowledge base:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--background))]">
      <header className="px-6 py-5 border-b border-[hsl(var(--border))]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[hsl(var(--primary))]" />
            <h1 className="text-xl font-semibold tracking-tight">{t('learning.title')}</h1>
          </div>
          <button
            onClick={loadKnowledgeBase}
            className="text-xs px-2 py-1 bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] border border-[hsl(var(--border))] rounded transition-colors"
          >
            {t('learning.refresh')}
          </button>
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

          {isLoading && (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
              Loading knowledge base...
            </div>
          )}

          {!isLoading && filteredItems.length === 0 && (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
              {searchQuery ? `No articles found matching "${searchQuery}"` : 'No articles available yet'}
            </div>
          )}

          {/* Grid of articles */}
          {!isLoading && filteredItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map(item => {
                const Icon = CATEGORY_ICONS[item.category] || Code2
                return (
                  <div key={item.id} className="border border-[hsl(var(--border))] rounded-lg p-5 bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.5)] transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-[hsl(var(--secondary))] rounded-md text-[hsl(var(--primary))]">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-[hsl(var(--foreground))]">{item.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">
                            {t(`learning.categories.${item.category}`)}
                          </span>
                          {item.source === 'history' && item.frequency && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] rounded">
                              {item.frequency}x
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] rounded">
                            {item.source}
                          </span>
                        </div>
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
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Add translations**

In `en/pages.json`, add under `"learning"`:
```json
    "refresh": "Refresh",
    "categories": {
      "security": "Security",
      "performance": "Performance",
      "architecture": "Architecture",
      "type-safety": "Type Safety",
      "code-quality": "Code Quality",
      "complexity": "Complexity",
      "robustness": "Robustness"
    }
```

In `zh/pages.json`, add under `"learning"`:
```json
    "refresh": "刷新",
    "categories": {
      "security": "安全性",
      "performance": "性能优化",
      "architecture": "架构设计",
      "type-safety": "类型安全",
      "code-quality": "代码质量",
      "complexity": "复杂度",
      "robustness": "健壮性"
    }
```

**Step 3: Commit**

```bash
git add src/renderer/src/pages/LearningPage.tsx src/renderer/src/locales/en/pages.json src/renderer/src/locales/zh/pages.json
git commit -m "feat: update Learning Page to use real knowledge base data"
```

---

## Execution Order

```
Task 1 (types) → Task 2 (history adapter) → Task 3 (local adapter) → 
Task 4 (remote stub) → Task 5 (knowledge service) → Task 6 (IPC) → 
Task 7 (update UI)
```

**Total: 7 tasks**

---

## Testing Strategy

After implementation:
1. Run a few reviews to populate the database with issues
2. Create 2-3 Markdown files in `docs/knowledge-base/`
3. Open Learning Center and verify all three sources appear
4. Test search functionality
5. Verify frequency badges show for history items
6. Test refresh button

---

## Future Enhancements

- Implement RemoteAdapter to fetch from GitHub/Notion
- Add filtering by source and category
- Add "View Details" modal for full article content
- Add ability to mark articles as "helpful" or "not helpful"
- Export knowledge base as PDF
