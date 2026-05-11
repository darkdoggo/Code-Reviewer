import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '@shared/types'
import type { DiffOptions, UserConfig } from '@shared/types'

/**
 * Wraps IPC invoke to clean up error messages
 * Strips "Error invoking remote method 'xxx': Error: " prefix
 */
const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  try {
    return await ipcRenderer.invoke(channel, ...args)
  } catch (error) {
    if (error instanceof Error) {
      // Strip Electron IPC error prefix for cleaner user-facing messages
      error.message = error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
    }
    throw error
  }
}

const api: ElectronAPI = {
  selectDirectory: () => invoke('select-directory'),
  getGitInfo: (path: string) => invoke('get-git-info', path),
  getChangedFiles: (projectId: string, mode: 'staged' | 'unstaged') => invoke('get-changed-files', projectId, mode),
  getProjectFiles: (projectId: string, targetPath?: string, fileExtensions?: string[], excludePattern?: string) => invoke('get-project-files', projectId, targetPath, fileExtensions, excludePattern),
  getDiff: (projectId: string, options: DiffOptions) => invoke('get-diff', projectId, options),
  getFileContent: (projectId: string, filePath: string, ref?: string) => invoke('get-file-content', projectId, filePath, ref),
  getBranches: (projectId: string) => invoke('get-branches', projectId),
  getCommits: (projectId: string, count?: number, branch?: string, includeFiles?: boolean) => invoke('get-commits', projectId, count, branch, includeFiles),

  addProject: (name: string, pathOrUrl: string, type?: 'local' | 'github' | 'gitlab') => invoke('add-project', name, pathOrUrl, type),
  getProjects: () => invoke('get-projects'),
  deleteProject: (id: string) => invoke('delete-project', id),
  refreshProject: (projectId: string) => invoke('refresh-project', projectId),

  startReview: (projectId: string, options: DiffOptions) => invoke('start-review', projectId, options),
  getReviews: (projectId?: string) => invoke('get-reviews', projectId),
  getReviewIssues: (reviewId: string) => invoke('get-review-issues', reviewId),
  deleteReview: (reviewId: string) => invoke('delete-review', reviewId),

  getProjectContext: (projectId: string) => invoke('get-project-context', projectId),

  getConfig: () => invoke('get-config'),
  updateConfig: (config: Partial<UserConfig>) => invoke('update-config', config),
  testLLMConnection: () => invoke('test-llm-connection'),
  listLLMModels: (provider: string, apiKey: string, baseUrl?: string) => invoke('list-llm-models', provider, apiKey, baseUrl),

  exportReview: (reviewId: string) => invoke('export-review', reviewId),

  getKnowledgeBase: () => invoke('get-knowledge-base'),
  getKnowledgeStats: () => invoke('get-knowledge-stats'),
  refreshKnowledgeCache: () => invoke('refresh-knowledge-cache'),

  onReviewProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { stage: string; percent: number }) => callback(data)
    ipcRenderer.on('review-progress', handler)
    return () => {
      ipcRenderer.removeListener('review-progress', handler)
    }
  },

  onReviewScoreReady: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { reviewId: string; score: number }) => callback(data)
    ipcRenderer.on('review-score-ready', handler)
    return () => {
      ipcRenderer.removeListener('review-score-ready', handler)
    }
  },

  restartApp: () => ipcRenderer.send('restart-app'),

  // Dashboard
  getDashboardTrend: (days: 7 | 30 | 'all') => invoke('dashboard:getTrendData', days),
  getDashboardIssuesDistribution: () => invoke('dashboard:getIssuesDistribution'),
  getDashboardLowScoreProjects: (limit?: number) => invoke('dashboard:getLowScoreProjects', limit ?? 5),
  getDashboardStatistics: (days: 7 | 30 | 'all') => invoke('dashboard:getStatistics', days),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
