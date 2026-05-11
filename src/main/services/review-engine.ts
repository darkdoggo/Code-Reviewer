import { nanoid } from 'nanoid'
import { BrowserWindow } from 'electron'
import type { DiffOptions, Review, ReviewIssue } from '@shared/types'
import type { GitService } from './git'
import type { DatabaseService } from './database'
import type { ConfigService } from './config'
import { createLLMProvider } from './llm/provider-factory'
import type { StaticAnalyzer } from './static-analyzer'
import type { BridgeTypeChecker } from './bridge-checker'
import type { ContextBuilder } from './context-builder'
import { calculateDeterministicScore, extractScoringFactors } from './scoring-algorithm'

const progressMessages = {
  en: {
    fetchingDiff: 'Fetching diff...',
    diffFetched: 'Diff fetched',
    analyzingContext: 'Analyzing project context...',
    buildingContext: 'Building context...',
    contextReady: 'Context ready',
    runningAiReview: (batches: number) => `Running AI review (${batches} batch${batches > 1 ? 'es' : ''})...`,
    reviewingBatch: (current: number, total: number) => `Reviewing batch ${current}/${total}...`,
    batchComplete: (current: number, total: number) => `Batch ${current}/${total} complete`,
    aiReviewComplete: 'AI review complete',
    runningStaticAnalysis: 'Running static analysis...',
    staticAnalysisComplete: 'Static analysis complete',
    mergingResults: 'Merging results...',
    calculatingScore: 'Calculating score...',
    savingResults: 'Saving results...',
    complete: 'Complete',
  },
  zh: {
    fetchingDiff: '正在获取差异...',
    diffFetched: '差异获取完成',
    analyzingContext: '正在分析项目上下文...',
    buildingContext: '正在构建上下文...',
    contextReady: '上下文准备就绪',
    runningAiReview: (batches: number) => `正在进行 AI 审查（共 ${batches} 个批次）...`,
    reviewingBatch: (current: number, total: number) => `正在审查第 ${current}/${total} 批次...`,
    batchComplete: (current: number, total: number) => `第 ${current}/${total} 批次完成`,
    aiReviewComplete: 'AI 审查完成',
    runningStaticAnalysis: '正在运行静态分析...',
    staticAnalysisComplete: '静态分析完成',
    mergingResults: '正在合并结果...',
    calculatingScore: '正在计算分数...',
    savingResults: '正在保存结果...',
    complete: '审查完成',
  },
}

export class ReviewEngine {
  constructor(
    private git: GitService,
    private db: DatabaseService,
    private config: ConfigService,
    private staticAnalyzer: StaticAnalyzer,
    private bridgeChecker: BridgeTypeChecker,
    private contextBuilder: ContextBuilder
  ) {}

