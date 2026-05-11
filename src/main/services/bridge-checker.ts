import { Project, SyntaxKind } from 'ts-morph'
import type { ReviewIssue } from '@shared/types'
import { nanoid } from 'nanoid'
import fs from 'fs'
import path from 'path'

const i18nMessages = {
  en: {
    handlerNotDeclared: {
      title: (channel: string) => `IPC handler "${channel}" not declared in contract`,
      description: 'This handler exists in main but is not declared in the ElectronAPI interface.',
    },
    methodNoHandler: {
      title: (method: string) => `IPC method "${method}" declared but no handler found`,
      description: 'This method is declared in ElectronAPI but no corresponding ipcMain.handle was found.',
    },
  },
  zh: {
    handlerNotDeclared: {
      title: (channel: string) => `IPC 处理器 "${channel}" 未在接口契约中声明`,
      description: '该处理器存在于主进程中，但未在 ElectronAPI 接口中声明。',
    },
    methodNoHandler: {
      title: (method: string) => `IPC 方法 "${method}" 已声明但未找到对应处理器`,
      description: '该方法已在 ElectronAPI 中声明，但未找到对应的 ipcMain.handle 实现。',
    },
  },
}

export class BridgeTypeChecker {
  check(repoPath: string, lang: 'en' | 'zh' = 'en'): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const messages = i18nMessages[lang]

    try {
      // Check if tsconfig.json exists before attempting to load
      const tsconfigPath = path.join(repoPath, 'tsconfig.json')
      if (!fs.existsSync(tsconfigPath)) {
        console.log('[BridgeChecker] No tsconfig.json found, skipping bridge type checking')
        return issues
      }

      const project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
      })

      // Find the IPC contract interface
      const ipcFile = project.getSourceFile('**/types/ipc.ts')
      if (!ipcFile) return issues

      const ipcInterface = ipcFile.getInterface('ElectronAPI') ?? ipcFile.getInterface('IpcContract')
      if (!ipcInterface) return issues

      // Get declared method signatures
      const declaredMethods = new Map<string, { params: string; returnType: string; line: number }>()
      for (const method of ipcInterface.getMethods()) {
        const methodName = method.getName()
        declaredMethods.set(methodName, {
          params: method.getParameters().map((p) => p.getType().getText()).join(', '),
          returnType: method.getReturnType().getText(),
          line: method.getStartLineNumber(),
        })
      }

      // Scan main process handlers for mismatches
      const mainFiles = project.getSourceFiles('**/main/**/*.ts')
      const foundHandlers = new Set<string>()

      for (const file of mainFiles) {
        file.forEachDescendant((node) => {
          if (
            node.getKind() === SyntaxKind.CallExpression &&
            node.getText().includes('ipcMain.handle')
          ) {
            const callExpr = node.asKind(SyntaxKind.CallExpression)
            const args = callExpr?.getArguments()
            if (!args || args.length < 2) return

            // Extract channel name
            const channelArg = args[0]
            let channel = channelArg.getText().replace(/['"]/g, '')

            // Convert kebab-case to camelCase for matching
            const channelCamelCase = channel.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
            foundHandlers.add(channelCamelCase)

            if (!declaredMethods.has(channelCamelCase)) {
              issues.push({
                id: nanoid(),
                reviewId: '',
                file: file.getFilePath().replace(repoPath + '/', ''),
                line: node.getStartLineNumber(),
                severity: 'warning',
                category: 'bridge-type',
                title: messages.handlerNotDeclared.title(channel),
                description: messages.handlerNotDeclared.description,
                source: 'bridge',
              })
            }
          }
        })
      }

      // Check for declared methods without handlers
      for (const [methodName, methodInfo] of Array.from(declaredMethods.entries())) {
        if (!foundHandlers.has(methodName)) {
          issues.push({
            id: nanoid(),
            reviewId: '',
            file: 'src/shared/types/ipc.ts',
            line: methodInfo.line,
            severity: 'warning',
            category: 'bridge-type',
            title: messages.methodNoHandler.title(methodName),
            description: messages.methodNoHandler.description,
            source: 'bridge',
          })
        }
      }
    } catch (err) {
      // If tsconfig.json doesn't exist or project setup fails, skip bridge checking silently
      console.log('[BridgeChecker] Skipping bridge type checking:', err instanceof Error ? err.message : 'Unknown error')
    }

    return issues
  }
}
