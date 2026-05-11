# Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-model LLM support (OpenAI), ts-morph static analysis, Bridge Type Checker, and GitHub/GitLab remote repo support.

**Architecture:** Refactor LLMService into a provider-based factory pattern. Add a StaticAnalyzer service using ts-morph that runs alongside LLM review and merges results. Add a BridgeTypeChecker that detects frontend/backend type mismatches. Add a RemoteGitService that clones GitHub/GitLab repos to a temp directory and delegates to the existing GitService.

**Tech Stack:** TypeScript, Electron, ts-morph, openai SDK, @octokit/rest, simple-git, Zustand, React

---

## Feature A: Multi-Model LLM Support

### Task A1: Widen LLMConfig type to support multiple providers

**Files:**
- Modify: `src/shared/types/config.ts`
- Modify: `src/shared/schemas.ts`
- Verify: `npm run typecheck`

**Step 1: Update the LLMConfig interface**

In `src/shared/types/config.ts`, change:

```ts
export interface LLMConfig {
  provider: 'anthropic' | 'openai'
  model: string
  apiKey: string
  baseUrl?: string
  temperature: number
  maxTokens: number
}
```

**Step 2: Update the Zod schema if it validates provider**

In `src/shared/schemas.ts`, update the provider field to `z.enum(['anthropic', 'openai'])`.

**Step 3: Run verification**

Run: `npm run typecheck`

Expected: TypeScript errors in LLMService and SettingsPage where `provider` is hardcoded to `'anthropic'`. These will be fixed in subsequent tasks.

**Step 4: Commit**

```bash
git add src/shared/types/config.ts src/shared/schemas.ts
git commit -m "feat: widen LLMConfig to support multiple providers"
```

### Task A2: Create LLM provider abstraction

**Files:**
- Create: `src/main/services/llm/types.ts`
- Create: `src/main/services/llm/anthropic-provider.ts`
- Create: `src/main/services/llm/openai-provider.ts`
- Create: `src/main/services/llm/provider-factory.ts`
- Verify: `npm run typecheck`

**Step 1: Define the provider interface**

Create `src/main/services/llm/types.ts`:

```ts
import type { LLMConfig } from '@shared/types'

export interface ReviewResult {
  result: import('@shared/types').ReviewResult
  tokenUsed: number
}

export interface LLMProvider {
  configure(config: LLMConfig): void
  isConfigured(): boolean
  testConnection(): Promise<{ success: boolean; error?: string }>
  review(diff: string, projectContext?: string): Promise<ReviewResult>
}
```

**Step 2: Extract existing Anthropic logic into AnthropicProvider**

Create `src/main/services/llm/anthropic-provider.ts`. Move the existing logic from `src/main/services/llm.ts` into a class that implements `LLMProvider`. Keep the same system prompt and response parsing.

**Step 3: Create OpenAI provider**

Create `src/main/services/llm/openai-provider.ts`. Implement `LLMProvider` using the `openai` SDK. Use the same system prompt and JSON response format. Map the response to the same `ReviewResultSchema`.

```ts
import OpenAI from 'openai'
import type { LLMProvider, ReviewResult } from './types'
import type { LLMConfig } from '@shared/types'
import { ReviewResultSchema } from '@shared/schemas'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null
  private config: LLMConfig | null = null

  configure(config: LLMConfig): void {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    })
  }

  isConfigured(): boolean {
    return !!this.client && !!this.config?.apiKey
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client || !this.config) return { success: false, error: 'Not configured' }
    try {
      await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Connection failed' }
    }
  }

  async review(diff: string, projectContext?: string): Promise<ReviewResult> {
    if (!this.client || !this.config) throw new Error('OpenAI not configured')

    const systemPrompt = `...` // Same system prompt as Anthropic provider
    const userPrompt = projectContext
      ? `Project context:\n${projectContext}\n\nDiff to review:\n${diff}`
      : `Diff to review:\n${diff}`

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: { type: 'json_object' },
    })

    const text = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(text)
    const result = ReviewResultSchema.parse(parsed)
    const tokenUsed = response.usage?.total_tokens ?? 0

    return { result, tokenUsed }
  }
}
```

**Step 4: Create provider factory**