  async runReview(projectId: string, options: DiffOptions): Promise<Review> {
    const project = this.db.getProject(projectId)
    if (!project) throw new Error('Project not found')

    const llmConfig = this.config.getLLMConfig()
    if (!llmConfig.apiKey) throw new Error('API key not configured. Go to Model Config to set it.')
    const provider = createLLMProvider(llmConfig)
    const msg = progressMessages[llmConfig.outputLanguage] || progressMessages.en

    const startTime = Date.now()

    // 1. Get diff (0% -> 10%)
    this.emitProgress(msg.fetchingDiff, 0)
    const diffs = await this.git.getDiff(project.path, options)
    this.emitProgress(msg.diffFetched, 10)

    // Get current branch for recording
    const gitInfo = await this.git.getGitInfo(project.path)
    const currentBranch = gitInfo.currentBranch

    if (diffs.length === 0) {
      let errorMessage = 'No changes found in the selected diff range.'

      if (options.mode === 'staged') {
        errorMessage = 'No staged changes found. Please stage your changes first using "git add <file>" or stage files in your Git client.'
      } else if (options.mode === 'unstaged') {
        errorMessage = 'No unstaged changes found. All changes have been staged or there are no modifications.'
      } else if (options.mode === 'branch') {
        const branchInfo = options.compareBranch
          ? `between "${options.baseBranch}" and "${options.compareBranch}"`
          : `between "${options.baseBranch}" and current branch`
        errorMessage = `No changes found ${branchInfo}. The branches may be identical or the base branch doesn't exist.`
      } else if (options.mode === 'commits') {
        errorMessage = 'No changes found in the selected commits. The commits may be empty or invalid.'
      } else if (options.mode === 'full-project') {
        errorMessage = 'No files found in the selected directory. Check the path and file type filters.'
      }

      throw new Error(errorMessage)
    }

    // 2. Build project context (10% -> 20%)
    this.emitProgress(msg.analyzingContext, 12)
    const projectContext = await this.contextBuilder.buildContext(project.path, diffs)
    this.emitProgress(msg.buildingContext, 16)
    const contextText = this.contextBuilder.formatContextForLLM(projectContext)
    this.emitProgress(msg.contextReady, 20)

    // 3. Build diff batches (split large diffs to avoid truncation)
    const maxCharsPerBatch = 12000 // Leave room for context
    const batches: string[] = []
    let currentBatch = ''
    let currentBatchFiles: string[] = []

    // Sort diffs by size (additions + deletions) descending to prioritize larger changes
    const sortedDiffs = [...diffs].sort((a, b) => {
      const sizeA = a.additions + a.deletions
      const sizeB = b.additions + b.deletions
      return sizeB - sizeA
    })

    for (const diff of sortedDiffs) {
      const diffText = `--- ${diff.file} (${diff.status})\n` + diff.hunks.map((h) => h.content).join('\n')

      // If adding this diff would exceed the limit, start a new batch
      if (currentBatch.length > 0 && currentBatch.length + diffText.length > maxCharsPerBatch) {
        batches.push(currentBatch)
        currentBatch = diffText
        currentBatchFiles = [diff.file]
      } else {
        currentBatch += (currentBatch ? '\n\n' : '') + diffText
        currentBatchFiles.push(diff.file)
      }
    }

    // Add the last batch
    if (currentBatch) {
      batches.push(currentBatch)
    }

    console.log(`[ReviewEngine] Split ${diffs.length} files into ${batches.length} batches`)

    // 4. Run LLM review on all batches (20% -> 70%)
    this.emitProgress(msg.runningAiReview(batches.length), 20)
    const batchResults = await Promise.all(
      batches.map(async (batch, index) => {
        const batchProgress = 20 + ((index + 0.5) / batches.length) * 50
        this.emitProgress(msg.reviewingBatch(index + 1, batches.length), batchProgress)
        const result = await provider.review(batch, contextText, llmConfig.outputLanguage)
        const completedProgress = 20 + ((index + 1) / batches.length) * 50
        this.emitProgress(msg.batchComplete(index + 1, batches.length), completedProgress)
        return result
      })
    )
    this.emitProgress(msg.aiReviewComplete, 70)

    // 5. Run static analysis and bridge checking in parallel (70% -> 85%)
    this.emitProgress(msg.runningStaticAnalysis, 72)
    const [staticIssues, bridgeIssues] = await Promise.all([
      Promise.resolve(this.staticAnalyzer.analyze(project.path, diffs, llmConfig.outputLanguage)),
      Promise.resolve(this.bridgeChecker.check(project.path, llmConfig.outputLanguage)),
    ])
    this.emitProgress(msg.staticAnalysisComplete, 85)

    // 6. Merge results from all batches (85% -> 95%)
    this.emitProgress(msg.mergingResults, 87)
    const duration = Date.now() - startTime

    // Combine LLM issues from all batches
    const llmIssues: ReviewIssue[] = batchResults.flatMap((result) =>
      result.result.issues.map((issue) => ({
        id: nanoid(),
        reviewId: '',
        ...issue,
        source: 'llm' as const
      }))
    )

    // Calculate average score from all batches (weighted by token usage)
    const totalTokens = batchResults.reduce((sum, r) => sum + r.tokenUsed, 0)
    let llmScore: number | null = null
    if (batchResults.every((r) => typeof r.result.score === 'number')) {
      llmScore = Math.round(
        batchResults.reduce((sum, r, i) => {
          const weight = r.tokenUsed / totalTokens
          return sum + (r.result.score || 0) * weight
        }, 0)
      )
      console.log(`[ReviewEngine] Averaged LLM score from ${batches.length} batches: ${llmScore}`)
    }

    const staticIssuesWithReviewId = staticIssues.map((issue) => ({
      ...issue,
      reviewId: ''
    }))

    const bridgeIssuesWithReviewId = bridgeIssues.map((issue) => ({
      ...issue,
      reviewId: ''
    }))

    const allIssues = [...llmIssues, ...staticIssuesWithReviewId, ...bridgeIssuesWithReviewId]

    // Calculate score: use averaged LLM score if available, otherwise use deterministic algorithm
    this.emitProgress(msg.calculatingScore, 90)
    let initialScore: number
    if (llmScore !== null) {
      initialScore = llmScore
      console.log('[ReviewEngine] Using averaged LLM score:', initialScore)
    } else {
      const factors = extractScoringFactors(allIssues, diffs)
      initialScore = calculateDeterministicScore(factors)
      console.log('[ReviewEngine] Using deterministic score:', initialScore, 'factors:', factors)
    }

    const review: Review = {
      id: nanoid(),
      projectId,
      mode: options.mode,
      commits: options.commits,
      baseBranch: options.baseBranch,
      compareBranch: options.compareBranch,
      currentBranch,
      score: initialScore,
      errorCount: allIssues.filter((i) => i.severity === 'error').length,
      warningCount: allIssues.filter((i) => i.severity === 'warning').length,
      suggestionCount: allIssues.filter((i) => i.severity === 'suggestion').length,
      llmProvider: llmConfig.provider,
      llmModel: llmConfig.model,
      tokenUsed: totalTokens,
      costEstimate: this.estimateCost(totalTokens, llmConfig.model),
      duration,
      createdAt: Date.now()
    }

    const issues: ReviewIssue[] = allIssues.map((issue) => ({
      ...issue,
      reviewId: review.id
    }))

    // 7. Store (95% -> 100%)
    this.emitProgress(msg.savingResults, 95)
    this.db.addReview(review)
    if (issues.length > 0) {
      this.db.addReviewIssues(issues)
    }
    this.db.updateProjectLastReview(projectId, review.createdAt)

    // Note: score is already set to initialScore, no need for async update
    // The scoreReviewAsync was intended for future enhancements

    this.emitProgress(msg.complete, 100)
    return review
  }

  private async scoreReviewAsync(reviewId: string, score: number): Promise<void> {
    // Small delay to ensure UI has rendered
    await new Promise((resolve) => setTimeout(resolve, 100))

    this.emitProgress('Calculating quality score...', 95)

    // Update score in database
    this.db.updateReviewScore(reviewId, score)

    // Emit score-ready event
    this.emitScoreReady(reviewId, score)

    console.log(`[ReviewEngine] Score ready for review ${reviewId}: ${score}`)
  }

  private emitScoreReady(reviewId: string, score: number): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('review-score-ready', { reviewId, score })
    }
  }

  private emitProgress(stage: string, percent: number): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('review-progress', { stage, percent })
    }
  }

  private estimateCost(tokenUsed: number, model: string): number {
    const rates: Record<string, number> = {
      // Anthropic
      'claude-sonnet-4-20250514': 9,
      'claude-opus-4-20250514': 22.5,
      'claude-haiku-4-5-20251001': 2.4,
      // OpenAI
      'gpt-4o': 7.5,
      'gpt-4o-mini': 0.6,
      'gpt-4-turbo': 20,
      'o3-mini': 2.2,
    }
    const rate = rates[model] ?? 9
    return (tokenUsed / 1_000_000) * rate
  }
}
