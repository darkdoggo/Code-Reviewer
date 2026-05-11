import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import type { Project, Review, ReviewIssue } from '@shared/types'

export class DatabaseService {
  private db: Database.Database

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'reviewer-agent.db')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.init()
  }

  private deserializeReview(row: any): Review {
    return {
      ...row,
      commits: row.commits ? row.commits.split(',') : undefined
    }
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'local',
        path TEXT NOT NULL,
        remoteUrl TEXT,
        createdAt INTEGER NOT NULL,
        lastReviewAt INTEGER
      );
    `)

    // Migrate: add remoteUrl column if missing
    const columns = this.db.pragma('table_info(projects)') as { name: string }[]
    if (!columns.some(c => c.name === 'remoteUrl')) {
      this.db.exec('ALTER TABLE projects ADD COLUMN remoteUrl TEXT')
    }

    this.db.exec(`      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        mode TEXT NOT NULL,
        commits TEXT,
        baseBranch TEXT,
        score REAL NOT NULL DEFAULT 0,
        errorCount INTEGER NOT NULL DEFAULT 0,
        warningCount INTEGER NOT NULL DEFAULT 0,
        suggestionCount INTEGER NOT NULL DEFAULT 0,
        llmProvider TEXT NOT NULL,
        llmModel TEXT NOT NULL,
        tokenUsed INTEGER NOT NULL DEFAULT 0,
        costEstimate REAL NOT NULL DEFAULT 0,
        duration INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS review_issues (
        id TEXT PRIMARY KEY,
        reviewId TEXT NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        suggestion TEXT,
        fullstackTip TEXT,
        source TEXT NOT NULL DEFAULT 'llm',
        FOREIGN KEY (reviewId) REFERENCES reviews(id) ON DELETE CASCADE
      );
    `)

    // Migrate: add compareBranch column if missing
    const reviewColumns = this.db.pragma('table_info(reviews)') as { name: string }[]
    if (!reviewColumns.some(c => c.name === 'compareBranch')) {
      this.db.exec('ALTER TABLE reviews ADD COLUMN compareBranch TEXT')
    }
    // Migrate: add currentBranch column if missing
    if (!reviewColumns.some(c => c.name === 'currentBranch')) {
      this.db.exec('ALTER TABLE reviews ADD COLUMN currentBranch TEXT')
    }

    // Migrate: convert old 0-10 scores to 0-100 scale
    this.migrateScoresToHundredScale()
  }

  private migrateScoresToHundredScale(): void {
    // Check if migration is needed (any score <= 10)
    const oldScores = this.db.prepare('SELECT COUNT(*) as count FROM reviews WHERE score IS NOT NULL AND score <= 10').get() as { count: number }
    if (oldScores.count > 0) {
      console.log(`[Database] Migrating ${oldScores.count} old scores from 0-10 to 0-100 scale`)
      this.db.prepare('UPDATE reviews SET score = score * 10 WHERE score IS NOT NULL AND score <= 10').run()
    }
  }

  addProject(project: Project): Project {
    const stmt = this.db.prepare(
      'INSERT INTO projects (id, name, type, path, remoteUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    )
    stmt.run(project.id, project.name, project.type, project.path, project.remoteUrl ?? null, project.createdAt)
    return project
  }

  getProjects(): Project[] {
    return this.db.prepare('SELECT * FROM projects ORDER BY lastReviewAt DESC, createdAt DESC').all() as Project[]
  }

  getProject(id: string): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined
  }

  deleteProject(id: string): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  }

  updateProjectLastReview(id: string, timestamp: number): void {
    this.db.prepare('UPDATE projects SET lastReviewAt = ? WHERE id = ?').run(timestamp, id)
  }

  updateProject(id: string, updates: Partial<Project>): void {
    const fields: string[] = []
    const values: any[] = []

    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.path !== undefined) {
      fields.push('path = ?')
      values.push(updates.path)
    }
    if (updates.remoteUrl !== undefined) {
      fields.push('remoteUrl = ?')
      values.push(updates.remoteUrl)
    }
    if (updates.type !== undefined) {
      fields.push('type = ?')
      values.push(updates.type)
    }

    if (fields.length === 0) return

    values.push(id)
    const sql = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`
    this.db.prepare(sql).run(...values)
  }

  addReview(review: Review): Review {
    const stmt = this.db.prepare(`
      INSERT INTO reviews (id, projectId, mode, commits, baseBranch, compareBranch, currentBranch, score,
        errorCount, warningCount, suggestionCount, llmProvider, llmModel,
        tokenUsed, costEstimate, duration, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      review.id, review.projectId, review.mode, review.commits?.join(',') ?? null,
      review.baseBranch ?? null, review.compareBranch ?? null, review.currentBranch ?? null, review.score, review.errorCount,
      review.warningCount, review.suggestionCount, review.llmProvider,
      review.llmModel, review.tokenUsed, review.costEstimate,
      review.duration, review.createdAt
    )
    return review
  }

  getReviews(projectId?: string): Review[] {
    if (projectId) {
      return (this.db.prepare('SELECT * FROM reviews WHERE projectId = ? ORDER BY createdAt DESC').all(projectId) as any[]).map(this.deserializeReview)
    }
    return (this.db.prepare('SELECT * FROM reviews ORDER BY createdAt DESC').all() as any[]).map(this.deserializeReview)
  }

  getReview(id: string): Review | undefined {
    const row = this.db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as any | undefined
    return row ? this.deserializeReview(row) : undefined
  }

  deleteReview(id: string): void {
    // Delete review issues first (foreign key constraint)
    this.db.prepare('DELETE FROM review_issues WHERE reviewId = ?').run(id)
    // Delete the review
    this.db.prepare('DELETE FROM reviews WHERE id = ?').run(id)
  }

  updateReviewScore(reviewId: string, score: number): void {
    this.db.prepare('UPDATE reviews SET score = ? WHERE id = ?').run(score, reviewId)
  }

  addReviewIssues(issues: ReviewIssue[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO review_issues (id, reviewId, file, line, severity, category,
        title, description, suggestion, fullstackTip, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertMany = this.db.transaction((items: ReviewIssue[]) => {
      for (const issue of items) {
        stmt.run(
          issue.id, issue.reviewId, issue.file, issue.line,
          issue.severity, issue.category, issue.title, issue.description,
          issue.suggestion ?? null, issue.fullstackTip ?? null, issue.source
        )
      }
    })
    insertMany(issues)
  }

  getReviewIssues(reviewId: string): ReviewIssue[] {
    return this.db.prepare('SELECT * FROM review_issues WHERE reviewId = ? ORDER BY severity ASC, line ASC').all(reviewId) as ReviewIssue[]
  }

  getAllIssues(): ReviewIssue[] {
    return this.db.prepare('SELECT * FROM review_issues').all() as ReviewIssue[]
  }

  getAllIssuesWithContext(): Array<ReviewIssue & { projectId: string; projectName: string; branch: string; reviewedAt: number }> {
    return this.db.prepare(`
      SELECT ri.*, r.projectId, p.name as projectName,
             COALESCE(r.currentBranch, r.baseBranch, r.compareBranch, 'main') as branch, r.createdAt as reviewedAt
      FROM review_issues ri
      JOIN reviews r ON ri.reviewId = r.id
      JOIN projects p ON r.projectId = p.id
      ORDER BY r.createdAt DESC
    `).all() as Array<ReviewIssue & { projectId: string; projectName: string; branch: string; reviewedAt: number }>
  }

  close(): void {
    this.db.close()
  }

  // --- Dashboard ---

  getDashboardTrend(days: 7 | 30 | 'all'): { date: string; avgScore: number; reviewCount: number }[] {
    const daysFilter = days === 'all' ? '' : `WHERE createdAt > ${Date.now() - days * 24 * 60 * 60 * 1000}`
    return this.db.prepare(`
      SELECT
        DATE(createdAt / 1000, 'unixepoch') as date,
        AVG(score) as avgScore,
        COUNT(*) as reviewCount
      FROM reviews
      ${daysFilter}
      GROUP BY DATE(createdAt / 1000, 'unixepoch')
      ORDER BY date ASC
    `).all() as { date: string; avgScore: number; reviewCount: number }[]
  }

  getDashboardIssuesDistribution(): { type: string; count: number; percentage: number }[] {
    const results = this.db.prepare(`
      SELECT category as type, COUNT(*) as count
      FROM review_issues
      GROUP BY category
    `).all() as { type: string; count: number }[]
    const total = results.reduce((sum, r) => sum + r.count, 0)
    return results.map(r => ({
      type: r.type,
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0
    }))
  }

  getDashboardLowScoreProjects(limit: number = 5): { id: string; name: string; score: number; lastReviewAt: string; issueCount: number }[] {
    const results = this.db.prepare(`
      SELECT
        p.id, p.name, r.score,
        r.createdAt as lastReviewAt,
        (SELECT COUNT(*) FROM review_issues WHERE reviewId = r.id) as issueCount
      FROM projects p
      INNER JOIN reviews r ON r.projectId = p.id
      WHERE r.createdAt = (SELECT MAX(createdAt) FROM reviews WHERE projectId = p.id)
      ORDER BY r.score ASC
      LIMIT ?
    `).all(limit) as any[]
    return results.map(r => ({ ...r, lastReviewAt: new Date(r.lastReviewAt).toISOString() }))
  }

  getDashboardStatistics(days: 7 | 30 | 'all'): {
    totalProjects: number; totalReviews: number; avgScore: number; issueCount: number;
    trends: { projects: string; reviews: string; score: string; issues: string }
  } {
    const now = Date.now()
    const daysMs = days === 'all' ? 0 : days * 24 * 60 * 60 * 1000
    const curFilter = days === 'all' ? '' : `WHERE createdAt > ${now - daysMs}`
    const prevFilter = days === 'all' ? '' : `WHERE createdAt BETWEEN ${now - daysMs * 2} AND ${now - daysMs}`

    const cur = this.db.prepare(`
      SELECT COUNT(DISTINCT projectId) as totalProjects, COUNT(*) as totalReviews, AVG(score) as avgScore
      FROM reviews ${curFilter}
    `).get() as { totalProjects: number; totalReviews: number; avgScore: number }

    const curIssues = this.db.prepare(`
      SELECT COUNT(*) as count FROM review_issues ri
      INNER JOIN reviews r ON r.id = ri.reviewId ${curFilter.replace('WHERE', 'WHERE r.')}
    `).get() as { count: number }

    const prev = this.db.prepare(`
      SELECT COUNT(DISTINCT projectId) as totalProjects, COUNT(*) as totalReviews, AVG(score) as avgScore
      FROM reviews ${prevFilter}
    `).get() as { totalProjects: number; totalReviews: number; avgScore: number }

    const prevIssues = this.db.prepare(`
      SELECT COUNT(*) as count FROM review_issues ri
      INNER JOIN reviews r ON r.id = ri.reviewId ${prevFilter.replace('WHERE', 'WHERE r.')}
    `).get() as { count: number }

    const trend = (a: number, b: number) => {
      if (b === 0) return 'stable'
      const d = ((a - b) / b) * 100
      return d > 5 ? 'up' : d < -5 ? 'down' : 'stable'
    }

    return {
      totalProjects: cur.totalProjects,
      totalReviews: cur.totalReviews,
      avgScore: cur.avgScore || 0,
      issueCount: curIssues.count,
      trends: {
        projects: trend(cur.totalProjects, prev.totalProjects),
        reviews: trend(cur.totalReviews, prev.totalReviews),
        score: trend(cur.avgScore, prev.avgScore),
        issues: trend(curIssues.count, prevIssues.count)
      }
    }
  }
}
