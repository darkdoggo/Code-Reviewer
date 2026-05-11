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

    // Sort: local (stable quality) first, then history by frequency, then remote
    const sourceOrder = { local: 0, history: 1, remote: 2 }
    const sorted = allItems.sort((a, b) => {
      const orderDiff = (sourceOrder[a.source] ?? 2) - (sourceOrder[b.source] ?? 2)
      if (orderDiff !== 0) return orderDiff
      // Within history, sort by frequency descending
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