Create `src/main/services/llm/provider-factory.ts`:

```ts
import type { LLMProvider } from './types'
import type { LLMConfig } from '@shared/types'
import { AnthropicProvider } from './anthropic-provider'
import { OpenAIProvider } from './openai-provider'

const providers: Record<string, () => LLMProvider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  const factory = providers[config.provider]
  if (!factory) throw new Error(`Unknown LLM provider: ${config.provider}`)
  const provider = factory()
  provider.configure(config)
  return provider
}
```

**Step 5: Run verification**

Run: `npm run typecheck`

Expected: success (old `llm.ts` still exists but is unused — will be removed in next task).

**Step 6: Commit**

```bash
git add src/main/services/llm/
git commit -m "feat: add LLM provider abstraction with Anthropic and OpenAI"
```

### Task A3: Wire provider factory into ReviewEngine and IPC

**Files:**
- Modify: `src/main/services/review-engine.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/index.ts`
- Delete: `src/main/services/llm.ts` (replaced by `llm/` directory)
- Verify: `npm run typecheck`

**Step 1: Update ReviewEngine**

Replace `llm.configure(llmConfig); llm.review(...)` with:

```ts
import { createLLMProvider } from './llm/provider-factory'

// In runReview():
const provider = createLLMProvider(llmConfig)
const { result, tokenUsed } = await provider.review(truncatedDiff)
```

**Step 2: Update IPC handler for test-llm-connection**

```ts
ipcMain.handle('test-llm-connection', async () => {
  const llmConfig = config.getLLMConfig()
  if (!llmConfig.apiKey) return { success: false, error: 'API key not configured' }
  const provider = createLLMProvider(llmConfig)
  return provider.testConnection()
})
```

**Step 3: Update main/index.ts**

Remove the `LLMService` import and instantiation. The `createLLMProvider` is called on-demand, no singleton needed. Remove `llm` from `registerIpcHandlers` params if it was passed.

**Step 4: Delete old llm.ts**

```bash
rm src/main/services/llm.ts
```

**Step 5: Update cost estimation in ReviewEngine**

Add OpenAI model rates to `estimateCost()`:

```ts
const rates: Record<string, number> = {
  'claude-sonnet-4-20250514': 9,
  'claude-opus-4-20250514': 22.5,
  'claude-haiku-4-5-20251001': 2.4,
  'gpt-4o': 7.5,
  'gpt-4o-mini': 0.6,
  'gpt-4-turbo': 30,
}
```

**Step 6: Run verification**

Run: `npm run typecheck`

Expected: success.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire LLM provider factory into ReviewEngine and IPC"
```

### Task A4: Update Settings UI for multi-provider

**Files:**
- Modify: `src/renderer/src/pages/SettingsPage.tsx`
- Verify: `npm run typecheck && npm run build`

**Step 1: Add provider selector and dynamic model list**

Add a `provider` state field. When provider changes, update the model dropdown options:

```ts
const modelOptions: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
}
```

Add a `<select>` for provider before the model select. When provider changes, reset model to the first option of that provider.

**Step 2: Fix model ID inconsistency**

Replace the old hardcoded model values (`claude-opus-4-6`, `claude-sonnet-4-6`) with the correct IDs from the `modelOptions` map above.

**Step 3: Run verification**

Run: `npm run typecheck && npm run build`

Expected: success.

**Step 4: Commit**

```bash
git add src/renderer/src/pages/SettingsPage.tsx
git commit -m "feat: add provider selector and fix model IDs in Settings"
```

---

## Feature B: Static Analysis with ts-morph

### Task B1: Create StaticAnalyzer service

**Files:**
- Create: `src/main/services/static-analyzer.ts`
- Modify: `src/shared/types/models.ts` (add `source` field to ReviewIssue)
- Verify: `npm run typecheck`

**Step 1: Add source field to ReviewIssue**

In `src/shared/types/models.ts`, add to `ReviewIssue`:

```ts
source: 'llm' | 'static' | 'bridge'
```

**Step 2: Create the analyzer**

Create `src/main/services/static-analyzer.ts`:

```ts
import { Project, SyntaxKind } from 'ts-morph'
import type { ReviewIssue, FileDiff } from '@shared/types'
import { nanoid } from 'nanoid'

