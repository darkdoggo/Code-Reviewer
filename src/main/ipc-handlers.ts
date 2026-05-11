import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { nanoid } from 'nanoid'
import fs from 'fs/promises'
import type { DiffOptions, Project, LLMConfig } from '@shared/types'
import type { DatabaseService } from './services/database'
import type { ConfigService } from './services/config'
import type { GitService } from './services/git'
import type { ReviewEngine } from './services/review-engine'
import type { ContextBuilder } from './services/context-builder'
import type { KnowledgeService } from './services/knowledge/knowledge-service'
import type { RemoteGitService } from './services/remote-git'
import { createLLMProvider } from './services/llm/provider-factory'

export function registerIpcHandlers(
  db: DatabaseService,
  config: ConfigService,
  git: GitService,
  reviewEngine: ReviewEngine,
  contextBuilder: ContextBuilder,
  knowledgeService: KnowledgeService,
  remoteGit: RemoteGitService
): void {
  // --- Directory ---
  ipcMain.handle('select-directory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // --- Git ---
  ipcMain.handle('get-git-info', async (_e, path: string) => {
    return git.getGitInfo(path)
  })

  ipcMain.handle('get-changed-files', async (_e, projectId: string, mode: 'staged' | 'unstaged') => {
    const project = db.getProject(projectId)
    if (!project) throw new Error('Project not found')
    return git.getChangedFiles(project.path, mode)
  })

  ipcMain.handle('get-project-files', async (_e, projectId: string, targetPath?: string, fileExtensions?: string[], excludePattern?: string) => {
    const project = db.getProject(projectId)
    if (!project) throw new Error('Project not found')
    return git.getProjectFiles(project.path, targetPath, fileExtensions, excludePattern)
  })

  ipcMain.handle('get-diff', async (_e, projectId: string, options: DiffOptions) => {
    const project = db.getProject(projectId)
    if (!project) throw new Error('Project not found')
    return git.getDiff(project.path, options)
  })

  ipcMain.handle('get-file-content', async (_e, projectId: string, filePath: string, ref?: string) => {
    const project = db.getProject(projectId)
    if (!project) throw new Error('Project not found')
    return git.getFileContent(project.path, filePath, ref)
  })

  ipcMain.handle('get-branches', async (_e, projectId: string) => {
    const project = db.getProject(projectId)
    if (!project) throw new Error('Project not found')
    if (project.type !== 'local' && project.remoteUrl) {
      return git.getRemoteBranches(project.remoteUrl)
    }
    // For all repos (including remote without remoteUrl saved), use getBranches
    // which will auto-fallback to ls-remote via origin URL
    return git.getBranches(project.path)
  })

  ipcMain.handle('get-commits', async (_e, projectId: string, count?: number, branch?: string, includeFiles?: boolean, offset?: number) => {
    const project = db.getProject(projectId)
    if (!project) throw new Error('Project not found')

    // Check if project path exists
    try {
      await fs.access(project.path)
    } catch (error) {
      console.error('[IPC] Project path does not exist:', project.path)
      // If it's a remote project, try to re-clone
      if (project.type === 'github' || project.type === 'gitlab') {
        console.log('[IPC] Attempting to re-clone remote project:', project.name)
        try {
          const newPath = await remoteGit.cloneOrPull(project.remoteUrl || '', projectId)
          // Update project path in database
          db.updateProject(projectId, { path: newPath })
          return git.getCommits(newPath, count, branch, includeFiles)
        } catch (cloneError) {
          console.error('[IPC] Failed to re-clone:', cloneError)
          return []
        }
      }
      return []
    }

    return git.getCommits(project.path, count, branch, includeFiles, offset)
  })

  // --- Projects ---
  ipcMain.handle('add-project', async (_e, name: string, pathOrUrl: string, type: 'local' | 'github' | 'gitlab' = 'local') => {
    const id = nanoid()
    let localPath = pathOrUrl

    if (type !== 'local') {
      // 1. Test access before cloning
      const test = await remoteGit.testAccess(pathOrUrl)
      if (!test.success) {
        throw new Error(test.error || 'Cannot access repository')
      }

      // 2. Clone
      try {
        localPath = await remoteGit.cloneOrPull(pathOrUrl, id)
      } catch (error) {
        await remoteGit.cleanup(id).catch(() => {})
        const msg = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to clone repository: ${msg}`)
      }
    }

    const project: Project = {
      id,
      name,
      type,
      path: localPath,
      remoteUrl: type !== 'local' ? pathOrUrl : undefined,
      createdAt: Date.now()
    }
    return db.addProject(project)
  })

  ipcMain.handle('get-projects', async () => {
    return db.getProjects()
  })

  ipcMain.handle('delete-project', async (_e, id: string) => {
    const project = db.getProject(id)
    db.deleteProject(id)
    // Cleanup cloned directory for remote projects
    if (project && project.type !== 'local') {
      await remoteGit.cleanup(id).catch(() => {})
    }
  })

  ipcMain.handle('refresh-project', async (_e, projectId: string) => {
    const project = db.getProject(projectId)
    if (!project || project.type === 'local') return

    await remoteGit.cloneOrPull(project.remoteUrl!, projectId)
  })

  // --- Reviews ---
  ipcMain.handle('start-review', async (_e, projectId: string, options: DiffOptions) => {
    return reviewEngine.runReview(projectId, options)
  })

  ipcMain.handle('get-reviews', async (_e, projectId?: string) => {
    return db.getReviews(projectId)
  })

  ipcMain.handle('get-review-issues', async (_e, reviewId: string) => {
    return db.getReviewIssues(reviewId)
  })

  ipcMain.handle('delete-review', async (_e, reviewId: string) => {
    db.deleteReview(reviewId)
  })

  // --- Context ---
  ipcMain.handle('get-project-context', async (_e, projectId: string) => {
    const project = db.getProject(projectId)
    if (!project) throw new Error('Project not found')

    const diffs = await git.getDiff(project.path, { mode: 'staged' })
    return contextBuilder.buildContext(project.path, diffs)
  })

  // --- Config ---
  ipcMain.handle('get-config', async () => {
    return config.getConfig()
  })

  ipcMain.handle('update-config', async (_e, partial) => {
    config.updateConfig(partial)
  })

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

    await fs.writeFile(filePath, md, 'utf-8')
    return true
  })

  ipcMain.handle('test-llm-connection', async () => {
    const llmConfig = config.getLLMConfig()
    if (!llmConfig.apiKey) {
      return { success: false, error: 'API key not configured' }
    }
    const provider = createLLMProvider(llmConfig)
    return provider.testConnection()
  })

  ipcMain.handle('list-llm-models', async (_e, providerName: string, apiKey: string, baseUrl?: string) => {
    console.log('[list-llm-models] called with provider:', providerName, 'baseUrl:', baseUrl, 'apiKey length:', apiKey?.length)
    const llmConfig: LLMConfig = { provider: providerName as any, model: '', apiKey, baseUrl, temperature: 0, maxTokens: 0, outputLanguage: 'en' }
    const provider = createLLMProvider(llmConfig)
    const models = await provider.listModels()
    console.log('[list-llm-models] result - models count:', models.length, 'first 5:', models.slice(0, 5))
    return models
  })

  // --- Knowledge Base ---
  ipcMain.handle('get-knowledge-base', async () => {
    return knowledgeService.getKnowledgeBase()
  })

  ipcMain.handle('get-knowledge-stats', async () => {
    return knowledgeService.getStats()
  })

  ipcMain.handle('refresh-knowledge-cache', async () => {
    knowledgeService.clearCache()
  })

  // --- App ---
  ipcMain.on('restart-app', () => {
    app.relaunch()
    app.exit(0)
  })

  // --- Dashboard ---
  ipcMain.handle('dashboard:getTrendData', async (_e, days: 7 | 30 | 'all') => {
    try {
      const data = db.getDashboardTrend(days)
      return { success: true, data, error: null }
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message }
    }
  })

  ipcMain.handle('dashboard:getIssuesDistribution', async () => {
    try {
      const data = db.getDashboardIssuesDistribution()
      return { success: true, data, error: null }
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message }
    }
  })

  ipcMain.handle('dashboard:getLowScoreProjects', async (_e, limit: number = 5) => {
    try {
      const data = db.getDashboardLowScoreProjects(limit)
      return { success: true, data, error: null }
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message }
    }
  })

  ipcMain.handle('dashboard:getStatistics', async (_e, days: 7 | 30 | 'all') => {
    try {
      const data = db.getDashboardStatistics(days)
      return { success: true, data, error: null }
    } catch (error) {
      return { success: false, data: null, error: (error as Error).message }
    }
  })
}
