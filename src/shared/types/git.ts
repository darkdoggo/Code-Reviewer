export interface GitInfo {
  isRepo: boolean
  currentBranch?: string
  remoteUrl?: string
  hasUncommittedChanges?: boolean
}

export interface DiffOptions {
  mode: 'commits' | 'branch' | 'staged' | 'unstaged' | 'full-project'
  commits?: string[]
  baseBranch?: string
  compareBranch?: string
  // For full-project mode
  targetPath?: string // Relative path to directory or file
  fileExtensions?: string[] // e.g., ['.ts', '.tsx', '.js']
  excludePattern?: string // Fuzzy match pattern to exclude files (e.g., 'test,spec,.min')
}

export interface FileDiff {
  file: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  hunks: DiffHunk[]
  oldContent?: string
  newContent?: string
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
}

export interface Commit {
  hash: string
  message: string
  author: string
  date: string
  files?: string[]  // Optional: list of files changed in this commit
}
