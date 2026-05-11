# Context Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Context Builder service that extracts project fingerprints (dependencies, tsconfig, directory structure), identifies related files based on imports/references, and supports .reviewerrc custom rules to make code reviews more accurate and context-aware.

**Architecture:** Create a ContextBuilder service that analyzes the project structure before LLM review. It uses ts-morph to parse TypeScript files, extracts package.json dependencies, reads tsconfig.json, and follows import chains to identify related files. The context is passed to the LLM provider as additional input. Support .reviewerrc for custom rules (ignore patterns, focus areas, custom prompts).

**Tech Stack:** TypeScript, ts-morph, Node.js fs/path, Zod for validation

---

## Feature Overview

The Context Builder provides three key capabilities:

1. **Project Fingerprint**: Extract project metadata (dependencies, TypeScript config, directory structure)
2. **Related Files**: Identify files related to the diff through import/reference analysis
3. **Custom Rules**: Support .reviewerrc configuration for user-defined review rules

---

## Task 1: Define Context Types

**Files:**
- Create: `src/shared/types/context.ts`
- Verify: `npm run typecheck`

**Step 1: Create context type definitions**

Create `src/shared/types/context.ts`:

```typescript
export interface ProjectFingerprint {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  tsConfig?: {
    target?: string
    module?: string
    strict?: boolean
    lib?: string[]
  }
  directoryStructure: {
    hasTests: boolean
    hasDocs: boolean
    framework?: 'react' | 'vue' | 'angular' | 'express' | 'nest' | 'next' | 'unknown'
  }
}

export interface RelatedFile {
  path: string
  reason: 'imported-by' | 'imports' | 'referenced-in'
  distance: number  // 0 = direct, 1 = one hop, etc.
}

export interface ReviewerConfig {
  ignore?: string[]  // glob patterns to ignore
  focus?: string[]   // areas to focus on
  customPrompts?: {
    security?: string
    performance?: string
    architecture?: string
  }
  rules?: {
    maxFunctionLength?: number
    maxFileLength?: number
    requireTests?: boolean
  }
}

export interface ProjectContext {
  fingerprint: ProjectFingerprint
  relatedFiles: RelatedFile[]
  config?: ReviewerConfig
}
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 3: Commit**

```bash
git add src/shared/types/context.ts
git commit -m "feat: add context builder type definitions"
```

---

## Task 2: Create ContextBuilder Service (Part 1: Project Fingerprint)

**Files:**
- Create: `src/main/services/context-builder.ts`
- Verify: `npm run typecheck`

**Step 1: Create the service skeleton**

Create `src/main/services/context-builder.ts`:

```typescript
import fs from 'fs/promises'
import path from 'path'
import type { ProjectFingerprint, ProjectContext, RelatedFile, ReviewerConfig } from '@shared/types/context'
import type { FileDiff } from '@shared/types'

export class ContextBuilder {
  async buildContext(projectPath: string, diffs: FileDiff[]): Promise<ProjectContext> {
    const fingerprint = await this.extractFingerprint(projectPath)
    const relatedFiles = await this.findRelatedFiles(projectPath, diffs)
    const config = await this.loadReviewerConfig(projectPath)

    return {
      fingerprint,
      relatedFiles,
      config
    }
  }

  private async extractFingerprint(projectPath: string): Promise<ProjectFingerprint> {
    // Will implement in next steps
    return {
      dependencies: {},
      devDependencies: {},
      directoryStructure: {
        hasTests: false,
        hasDocs: false
      }
    }
  }

  private async findRelatedFiles(projectPath: string, diffs: FileDiff[]): Promise<RelatedFile[]> {
    // Will implement in Task 3
    return []
  }

  private async loadReviewerConfig(projectPath: string): Promise<ReviewerConfig | undefined> {
    // Will implement in Task 4
    return undefined
  }
}
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 3: Commit**

```bash
git add src/main/services/context-builder.ts
git commit -m "feat: add ContextBuilder service skeleton"
```

---

## Task 3: Implement Project Fingerprint Extraction

**Files:**
- Modify: `src/main/services/context-builder.ts`
- Verify: `npm run typecheck`

**Step 1: Implement extractFingerprint method**

Replace the `extractFingerprint` method in `src/main/services/context-builder.ts`:

```typescript
  private async extractFingerprint(projectPath: string): Promise<ProjectFingerprint> {
    const fingerprint: ProjectFingerprint = {
      dependencies: {},
      devDependencies: {},
      directoryStructure: {
        hasTests: false,
        hasDocs: false
      }
    }

    // 1. Extract dependencies from package.json
    try {
      const packageJsonPath = path.join(projectPath, 'package.json')
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      fingerprint.dependencies = packageJson.dependencies ?? {}
      fingerprint.devDependencies = packageJson.devDependencies ?? {}
    } catch {
      // No package.json or parse error - skip
    }

    // 2. Extract TypeScript config
    try {
      const tsconfigPath = path.join(projectPath, 'tsconfig.json')
      const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf-8'))
      fingerprint.tsConfig = {
        target: tsconfig.compilerOptions?.target,
        module: tsconfig.compilerOptions?.module,
        strict: tsconfig.compilerOptions?.strict,
        lib: tsconfig.compilerOptions?.lib
      }
    } catch {
      // No tsconfig.json - skip
    }

    // 3. Detect directory structure
    try {
      const entries = await fs.readdir(projectPath)
      fingerprint.directoryStructure.hasTests = entries.some(e => 
        e === 'test' || e === 'tests' || e === '__tests__' || e.endsWith('.test.ts') || e.endsWith('.spec.ts')
      )
      fingerprint.directoryStructure.hasDocs = entries.some(e => 
        e === 'docs' || e === 'documentation' || e === 'README.md'
      )

      // Detect framework
      const deps = { ...fingerprint.dependencies, ...fingerprint.devDependencies }
      if (deps['react']) fingerprint.directoryStructure.framework = 'react'
      else if (deps['vue']) fingerprint.directoryStructure.framework = 'vue'
      else if (deps['@angular/core']) fingerprint.directoryStructure.framework = 'angular'
      else if (deps['express']) fingerprint.directoryStructure.framework = 'express'
      else if (deps['@nestjs/core']) fingerprint.directoryStructure.framework = 'nest'
      else if (deps['next']) fingerprint.directoryStructure.framework = 'next'
      else fingerprint.directoryStructure.framework = 'unknown'
    } catch {
      // Directory read error - skip
    }

    return fingerprint
  }
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 3: Commit**

```bash
git add src/main/services/context-builder.ts
git commit -m "feat: implement project fingerprint extraction"
```

---

## Task 4: Implement Related Files Discovery

**Files:**
- Modify: `src/main/services/context-builder.ts`
- Verify: `npm run typecheck`

**Step 1: Add import analysis helper**

Add this helper method to `ContextBuilder` class:

```typescript
  private async analyzeImports(projectPath: string, filePath: string): Promise<string[]> {
    try {
      const fullPath = path.join(projectPath, filePath)
      const content = await fs.readFile(fullPath, 'utf-8')
      
      // Simple regex-based import extraction (works for TS/JS)
      const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g
      const requireRegex = /require\s*\(\s*['"](.+?)['"]\s*\)/g
      
      const imports: string[] = []
      let match: RegExpExecArray | null
      
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1])
      }
      
      while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1])
      }
      
      // Filter to relative imports only (starts with . or ..)
      return imports
        .filter(imp => imp.startsWith('.'))
        .map(imp => {
          // Resolve relative path
          const dir = path.dirname(filePath)
          let resolved = path.join(dir, imp)
          
          // Add .ts/.tsx extension if missing
          if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx') && !resolved.endsWith('.js')) {
            // Try .ts first, then .tsx
            resolved = resolved + '.ts'
          }
          
          return resolved
        })
    } catch {
      return []
    }
  }
```

**Step 2: Implement findRelatedFiles method**

Replace the `findRelatedFiles` method:

```typescript
  private async findRelatedFiles(projectPath: string, diffs: FileDiff[]): Promise<RelatedFile[]> {
    const relatedFiles: RelatedFile[] = []
    const visited = new Set<string>()
    
    // Get all changed files
    const changedFiles = diffs
      .filter(d => d.status !== 'deleted')
      .map(d => d.file)
    
    // For each changed file, find what it imports (distance 0)
    for (const file of changedFiles) {
      visited.add(file)
      const imports = await this.analyzeImports(projectPath, file)
      
      for (const importPath of imports) {
        if (!visited.has(importPath) && !changedFiles.includes(importPath)) {
          relatedFiles.push({
            path: importPath,
            reason: 'imports',
            distance: 0
          })
          visited.add(importPath)
        }
      }
    }
    
    // Find files that import the changed files (reverse lookup, distance 0)
    // This is expensive, so we limit to src/ directory
    try {
      const srcPath = path.join(projectPath, 'src')
      const allFiles = await this.getAllTsFiles(srcPath)
      
      for (const file of allFiles) {
        const relativePath = path.relative(projectPath, file)
        if (visited.has(relativePath)) continue
        
        const imports = await this.analyzeImports(projectPath, relativePath)
        const importsChangedFile = imports.some(imp => changedFiles.includes(imp))
        
        if (importsChangedFile) {
          relatedFiles.push({
            path: relativePath,
            reason: 'imported-by',
            distance: 0
          })
          visited.add(relativePath)
        }
      }
    } catch {
      // src/ directory doesn't exist - skip reverse lookup
    }
    
    // Limit to top 20 most relevant files
    return relatedFiles.slice(0, 20)
  }
  
  private async getAllTsFiles(dir: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          // Skip node_modules, dist, build
          if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue
          files.push(...await this.getAllTsFiles(fullPath))
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          files.push(fullPath)
        }
      }
    } catch {
      // Directory read error - return what we have
    }
    
    return files
  }
