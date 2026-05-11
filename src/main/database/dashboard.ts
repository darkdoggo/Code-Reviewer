import type { Database } from 'better-sqlite3';

export interface TrendDataPoint {
  date: string;
  avgScore: number;
  reviewCount: number;
}

export interface IssueDistribution {
  type: 'security' | 'performance' | 'style' | 'other';
  count: number;
  percentage: number;
}

export interface LowScoreProject {
  id: string;
  name: string;
  score: number;
  lastReviewAt: string;
  issueCount: number;
}

export interface Statistics {
  totalProjects: number;
  totalReviews: number;
  avgScore: number;
  issueCount: number;
  trends: {
    projects: 'up' | 'down' | 'stable';
    reviews: 'up' | 'down' | 'stable';
    score: 'up' | 'down' | 'stable';
    issues: 'up' | 'down' | 'stable';
  };
}

export class DashboardService {
  constructor(private db: Database) {}

  getTrendData(days: 7 | 30 | 'all'): TrendDataPoint[] {
    const daysFilter = days === 'all' ? '' : `WHERE createdAt > ${Date.now() - days * 24 * 60 * 60 * 1000}`;
    
    const stmt = this.db.prepare(`
      SELECT 
        DATE(createdAt / 1000, 'unixepoch') as date,
        AVG(score) as avgScore,
        COUNT(*) as reviewCount
      FROM reviews
      ${daysFilter}
      GROUP BY DATE(createdAt / 1000, 'unixepoch')
      ORDER BY date ASC
    `);

    return stmt.all() as TrendDataPoint[];
  }

  getIssuesDistribution(): IssueDistribution[] {
    const stmt = this.db.prepare(`
      SELECT 
        category as type,
        COUNT(*) as count
      FROM review_issues
      GROUP BY category
    `);

    const results = stmt.all() as { type: string; count: number }[];
    const total = results.reduce((sum, r) => sum + r.count, 0);

    return results.map(r => ({
      type: r.type as IssueDistribution['type'],
      count: r.count,
      percentage: total > 0 ? (r.count / total) * 100 : 0
    }));
  }

  getLowScoreProjects(limit: number = 5): LowScoreProject[] {
    const stmt = this.db.prepare(`
      SELECT 
        p.id,
        p.name,
        r.score,
        r.createdAt as lastReviewAt,
        (
          SELECT COUNT(*) 
          FROM review_issues 
          WHERE reviewId = r.id
        ) as issueCount
      FROM projects p
      INNER JOIN reviews r ON r.projectId = p.id
      WHERE r.createdAt = (
        SELECT MAX(createdAt) 
        FROM reviews 
        WHERE projectId = p.id
      )
      ORDER BY r.score ASC
      LIMIT ?
    `);

    const results = stmt.all(limit) as any[];
    return results.map(r => ({
      ...r,
      lastReviewAt: new Date(r.lastReviewAt).toISOString()
    }));
  }

  getStatistics(days: 7 | 30 | 'all'): Statistics {
    const now = Date.now();
    const daysMs = days === 'all' ? 0 : days * 24 * 60 * 60 * 1000;
    const daysFilter = days === 'all' ? '' : `WHERE createdAt > ${now - daysMs}`;
    
    const current = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT projectId) as totalProjects,
        COUNT(*) as totalReviews,
        AVG(score) as avgScore
      FROM reviews
      ${daysFilter}
    `).get() as { totalProjects: number; totalReviews: number; avgScore: number };

    const issueCount = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM review_issues ri
      INNER JOIN reviews r ON r.id = ri.reviewId
      ${daysFilter.replace('createdAt', 'r.createdAt')}
    `).get() as { count: number };

    const prevDaysFilter = days === 'all' 
      ? '' 
      : `WHERE createdAt BETWEEN ${now - daysMs * 2} AND ${now - daysMs}`;
    
    const previous = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT projectId) as totalProjects,
        COUNT(*) as totalReviews,
        AVG(score) as avgScore
      FROM reviews
      ${prevDaysFilter}
    `).get() as { totalProjects: number; totalReviews: number; avgScore: number };

    const prevIssueCount = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM review_issues ri
      INNER JOIN reviews r ON r.id = ri.reviewId
      ${prevDaysFilter.replace('createdAt', 'r.createdAt')}
    `).get() as { count: number };

    const getTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
      if (previous === 0) return 'stable';
      const change = ((current - previous) / previous) * 100;
      if (change > 5) return 'up';
      if (change < -5) return 'down';
      return 'stable';
    };

    return {
      totalProjects: current.totalProjects,
      totalReviews: current.totalReviews,
      avgScore: current.avgScore || 0,
      issueCount: issueCount.count,
      trends: {
        projects: getTrend(current.totalProjects, previous.totalProjects),
        reviews: getTrend(current.totalReviews, previous.totalReviews),
        score: getTrend(current.avgScore, previous.avgScore),
        issues: getTrend(issueCount.count, prevIssueCount.count)
      }
    };
  }
}
