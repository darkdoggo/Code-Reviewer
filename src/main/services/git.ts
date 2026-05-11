import simpleGit, { type SimpleGit } from 'simple-git'
import fs from 'fs/promises'
import path from 'path'
import type { GitInfo, DiffOptions, FileDiff, DiffHunk, Commit } from '@shared/types'

export class GitService {
  private getGit(repoPath: string): SimpleGit {
    // Check if directory exists before creating git instance
    try {
      const fs = require('fs')
      if (!fs.existsSync(repoPath)) {
        throw new Error(`Directory does not exist: ${repoPath}`)
      }
    } catch (error) {
      console.error('[Git] Failed to access directory:', repoPath, error)
      throw error
    }
    return simpleGit(repoPath)
  }

  async getGitInfo(repoPath: string): Promise<GitInfo> {
    const git = this.getGit(repoPath)
    try {
      const isRepo = await git.checkIsRepo()
      if (!isRepo) return { isRepo: false }
      const status = await git.status()
      return {
        isRepo: true,
        currentBranch: status.current ?? undefined,
        hasUncommittedChanges: !status.isClean()
      }
    } catch {
      return { isRepo: false }
    }
  }

  async getChangedFiles(repoPath: string, mode: 'staged' | 'unstaged'): Promise<{ branch: string; files: { file: string; status: string }[] }> {
    const git = this.getGit(repoPath)
    const status = await git.status()
    const branch = status.current || 'HEAD'

    let files: { file: string; status: string }[] = []

    if (mode === 'staged') {
      // Staged files: renamed, created, modified, deleted in staging area
      for (const f of status.renamed) {
        files.push({ file: `${f.from} → ${f.to}`, status: 'renamed' })
      }
      for (const f of status.created) {
        files.push({ file: f, status: 'added' })
      }
      for (const f of status.staged) {
        if (!status.created.includes(f) && !status.renamed.some(r => r.to === f)) {
          files.push({ file: f, status: 'modified' })
        }
      }
      for (const f of status.deleted) {
        files.push({ file: f, status: 'deleted' })
      }
    } else {
      // Unstaged files: modified, deleted, not_added (untracked)
      for (const f of status.modified) {
        files.push({ file: f, status: 'modified' })
      }
      for (const f of status.deleted) {
        files.push({ file: f, status: 'deleted' })
      }
      for (const f of status.not_added) {
        files.push({ file: f, status: 'new' })
      }
    }

    return { branch, files }
  }

  async getDiff(repoPath: string, options: DiffOptions): Promise<FileDiff[]> {
    const git = this.getGit(repoPath)
    let diffText: string

    switch (options.mode) {
      case 'staged':
        diffText = await git.diff(['--cached'])
        break
      case 'unstaged':
        diffText = await git.diff()
        break
      case 'branch': {
        const base = options.baseBranch
        const compare = options.compareBranch || 'HEAD'

        if (!base) throw new Error('baseBranch is required for branch mode')

        // Fetch branches if needed (for shallow clones)
        try {
          await git.fetch(['origin', `${base}:refs/remotes/origin/${base}`])
          if (compare !== 'HEAD') {
            await git.fetch(['origin', `${compare}:refs/remotes/origin/${compare}`])
          }
        } catch {
          // Ignore - branches may already exist locally
        }

        // Try origin/<branch> first, fallback to <branch> for local repos
        try {
          const baseRef = `origin/${base}`
          const compareRef = compare === 'HEAD' ? 'HEAD' : `origin/${compare}`
          diffText = await git.diff([`${baseRef}..${compareRef}`])
        } catch {
          diffText = await git.diff([`${base}..${compare}`])
        }
        break
      }
      case 'commits': {
        const commits = options.commits ?? []
        if (commits.length === 0) {
          throw new Error('No commits specified')
        }

        // Get diff for each commit and merge them
        const allDiffs: string[] = []
        for (const commit of commits) {
          try {
            // Get the diff for this specific commit (commit vs its parent)
            const commitDiff = await git.diff([`${commit}~1`, commit])
            if (commitDiff.trim()) {
              allDiffs.push(commitDiff)
            }
          } catch (error) {
            console.warn(`[Git] Failed to get diff for commit ${commit}:`, error)
            // Try without parent (for initial commit)
            try {
              const commitDiff = await git.show([commit])
              if (commitDiff.trim()) {
                allDiffs.push(commitDiff)
              }
            } catch {
              console.error(`[Git] Could not get diff for commit ${commit}`)
            }
          }
        }

        diffText = allDiffs.join('\n\n')
        break
      }
      case 'full-project': {
        const files = await this.getProjectFiles(repoPath, options.targetPath, options.fileExtensions, options.excludePattern)
        const syntheticDiffs: FileDiff[] = []

        for (const file of files) {
          try {
            const content = await fs.readFile(path.join(repoPath, options.targetPath || '', file), 'utf-8')
            const lines = content.split('\n')
            const hunkContent = lines.map(line => `+${line}`).join('\n')

            syntheticDiffs.push({
              file: options.targetPath ? path.join(options.targetPath, file) : file,
              status: 'modified',
              additions: lines.length,
              deletions: 0,
              hunks: [{
                oldStart: 0,
                oldLines: 0,
                newStart: 1,
                newLines: lines.length,
                content: hunkContent
              }],
              newContent: content
            })
          } catch {
            // Skip unreadable files
          }
        }

        return syntheticDiffs
      }
      default:
        diffText = await git.diff()
    }

    return this.parseDiff(diffText)
  }