```

**Step 3: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 4: Commit**

```bash
git add src/main/services/context-builder.ts
git commit -m "feat: implement related files discovery"
```

---

## Task 5: Implement .reviewerrc Config Loading

**Files:**
- Modify: `src/main/services/context-builder.ts`
- Verify: `npm run typecheck`

**Step 1: Implement loadReviewerConfig method**

Replace the `loadReviewerConfig` method:

```typescript
  private async loadReviewerConfig(projectPath: string): Promise<ReviewerConfig | undefined> {
    try {
      const configPath = path.join(projectPath, '.reviewerrc')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configContent) as ReviewerConfig
      
      // Validate basic structure
      if (typeof config !== 'object') return undefined
      
      return config
    } catch {
      // No .reviewerrc or parse error
      return undefined
    }
  }
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 3: Commit**

```bash
git add src/main/services/context-builder.ts
git commit -m "feat: implement .reviewerrc config loading"
```

---

## Task 6: Format Context for LLM

**Files:**
- Modify: `src/main/services/context-builder.ts`
- Verify: `npm run typecheck`

**Step 1: Add context formatting method**

Add this method to `ContextBuilder` class:

```typescript
  formatContextForLLM(context: ProjectContext): string {
    const lines: string[] = []
    
    lines.push('# Project Context')
    lines.push('')
    
    // 1. Framework and dependencies
    lines.push('## Framework & Dependencies')
    const framework = context.fingerprint.directoryStructure.framework
    if (framework && framework !== 'unknown') {
      lines.push(`Framework: ${framework}`)
    }
    
    const keyDeps = Object.keys(context.fingerprint.dependencies).slice(0, 10)
    if (keyDeps.length > 0) {
      lines.push(`Key dependencies: ${keyDeps.join(', ')}`)
    }
    lines.push('')
    
    // 2. TypeScript config
    if (context.fingerprint.tsConfig) {
      lines.push('## TypeScript Config')
      const ts = context.fingerprint.tsConfig
      if (ts.strict !== undefined) lines.push(`Strict mode: ${ts.strict}`)
      if (ts.target) lines.push(`Target: ${ts.target}`)
      lines.push('')
    }
    
    // 3. Related files
    if (context.relatedFiles.length > 0) {
      lines.push('## Related Files')
      lines.push('The following files are related to the changes:')
      for (const file of context.relatedFiles.slice(0, 10)) {
        lines.push(`- ${file.path} (${file.reason})`)
      }
      lines.push('')
    }
    
    // 4. Custom rules
    if (context.config) {
      lines.push('## Custom Review Rules')
      if (context.config.focus && context.config.focus.length > 0) {
        lines.push(`Focus areas: ${context.config.focus.join(', ')}`)
      }
      if (context.config.rules) {
        const rules = context.config.rules
        if (rules.maxFunctionLength) {
          lines.push(`Max function length: ${rules.maxFunctionLength} lines`)
        }
        if (rules.requireTests) {
          lines.push('Tests are required for new features')
        }
      }
      lines.push('')
    }
    
    return lines.join('\n')
  }
```

**Step 2: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 3: Commit**

```bash
git add src/main/services/context-builder.ts
git commit -m "feat: add context formatting for LLM"
```

---

## Task 7: Integrate ContextBuilder into ReviewEngine

**Files:**
- Modify: `src/main/services/review-engine.ts`
- Modify: `src/main/index.ts`
- Verify: `npm run typecheck`

**Step 1: Add ContextBuilder to ReviewEngine constructor**

In `src/main/services/review-engine.ts`, update the constructor:

