import simpleGit from 'simple-git'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export class RemoteGitService {
  private cloneDir: string

  constructor() {
    this.cloneDir = path.join(os.tmpdir(), 'reviewer-agent-clones')
  }

  async testAccess(remoteUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
      const lsRemotePromise = simpleGit().listRemote([remoteUrl])
      const result = await Promise.race([lsRemotePromise, timeoutPromise]) as string

      // If result is empty, the URL is reachable but has no refs — likely a wrong URL or empty repo
      if (!result || result.trim().length === 0) {
        return { success: false, error: 'Repository appears empty or the URL is incorrect. Please verify the repository URL (remove any trailing paths like /-/code/).' }
      }

      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('timeout') || msg.includes('Connection timeout')) {
        return { success: false, error: 'Connection timeout. The repository may require authentication or be unreachable.' }
      } else if (msg.includes('Authentication') || msg.includes('could not read Username')) {
        return { success: false, error: 'Authentication failed. Please configure git credentials for private repositories.' }
      } else if (msg.includes('not found') || msg.includes('does not exist')) {
        return { success: false, error: 'Repository not found. Please check the URL.' }
      } else if (msg.includes('Could not resolve host')) {
        return { success: false, error: 'Network error. Please check your connection.' }
      }
      return { success: false, error: `Cannot access repository: ${msg}` }
    }
  }

  async cloneOrPull(remoteUrl: string, projectId: string): Promise<string> {
    const localPath = path.join(this.cloneDir, projectId)

    try {
      // Check if directory exists and is a valid git repo
      await fs.access(localPath)
      const git = simpleGit(localPath)

      // Verify it's a valid git repository
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        console.warn('[RemoteGit] Invalid git repo, cleaning up:', localPath)
        await fs.rm(localPath, { recursive: true, force: true })
        throw new Error('Invalid git repository, will re-clone')
      }

      // Try to pull
      await git.pull()
      return localPath
    } catch (error) {
      // If directory exists but pull failed, clean it up
      try {
        await fs.access(localPath)
        console.warn('[RemoteGit] Pull failed, cleaning up:', localPath)
        await fs.rm(localPath, { recursive: true, force: true })
      } catch {
        // Directory doesn't exist, that's fine
      }

      // Clone fresh
      try {
        await fs.mkdir(this.cloneDir, { recursive: true })
        await simpleGit().clone(remoteUrl, localPath, ['--depth', '50', '--no-single-branch'])
        return localPath
      } catch (cloneError) {
        // Clean up failed clone
        try {
          await fs.rm(localPath, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }
        throw cloneError
      }
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
