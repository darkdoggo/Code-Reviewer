import { useEffect, useState, useMemo } from 'react'
import { useReviewerStore } from '../store'
import { AlertCircle, AlertTriangle, Lightbulb, Clock, ExternalLink, Trash2, ChevronDown, ChevronRight, FolderGit2, FileSearch } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '../lib/utils'
import { useTranslation } from 'react-i18next'
import type { Review, Project } from '@shared/types'

interface ProjectGroup {
  project: Project | null // null for "Other" category
  reviews: Review[]
}

export function HistoryPage() {
  const { reviews, projects, loadReviews, loadReviewDetails, deleteReview, isLoadingReviews } = useReviewerStore()
  const { t } = useTranslation('pages')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  useEffect(() => { loadReviews() }, [])

  // Group reviews by project
  const groupedReviews = useMemo(() => {
    const groups = new Map<string, ProjectGroup>()
    const projectIds = new Set(projects.map(p => p.id))

    // Sort reviews by time first
    const sorted = [...reviews].sort((a, b) => b.createdAt - a.createdAt)

    for (const review of sorted) {
      const projectId = review.projectId
      const project = projects.find(p => p.id === projectId)

      // If project exists in current project list, group by project
      // Otherwise, put in "other" category
      const groupKey = projectIds.has(projectId) ? projectId : '__other__'

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          project: groupKey === '__other__' ? null : project || null,
          reviews: []
        })
      }

      groups.get(groupKey)!.reviews.push(review)
    }

    // Convert to array and sort: active projects first (by latest review), then "other"
    const result = Array.from(groups.entries())
      .map(([key, group]) => ({ key, ...group }))
      .sort((a, b) => {
        if (a.key === '__other__') return 1
        if (b.key === '__other__') return -1
        // Sort by latest review time
        const aLatest = Math.max(...a.reviews.map(r => r.createdAt))
        const bLatest = Math.max(...b.reviews.map(r => r.createdAt))
        return bLatest - aLatest
      })

    return result
  }, [reviews, projects])

  const toggleProject = (key: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleDelete = async (e: React.MouseEvent, reviewId: string) => {
    e.stopPropagation()
    if (!confirm(t('history.confirmDelete', { defaultValue: '确定要删除这条审查记录吗？' }))) return

    setDeletingId(reviewId)
    try {
      await deleteReview(reviewId)
    } catch (err) {
      console.error('Failed to delete review:', err)
      alert(t('history.deleteFailed', { defaultValue: '删除失败' }))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-xl font-semibold">{t('history.title')}</h2>

      {isLoadingReviews ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('history.loading')}</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center bg-white dark:bg-gray-900">
          <FileSearch size={56} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('history.noReviews')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">开始第一次代码审查，记录将显示在这里</p>
          <button
            onClick={() => useReviewerStore.getState().navigate('review')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            开始审查
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedReviews.map(({ key, project, reviews: groupReviews }) => {
            const isExpanded = expandedProjects.has(key)
            const isOther = key === '__other__'
            const projectName = isOther
              ? t('history.otherProjects', { defaultValue: '其他项目' })
              : project?.name || t('history.unknown')

            return (
              <div key={key} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
                {/* Project header */}
                <button
                  onClick={() => toggleProject(key)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-200 dark:border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <div className="p-1.5 rounded-lg bg-[hsl(var(--primary))]">
                      <FolderGit2 size={14} className={cn(isOther ? 'text-gray-400' : 'text-[hsl(var(--primary-foreground))]')} />
                    </div>
                    <span className="font-semibold text-sm">{projectName}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {groupReviews.length} 次
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDistanceToNow(groupReviews[0].createdAt, { addSuffix: true })}
                  </div>
                </button>

                {/* Review list */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {groupReviews.map((review) => {
                      const scoreColor = (review.score ?? 0) >= 80 ? 'text-emerald-600 dark:text-emerald-400' : (review.score ?? 0) >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                      const scoreBg = (review.score ?? 0) >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/30' : (review.score ?? 0) >= 60 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-red-50 dark:bg-red-950/30'

                      return (
                        <div
                          key={review.id}
                          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <button
                            onClick={() => loadReviewDetails(review)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={cn('flex items-center justify-center w-14 h-14 rounded-xl font-bold text-xl', scoreBg, scoreColor)}>
                                  {review.score ?? '—'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 font-medium">{review.mode}</span>
                                    <span>{review.llmModel}</span>
                                    {review.tokenUsed && (
                                      <span>
                                        {(review.tokenUsed / 1000).toFixed(1)}k tokens
                                      </span>
                                    )}
                                  </div>
                                  {(review.baseBranch || review.commits) && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {review.mode === 'branch' && review.baseBranch && (
                                        <span>
                                          {review.baseBranch}
                                          {review.compareBranch && ` → ${review.compareBranch}`}
                                        </span>
                                      )}
                                      {review.mode === 'commits' && review.commits && (
                                        <span>{review.commits.length} commits</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <AlertCircle size={12} className="text-red-500" />
                                  {review.errorCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <AlertTriangle size={12} className="text-amber-500" />
                                  {review.warningCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Lightbulb size={12} className="text-blue-500" />
                                  {review.suggestionCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {formatDistanceToNow(review.createdAt, { addSuffix: true })}
                                </span>
                                <ExternalLink size={12} />
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, review.id)}
                            disabled={deletingId === review.id}
                            className="mt-3 flex items-center gap-1.5 px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                            title={t('history.delete', { defaultValue: '删除' })}
                          >
                            <Trash2 size={12} />
                            {deletingId === review.id ? t('history.deleting', { defaultValue: '删除中...' }) : t('history.delete', { defaultValue: '删除' })}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