```typescript
import type { ContextBuilder } from './context-builder'

export class ReviewEngine {
  constructor(
    private git: GitService,
    private db: DatabaseService,
    private config: ConfigService,
    private staticAnalyzer: StaticAnalyzer,
    private bridgeChecker: BridgeTypeChecker,
    private contextBuilder: ContextBuilder
  ) {}
```

**Step 2: Build and use context in runReview**

In the `runReview` method, after getting the diff (around line 32), add:

```typescript
    // 2. Build project context
    this.emitProgress('Analyzing project context...', 15)
    const projectContext = await this.contextBuilder.buildContext(project.path, diffs)
    const contextText = this.contextBuilder.formatContextForLLM(projectContext)
```

Then update the LLM call (around line 50) to pass the context:

```typescript
    const [llmResult, staticIssues, bridgeIssues] = await Promise.all([
      provider.review(truncatedDiff, contextText, llmConfig.outputLanguage),
      Promise.resolve(this.staticAnalyzer.analyze(project.path, diffs)),
      Promise.resolve(this.bridgeChecker.check(project.path)),
    ])
```

**Step 3: Update main/index.ts to instantiate ContextBuilder**

In `src/main/index.ts`, add:

```typescript
import { ContextBuilder } from './services/context-builder'

// In the initialization section:
const contextBuilder = new ContextBuilder()

// Update ReviewEngine instantiation:
const reviewEngine = new ReviewEngine(git, db, config, staticAnalyzer, bridgeChecker, contextBuilder)
```

**Step 4: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 5: Commit**

```bash
git add src/main/services/review-engine.ts src/main/index.ts
git commit -m "feat: integrate ContextBuilder into ReviewEngine"
```

---

## Task 8: Update LLM Provider Interface

**Files:**
- Modify: `src/main/services/llm/types.ts`
- Modify: `src/main/services/llm/anthropic-provider.ts`
- Modify: `src/main/services/llm/openai-provider.ts`
- Verify: `npm run typecheck`

**Step 1: Update LLMProvider interface**

In `src/main/services/llm/types.ts`, update the `review` method signature:

```typescript
export interface LLMProvider {
  configure(config: LLMConfig): void
  isConfigured(): boolean
  testConnection(): Promise<{ success: boolean; error?: string }>
  review(diff: string, projectContext: string | undefined, outputLanguage?: 'en' | 'zh'): Promise<ReviewResult>
}
```

**Step 2: Update AnthropicProvider**

In `src/main/services/llm/anthropic-provider.ts`, update the `review` method to accept `projectContext`:

```typescript
  async review(diff: string, projectContext: string | undefined, outputLanguage: 'en' | 'zh' = 'en'): Promise<ReviewResult> {
    if (!this.client || !this.config) throw new Error('Anthropic not configured')

    const systemPrompt = getSystemPrompt()
    
    // Add language instruction if Chinese
    const languageInstruction = outputLanguage === 'zh' 
      ? '\n\nIMPORTANT: Respond in Chinese (中文). All issue titles, descriptions, suggestions, and fullstack tips must be in Chinese.'
      : ''

    let userPrompt = ''
    if (projectContext) {
      userPrompt += `${projectContext}\n\n`
    }
    userPrompt += `Diff to review:\n${diff}`
    userPrompt += languageInstruction

    // ... rest of the method stays the same
  }
```

**Step 3: Update OpenAIProvider**

Make the same change in `src/main/services/llm/openai-provider.ts`.

**Step 4: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 5: Commit**

```bash
git add src/main/services/llm/
git commit -m "feat: update LLM providers to accept project context"
```

---

## Task 9: Add Context to IPC Types (Optional Enhancement)

**Files:**
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/preload/index.ts`
- Verify: `npm run typecheck`

**Step 1: Add getProjectContext to IPC interface**

In `src/shared/types/ipc.ts`, add:

```typescript
import type { ProjectContext } from './context'

export interface ElectronAPI {
  // ... existing methods
  
  getProjectContext(projectId: string): Promise<ProjectContext>
}
```

**Step 2: Add IPC handler**

In `src/main/ipc-handlers.ts`, add:

```typescript
ipcMain.handle('get-project-context', async (_e, projectId: string) => {
  const project = db.getProject(projectId)
  if (!project) throw new Error('Project not found')
  
  const diffs = await git.getDiff(project.path, { mode: 'staged' })
  return contextBuilder.buildContext(project.path, diffs)
})
```

**Step 3: Update preload**

In `src/preload/index.ts`, add:

```typescript
  getProjectContext: (projectId: string) => ipcRenderer.invoke('get-project-context', projectId),
