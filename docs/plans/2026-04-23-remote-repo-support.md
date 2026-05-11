# Remote Repository Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to add and review GitHub/GitLab remote repositories directly without manual cloning.

**Architecture:** Create a RemoteGitService that clones remote repositories to a temporary directory (os.tmpdir/reviewer-agent-clones). Update the add-project IPC handler to accept a type parameter ('local' | 'github' | 'gitlab') and handle remote URLs by cloning them first. Add a refresh-project handler to pull latest changes. Update the Projects page UI to include an "Add Remote" button with a form for entering remote repository URLs.

**Tech Stack:** simple-git, Node.js fs/path/os, React, Electron IPC

---

## Task 1: Create RemoteGitService

**Files:**
- Create: `src/main/services/remote-git.ts`
- Verify: `npm run typecheck`

**Step 1: Create the service**

Create `src/main/services/remote-git.ts`:

```typescript
import simpleGit from 'simple-git'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export class RemoteGitService {
  private cloneDir: string

  constructor() {
    this.cloneDir = path.join(os.tmpdir(), 'reviewer-agent-clones')
  }

  async cloneOrPull(remoteUrl: string, projectId: string): Promise<string> {
    const localPath = path.join(this.cloneDir, projectId)

    try {
      await fs.access(localPath)
      // Already cloned — pull latest
      const git = simpleGit(localPath)
      await git.pull()
      return localPath
    } catch {
      // Clone fresh
      await fs.mkdir(this.cloneDir, { recursive: true })
      await simpleGit().clone(remoteUrl, localPath, ['--depth', '50'])
      return localPath
    }
  }

  async cleanup(projectId: string): Promise<void> {
    const localPath = path.join(this.cloneDir, projectId)
    await fs.rm(localPath, { recursive: true, force: true })
  }

  getClonePath(projectId: string): string {
    return path.join(this.cloneDir, projectId)
  }
}
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 3: Commit**

```bash
git add src/main/services/remote-git.ts
git commit -m "feat: add RemoteGitService for cloning remote repos"
```

---

## Task 2: Update IPC Types and Handlers

**Files:**
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Verify: `npm run typecheck`

**Step 1: Update IPC types**

In `src/shared/types/ipc.ts`, update the `addProject` signature and add `refreshProject`:

```typescript
export interface ElectronAPI {
  // ... existing methods
  
  addProject(name: string, pathOrUrl: string, type?: 'local' | 'github' | 'gitlab'): Promise<Project>
  refreshProject(projectId: string): Promise<void>
}
```

**Step 2: Update add-project handler**

In `src/main/ipc-handlers.ts`, update the handler:

```typescript
  ipcMain.handle('add-project', async (_e, name: string, pathOrUrl: string, type: 'local' | 'github' | 'gitlab' = 'local') => {
    const id = nanoid()
    let localPath = pathOrUrl

    if (type !== 'local') {
      // Clone remote repository
      localPath = await remoteGit.cloneOrPull(pathOrUrl, id)
    }

    const project: Project = {
      id,
      name,
      type,
      path: localPath,
      remoteUrl: type !== 'local' ? pathOrUrl : undefined,
      createdAt: Date.now(),
    }
    return db.addProject(project)
  })
```

**Step 3: Add refresh-project handler**

In `src/main/ipc-handlers.ts`, add:

```typescript
  ipcMain.handle('refresh-project', async (_e, projectId: string) => {
    const project = db.getProject(projectId)
    if (!project || project.type === 'local') return
    
    await remoteGit.cloneOrPull(project.remoteUrl!, projectId)
  })
```

**Step 4: Instantiate RemoteGitService in main/index.ts**

```typescript
import { RemoteGitService } from './services/remote-git'

// After other service initialization:
const remoteGit = new RemoteGitService()

// Pass to registerIpcHandlers
registerIpcHandlers(git, db, config, reviewEngine, staticAnalyzer, bridgeChecker, contextBuilder, knowledgeService, remoteGit)
```

**Step 5: Update preload**

In `src/preload/index.ts`, update:

```typescript
  addProject: (name: string, pathOrUrl: string, type?: 'local' | 'github' | 'gitlab') => 
    ipcRenderer.invoke('add-project', name, pathOrUrl, type),
  refreshProject: (projectId: string) => ipcRenderer.invoke('refresh-project', projectId),
```

**Step 6: Commit**

```bash
git add src/shared/types/ipc.ts src/main/ipc-handlers.ts src/main/index.ts src/preload/index.ts
git commit -m "feat: update IPC handlers to support remote repositories"
```

---

## Task 3: Update Projects Page UI

**Files:**
- Modify: `src/renderer/src/pages/ProjectsPage.tsx`
- Modify: `src/renderer/src/store/index.ts`
- Modify: `src/renderer/src/locales/en/pages.json`
- Modify: `src/renderer/src/locales/zh/pages.json`
- Verify: `npm run typecheck && npm run build`

**Step 1: Add translations**

In `src/renderer/src/locales/en/pages.json`, add under `"projects"`:

```json
    "addRemote": "Add Remote",
    "remoteUrl": "Repository URL",
    "remoteUrlPlaceholder": "https://github.com/owner/repo",
    "repoType": "Repository Type",
    "github": "GitHub",
    "gitlab": "GitLab",
    "refreshing": "Refreshing...",
    "refresh": "Refresh"
