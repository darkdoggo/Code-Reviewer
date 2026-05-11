import type { DatabaseService } from '../database'
import type { KnowledgeItem, KnowledgeCategory, KnowledgeReference } from '@shared/types/knowledge'
import { nanoid } from 'nanoid'

export class HistoryAdapter {
  constructor(private db: DatabaseService) {}

  async getKnowledgeItems(): Promise<KnowledgeItem[]> {
    const allIssues = this.db.getAllIssuesWithContext()

    // Only include significant issues (error or warning), skip suggestions
    const issues = allIssues.filter(
      issue => issue.severity === 'error' || issue.severity === 'warning'
    )

    // Group by category and title to find high-frequency issues
    const grouped = new Map<string, {
      category: KnowledgeCategory
      title: string
      descriptions: string[]
      tips: string[]
      references: KnowledgeReference[]
      count: number
    }>()

    for (const issue of issues) {
      const key = `${issue.category}-${issue.title}`
      const existing = grouped.get(key)
      const ref: KnowledgeReference = {
        reviewId: issue.reviewId,
        projectId: issue.projectId,
        projectName: issue.projectName,
        branch: issue.branch,
        file: issue.file,
        line: issue.line,
        reviewedAt: issue.reviewedAt
      }

      if (existing) {
        existing.count++
        if (issue.description && !existing.descriptions.includes(issue.description)) {
          existing.descriptions.push(issue.description)
        }
        if (issue.fullstackTip && !existing.tips.includes(issue.fullstackTip)) {
          existing.tips.push(issue.fullstackTip)
        }
        // Keep up to 10 references
        if (existing.references.length < 10) {
          existing.references.push(ref)
        }
      } else {
        grouped.set(key, {
          category: issue.category as KnowledgeCategory,
          title: issue.title,
          descriptions: issue.description ? [issue.description] : [],
          tips: issue.fullstackTip ? [issue.fullstackTip] : [],
          references: [ref],
          count: 1
        })
      }
    }

    // Convert to KnowledgeItems, only include issues that appeared 2+ times
    const items: KnowledgeItem[] = []

    for (const [, data] of Array.from(grouped.entries())) {
      if (data.count >= 2) {  // Require 2+ occurrences to reduce noise
        items.push({
          id: `history-${nanoid(8)}`,
          title: data.title,
          category: data.category,
          description: data.descriptions[0] || '代码审查中发现的常见问题',
          fullstackTip: data.tips[0] || '',
          source: 'history',
          frequency: data.count,
          references: data.references,
          createdAt: Date.now()
        })
      }
    }

    // Sort by frequency (most common first)
    return items.sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
  }
}
