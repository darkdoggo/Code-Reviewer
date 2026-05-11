import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode } from 'lucide-react'
import { cn } from '../lib/utils'
import type { FileDiff, ReviewIssue } from '@shared/types'

interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  diff?: FileDiff
  children: FileTreeNode[]
  issueCount: { error: number; warning: number; suggestion: number; total: number }
}

interface FileTreeViewProps {
  nodes: FileTreeNode[]
  selectedFile: FileDiff | null
  onSelectFile: (f: FileDiff | null) => void
  filteredFiles: Set<string>
  issues: ReviewIssue[]
  severityFilter: string | null
}

export function FileTreeView({ nodes, selectedFile, onSelectFile, filteredFiles, severityFilter }: FileTreeViewProps) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          filteredFiles={filteredFiles}
          severityFilter={severityFilter}
          depth={0}
        />
      ))}
    </div>
  )
}

function TreeNode({
  node, selectedFile, onSelectFile, filteredFiles, severityFilter, depth
}: {
  node: FileTreeNode
  selectedFile: FileDiff | null
  onSelectFile: (f: FileDiff | null) => void
  filteredFiles: Set<string>
  severityFilter: string | null
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)

  if (node.isDir) {
    // Filter children by severity
    const visibleChildren = severityFilter
      ? node.children.filter((child) => {
          if (child.isDir) return child.issueCount[severityFilter as keyof typeof child.issueCount] > 0
          return child.diff && filteredFiles.has(child.diff.file)
        })
      : node.children

    if (visibleChildren.length === 0) return null

    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left px-2 py-1 text-xs flex items-center gap-1.5 hover:bg-[hsl(var(--secondary))] transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {expanded ? <FolderOpen size={12} className="text-blue-500" /> : <Folder size={12} className="text-blue-500" />}
          <span className="truncate flex-1">{node.name}</span>
          {node.issueCount.total > 0 && (
            <span className="text-[10px] bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] rounded-full px-1.5">
              {node.issueCount.total}
            </span>
          )}
        </button>
        {expanded && visibleChildren.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            filteredFiles={filteredFiles}
            severityFilter={severityFilter}
            depth={depth + 1}
          />
        ))}
      </div>
    )
  }

  // File node
  if (!node.diff || (severityFilter && !filteredFiles.has(node.diff.file))) return null

  const isSelected = selectedFile?.file === node.diff.file
  const { error, warning, suggestion, total } = node.issueCount

  return (
    <button
      onClick={() => onSelectFile(isSelected ? null : node.diff!)}
      className={cn(
        'w-full text-left px-2 py-1 text-xs flex items-center gap-1.5 hover:bg-[hsl(var(--secondary))] transition-colors',
        isSelected && 'bg-[hsl(var(--secondary))]'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      title={`${node.path}\n${error} errors, ${warning} warnings, ${suggestion} suggestions\nStatus: ${node.diff.status}`}
    >
      <FileCode size={12} className={cn(
        node.diff.status === 'added' && 'text-green-500',
        node.diff.status === 'deleted' && 'text-red-500',
        node.diff.status === 'modified' && 'text-yellow-500',
      )} />
      <span className="truncate flex-1">{node.name}</span>
      <span className="flex items-center gap-0.5 shrink-0">
        {error > 0 && (
          <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 leading-4">{error}</span>
        )}
        {warning > 0 && (
          <span className="text-[10px] bg-yellow-500 text-white rounded-full px-1.5 leading-4">{warning}</span>
        )}
        {suggestion > 0 && (
          <span className="text-[10px] bg-blue-500 text-white rounded-full px-1.5 leading-4">{suggestion}</span>
        )}
      </span>
    </button>
  )
}
