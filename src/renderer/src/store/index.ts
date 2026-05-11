import { create } from 'zustand'

import type { Project, Review, ReviewIssue, UserConfig, DiffOptions, FileDiff } from '@shared/types'

export type Page = 'dashboard' | 'projects' | 'review' | 'history' | 'settings' | 'learning'

interface ReviewProgress {
  stage: string
  percent: number
}

interface ReviewerStore {
  currentPage: Page
  selectedProjectId: string | null
  selectedReviewId: string | null

  // UI state
  sidebarCollapsed: boolean
  fileTreeWidth: number
  issuesPanelWidth: number
  fileTreeCollapsed: boolean
  issuesPanelCollapsed: boolean

  projects: Project[]
  reviews: Review[]
  config: UserConfig | null

  reviewProgress: ReviewProgress | null
  activeReview: Review | null
  reviewIssues: ReviewIssue[]
  reviewDiffs: FileDiff[]

  isLoadingProjects: boolean
  isLoadingReviews: boolean
  isLoadingConfig: boolean
  isStartingReview: boolean
  error: string | null

  initialize: () => Promise<void>
  navigate: (page: Page) => void
  selectProject: (projectId: string | null) => void
  selectReview: (reviewId: string | null) => void
  loadProjects: () => Promise<void>
  addProject: (name: string, pathOrUrl: string, type?: 'local' | 'github' | 'gitlab') => Promise<Project>
  deleteProject: (projectId: string) => Promise<void>
  refreshProject: (projectId: string) => Promise<void>
  loadReviews: (projectId?: string) => Promise<void>
  deleteReview: (reviewId: string) => Promise<void>
  loadConfig: () => Promise<void>
  saveConfig: (config: Partial<UserConfig>) => Promise<void>
  startReview: (projectId: string, options: DiffOptions) => Promise<void>
  loadReviewDetails: (review: Review) => Promise<void>
  setReviewDiffs: (diffs: FileDiff[]) => void
  clearReviewState: () => void
  setError: (error: string | null) => void
  toggleSidebar: () => void
  setFileTreeWidth: (width: number) => void
  setIssuesPanelWidth: (width: number) => void
  toggleFileTree: () => void
  toggleIssuesPanel: () => void
}

let unsubscribeProgress: (() => void) | null = null
let unsubscribeScoreReady: (() => void) | null = null