export class StaticAnalyzer {
  analyze(repoPath: string, diffs: FileDiff[]): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const tsFiles = diffs
      .filter((d) => d.status !== 'deleted')
      .filter((d) => /\.(ts|tsx)$/.test(d.file))

    if (tsFiles.length === 0) return issues

    const project = new Project({
      tsConfigFilePath: `${repoPath}/tsconfig.json`,
      skipAddingFilesFromTsConfig: true,
    })

    for (const diff of tsFiles) {
      const filePath = `${repoPath}/${diff.file}`
      const sourceFile = project.addSourceFileAtPath(filePath)

      // Rule 1: Detect `any` type annotations
      sourceFile.forEachDescendant((node) => {
        if (node.getKind() === SyntaxKind.AnyKeyword) {
          issues.push({
            id: nanoid(),
            reviewId: '',
            file: diff.file,
            line: node.getStartLineNumber(),
            severity: 'warning',
            category: 'type-safety',
            title: 'Explicit `any` type detected',
            description: 'Avoid using `any`. Use a specific type or `unknown` instead.',
            source: 'static',
          })
        }
      })

      // Rule 2: Detect unused imports (via ts-morph diagnostics)
      // Rule 3: Detect console.log statements
      sourceFile.forEachDescendant((node) => {
        if (
          node.getKind() === SyntaxKind.PropertyAccessExpression &&
          node.getText() === 'console.log'
        ) {
          issues.push({
            id: nanoid(),
            reviewId: '',
            file: diff.file,
            line: node.getStartLineNumber(),
            severity: 'suggestion',
            category: 'code-quality',
            title: 'console.log detected',
            description: 'Remove console.log before committing, or use a proper logger.',
            source: 'static',
          })
        }
      })

      // Rule 4: Detect functions with too many parameters (>4)
      sourceFile.getFunctions().forEach((fn) => {
        if (fn.getParameters().length > 4) {
          issues.push({
            id: nanoid(),
            reviewId: '',
            file: diff.file,
            line: fn.getStartLineNumber(),
            severity: 'suggestion',
            category: 'complexity',
            title: `Function "${fn.getName()}" has ${fn.getParameters().length} parameters`,
            description: 'Consider using an options object to reduce parameter count.',
            source: 'static',
          })
        }
      })
    }

    return issues
  }
}
```

**Step 3: Run verification**

Run: `npm run typecheck`

Expected: success.

**Step 4: Commit**

```bash
git add src/main/services/static-analyzer.ts src/shared/types/models.ts
git commit -m "feat: add ts-morph static analyzer service"
```

### Task B2: Integrate StaticAnalyzer into ReviewEngine

**Files:**
- Modify: `src/main/services/review-engine.ts`
- Modify: `src/main/index.ts`
- Verify: `npm run typecheck`

**Step 1: Add StaticAnalyzer to ReviewEngine**

In `ReviewEngine` constructor, accept a `StaticAnalyzer` instance. In `runReview()`, after getting the diff:

```ts
// Run static analysis in parallel with LLM
const [llmResult, staticIssues] = await Promise.all([
  provider.review(truncatedDiff),
  Promise.resolve(this.staticAnalyzer.analyze(project.path, diffs)),
])
```

Merge static issues into the review:
- Set `reviewId` on each static issue
- Concat with LLM issues
- Recalculate error/warning/suggestion counts from the merged list

**Step 2: Instantiate StaticAnalyzer in main/index.ts and pass to ReviewEngine**

**Step 3: Run verification**

Run: `npm run typecheck`

Expected: success.

**Step 4: Commit**

```bash
git add src/main/services/review-engine.ts src/main/index.ts
git commit -m "feat: integrate static analysis into review pipeline"
```

### Task B3: Show issue source badges in UI

**Files:**
- Modify: `src/renderer/src/pages/ReviewPage.tsx`
- Verify: `npm run typecheck && npm run build`

**Step 1: Add source badge to IssueCard**

In the `IssueCard` component, next to the severity icon, add a small badge showing the source:

```tsx
{issue.source && issue.source !== 'llm' && (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
    {issue.source === 'static' ? 'Static' : 'Bridge'}
  </span>
)}
```

**Step 2: Run verification**

Run: `npm run typecheck && npm run build`

Expected: success.

**Step 3: Commit**

```bash
git add src/renderer/src/pages/ReviewPage.tsx
git commit -m "feat: show issue source badges in review results"
```

---

## Feature C: Bridge Type Checker

### Task C1: Create BridgeTypeChecker service

**Files:**
- Create: `src/main/services/bridge-checker.ts`
- Verify: `npm run typecheck`

**Step 1: Create the checker**

Create `src/main/services/bridge-checker.ts`:

This service detects mismatches between frontend API call types and backend handler types. It works by:

1. Scanning for IPC channel definitions in `src/shared/types/ipc.ts`
2. Scanning for `ipcMain.handle(channel, ...)` in main process files
3. Scanning for `window.api.xxx()` calls in renderer files
4. Comparing the parameter and return types using ts-morph's type checker

```ts
import { Project, SyntaxKind, Type } from 'ts-morph'
import type { ReviewIssue } from '@shared/types'
import { nanoid } from 'nanoid'

