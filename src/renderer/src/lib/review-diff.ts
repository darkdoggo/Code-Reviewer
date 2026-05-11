import type { Review } from '@shared/types'

export interface DiffRefs {
  oldRef?: string
  newRef?: string
}

export function getDiffRefs(review: Review): DiffRefs {
  if (review.mode === 'staged') {
    return { oldRef: 'HEAD', newRef: undefined }
  }

  if (review.mode === 'branch') {
    return { oldRef: review.baseBranch, newRef: review.compareBranch || 'HEAD' }
  }

  if (review.mode === 'commits') {
    const commits = review.commits?.map((c) => c.trim()).filter(Boolean) ?? []
    if (commits.length >= 2) return { oldRef: commits[0], newRef: commits[1] }
    if (commits.length === 1) return { oldRef: `${commits[0]}~1`, newRef: commits[0] }
  }

  return { oldRef: undefined, newRef: undefined }
}
