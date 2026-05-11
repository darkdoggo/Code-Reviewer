import { useState, useEffect } from 'react'
import { useReviewerStore } from '../store'
import { FolderOpen, Trash2, GitPullRequest, Plus, Loader2, Globe, RefreshCw, Key, FolderGit2, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { toast } from '../lib/toast'
import { truncatePath } from '../lib/utils'

type AuthType = 'none' | 'token' | 'userpass' | 'ssh'

export function ProjectsPage() {
  const { projects, loadProjects, addProject, deleteProject, refreshProject, selectProject, navigate, isLoadingProjects } = useReviewerStore()
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showRemoteForm, setShowRemoteForm] = useState(false)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [repoType, setRepoType] = useState<'github' | 'gitlab'>('github')
  const [isAddingRemote, setIsAddingRemote] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [authType, setAuthType] = useState<AuthType>('none')
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { t } = useTranslation('pages')

  useEffect(() => { loadProjects() }, [])

  // Reset auth type options when repo type changes
  useEffect(() => {
    setAuthType('none')
    setToken('')
    setUsername('')
    setPassword('')
  }, [repoType])

  const resetForm = () => {
    setShowRemoteForm(false)
    setRemoteUrl('')
    setRepoType('github')
    setRemoteError(null)
    setAuthType('none')
    setToken('')
    setUsername('')
    setPassword('')
  }

  const handleAdd = async () => {
    setAdding(true)
    try {
      const dirPath = await window.api.selectDirectory()
      if (!dirPath) return
      const gitInfo = await window.api.getGitInfo(dirPath)
      if (!gitInfo.isRepo) {
        toast.userError(t('projects.notGitRepo'))
        return
      }
      const name = dirPath.split('/').pop() ?? dirPath
      await addProject(name, dirPath)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('projects.deleteConfirm'))) return
    setDeletingId(id)
    try {
      await deleteProject(id)
    } finally {
      setDeletingId(null)
    }
  }

  const handleReview = (id: string) => {
    selectProject(id)
    navigate('review')
  }

  const buildAuthUrl = (): string => {
    try {
      const url = new URL(remoteUrl)
      switch (authType) {
        case 'token':
          if (repoType === 'github') {
            // GitHub: https://<token>@github.com/owner/repo.git
            url.username = token
            url.password = ''
          } else {
            // GitLab: https://oauth2:<token>@gitlab.com/owner/repo.git
            url.username = 'oauth2'
            url.password = token
          }
          break
        case 'userpass':
          url.username = encodeURIComponent(username)
          url.password = encodeURIComponent(password)
          break
        default:
          return remoteUrl
      }
      return url.toString()
    } catch {
      return remoteUrl
    }
  }

  const handleAddRemote = async () => {
    if (!remoteUrl) return

    const urlPattern = /^https?:\/\/.+\/.+/
    if (!urlPattern.test(remoteUrl)) {
      setRemoteError(t('projects.invalidUrl'))
      return
    }

    try {
      setIsAddingRemote(true)
      setRemoteError(null)
      const repoName = remoteUrl.split('/').pop()?.replace('.git', '') || 'Remote Repo'
      const urlWithAuth = buildAuthUrl()

      await addProject(repoName, urlWithAuth, repoType)
      resetForm()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      if (errorMsg.includes('timeout') || errorMsg.includes('Connection timeout')) {
        setRemoteError(t('projects.timeoutError'))
      } else if (errorMsg.includes('Authentication') || errorMsg.includes('authentication') || errorMsg.includes('could not read Username')) {
        setRemoteError(t('projects.authError'))
      } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        setRemoteError(t('projects.repoNotFound'))
      } else if (errorMsg.includes('network')) {
        setRemoteError(t('projects.networkError'))
      } else {
        setRemoteError(t('projects.cloneError', { error: errorMsg }))
      }
      console.error('Failed to add remote project:', err)
    } finally {
      setIsAddingRemote(false)
    }
  }

  const authOptions = repoType === 'github'
    ? [
        { value: 'none', label: t('projects.authNone') },
        { value: 'token', label: t('projects.authGithubToken') },
        { value: 'userpass', label: t('projects.authUserPass') },
      ]
    : [
        { value: 'none', label: t('projects.authNone') },
        { value: 'token', label: t('projects.authGitlabToken') },
        { value: 'userpass', label: t('projects.authUserPass') },
      ]

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('projects.title')}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRemoteForm(!showRemoteForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg transition-colors"
          >
            <Globe size={14} />
            {t('projects.addRemote')}
          </button>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t('projects.addProject')}
          </button>
        </div>
      </div>

      {showRemoteForm && (
        <div className="p-5 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">{t('projects.addRemote')}</h3>
            <button onClick={resetForm} disabled={isAddingRemote} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50">✕</button>
          </div>

          <div className="space-y-3">
            {/* URL */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block font-medium">{t('projects.remoteUrl')}</label>
              <input
                type="text"
                value={remoteUrl}
                onChange={(e) => { setRemoteUrl(e.target.value); setRemoteError(null) }}
                placeholder={t('projects.remoteUrlPlaceholder')}
                disabled={isAddingRemote}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] disabled:opacity-50 transition-all"
              />
            </div>

            {/* Repo type */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block font-medium">{t('projects.repoType')}</label>
              <select
                value={repoType}
                onChange={(e) => setRepoType(e.target.value as 'github' | 'gitlab')}
                disabled={isAddingRemote}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] disabled:opacity-50 transition-all"
              >
                <option value="github">{t('projects.github')}</option>
                <option value="gitlab">{t('projects.gitlab')}</option>
              </select>
            </div>

            {/* Auth section */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-1.5 mb-2">
                <Key size={12} className="text-gray-400" />
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('projects.authMethod')}</label>
              </div>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as AuthType)}
                disabled={isAddingRemote}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] disabled:opacity-50 transition-all"
              >
                {authOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* Token input */}
              {authType === 'token' && (
                <div className="mt-2">
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={repoType === 'github' ? t('projects.githubTokenPlaceholder') : t('projects.gitlabTokenPlaceholder')}
                    disabled={isAddingRemote}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] disabled:opacity-50 transition-all"
                  />
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    {repoType === 'github' ? t('projects.githubTokenHint') : t('projects.gitlabTokenHint')}
                  </p>
                </div>
              )}

              {/* Username + Password */}
              {authType === 'userpass' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('projects.username')}
                    disabled={isAddingRemote}
                    className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] disabled:opacity-50 transition-all"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('projects.password')}
                    disabled={isAddingRemote}
                    className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] disabled:opacity-50 transition-all"
                  />
                </div>
              )}
            </div>

            {/* Error */}
            {remoteError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 whitespace-pre-line">
                {remoteError}
              </div>
            )}

            {/* Loading */}
            {isAddingRemote && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                {t('projects.cloning')}
              </div>
            )}

            {/* Hint */}
            <p className="text-xs text-gray-400">{t('projects.remoteHint')}</p>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddRemote}
                disabled={!remoteUrl || isAddingRemote}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              >
                {isAddingRemote ? (
                  <><Loader2 size={14} className="animate-spin" />{t('projects.cloning')}</>
                ) : (
                  <><Plus size={14} />{t('common.add', { defaultValue: 'Add' })}</>
                )}
              </button>
              <button
                onClick={resetForm}
                disabled={isAddingRemote}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoadingProjects ? (
        <p className="text-sm text-gray-500">{t('projects.loading')}</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center bg-white dark:bg-gray-900">
          <FolderOpen size={56} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('projects.emptyHint')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">添加本地 Git 仓库或克隆远程仓库开始审查</p>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t('projects.addProject')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-lg hover:border-[hsl(var(--primary))]/50 dark:hover:border-[hsl(var(--primary))]/50 transition-all cursor-pointer"
              onClick={() => handleReview(project.id)}
            >
              {/* Project icon + type badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--primary))' }}>
                  <FolderGit2 size={20} style={{ color: 'hsl(var(--primary-foreground))' }} />
                </div>
                {project.type !== 'local' && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                    {project.type === 'github' ? 'GitHub' : 'GitLab'}
                  </span>
                )}
              </div>

              {/* Project name */}
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 mb-1 truncate" title={project.name}>
                {project.name}
              </h3>

              {/* Project path */}
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-3" title={project.path}>
                {truncatePath(project.path)}
              </p>

              {/* Last review time */}
              {project.lastReviewAt && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                  <Clock size={11} />
                  <span>{formatDistanceToNow(project.lastReviewAt, { addSuffix: true })}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                {project.type !== 'local' && (
                  <button
                    onClick={async (e) => { e.stopPropagation(); await refreshProject(project.id) }}
                    className="p-1.5 text-gray-400 hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-light))] dark:hover:bg-[hsl(var(--primary))]/10 rounded-lg transition-colors"
                    title={t('projects.refresh')}
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleReview(project.id) }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--primary))] text-[hsl(var(--primary))] text-xs font-medium hover:bg-[hsl(var(--primary-light))] dark:hover:bg-[hsl(var(--primary))]/10 transition-colors"
                >
                  <GitPullRequest size={13} />
                  {t('projects.review')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(project.id) }}
                  disabled={deletingId === project.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                  title={t('projects.delete')}
                >
                  {deletingId === project.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
