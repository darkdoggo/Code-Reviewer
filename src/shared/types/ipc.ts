import type { Project, Review, ReviewIssue } from './models'
import type { GitInfo, DiffOptions, FileDiff, Commit } from './git'
import type { UserConfig } from './config'
import type { ProjectContext } from './context'
import type { KnowledgeItem, KnowledgeStats } from './knowledge'

export interface ElectronAPI {
  selectDirectory(): Promise<string | null>
  getGitInfo(path: string): Promise<GitInfo>
  getChangedFiles(projectId: string, mode: 'staged' | 'unstaged'): Promise<{ branch: string; files: { file: string; status: string }[] }>
  getProjectFiles(projectId: string, targetPath?: string, fileExtensions?: string[], excludePattern?: string): Promise<string[]>
  getDiff(projectId: string, options: DiffOptions): Promise<FileDiff[]>
  getFileContent(projectId: string, filePath: string, ref?: string): Promise<string>
  getBranches(projectId: string): Promise<string[]>
  getCommits(projectId: string, count?: number, branch?: string, includeFiles?: boolean): Promise<Commit[]>

  addProject(name: string, pathOrUrl: string, type?: 'local' | 'github' | 'gitlab'): Promise<Project>
  getProjects(): Promise<Project[]>
  deleteProject(id: string): Promise<void>
  refreshProject(projectId: string): Promise<void>

  startReview(projectId: string, options: DiffOptions): Promise<Review>
  getReviews(projectId?: string): Promise<Review[]>
  getReviewIssues(reviewId: string): Promise<ReviewIssue[]>
  deleteReview(reviewId: string): Promise<void>

  getProjectContext(projectId: string): Promise<ProjectContext>

  getConfig(): Promise<UserConfig>
  updateConfig(config: Partial<UserConfig>): Promise<void>
  testLLMConnection(): Promise<{ success: boolean; error?: string }>
  listLLMModels(provider: string, apiKey: string, baseUrl?: string): Promise<string[]>

  exportReview(reviewId: string): Promise<boolean>

  getKnowledgeBase(): Promise<KnowledgeItem[]>
  getKnowledgeStats(): Promise<KnowledgeStats>
  refreshKnowledgeCache(): Promise<void>

  onReviewProgress(callback: (progress: { stage: string; percent: number }) => void): () => void
  onReviewScoreReady(callback: (data: { reviewId: string; score: number }) => void): () => void

  restartApp(): void

  // Dashboard
  getDashboardTrend(days: 7 | 30 | 'all'): Promise<{ success: boolean; data: { date: string; avgScore: number; reviewCount: number }[] | null; error: string | null }>
  getDashboardIssuesDistribution(): Promise<{ success: boolean; data: { type: string; count: number; percentage: number }[] | null; error: string | null }>
  getDashboardLowScoreProjects(limit?: number): Promise<{ success: boolean; data: { id: string; name: string; score: number; lastReviewAt: string; issueCount: number }[] | null; error: string | null }>
  getDashboardStatistics(days: 7 | 30 | 'all'): Promise<{ success: boolean; data: { totalProjects: number; totalReviews: number; avgScore: number; issueCount: number; trends: { projects: string; reviews: string; score: string; issues: string } } | null; error: string | null }>
}
