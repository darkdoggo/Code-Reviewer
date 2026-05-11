export type KnowledgeCategory =
  | 'security'
  | 'performance'
  | 'architecture'
  | 'type-safety'
  | 'code-quality'
  | 'complexity'
  | 'robustness'

export type KnowledgeSource = 'history' | 'local' | 'remote'

export interface KnowledgeReference {
  reviewId: string
  projectId: string
  projectName: string
  branch: string
  file: string
  line: number
  reviewedAt: number
}

export interface KnowledgeItem {
  id: string
  title: string
  category: KnowledgeCategory
  description: string
  fullstackTip: string
  source: KnowledgeSource

  // Optional metadata
  frequency?: number      // For history source: how many times this issue appeared
  references?: KnowledgeReference[]  // For history source: related review records
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