```

**Step 4: Run verification**

Run: `npm run typecheck`

Expected: success

**Step 5: Commit**

```bash
git add src/shared/types/ipc.ts src/main/ipc-handlers.ts src/preload/index.ts
git commit -m "feat: add getProjectContext IPC method"
```

---

## Task 10: Create Example .reviewerrc

**Files:**
- Create: `docs/examples/.reviewerrc.example`

**Step 1: Create example config**

Create `docs/examples/.reviewerrc.example`:

```json
{
  "ignore": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/dist/**",
    "**/build/**"
  ],
  "focus": [
    "security",
    "performance",
    "type-safety"
  ],
  "customPrompts": {
    "security": "Pay special attention to SQL injection, XSS, and authentication issues.",
    "performance": "Check for N+1 queries, unnecessary re-renders, and memory leaks.",
    "architecture": "Ensure proper separation of concerns and adherence to SOLID principles."
  },
  "rules": {
    "maxFunctionLength": 50,
    "maxFileLength": 300,
    "requireTests": true
  }
}
```

**Step 2: Commit**

```bash
git add docs/examples/.reviewerrc.example
git commit -m "docs: add .reviewerrc example configuration"
```

---

## Task 11: Update Documentation

**Files:**
- Create: `docs/context-builder.md`

**Step 1: Create documentation**

Create `docs/context-builder.md`:

```markdown
# Context Builder

The Context Builder analyzes your project to provide additional context for more accurate code reviews.

## Features

### 1. Project Fingerprint

Automatically extracts:
- Dependencies from package.json
- TypeScript configuration
- Framework detection (React, Vue, Express, etc.)
- Directory structure (tests, docs)

### 2. Related Files

Identifies files related to your changes through:
- Import analysis (what the changed files import)
- Reverse lookup (what imports the changed files)
- Limited to top 20 most relevant files

### 3. Custom Rules (.reviewerrc)

Create a `.reviewerrc` file in your project root to customize reviews:

```json
{
  "ignore": ["**/*.test.ts"],
  "focus": ["security", "performance"],
  "customPrompts": {
    "security": "Check for authentication issues"
  },
  "rules": {
    "maxFunctionLength": 50,
    "requireTests": true
  }
}
```

## How It Works

1. When you start a review, Context Builder analyzes your project
2. It extracts project metadata and identifies related files
3. This context is formatted and sent to the LLM along with the diff
4. The LLM uses this context to provide more accurate and relevant feedback

## Benefits

- **More Accurate Reviews**: LLM understands your project structure
- **Better Suggestions**: Recommendations fit your tech stack
- **Custom Focus**: Define what matters most for your project
- **Related File Awareness**: Catch issues in dependent files

## Example Output

```
# Project Context

## Framework & Dependencies
Framework: react
Key dependencies: react, typescript, zustand, tailwindcss

## TypeScript Config
Strict mode: true
Target: ES2020

## Related Files
- src/store/index.ts (imports)
- src/components/Layout.tsx (imported-by)

## Custom Review Rules
Focus areas: security, performance
Max function length: 50 lines
```
```

**Step 2: Commit**

```bash
git add docs/context-builder.md
git commit -m "docs: add Context Builder documentation"
```

---

## Execution Order

```
Task 1 (types) → Task 2 (skeleton) → Task 3 (fingerprint) → Task 4 (related files) → 
Task 5 (config) → Task 6 (formatting) → Task 7 (integration) → Task 8 (LLM update) → 
Task 9 (IPC, optional) → Task 10 (example) → Task 11 (docs)
```

**Dependencies:**
- Tasks 3-6 can be done in parallel after Task 2
- Task 7 depends on Tasks 3-6
- Task 8 depends on Task 7
- Tasks 9-11 are independent enhancements

**Total: 11 tasks**

---

## Testing Strategy

After implementation, test with:

1. **Basic project**: Verify fingerprint extraction works
2. **TypeScript project**: Check tsconfig parsing
3. **React project**: Verify framework detection
4. **With .reviewerrc**: Test custom rules loading
5. **Complex imports**: Test related files discovery
6. **Full review**: Verify context is passed to LLM and improves results

---

## Success Criteria

- [ ] Context Builder extracts project fingerprint correctly
- [ ] Related files are identified through import analysis
- [ ] .reviewerrc config is loaded and applied
- [ ] Context is formatted and passed to LLM
- [ ] Reviews show improved accuracy with context
- [ ] All TypeScript checks pass
- [ ] Documentation is complete