export const useReviewerStore = create<ReviewerStore>((set, get) => ({
  currentPage: 'dashboard',
  selectedProjectId: null,
  selectedReviewId: null,

  // UI state
  sidebarCollapsed: false,
  fileTreeWidth: 256,
  issuesPanelWidth: 340,
  fileTreeCollapsed: false,
  issuesPanelCollapsed: false,

  projects: [],
  reviews: [],
  config: null,

  reviewProgress: null,
  activeReview: null,
  reviewIssues: [],
  reviewDiffs: [],

  isLoadingProjects: false,
  isLoadingReviews: false,
  isLoadingConfig: false,
  isStartingReview: false,
  error: null,

  initialize: async () => {
    if (!unsubscribeProgress) {
      unsubscribeProgress = window.api.onReviewProgress((progress) => {
        set({ reviewProgress: progress })
      })
    }

    if (!unsubscribeScoreReady) {
      unsubscribeScoreReady = window.api.onReviewScoreReady(({ reviewId, score }) => {
        const state = get()

        // Update active review if it matches
        if (state.activeReview?.id === reviewId) {
          set({ activeReview: { ...state.activeReview, score } })
        }

        // Update in reviews list
        const reviews = state.reviews.map((r) =>
          r.id === reviewId ? { ...r, score } : r
        )
        set({ reviews })

        console.log(`[Store] Score updated for review ${reviewId}: ${score}`)
      })
    }

    await Promise.all([
      get().loadProjects(),
      get().loadReviews(),
      get().loadConfig(),
    ])
  },

  navigate: (page) => set({ currentPage: page, error: null }),

  selectProject: (projectId) => set({ selectedProjectId: projectId }),

  selectReview: (reviewId) => set({ selectedReviewId: reviewId }),

  loadProjects: async () => {
    set({ isLoadingProjects: true, error: null })

    try {
      const projects = await window.api.getProjects()
      set((state) => ({
        projects,
        selectedProjectId:
          state.selectedProjectId && projects.some((project) => project.id === state.selectedProjectId)
            ? state.selectedProjectId
            : projects[0]?.id ?? null,
        isLoadingProjects: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load projects',
        isLoadingProjects: false,
      })
    }
  },

  addProject: async (name, pathOrUrl, type = 'local') => {
    set({ error: null })

    try {
      const project = await window.api.addProject(name, pathOrUrl, type)
      set((state) => ({
        projects: [project, ...state.projects],
        selectedProjectId: project.id,
      }))
      return project
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add project'
      set({ error: message })
      throw error
    }
  },

  deleteProject: async (projectId) => {
    set({ error: null })

    try {
      await window.api.deleteProject(projectId)
      set((state) => {
        const projects = state.projects.filter((project) => project.id !== projectId)
        const reviews = state.reviews.filter((review) => review.projectId !== projectId)
        const selectedProjectId = state.selectedProjectId === projectId ? projects[0]?.id ?? null : state.selectedProjectId

        return {
          projects,
          reviews,
          selectedProjectId,
        }
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete project' })
      throw error
    }
  },

  refreshProject: async (projectId) => {
    set({ error: null })

    try {
      await window.api.refreshProject(projectId)
      await get().loadProjects()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refresh project' })
      throw error
    }
  },

  loadReviews: async (projectId) => {
    set({ isLoadingReviews: true, error: null })

    try {
      const reviews = await window.api.getReviews(projectId)
      set({ reviews, isLoadingReviews: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load reviews',
        isLoadingReviews: false,
      })
    }
  },

  deleteReview: async (reviewId) => {
    try {
      await window.api.deleteReview(reviewId)
      const reviews = get().reviews.filter((r) => r.id !== reviewId)
      set({ reviews })
      // If the deleted review was active, clear it
      if (get().activeReview?.id === reviewId) {
        get().clearReviewState()
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete review' })
      throw error
    }
  },

  loadConfig: async () => {
    set({ isLoadingConfig: true, error: null })

    try {
      const config = await window.api.getConfig()
      set({ config, isLoadingConfig: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load config',
        isLoadingConfig: false,
      })
    }
  },

  saveConfig: async (config) => {
    set({ error: null })

    try {
      await window.api.updateConfig(config)
      const nextConfig = await window.api.getConfig()
      set({ config: nextConfig })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save config' })
      throw error
    }
  },

  startReview: async (projectId, options) => {
    set({
      isStartingReview: true,
      reviewProgress: { stage: 'Preparing review', percent: 0 },
      activeReview: null,
      reviewIssues: [],
      reviewDiffs: [],
      selectedProjectId: projectId,
      error: null,
    })

    try {
      const review = await window.api.startReview(projectId, options)
      const [issues, diffs] = await Promise.all([
        window.api.getReviewIssues(review.id),
        window.api.getDiff(projectId, options),
      ])

      set((state) => ({
        activeReview: review,
        selectedReviewId: review.id,
        reviewIssues: issues,
        reviewDiffs: diffs,
        reviewProgress: { stage: 'Review completed', percent: 100 },
        isStartingReview: false,
        reviews: [review, ...state.reviews],
        currentPage: 'review',
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start review',
        isStartingReview: false,
        reviewProgress: null,
      })
      throw error
    }
  },

  loadReviewDetails: async (review) => {
    set({ error: null, activeReview: review, selectedReviewId: review.id, reviewProgress: null })

    try {
      const issues = await window.api.getReviewIssues(review.id)
      const diffs = await window.api.getDiff(review.projectId, {
        mode: review.mode,
        commits: review.commits,
        baseBranch: review.baseBranch,
        compareBranch: review.compareBranch,
      })

      set({
        reviewIssues: issues,
        reviewDiffs: diffs,
        currentPage: 'review',
        selectedProjectId: review.projectId,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load review details' })
      throw error
    }
  },

  setReviewDiffs: (diffs) => set({ reviewDiffs: diffs }),

  clearReviewState: () =>
    set({
      reviewProgress: null,
      activeReview: null,
      selectedReviewId: null,
      reviewIssues: [],
      reviewDiffs: [],
      error: null,
    }),

  setError: (error) => set({ error }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setFileTreeWidth: (width) => set({ fileTreeWidth: Math.max(160, Math.min(500, width)) }),
  setIssuesPanelWidth: (width) => set({ issuesPanelWidth: Math.max(200, Math.min(600, width)) }),
  toggleFileTree: () => set((s) => ({ fileTreeCollapsed: !s.fileTreeCollapsed })),
  toggleIssuesPanel: () => set((s) => ({ issuesPanelCollapsed: !s.issuesPanelCollapsed })),
}))
