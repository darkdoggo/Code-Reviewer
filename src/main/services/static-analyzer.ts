import { Project, SyntaxKind } from 'ts-morph'
import type { ReviewIssue, FileDiff } from '@shared/types'
import { nanoid } from 'nanoid'
import fs from 'fs'
import path from 'path'

const i18nMessages = {
  en: {
    anyType: {
      title: 'Explicit `any` type detected',
      description: 'Avoid using `any`. Use a specific type or `unknown` instead.',
    },
    consoleLog: {
      title: 'console.log detected',
      description: 'Remove console.log before committing, or use a proper logger.',
    },
    tooManyParams: {
      title: (name: string, count: number) => `Function "${name}" has ${count} parameters`,
      description: 'Consider using an options object to reduce parameter count.',
    },
  },
  zh: {
    anyType: {
      title: '检测到显式 `any` 类型',
      description: '避免使用 `any`，请使用具体类型或 `unknown` 替代。',
    },
    consoleLog: {
      title: '检测到 console.log',
      description: '提交前请移除 console.log，或使用正式的日志工具。',
    },
    tooManyParams: {
      title: (name: string, count: number) => `函数 "${name}" 有 ${count} 个参数`,
      description: '建议使用配置对象来减少参数数量。',
    },
  },
}

export class StaticAnalyzer {
  analyze(repoPath: string, diffs: FileDiff[], lang: 'en' | 'zh' = 'en'): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const messages = i18nMessages[lang]
    const tsFiles = diffs
      .filter((d) => d.status !== 'deleted')
      .filter((d) => /\.(ts|tsx)$/.test(d.file))

    if (tsFiles.length === 0) return issues

    try {
      // Check if tsconfig.json exists before attempting to load
      const tsconfigPath = path.join(repoPath, 'tsconfig.json')
      if (!fs.existsSync(tsconfigPath)) {
        console.log('[StaticAnalyzer] No tsconfig.json found, skipping static analysis')
        return issues
      }

      const project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: true,
      })

      for (const diff of tsFiles) {
        const filePath = `${repoPath}/${diff.file}`
        try {
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
                title: messages.anyType.title,
                description: messages.anyType.description,
                source: 'static',
              })
            }
          })

          // Rule 2: Detect console.log statements
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
                title: messages.consoleLog.title,
                description: messages.consoleLog.description,
                source: 'static',
              })
            }
          })

          // Rule 3: Detect functions with too many parameters (>4)
          sourceFile.getFunctions().forEach((fn) => {
            if (fn.getParameters().length > 4) {
              issues.push({
                id: nanoid(),
                reviewId: '',
                file: diff.file,
                line: fn.getStartLineNumber(),
                severity: 'suggestion',
                category: 'complexity',
                title: messages.tooManyParams.title(fn.getName() || 'anonymous', fn.getParameters().length),
                description: messages.tooManyParams.description,
                source: 'static',
              })
            }
          })
        } catch (err) {
          // Skip files that can't be parsed
          console.error(`Failed to analyze ${filePath}:`, err)
        }
      }
    } catch (err) {
      // If tsconfig.json doesn't exist or project setup fails, skip static analysis
      console.log('[StaticAnalyzer] Skipping static analysis:', err instanceof Error ? err.message : 'Unknown error')
    }

    return issues
  }
}

