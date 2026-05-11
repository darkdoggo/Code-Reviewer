import { z } from 'zod'

// Map non-standard severity values to valid ones
const severityTransform = z.string().transform((val) => {
  const map: Record<string, string> = {
    info: 'suggestion',
    note: 'suggestion',
    hint: 'suggestion',
    critical: 'error',
    major: 'error',
    minor: 'warning',
    low: 'suggestion',
    medium: 'warning',
    high: 'error',
  }
  return map[val.toLowerCase()] || val
}).pipe(z.enum(['error', 'warning', 'suggestion']))

// Map non-standard category values to valid ones
const categoryTransform = z.string().transform((val) => {
  const map: Record<string, string> = {
    'code-quality': 'robustness',
    'code_quality': 'robustness',
    'quality': 'robustness',
    'type-safety': 'robustness',
    'type_safety': 'robustness',
    'complexity': 'architecture',
    'maintainability': 'architecture',
    'readability': 'architecture',
    'style': 'architecture',
    'best-practice': 'robustness',
    'best_practice': 'robustness',
    'bug': 'robustness',
    'error-handling': 'robustness',
    'error_handling': 'robustness',
  }
  return map[val.toLowerCase()] || val
}).pipe(z.enum(['security', 'performance', 'robustness', 'architecture']))

export const ReviewIssueSchema = z.object({
  file: z.string(),
  line: z.number().default(1),
  severity: severityTransform,
  category: categoryTransform,
  title: z.string().default('Code issue'),
  description: z.string(),
  suggestion: z.string().optional(),
  fullstackTip: z.string().optional()
})

export const ReviewResultSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  issues: z.array(ReviewIssueSchema)
})

export type ReviewResult = z.infer<typeof ReviewResultSchema>
export type ReviewIssueResult = z.infer<typeof ReviewIssueSchema>