```

In `src/renderer/src/locales/zh/pages.json`, add under `"projects"`:

```json
    "addRemote": "添加远程仓库",
    "remoteUrl": "仓库 URL",
    "remoteUrlPlaceholder": "https://github.com/owner/repo",
    "repoType": "仓库类型",
    "github": "GitHub",
    "gitlab": "GitLab",
    "refreshing": "刷新中...",
    "refresh": "刷新"
```

**Step 2: Update store**

In `src/renderer/src/store/index.ts`, update the `addProject` method signature and add `refreshProject`:

```typescript
  addProject: (name: string, pathOrUrl: string, type?: 'local' | 'github' | 'gitlab') => Promise<Project>
  refreshProject: (projectId: string) => Promise<void>
```

Implementation:

```typescript
  addProject: async (name, pathOrUrl, type = 'local') => {
    try {
      set({ error: null })
      const project = await window.api.addProject(name, pathOrUrl, type)
      set((state) => ({ projects: [...state.projects, project] }))
      return project
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to add project'
      set({ error })
      throw err
    }
  },

  refreshProject: async (projectId) => {
    try {
      set({ error: null })
      await window.api.refreshProject(projectId)
      // Reload projects to get updated info
      await get().loadProjects()
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to refresh project'
      set({ error })
      throw err
    }
  },
```

**Step 3: Update ProjectsPage component**

In `src/renderer/src/pages/ProjectsPage.tsx`:

- Import `Globe` and `RefreshCw` icons from `lucide-react`
- Add state for remote form:

```typescript
  const [showRemoteForm, setShowRemoteForm] = useState(false)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [repoType, setRepoType] = useState<'github' | 'gitlab'>('github')
  const [isAddingRemote, setIsAddingRemote] = useState(false)
```

- Add remote form UI after the "Add Project" button:

```tsx
        <button
          onClick={() => setShowRemoteForm(!showRemoteForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] border border-[hsl(var(--border))] rounded-md transition-colors"
        >
          <Globe size={14} />
          {t('projects.addRemote')}
        </button>

      {showRemoteForm && (
        <div className="mt-4 p-4 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
          <h3 className="text-sm font-medium mb-3">{t('projects.addRemote')}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">
                {t('projects.remoteUrl')}
              </label>
              <input
                type="text"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder={t('projects.remoteUrlPlaceholder')}
                className="w-full px-3 py-1.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">
                {t('projects.repoType')}
              </label>
              <select
                value={repoType}
                onChange={(e) => setRepoType(e.target.value as 'github' | 'gitlab')}
                className="w-full px-3 py-1.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              >
                <option value="github">{t('projects.github')}</option>
                <option value="gitlab">{t('projects.gitlab')}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddRemote}
                disabled={!remoteUrl || isAddingRemote}
                className="flex-1 px-3 py-1.5 text-sm bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] rounded-md transition-colors disabled:opacity-50"
              >
                {isAddingRemote ? t('common.adding') : t('common.add')}
              </button>
              <button
                onClick={() => {
                  setShowRemoteForm(false)
                  setRemoteUrl('')
                }}
                className="px-3 py-1.5 text-sm bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] border border-[hsl(var(--border))] rounded-md transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
```

- Add handler function:

```typescript
  const handleAddRemote = async () => {
    if (!remoteUrl) return
    
    try {
      setIsAddingRemote(true)
      // Extract repo name from URL
      const repoName = remoteUrl.split('/').pop()?.replace('.git', '') || 'Remote Repo'
      await addProject(repoName, remoteUrl, repoType)
      setShowRemoteForm(false)
      setRemoteUrl('')
    } catch (err) {
      console.error('Failed to add remote project:', err)
    } finally {
      setIsAddingRemote(false)
    }
  }
```

- Add refresh button to project cards (for remote projects):

```tsx
              {project.type !== 'local' && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    await refreshProject(project.id)
                  }}
                  className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded transition-colors"
                  title={t('projects.refresh')}
                >
                  <RefreshCw size={14} />
                </button>
              )}
```

**Step 4: Commit**

```bash
git add src/renderer/src/pages/ProjectsPage.tsx src/renderer/src/store/index.ts src/renderer/src/locales/
git commit -m "feat: add remote repository UI to Projects page"
```

---

## Execution Order

```
Task 1 (RemoteGitService) → Task 2 (IPC handlers) → Task 3 (UI)
```

**Total: 3 tasks**

---

## Testing Strategy

After implementation:
1. Click "Add Remote" button
2. Enter a public GitHub repo URL (e.g., https://github.com/facebook/react)
3. Select "GitHub" as type
4. Click Add - should clone the repo to temp directory
5. Verify the project appears in the list with a remote badge
6. Click the refresh button - should pull latest changes
7. Try starting a review on the remote project

---

## Notes

- Remote repos are cloned to `os.tmpdir()/reviewer-agent-clones/`
- Clones are shallow (--depth 50) to save space
- The refresh button pulls latest changes without re-cloning
- For private repos, users would need to configure git credentials separately (future enhancement)
