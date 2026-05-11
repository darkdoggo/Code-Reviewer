import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, BookOpen, Shield, Zap, Layers, FileCode2, Database, AlertTriangle, Code2, X, ExternalLink, FolderGit2, GitBranch, FileCode, Clock, ArrowRight, History, Globe, ChevronDown, ChevronRight } from 'lucide-react'
import type { KnowledgeItem } from '@shared/types/knowledge'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  security: Shield,
  performance: Zap,
  architecture: Layers,
  'type-safety': FileCode2,
  'code-quality': Code2,
  complexity: Database,
  robustness: AlertTriangle
}

const CATEGORY_COLORS: Record<string, string> = {
  security: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
  performance: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300',
  architecture: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
  'type-safety': 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  'code-quality': 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300',
  complexity: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300',
  robustness: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
}

// Detail Modal Component
function KnowledgeDetailModal({ item, onClose }: { item: KnowledgeItem; onClose: () => void }) {
  const { t } = useTranslation('pages')
  const Icon = CATEGORY_ICONS[item.category] || Code2

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-[hsl(var(--border))]">
          <div className="p-2.5 bg-[hsl(var(--primary))] rounded-xl shrink-0">
            <Icon className="w-5 h-5 text-[hsl(var(--primary-foreground))]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{item.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>
                {t(`learning.categories.${item.category}`)}
              </span>
              {item.source === 'history' && item.frequency && (
                <span className="text-[10px] px-2 py-0.5 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] rounded-full font-medium">
                  出现 {item.frequency} 次
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] rounded-full">
                {item.source === 'history' ? '来自审查历史' : item.source === 'local' ? '本地知识库' : '远程知识库'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">问题描述</h3>
            <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">{item.description}</p>
          </div>

          {/* Fullstack Tip */}
          {item.fullstackTip && (
            <div>
              <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" />
                全栈工程师建议
              </h3>
              <div className="bg-[hsl(var(--secondary))]/50 rounded-xl p-4 border border-[hsl(var(--border))] markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.fullstackTip}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Related Review Records */}
          {item.source === 'history' && item.references && item.references.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                相关审查记录
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                该问题在以下审查中出现过 {item.frequency} 次
              </p>
              <div className="space-y-2">
                {item.references.slice(0, 3).map((ref, i) => (
                  <div
                    key={`${ref.reviewId}-${i}`}
                    className="border border-[hsl(var(--border))] rounded-lg p-3 hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--secondary))]/30 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                      <span className="text-sm font-medium">{ref.projectName}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        {ref.branch}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileCode className="w-3 h-3" />
                        {ref.file}:{ref.line}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(ref.reviewedAt), { addSuffix: true, locale: zhCN })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {item.references.length > 3 && (
                <div className="mt-2 text-center">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    还有 {item.references.length - 3} 条记录
                    <ArrowRight className="w-3 h-3 inline ml-1" />
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export function LearningPage() {
  const { t } = useTranslation('pages')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false)

  useEffect(() => {
    loadKnowledgeBase()
  }, [])

  const loadKnowledgeBase = async () => {
    try {
      setIsLoading(true)
      const data = await window.api.getKnowledgeBase()
      setItems(data)
    } catch (err) {
      console.error('Failed to load knowledge base:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const categories = [
    { key: 'all', label: '全部' },
    { key: 'security', label: '安全' },
    { key: 'performance', label: '性能' },
    { key: 'architecture', label: '架构' },
    { key: 'code-quality', label: '代码质量' },
    { key: 'type-safety', label: '类型安全' },
    { key: 'complexity', label: '复杂度' },
    { key: 'robustness', label: '健壮性' },
  ]

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--background))]">
      {/* Detail Modal */}
      {selectedItem && (
        <KnowledgeDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      <header className="px-6 py-5 border-b border-[hsl(var(--border))]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[hsl(var(--primary))]" />
            <h1 className="text-xl font-semibold tracking-tight">{t('learning.title')}</h1>
          </div>
          <button
            onClick={loadKnowledgeBase}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 rounded-lg transition-colors"
          >
            {t('learning.refresh')}
          </button>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t('learning.description')}
        </p>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder={t('learning.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            />
          </div>

          {isLoading && (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
              {t('learning.loading', { defaultValue: '加载中...' })}
            </div>
          )}

          {!isLoading && (() => {
            const knowledgeItems = filteredItems.filter(i => i.source === 'local' || i.source === 'remote')
            const historyItems = filteredItems.filter(i => i.source === 'history')
            const hasFilter = searchQuery || activeCategory !== 'all'

            const renderCard = (item: (typeof filteredItems)[0]) => {
              const Icon = CATEGORY_ICONS[item.category] || Code2
              const isHistory = item.source === 'history'
              const isLocal = item.source === 'local'
              const sourceConfig = isHistory
                ? { label: '审查学习', icon: History, bg: 'bg-[hsl(var(--primary))]/10', text: 'text-[hsl(var(--primary))]', border: 'border-l-[hsl(var(--primary))]', iconBg: 'bg-[hsl(var(--primary))]' }
                : isLocal
                ? { label: '知识库', icon: Database, bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-600 dark:text-green-400', border: 'border-l-green-400', iconBg: 'bg-green-500' }
                : { label: '远程', icon: Globe, bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-l-blue-400', iconBg: 'bg-blue-500' }
              return (
                <div
                  key={item.id}
                  className={`border border-[hsl(var(--border))] border-l-2 ${sourceConfig.border} rounded-xl p-4 bg-[hsl(var(--card))] hover:shadow-md transition-all cursor-pointer group`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 ${sourceConfig.iconBg} rounded-lg shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight group-hover:text-[hsl(var(--primary))] transition-colors">{item.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${sourceConfig.bg} ${sourceConfig.text}`}>
                          <sourceConfig.icon className="w-2.5 h-2.5" />
                          {sourceConfig.label}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>
                          {t(`learning.categories.${item.category}`)}
                        </span>
                        {isHistory && item.frequency && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] rounded-full font-medium">
                            出现 {item.frequency} 次
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </div>
                </div>
              )
            }

            if (filteredItems.length === 0) {
              return (
                <div className="text-center py-16">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-40" />
                  <p className="text-sm font-medium mb-1">
                    {searchQuery || activeCategory !== 'all' ? '没有找到匹配的内容' : '暂无学习内容'}
                  </p>
                  {!searchQuery && activeCategory === 'all' && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs mx-auto mt-1">
                      完成代码审查后，系统会自动从审查结果中提取高频问题，生成学习内容
                    </p>
                  )}
                </div>
              )
            }

            return (
              <div className="space-y-8">
                {/* Section 1: Review Learning (上方，默认展开) */}
                <div>
                  <button
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="flex items-center gap-2 mb-3 w-full hover:opacity-70 transition-opacity"
                  >
                    {historyExpanded ? <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
                    <History className="w-4 h-4 text-[hsl(var(--primary))]" />
                    <h2 className="text-sm font-semibold">🔍 审查学习</h2>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] px-2 py-0.5 rounded-full">{historyItems.length} 条</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">来自历史审查</span>
                  </button>
                  <div className="h-px bg-[hsl(var(--border))] mb-4" />
                  {historyExpanded && (
                    historyItems.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {historyItems.map(renderCard)}
                      </div>
                    ) : (
                      <div className="text-center py-8 rounded-xl border border-dashed border-[hsl(var(--border))]">
                        <History className="w-8 h-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))] opacity-40" />
                        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">暂无审查学习内容</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs mx-auto mt-1 opacity-70">
                          完成更多代码审查后，系统会自动从高频问题中提取学习内容
                        </p>
                      </div>
                    )
                  )}
                </div>

                {/* Section 2: Knowledge Base Articles (下方，默认收起) */}
                <div>
                  <button
                    onClick={() => setKnowledgeExpanded(!knowledgeExpanded)}
                    className="flex items-center gap-2 mb-3 w-full hover:opacity-70 transition-opacity"
                  >
                    {knowledgeExpanded ? <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
                    <Database className="w-4 h-4 text-green-500" />
                    <h2 className="text-sm font-semibold">📚 知识库文章</h2>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] px-2 py-0.5 rounded-full">{knowledgeItems.length} 篇</span>
                  </button>
                  <div className="h-px bg-[hsl(var(--border))] mb-4" />
                  {knowledgeExpanded && (
                    knowledgeItems.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {knowledgeItems.map(renderCard)}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                        <p className="text-sm">{hasFilter ? '没有匹配的知识库文章' : '暂无知识库文章'}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
