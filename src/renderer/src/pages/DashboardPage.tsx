import { useEffect, useMemo, useState } from 'react'
import { useReviewerStore } from '../store'
import { FolderGit2, GitPullRequest, AlertCircle, Star, TrendingUp } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { TrendChart } from '../components/charts/TrendChart'
import { IssueDistributionChart } from '../components/charts/IssueDistributionChart'
import { ProjectHealthChart } from '../components/charts/ProjectHealthChart'

type TimeRange = '7' | '30' | 'all'

export function DashboardPage() {
  const { projects, reviews, navigate, loadReviews, isLoadingReviews } = useReviewerStore()
  const { t } = useTranslation('pages')
  const [timeRange, setTimeRange] = useState<TimeRange>('30')

  useEffect(() => { loadReviews() }, [])

  const filteredReviews = useMemo(() => {
    if (timeRange === 'all') return reviews
    const cutoff = subDays(new Date(), parseInt(timeRange)).getTime()
    return reviews.filter((r) => r.createdAt >= cutoff)
  }, [reviews, timeRange])

  const totalReviews = filteredReviews.length
  const totalIssues = filteredReviews.reduce((sum, r) => sum + r.errorCount + r.warningCount + r.suggestionCount, 0)
  const avgScore = filteredReviews.length > 0
    ? filteredReviews.reduce((sum, r) => sum + (r.score ?? 0), 0) / filteredReviews.length
    : null

  // Calculate trends (compare with previous period)
  const previousPeriodReviews = useMemo(() => {
    if (timeRange === 'all') return []
    const days = parseInt(timeRange)
    const cutoffStart = subDays(new Date(), days * 2).getTime()
    const cutoffEnd = subDays(new Date(), days).getTime()
    return reviews.filter((r) => r.createdAt >= cutoffStart && r.createdAt < cutoffEnd)
  }, [reviews, timeRange])

  const previousAvgScore = previousPeriodReviews.length > 0
    ? previousPeriodReviews.reduce((sum, r) => sum + (r.score ?? 0), 0) / previousPeriodReviews.length
    : null

  const scoreTrend = avgScore !== null && previousAvgScore !== null
    ? avgScore - previousAvgScore
    : null

  const reviewsTrend = previousPeriodReviews.length > 0
    ? totalReviews - previousPeriodReviews.length
    : null

  const previousIssues = previousPeriodReviews.reduce((sum, r) => sum + r.errorCount + r.warningCount + r.suggestionCount, 0)
  const issuesTrend = previousIssues > 0 ? totalIssues - previousIssues : null

  const trendData = useMemo(() => {
    const days = timeRange === 'all' ? 30 : parseInt(timeRange)
    const map = new Map<string, { sum: number; count: number }>()
    for (let i = days - 1; i >= 0; i--) {
      map.set(format(subDays(new Date(), i), 'MM/dd'), { sum: 0, count: 0 })
    }
    filteredReviews.forEach((r) => {
      const key = format(new Date(r.createdAt), 'MM/dd')
      if (map.has(key)) {
        const e = map.get(key)!
        e.sum += r.score ?? 0
        e.count += 1
      }
    })
    return Array.from(map.entries()).map(([date, { sum, count }]) => ({
      date,
      avgScore: count > 0 ? parseFloat((sum / count).toFixed(1)) : null,
    }))
  }, [filteredReviews, timeRange])

  const issueDistribution = useMemo(() => [
    { type: 'error' as const, count: filteredReviews.reduce((s, r) => s + r.errorCount, 0) },
    { type: 'warning' as const, count: filteredReviews.reduce((s, r) => s + r.warningCount, 0) },
    { type: 'suggestion' as const, count: filteredReviews.reduce((s, r) => s + r.suggestionCount, 0) },
  ], [filteredReviews])

  const lowScoreProjects = useMemo(() => {
    const m = new Map<string, { sum: number; count: number; name: string }>()
    filteredReviews.forEach((r) => {
      const p = projects.find((p) => p.id === r.projectId)
      if (!p) return
      const e = m.get(r.projectId) ?? { sum: 0, count: 0, name: p.name }
      e.sum += r.score ?? 0; e.count += 1
      m.set(r.projectId, e)
    })
    return Array.from(m.entries())
      .map(([projectId, { sum, count, name }]) => ({ projectId, projectName: name, score: parseFloat((sum / count).toFixed(1)) }))
      .sort((a, b) => a.score - b.score).slice(0, 5)
  }, [filteredReviews, projects])

  return (
    <div className="space-y-5 pb-12">

      {/* ── 操作按钮 + 时间筛选 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('review')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            <GitPullRequest size={14} />
            {t('dashboard.startReview')}
          </button>
          <button
            onClick={() => navigate('projects')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[hsl(var(--secondary))]"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
          >
            <FolderGit2 size={14} />
            {projects.length === 0 ? t('dashboard.addFirstProject') : t('dashboard.manageProjects')}
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1 py-1">
          {(['7', '30', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md text-sm transition-all ${
                timeRange === range
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {range === 'all' ? '全部' : `近 ${range} 天`}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4 个等大统计卡片 ── */}
      <div className="grid grid-cols-4 gap-4">

        {/* 平均评分 */}
        <div className="rounded-xl p-5 bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/20 border border-violet-200/50 dark:border-violet-800/30 hover:shadow-lg transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-500/10">
                <Star size={14} className="text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-xs font-medium text-violet-600/70 dark:text-violet-400/70">平均评分</span>
            </div>
            {scoreTrend !== null && (
              <div className={`flex items-center gap-0.5 text-xs font-medium ${
                scoreTrend > 0 ? 'text-emerald-600' : scoreTrend < 0 ? 'text-red-600' : 'text-gray-400'
              }`}>
                {scoreTrend > 0 ? '↑' : scoreTrend < 0 ? '↓' : '→'}
                <span>{Math.abs(scoreTrend).toFixed(1)}</span>
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-violet-600 dark:text-violet-400">
              {avgScore !== null ? avgScore.toFixed(1) : '—'}
            </span>
            {avgScore !== null && (
              <span className="text-lg text-violet-400 dark:text-violet-500">/100</span>
            )}
          </div>
        </div>

        {/* 问题总数 */}
        <div className="rounded-xl p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 hover:shadow-lg transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-medium text-amber-600/70 dark:text-amber-400/70">问题总数</span>
            </div>
            {issuesTrend !== null && (
              <div className={`flex items-center gap-0.5 text-xs font-medium ${
                issuesTrend < 0 ? 'text-emerald-600' : issuesTrend > 0 ? 'text-red-600' : 'text-gray-400'
              }`}>
                {issuesTrend < 0 ? '↓' : issuesTrend > 0 ? '↑' : '→'}
                <span>{Math.abs(issuesTrend)}</span>
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-amber-900 dark:text-amber-100">{totalIssues}</span>
            <span className="text-lg text-amber-600/50 dark:text-amber-400/50">个</span>
          </div>
        </div>

        {/* 审查次数 */}
        <div className="rounded-xl p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 hover:shadow-lg transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <GitPullRequest size={14} className="text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70">审查次数</span>
            </div>
            {reviewsTrend !== null && (
              <div className={`flex items-center gap-0.5 text-xs font-medium ${
                reviewsTrend > 0 ? 'text-emerald-600' : reviewsTrend < 0 ? 'text-red-600' : 'text-gray-400'
              }`}>
                {reviewsTrend > 0 ? '↑' : reviewsTrend < 0 ? '↓' : '→'}
                <span>{Math.abs(reviewsTrend)}</span>
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-blue-900 dark:text-blue-100">{totalReviews}</span>
            <span className="text-lg text-blue-600/50 dark:text-blue-400/50">次</span>
          </div>
        </div>

        {/* 项目总数 */}
        <div className="rounded-xl p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30 hover:shadow-lg transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <FolderGit2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70">项目总数</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-emerald-900 dark:text-emerald-100">{projects.length}</span>
            <span className="text-lg text-emerald-600/50 dark:text-emerald-400/50">个</span>
          </div>
        </div>
      </div>

      {/* ── 图表 2x2 网格 ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* 评分趋势 */}
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp size={14} style={{ color: '#8B5CF6' }} />
            <span className="text-sm font-semibold">评分趋势</span>
          </div>
          {isLoadingReviews ? (
            <div className="h-[200px] flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <TrendChart data={trendData.filter((d) => d.avgScore !== null) as { date: string; avgScore: number }[]} />
          )}
        </div>

        {/* 问题分布 */}
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertCircle size={14} style={{ color: '#F59E0B' }} />
            <span className="text-sm font-semibold">问题分布</span>
          </div>
          {isLoadingReviews ? (
            <div className="h-[200px] flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <IssueDistributionChart data={issueDistribution} />
          )}
        </div>

        {/* 项目健康度 */}
        {lowScoreProjects.length > 0 && (
          <>
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-1.5 mb-3">
                <FolderGit2 size={14} style={{ color: '#D97706' }} />
                <span className="text-sm font-semibold">项目健康度</span>
              </div>
              <ProjectHealthChart data={lowScoreProjects} />
            </div>

            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingUp size={14} style={{ color: '#8B5CF6' }} />
                <span className="text-sm font-semibold">审查历史</span>
              </div>
              <div className="h-[200px] flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                暂无数据
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
