import { useState, useEffect, useCallback, useRef } from 'react'
import { useReviewerStore } from '../store'
import type { DiffOptions, Commit, ReviewIssue, FileDiff } from '@shared/types'
import {
  Play, Loader2, AlertCircle, AlertTriangle, Lightbulb, FileCode,
  ChevronRight, ArrowLeft, Zap, Download, RefreshCw, GitBranch, Clock, TrendingUp
} from 'lucide-react'
import { cn } from '../lib/utils'
import { DiffViewer } from '../components/DiffViewer'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'

type ReviewState = 'config' | 'running' | 'results'

export function ReviewPage() {
  const {
    selectedProjectId, projects, activeReview, reviewProgress, reviewIssues, reviewDiffs,
    isStartingReview, startReview, loadReviewDetails, clearReviewState, navigate, error, reviews, loadReviews,
  } = useReviewerStore()
  const { t } = useTranslation('review')

  const project = projects.find((p) => p.id === selectedProjectId)

  const [reviewState, setReviewState] = useState<ReviewState>(activeReview ? 'results' : 'config')
  const [mode, setMode] = useState<DiffOptions['mode']>('staged')
  const [branches, setBranches] = useState<string[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedCommits, setSelectedCommits] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<FileDiff | null>(null)
  const [selectedLine, setSelectedLine] = useState<number | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [isLoadingCommits, setIsLoadingCommits] = useState(false)
  const [commitsError, setCommitsError] = useState<string | null>(null)
  const [commitOffset, setCommitOffset] = useState(0)
  const [hasMoreCommits, setHasMoreCommits] = useState(true)
  const [isLoadingMoreCommits, setIsLoadingMoreCommits] = useState(false)
  const commitsListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeReview) setReviewState('results')
    loadReviews()
  }, [activeReview])

  useEffect(() => {
    if (!selectedProjectId) return
    setIsLoadingBranches(true)
    setBranchError(null)
    setIsLoadingCommits(true)
    setCommitsError(null)
    setCommitOffset(0)
    setHasMoreCommits(true)
    setCommits([])
    window.api.getBranches(selectedProjectId)
      .then((result) => {
        setBranches(result)
        if (result.length === 0) setBranchError(t('noBranches'))
      })
      .catch((err) => {
        setBranches([])
        setBranchError(err instanceof Error ? err.message : t('branchLoadFailed'))
      })
      .finally(() => setIsLoadingBranches(false))
    window.api.getCommits(selectedProjectId, 20)
      .then((result) => {
        setCommits(result)
        setCommitOffset(20)
        if (result.length < 20) setHasMoreCommits(false)
      })
      .catch((err) => {
        setCommits([])
        setCommitsError(err instanceof Error ? err.message : '无法加载提交列表')
      })
      .finally(() => setIsLoadingCommits(false))
  }, [selectedProjectId])

  const handleStartReview = async () => {
    if (!selectedProjectId) return
    setReviewState('running')
    const options: DiffOptions = { mode }
    if (mode === 'branch') options.baseBranch = selectedBranch
    if (mode === 'commits') options.commits = selectedCommits

    try {
      await startReview(selectedProjectId, options)
      setReviewState('results')
    } catch {
      setReviewState('config')
    }
  }

  const handleBack = () => {
    clearReviewState()
    setReviewState('config')
    setSelectedFile(null)
    setSelectedLine(null)
  }

  const loadMoreCommits = useCallback(async () => {
    if (!selectedProjectId || isLoadingMoreCommits || !hasMoreCommits) return
    setIsLoadingMoreCommits(true)
    try {
      const result = await window.api.getCommits(selectedProjectId, 20)
      setCommits((prev) => [...prev, ...result])
      setCommitOffset((prev) => prev + 20)
      if (result.length < 20) setHasMoreCommits(false)
    } catch {
      // ignore
    } finally {
      setIsLoadingMoreCommits(false)
    }
  }, [selectedProjectId, commitOffset, isLoadingMoreCommits, hasMoreCommits])

  const handleCommitsScroll = useCallback(() => {
    const el = commitsListRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) loadMoreCommits()
  }, [loadMoreCommits])

  const handleIssueSelect = useCallback((issue: ReviewIssue) => {
    const diff = reviewDiffs.find((d) => d.file === issue.file) ?? null
    setSelectedFile(diff)
    setSelectedLine(issue.line)
  }, [reviewDiffs])

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('noProject')}</p>
        <button onClick={() => navigate('projects')} className="text-sm underline">{t('goToProjects')}</button>
      </div>
    )
  }

  if (reviewState === 'running') {
    const percent = reviewProgress?.percent ?? 0
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 size={32} className="animate-spin text-[hsl(var(--primary))]" />
        <div className="text-center w-80">
          <p className="text-sm font-medium mb-2">{reviewProgress?.stage ?? t('startingReview')}</p>
          <div className="w-full h-3 bg-[hsl(var(--secondary))] rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 font-mono">{percent.toFixed(2)}%</p>
        </div>
      </div>
    )
  }

  if (reviewState === 'results' && activeReview) {
    return (
      <ReviewResults
        review={activeReview}
        issues={reviewIssues}
        diffs={reviewDiffs}
        project={project}
        selectedFile={selectedFile}
        selectedLine={selectedLine}
        onSelectFile={(f) => { setSelectedFile(f); setSelectedLine(null) }}
        onIssueSelect={handleIssueSelect}
        severityFilter={severityFilter}
        onSeverityFilter={setSeverityFilter}
        onBack={handleBack}
      />
    )
  }

  // Get recent reviews for this project
  const projectReviews = reviews
    .filter((r) => r.projectId === selectedProjectId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3)

  return (
    <div className="h-full flex flex-col space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('newReview')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('project')}: <span className="font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
          </p>
        </div>
        <button
          onClick={() => navigate('projects')}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          切换项目
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* 60:40 Split Layout */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left: Configuration (60%) */}
        <div className="w-[60%] flex flex-col gap-4 overflow-y-auto">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">审查范围</h3>
          <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('diffMode')}</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as DiffOptions['mode'])}
            className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] transition-all"
          >
            <option value="staged">{t('staged')}</option>
            <option value="branch">{t('branch')}</option>
            <option value="commits">{t('commits')}</option>
          </select>
        </label>

        {mode === 'branch' && (
          <div className="block">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('baseBranch')}</span>
              {isLoadingBranches ? (
                <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" />
                  {t('loadingBranches')}
                </div>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] transition-all"
                >
                  <option value="">{t('selectBranch')}</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
            </label>
            {branchError && (
              <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle size={12} className="inline mr-1" />
                {branchError}
              </div>
            )}
          </div>
        )}

        {mode === 'commits' && (
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('selectCommits')}</span>
            {isLoadingCommits ? (
              <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={14} className="animate-spin" />
                正在加载提交列表...
              </div>
            ) : commitsError ? (
              <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle size={12} className="inline mr-1" />
                {commitsError}
              </div>
            ) : commits.length === 0 ? (
              <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5 text-xs text-blue-700 dark:text-blue-300">
                <AlertCircle size={12} className="inline mr-1" />
                当前项目没有可选提交记录，请先在仓库中提交代码，或切换到"暂存更改"模式。
              </div>
            ) : (
              <div
                ref={commitsListRef}
                onScroll={handleCommitsScroll}
                className="mt-1.5 max-h-96 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800"
              >
                {commits.map((c) => (
                  <label key={c.hash} className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedCommits.includes(c.hash)}
                      onChange={(e) => {
                        setSelectedCommits(e.target.checked
                          ? [...selectedCommits, c.hash]
                          : selectedCommits.filter((h) => h !== c.hash)
                        )
                      }}
                      className="rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                    />
                    <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">{c.hash.slice(0, 7)}</code>
                    <span className="truncate text-gray-700 dark:text-gray-300" title={c.message}>{c.message}</span>
                  </label>
                ))}
                {isLoadingMoreCommits && (
                  <div className="flex items-center justify-center gap-2 py-2.5 text-xs text-gray-500">
                    <Loader2 size={12} className="animate-spin" />
                    加载更多...
                  </div>
                )}
                {!hasMoreCommits && commits.length > 0 && (
                  <div className="py-2.5 text-center text-xs text-gray-400 dark:text-gray-600">
                    已加载全部 {commits.length} 个提交
                  </div>
                )}
              </div>
            )}
          </div>
        )}

          <button
            onClick={handleStartReview}
            disabled={isStartingReview || (mode === 'branch' && !selectedBranch) || (mode === 'commits' && selectedCommits.length === 0)}
            className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            {isStartingReview ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {t('startReview')}
          </button>
        </div>
        </div>

        {/* Right: Project Info (40%) */}
        <div className="w-[40%] flex flex-col gap-4">
          {/* Project Overview */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">项目概览</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[hsl(var(--primary))]">
                  <FileCode size={13} className="text-[hsl(var(--primary-foreground))]" />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[hsl(var(--primary))]">
                  <GitBranch size={13} className="text-[hsl(var(--primary-foreground))]" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">{branches[0] || 'main'} 分支</span>
              </div>
            </div>
          </div>

          {/* Recent Reviews */}
          {projectReviews.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">最近审查</h3>
              <div className="space-y-2">
                {projectReviews.map((review) => {
                  const score = review.score ?? 0
                  const scoreColor = score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  return (
                    <div key={review.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${scoreColor}`}>{score.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Estimated Info */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">预估信息</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[hsl(var(--primary))]">
                  <Zap size={13} className="text-[hsl(var(--primary-foreground))]" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">预计耗时: 1-3 分钟</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[hsl(var(--primary))]">
                  <TrendingUp size={13} className="text-[hsl(var(--primary-foreground))]" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">检查维度: 安全/性能/规范</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Results Sub-Components ---

function ReviewResults({
  review, issues, diffs, project, selectedFile, selectedLine, onSelectFile, onIssueSelect, severityFilter, onSeverityFilter, onBack,
}: {
  review: import('@shared/types').Review
  issues: ReviewIssue[]
  diffs: FileDiff[]
  project: import('@shared/types').Project
  selectedFile: FileDiff | null
  selectedLine: number | null
  onSelectFile: (f: FileDiff | null) => void
  onIssueSelect: (issue: ReviewIssue) => void
  severityFilter: string | null
  onSeverityFilter: (s: string | null) => void
  onBack: () => void
}) {
  const { t } = useTranslation('review')
  const [isExporting, setIsExporting] = useState(false)
  const filteredIssues = severityFilter ? issues.filter((i) => i.severity === severityFilter) : issues
  const visibleIssues = selectedFile ? filteredIssues.filter((i) => i.file === selectedFile.file) : filteredIssues

  const handleExport = async () => {
    try {
      setIsExporting(true)
      await window.api.exportReview(review.id)
      // Optional: Could add a toast notification here
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 rounded hover:bg-[hsl(var(--secondary))]">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-lg font-semibold">{t('results.title')}</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{project.name} · {review.mode} · {review.llmModel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] border border-[hsl(var(--border))] rounded-md transition-colors disabled:opacity-50"
          >
            <Download size={14} />
            {t('exportReport')}
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] rounded-md transition-colors"
          >
            <RefreshCw size={14} />
            {t('newReview')}
          </button>
          <ScoreBadge score={review.score} />
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex gap-3 shrink-0">
        {[
          { label: t('results.errors'), count: review.errorCount, icon: AlertCircle, color: 'text-red-500', key: 'error' },
          { label: t('results.warnings'), count: review.warningCount, icon: AlertTriangle, color: 'text-yellow-500', key: 'warning' },
          { label: t('results.suggestions'), count: review.suggestionCount, icon: Lightbulb, color: 'text-blue-500', key: 'suggestion' },
        ].map(({ label, count, icon: Icon, color, key }) => (
          <button
            key={key}
            onClick={() => onSeverityFilter(severityFilter === key ? null : key)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors',
              severityFilter === key
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]'
                : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]'
            )}
          >
            <Icon size={14} className={color} />
            <span className="font-medium">{count}</span>
            <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
          </button>
        ))}
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Zap size={12} />
          {review.tokenUsed} tokens · ${review.costEstimate.toFixed(4)} · {(review.duration / 1000).toFixed(1)}s
        </div>
      </div>

      {/* Three-Column Workspace */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Left: File List */}
        <div className="w-52 shrink-0 overflow-y-auto rounded-md border border-[hsl(var(--border))]">
          <div className="p-2 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            {t('results.files')} ({diffs.length})
          </div>
          {diffs.map((diff) => {
            const fileIssues = issues.filter((i) => i.file === diff.file)
            return (
              <button
                key={diff.file}
                onClick={() => onSelectFile(selectedFile?.file === diff.file ? null : diff)}
                className={cn(
                  'w-full text-left px-2 py-1.5 text-xs flex items-center gap-1.5 hover:bg-[hsl(var(--secondary))] transition-colors',
                  selectedFile?.file === diff.file && 'bg-[hsl(var(--secondary))]'
                )}
              >
                <FileCode size={12} className={cn(
                  diff.status === 'added' && 'text-green-500',
                  diff.status === 'deleted' && 'text-red-500',
                  diff.status === 'modified' && 'text-yellow-500',
                )} />
                <span className="truncate flex-1">{diff.file.split('/').pop()}</span>
                {fileIssues.length > 0 && (
                  <span className="text-[10px] bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] rounded-full px-1.5">{fileIssues.length}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Center: Monaco Diff Viewer */}
        <div className="flex-1 min-w-0 rounded-md border border-[hsl(var(--border))] overflow-hidden">
          <DiffViewer
            projectId={project.id}
            review={review}
            file={selectedFile}
            targetLine={selectedLine}
          />
        </div>

        {/* Right: Issue List */}
        <div className="w-[340px] shrink-0 overflow-y-auto space-y-2">
          {visibleIssues.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
              {severityFilter ? t('results.noSeverityIssues', { severity: severityFilter }) : t('results.noIssues')}
            </p>
          ) : (
            visibleIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} onSelect={onIssueSelect} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function IssueCard({ issue, onSelect }: { issue: ReviewIssue; onSelect?: (issue: ReviewIssue) => void }) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation('review')

  const severityConfig = {
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800' },
    warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-200 dark:border-yellow-800' },
    suggestion: { icon: Lightbulb, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200 dark:border-blue-800' },
  }

  const config = severityConfig[issue.severity]
  const Icon = config.icon

  const handleClick = () => {
    setExpanded(!expanded)
    onSelect?.(issue)
  }

  return (
    <div className={cn('rounded-md border p-3 text-sm', config.border, config.bg)}>
      <button onClick={handleClick} className="w-full text-left">
        <div className="flex items-start gap-2">
          <Icon size={14} className={cn('mt-0.5 shrink-0', config.color)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{issue.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">{issue.category}</span>
              {issue.source && issue.source !== 'llm' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                  {issue.source === 'static' ? t('results.static') : t('results.bridge')}
                </span>
              )}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {issue.file}:{issue.line}
            </p>
          </div>
          <ChevronRight size={14} className={cn('shrink-0 transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>

      {expanded && (
        <div className="mt-3 ml-5 space-y-2 text-xs">
          <p>{issue.description}</p>
          {issue.suggestion && (
            <div className="rounded bg-[hsl(var(--background))] p-2 font-mono whitespace-pre-wrap">{issue.suggestion}</div>
          )}
          {issue.fullstackTip && (
            <div className="rounded bg-[hsl(var(--background))] p-2 border-l-2 border-[hsl(var(--primary))]">
              <span className="font-medium">{t('results.fullStackTip')}</span> {issue.fullstackTip}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="rounded-lg px-4 py-2 text-center bg-gray-50 dark:bg-gray-950">
        <p className="text-2xl font-bold text-gray-600">—</p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">/ 100</p>
      </div>
    )
  }

  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
  const bg = score >= 80 ? 'bg-green-50 dark:bg-green-950' : score >= 60 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-red-50 dark:bg-red-950'

  return (
    <div className={cn('rounded-lg px-4 py-2 text-center', bg)}>
      <p className={cn('text-2xl font-bold', color)}>{score}</p>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">/ 100</p>
    </div>
  )
}