export class BridgeTypeChecker {
  check(repoPath: string): ReviewIssue[] {
    const issues: ReviewIssue[] = []

    const project = new Project({
      tsConfigFilePath: `${repoPath}/tsconfig.json`,
      skipAddingFilesFromTsConfig: false,
    })

    const ipcFile = project.getSourceFile('**/types/ipc.ts')
    if (!ipcFile) return issues

    // Find the IPC contract interface
    const ipcInterface = ipcFile.getInterface('IpcContract') ?? ipcFile.getInterface('ElectronAPI')
    if (!ipcInterface) return issues

    // Get declared method signatures
    const declaredMethods = new Map<string, { params: string; returnType: string; line: number }>()
    for (const method of ipcInterface.getMethods()) {
      declaredMethods.set(method.getName(), {
        params: method.getParameters().map((p) => p.getType().getText()).join(', '),
        returnType: method.getReturnType().getText(),
        line: method.getStartLineNumber(),
      })
    }

    // Scan main process handlers for mismatches
    const mainFiles = project.getSourceFiles('**/main/**/*.ts')
    for (const file of mainFiles) {
      file.forEachDescendant((node) => {
        if (
          node.getKind() === SyntaxKind.CallExpression &&
          node.getText().includes('ipcMain.handle')
        ) {
          const args = node.asKind(SyntaxKind.CallExpression)?.getArguments()
          if (!args || args.length < 2) return
          const channel = args[0].getText().replace(/['"]/g, '')
          const handler = args[1]

          if (!declaredMethods.has(channel)) {
            issues.push({
              id: nanoid(),
              reviewId: '',
              file: file.getFilePath().replace(repoPath + '/', ''),
              line: node.getStartLineNumber(),
              severity: 'warning',
              category: 'bridge-type',
              title: `IPC handler "${channel}" not declared in contract`,
              description: 'This handler exists in main but is not declared in the IPC contract type.',
              source: 'bridge',
            })
          }
        }
      })
    }

    return issues
  }
}
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success.

**Step 3: Commit**

```bash
git add src/main/services/bridge-checker.ts
git commit -m "feat: add Bridge Type Checker service"
```

### Task C2: Integrate BridgeTypeChecker into ReviewEngine

**Files:**
- Modify: `src/main/services/review-engine.ts`
- Modify: `src/main/index.ts`
- Verify: `npm run typecheck`

**Step 1: Add BridgeTypeChecker to ReviewEngine**

Same pattern as StaticAnalyzer. Run in parallel:

```ts
const [llmResult, staticIssues, bridgeIssues] = await Promise.all([
  provider.review(truncatedDiff),
  Promise.resolve(this.staticAnalyzer.analyze(project.path, diffs)),
  Promise.resolve(this.bridgeChecker.check(project.path)),
])
```

Merge all three issue sources.

**Step 2: Instantiate in main/index.ts**

**Step 3: Run verification**

Run: `npm run typecheck`

Expected: success.

**Step 4: Commit**

```bash
git add src/main/services/review-engine.ts src/main/index.ts
git commit -m "feat: integrate Bridge Type Checker into review pipeline"
```

---

## Feature D: GitHub/GitLab Remote Repo Support

### Task D1: Add remote project type to shared types

**Files:**
- Modify: `src/shared/types/models.ts`
- Modify: `src/shared/types/config.ts`
- Verify: `npm run typecheck`

**Step 1: Update Project type**

In `src/shared/types/models.ts`, update `Project`:

```ts
export interface Project {
  id: string
  name: string
  type: 'local' | 'github' | 'gitlab'
  path: string                    // local path or cloned temp path
  remoteUrl?: string              // e.g. https://github.com/owner/repo
  remoteBranch?: string           // default branch for remote
  createdAt: number
  lastReviewAt?: number
}
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success (existing code already uses `type: 'local'`).

**Step 3: Commit**

```bash
git add src/shared/types/models.ts src/shared/types/config.ts
git commit -m "feat: add remote project type to shared types"
```

### Task D2: Create RemoteGitService

**Files:**
- Create: `src/main/services/remote-git.ts`
- Verify: `npm run typecheck`

**Step 1: Create the service**

```ts
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
}
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success.

**Step 3: Commit**

```bash
git add src/main/services/remote-git.ts
git commit -m "feat: add RemoteGitService for cloning remote repos"
```

### Task D3: Update IPC handlers for remote projects

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/index.ts`
- Verify: `npm run typecheck`

**Step 1: Add remote-aware add-project handler**

Update `add-project` to accept `type`, `remoteUrl`, `remoteBranch`. When type is `github` or `gitlab`, clone the repo first via `RemoteGitService`, then store the local clone path.

```ts
ipcMain.handle('add-project', async (_e, name: string, pathOrUrl: string, type: 'local' | 'github' | 'gitlab') => {
  const id = nanoid()
  let localPath = pathOrUrl

  if (type !== 'local') {
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

**Step 2: Add refresh-project handler**

```ts
ipcMain.handle('refresh-project', async (_e, projectId: string) => {
  const project = db.getProject(projectId)
  if (!project || project.type === 'local') return
  await remoteGit.cloneOrPull(project.remoteUrl!, projectId)
})
```

**Step 3: Update preload and IPC types**

Add `refreshProject` and update `addProject` signature in `src/shared/types/ipc.ts` and `src/preload/index.ts`.

**Step 4: Run verification**

Run: `npm run typecheck`

Expected: success.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/index.ts src/shared/types/ipc.ts src/preload/index.ts
git commit -m "feat: add IPC handlers for remote project management"
```

### Task D4: Update Projects page UI for remote repos

**Files:**
- Modify: `src/renderer/src/pages/ProjectsPage.tsx`
- Modify: `src/renderer/src/store/index.ts`
- Verify: `npm run typecheck && npm run build`

**Step 1: Add "Add Remote" button and dialog**

Add a second button next to "Add Project" labeled "Add Remote". When clicked, show an inline form with:
- URL input (https://github.com/owner/repo)
- Type selector (GitHub / GitLab)
- Name input (auto-filled from URL)

On submit, call `window.api.addProject(name, url, type)`.

**Step 2: Add refresh button for remote projects**

In the project card, if `project.type !== 'local'`, show a refresh icon button that calls `window.api.refreshProject(project.id)`.

**Step 3: Update store**

Add `refreshProject` action to the Zustand store.

**Step 4: Run verification**

Run: `npm run typecheck && npm run build`

Expected: success.

**Step 5: Commit**

```bash
git add src/renderer/src/pages/ProjectsPage.tsx src/renderer/src/store/index.ts
git commit -m "feat: add remote repo UI to Projects page"
```

---

## Execution Order

```
A1 → A2 → A3 → A4 (multi-model)
B1 → B2 → B3 (static analysis)
C1 → C2 (bridge checker)
D1 → D2 → D3 → D4 (remote repos)
```

Dependencies:
- B2 depends on A3 (ReviewEngine refactor)
- C2 depends on B2 (merged issue pipeline)
- D tasks are independent of A/B/C

Recommended order: A1→A2→A3→A4 → B1→B2→B3 → C1→C2 → D1→D2→D3→D4

Total: 14 tasks.