  async getBranches(repoPath: string): Promise<string[]> {
    const git = this.getGit(repoPath)
    try {
      await git.fetch(['--all'])
    } catch {
      // Ignore fetch errors
    }
    const result = await git.branch(['-a'])
    let branches = result.all
      .map(b => b.replace(/^remotes\/origin\//, ''))
      .filter((b, i, arr) => b !== 'HEAD' && arr.indexOf(b) === i)

    // If shallow clone only has one branch, try ls-remote using origin URL
    if (branches.length <= 1) {
      try {
        const originUrl = ((await git.remote(['get-url', 'origin'])) || '').trim()
        branches = await this.getRemoteBranches(originUrl)
      } catch {
        // Keep local branches if remote lookup fails
      }
    }

    return branches
  }

  async getRemoteBranches(remoteUrl: string): Promise<string[]> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    )
    const lsRemotePromise = simpleGit().listRemote(['--heads', remoteUrl])
    const output = await Promise.race([lsRemotePromise, timeoutPromise])
    return (output as string)
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const ref = line.split('\t')[1] || ''
        return ref.replace('refs/heads/', '')
      })
      .filter(Boolean)
  }

  async getCommits(repoPath: string, count = 20, branch?: string, includeFiles = false, offset = 0): Promise<Commit[]> {
    const git = this.getGit(repoPath)

    // Check if it's a git repository first
    try {
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        console.warn('[Git] Not a git repository:', repoPath)
        return []
      }
    } catch (error) {
      console.warn('[Git] Failed to check if repo:', repoPath, error)
      return []
    }

    // Format: hash|message|author|date|files (if includeFiles)
    const format = includeFiles
      ? '--pretty=format:%H|%s|%an|%aI'
      : '--pretty=format:%H|%s|%an|%aI'

    const args = ['log', `--max-count=${count}`, `--skip=${offset}`, format]
    if (includeFiles) {
      args.push('--name-only')
    }

    if (branch) {
      // Try different ref formats directly with git log
      const refsToTry = [
        branch,
        `origin/${branch}`,
        `refs/remotes/origin/${branch}`
      ]

      // Try each ref format
      for (const ref of refsToTry) {
        try {
          const result = await git.raw([...args, ref])
          return this.parseCommits(result, includeFiles)
        } catch {
          // This ref doesn't work, try next
          continue
        }
      }

      // If all local refs failed, try fetching from remote
      try {
        console.log(`[Git] Fetching remote branch: ${branch}`)
        await git.fetch(['origin', `${branch}:refs/remotes/origin/${branch}`])

        // Try again with origin/branch after fetch
        const result = await git.raw([...args, `origin/${branch}`])
        return this.parseCommits(result, includeFiles)
      } catch (error) {
        console.warn(`[Git] Failed to fetch and get commits for branch ${branch}:`, error)
        return []
      }
    }

    // No branch specified, use current branch
    try {
      const result = await git.raw(args)
      return this.parseCommits(result, includeFiles)
    } catch (error) {
      console.error('[Git] Failed to get commits for current branch:', error)
      return []
    }
  }

  private parseCommits(result: string, includeFiles: boolean): Commit[] {
    if (!includeFiles) {
      // Simple format: hash|message|author|date
      return result
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, message, author, date] = line.split('|')
          return { hash, message, author, date }
        })
    }

    // With files: each commit is separated by blank lines
    // Format:
    // hash|message|author|date
    // file1
    // file2
    // (blank line)
    // next commit...
    const commits: Commit[] = []
    const blocks = result.trim().split('\n\n')

    for (const block of blocks) {
      const lines = block.split('\n').filter(Boolean)
      if (lines.length === 0) continue

      const [hash, message, author, date] = lines[0].split('|')
      const files = lines.slice(1) // Remaining lines are file paths

      commits.push({ hash, message, author, date, files })
    }

    return commits
  }

  async getFileContent(repoPath: string, filePath: string, ref?: string): Promise<string> {
    const git = this.getGit(repoPath)
    if (ref) {
      return git.show([`${ref}:${filePath}`])
    }
    return fs.readFile(path.join(repoPath, filePath), 'utf-8')
  }

  async getProjectFiles(repoPath: string, targetPath?: string, fileExtensions?: string[], excludePattern?: string): Promise<string[]> {
    const scanPath = targetPath ? path.join(repoPath, targetPath) : repoPath

    // Check if path exists
    try {
      await fs.access(scanPath)
    } catch {
      throw new Error(`Path not found: ${targetPath || '.'}`)
    }

    const files: string[] = []
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage', '.vscode', '.idea'])
    const ignoreFiles = new Set(['.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])

    // Parse exclude pattern into keywords
    const excludeKeywords = excludePattern
      ? excludePattern.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
      : []

    async function scan(dir: string, relativePath: string = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name

        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            await scan(fullPath, relPath)
          }
        } else if (entry.isFile()) {
          if (ignoreFiles.has(entry.name)) continue

          // Filter by extension if specified
          if (fileExtensions && fileExtensions.length > 0) {
            const ext = path.extname(entry.name)
            if (!fileExtensions.includes(ext)) continue
          }

          // Apply exclude pattern (fuzzy match)
          if (excludeKeywords.length > 0) {
            const lowerPath = relPath.toLowerCase()
            const shouldExclude = excludeKeywords.some(keyword => lowerPath.includes(keyword))
            if (shouldExclude) continue
          }

          files.push(relPath)
        }
      }
    }

    await scan(scanPath)
    return files.sort()
  }

  private parseDiff(diffText: string): FileDiff[] {
    if (!diffText.trim()) return []

    const files: FileDiff[] = []
    const fileSections = diffText.split(/^diff --git /m).filter(Boolean)

    for (const section of fileSections) {
      const lines = section.split('\n')
      const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/)
      if (!headerMatch) continue

      const oldFile = headerMatch[1]
      const newFile = headerMatch[2]
      const file = newFile

      let status: FileDiff['status'] = 'modified'
      if (section.includes('new file mode')) status = 'added'
      else if (section.includes('deleted file mode')) status = 'deleted'
      else if (oldFile !== newFile) status = 'renamed'

      const hunks: DiffHunk[] = []
      let additions = 0
      let deletions = 0

      const hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/gm
      let match: RegExpExecArray | null
      const hunkPositions: { start: number; header: RegExpExecArray }[] = []

      while ((match = hunkRegex.exec(section)) !== null) {
        hunkPositions.push({ start: match.index, header: match })
      }

      for (let i = 0; i < hunkPositions.length; i++) {
        const { header } = hunkPositions[i]
        const start = hunkPositions[i].start
        const end = i + 1 < hunkPositions.length ? hunkPositions[i + 1].start : section.length
        const content = section.slice(start, end)

        for (const line of content.split('\n')) {
          if (line.startsWith('+') && !line.startsWith('+++')) additions++
          if (line.startsWith('-') && !line.startsWith('---')) deletions++
        }

        hunks.push({
          oldStart: parseInt(header[1]),
          oldLines: parseInt(header[2] ?? '1'),
          newStart: parseInt(header[3]),
          newLines: parseInt(header[4] ?? '1'),
          content
        })
      }

      files.push({ file, status, additions, deletions, hunks })
    }

    return files
  }
}
