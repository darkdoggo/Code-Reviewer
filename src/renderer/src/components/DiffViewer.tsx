import { useState, useEffect, useRef } from 'react'
import { DiffEditor, type DiffEditorProps } from '@monaco-editor/react'
import type { Review, FileDiff } from '@shared/types'
import { getDiffRefs } from '../lib/review-diff'
import { Loader2 } from 'lucide-react'

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  json: 'json', css: 'css', html: 'html', md: 'markdown',
  yml: 'yaml', yaml: 'yaml', py: 'python', rs: 'rust', go: 'go',
}

function getLang(file: string): string {
  const ext = file.split('.').pop() ?? ''
  return LANG_MAP[ext] ?? 'plaintext'
}

/**
 * Extract old/new content from diff hunks when git refs are unavailable.
 * Parses unified diff format lines (+/-/space) to reconstruct both sides.
 */
function reconstructFromHunks(file: FileDiff): { old: string; mod: string } {
  const oldLines: string[] = []
  const newLines: string[] = []

  for (const hunk of file.hunks) {
    const lines = hunk.content.split('\n')
    for (const line of lines) {
      // Skip hunk headers
      if (line.startsWith('@@')) continue
      // Skip diff metadata
      if (line.startsWith('diff ') || line.startsWith('index ') ||
          line.startsWith('---') || line.startsWith('+++')) continue

      if (line.startsWith('+')) {
        newLines.push(line.slice(1))
      } else if (line.startsWith('-')) {
        oldLines.push(line.slice(1))
      } else {
        // Context line (starts with space or is empty)
        const content = line.startsWith(' ') ? line.slice(1) : line
        oldLines.push(content)
        newLines.push(content)
      }
    }
  }

  return { old: oldLines.join('\n'), mod: newLines.join('\n') }
}

interface DiffViewerProps {
  projectId: string
  review: Review
  file: FileDiff | null
  targetLine?: number | null
}

export function DiffViewer({ projectId, review, file, targetLine }: DiffViewerProps) {
  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFallback, setIsFallback] = useState(false)
  const editorRef = useRef<Parameters<NonNullable<DiffEditorProps['onMount']>>[0] | null>(null)

  useEffect(() => {
    if (!file) return
    const { oldRef, newRef } = getDiffRefs(review)
    setIsLoading(true)
    setIsFallback(false)

    const fetchOld = oldRef !== undefined
      ? window.api.getFileContent(projectId, file.file, oldRef).catch(() => null)
      : window.api.getFileContent(projectId, file.file).catch(() => null)

    const fetchNew = newRef !== undefined
      ? window.api.getFileContent(projectId, file.file, newRef).catch(() => null)
      : window.api.getFileContent(projectId, file.file).catch(() => null)

    Promise.all([
      file.status === 'added' ? Promise.resolve('') : fetchOld,
      file.status === 'deleted' ? Promise.resolve('') : fetchNew,
    ])
      .then(([old, mod]) => {
        // If git fetch succeeded, use the full content
        if (old !== null && mod !== null && (old.length > 0 || mod.length > 0 || file.status === 'added' || file.status === 'deleted')) {
          setOriginal(old)
          setModified(mod)
          return
        }

        // Fallback: reconstruct from diff hunks
        if (file.hunks && file.hunks.length > 0) {
          const { old: hunkOld, mod: hunkMod } = reconstructFromHunks(file)
          setOriginal(hunkOld)
          setModified(hunkMod)
          setIsFallback(true)
          return
        }

        // No data at all
        setOriginal('')
        setModified('')
      })
      .catch(() => {
        // Last resort: try hunks
        if (file.hunks && file.hunks.length > 0) {
          const { old: hunkOld, mod: hunkMod } = reconstructFromHunks(file)
          setOriginal(hunkOld)
          setModified(hunkMod)
          setIsFallback(true)
        }
      })
      .finally(() => setIsLoading(false))
  }, [projectId, review.id, file?.file])

  useEffect(() => {
    if (!targetLine || !editorRef.current) return
    const modifiedEditor = editorRef.current.getModifiedEditor()
    modifiedEditor.revealLineInCenter(targetLine)
    modifiedEditor.setPosition({ lineNumber: targetLine, column: 1 })
  }, [targetLine])

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[hsl(var(--muted-foreground))]">
        Select a file to preview the diff
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 size={14} className="animate-spin" /> Loading diff...
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col">
      {isFallback && (
        <div className="shrink-0 px-3 py-1.5 text-xs bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-b border-yellow-200 dark:border-yellow-800">
          ⚠ 原始 git 引用不可用，已从 diff 数据重建代码视图（仅显示变更部分）
        </div>
      )}
      <div className="flex-1 min-h-0">
        <DiffEditor
          height="100%"
          original={original}
          modified={modified}
          language={getLang(file.file)}
          theme="vs-dark"
          onMount={(editor) => { editorRef.current = editor }}
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  )
}
