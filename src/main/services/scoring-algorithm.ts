import type { ReviewIssue, FileDiff } from '@shared/types'

export interface ScoringFactors {
  totalFiles: number
  filesWithIssues: number
  errorCount: number
  warningCount: number
  suggestionCount: number
  securityIssues: number
  performanceIssues: number
  diffSize: number // total lines changed
}

/**
 * Calculate code quality score (0-100) based on issue counts and severity.
 * Industry best practices:
 * - Security issues are weighted heavily
 * - Proportion of clean files matters
 * - Errors are more severe than warnings
 */
export function calculateDeterministicScore(factors: ScoringFactors): number {
  let score = 100

  // Deduct for errors (severe) - max 8 points each
  score -= Math.min(factors.errorCount * 8, 40)

  // Deduct for warnings (moderate) - max 3 points each
  score -= Math.min(factors.warningCount * 3, 30)

  // Deduct for suggestions (minor) - max 1 point each
  score -= Math.min(factors.suggestionCount * 1, 10)

  // Extra penalty for security issues - 5 points each
  score -= factors.securityIssues * 5

  // Extra penalty for performance issues - 3 points each
  score -= factors.performanceIssues * 3

  // Bonus for clean files (proportion matters)
  if (factors.totalFiles > 0) {
    const cleanFileRatio = (factors.totalFiles - factors.filesWithIssues) / factors.totalFiles
    score += cleanFileRatio * 15
  }

  // Small bonus for small diffs (easier to review)
  if (factors.diffSize < 100) {
    score += 2
  }

  // Cap at 0-100
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Extract scoring factors from review data
 */
export function extractScoringFactors(
  issues: ReviewIssue[],
  diffs: FileDiff[]
): ScoringFactors {
  const filesWithIssues = new Set(issues.map((i) => i.file)).size
  const securityIssues = issues.filter((i) => i.category === 'security').length
  const performanceIssues = issues.filter((i) => i.category === 'performance').length
  const diffSize = diffs.reduce((sum, d) => sum + d.additions + d.deletions, 0)

  return {
    totalFiles: diffs.length,
    filesWithIssues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    suggestionCount: issues.filter((i) => i.severity === 'suggestion').length,
    securityIssues,
    performanceIssues,
    diffSize,
  }
}
