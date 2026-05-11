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

  formatContextForLLM(context: ProjectContext): string {
    const lines: string[] = []

    lines.push('# Project Context')
    lines.push('')

    lines.push('## Framework & Dependencies')
    const framework = context.fingerprint.directoryStructure.framework
    if (framework && framework !== 'unknown') {
      lines.push(`Framework: ${framework}`)
    }

    const keyDeps = Object.keys(context.fingerprint.dependencies).slice(0, 5)
    if (keyDeps.length > 0) {
      lines.push(`Key dependencies: ${keyDeps.join(', ')}`)
    }
    lines.push('')

    if (context.fingerprint.tsConfig) {
      lines.push('## TypeScript Config')
      const ts = context.fingerprint.tsConfig
      if (ts.strict !== undefined) lines.push(`Strict mode: ${ts.strict}`)
      if (ts.target) lines.push(`Target: ${ts.target}`)
      lines.push('')
    }

    if (context.relatedFiles.length > 0) {
      lines.push('## Related Files')
      lines.push('The following files are related to the changes:')
      for (const file of context.relatedFiles.slice(0, 10)) {
        lines.push(`- ${file.path} (${file.reason})`)
      }
      lines.push('')
    }

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

  private async findRelatedFiles(projectPath: string, diffs: FileDiff[]): Promise<RelatedFile[]> {
    const relatedFiles: RelatedFile[] = []
    const visited = new Set<string>()

    const changedFiles = diffs
      .filter(d => d.status !== 'deleted')
      .map(d => d.file)

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

    return relatedFiles.slice(0, 10)
  }

  private async analyzeImports(projectPath: string, filePath: string): Promise<string[]> {
    try {
      const fullPath = path.join(projectPath, filePath)
      const content = await fs.readFile(fullPath, 'utf-8')

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

      return imports
        .filter(imp => imp.startsWith('.'))
        .map(imp => {
          const dir = path.dirname(filePath)
          let resolved = path.join(dir, imp)

          if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx') && !resolved.endsWith('.js')) {
            resolved = resolved + '.ts'
          }

          return resolved
        })
    } catch {
      return []
    }
  }

  private async getAllTsFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
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

  private async loadReviewerConfig(projectPath: string): Promise<ReviewerConfig | undefined> {
    try {
      const configPath = path.join(projectPath, '.reviewerrc')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configContent) as ReviewerConfig

      if (typeof config !== 'object') return undefined

      return config
    } catch {
      return undefined
    }
  }
}
