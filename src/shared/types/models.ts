export interface Project {
  id: string
  name: string
  type: 'local' | 'github' | 'gitlab'
  path: string
  remoteUrl?: string
  createdAt: number
  lastReviewAt?: number
}

export interface Review {
  id: string
  projectId: string
  mode: 'commits' | 'branch' | 'staged'
  commits?: string[]
  baseBranch?: string
  compareBranch?: string
  currentBranch?: string
  score: number | null
  errorCount: number
  warningCount: number
  suggestionCount: number
  llmProvider: string
  llmModel: string
  tokenUsed: number
  costEstimate: number
  duration: number
  createdAt: number
}

export interface ReviewIssue {
  id: string
  reviewId: string
  file: string
  line: number
  severity: 'error' | 'warning' | 'suggestion'
  category: 'security' | 'performance' | 'robustness' | 'architecture' | 'type-safety' | 'code-quality' | 'complexity' | 'bridge-type'
  title: string
  description: string
  suggestion?: string
  fullstackTip?: string
  source: 'llm' | 'static' | 'bridge'
}
