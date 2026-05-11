# Frontend UI Implementation Plan

**Date:** 2026-04-22  
**Status:** In Progress

## Overview

Build the complete React renderer UI. Backend (main process, IPC, preload) is fully implemented. All data is accessed via `window.api`.

## Architecture Decisions

- **Routing:** State-based via Zustand `currentPage` (no react-router — Electron SPA)
- **State:** Single Zustand store with slices for projects, reviews, config, UI
- **Styling:** Tailwind v4 + CSS vars already configured in globals.css
- **Components:** Radix UI primitives already installed

## File Structure

```
src/renderer/src/
├── store/
│   └── index.ts          # Zustand store (all slices)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Layout.tsx
│   └── ui/               # Reusable primitives (Button, Badge, etc.)
├── pages/
│   ├── DashboardPage.tsx
│   ├── ProjectsPage.tsx
│   ├── ReviewPage.tsx    # Review workflow: config → run → results
│   ├── HistoryPage.tsx
│   └── SettingsPage.tsx
└── App.tsx               # Root: Layout + page router
```

## Tasks

### Task 1: Zustand Store
File: `src/renderer/src/store/index.ts`

State shape:
```ts
{
  // Navigation
  currentPage: 'dashboard' | 'projects' | 'review' | 'history' | 'settings'
  selectedProjectId: string | null
  selectedReviewId: string | null

  // Data
  projects: Project[]
  reviews: Review[]
  config: UserConfig | null

  // Review workflow
  reviewProgress: { stage: string; percent: number } | null
  activeReview: Review | null
  reviewIssues: ReviewIssue[]
  reviewDiffs: FileDiff[]
}
```

### Task 2: App Shell (Layout + Sidebar)
- `Layout.tsx`: flex row, sidebar + main content
- `Sidebar.tsx`: 220px, nav items with icons, active state
- Nav items: Dashboard, Projects, History, Settings
- Wire `App.tsx` to render Layout + current page

### Task 3: Settings Page
First page to build — user needs to enter API key before anything works.
- LLM section: provider (locked to anthropic), model select, API key input, baseUrl
- Test Connection button → `window.api.testLLMConnection()`
- UI section: theme toggle (light/dark/system), diffMode toggle
- Save via `window.api.updateConfig()`

### Task 4: Dashboard Page
- Stats row: total reviews, total issues found, avg score
- Recent reviews list (last 5)
- "Start New Review" button → navigate to Projects if no project selected, else Review page

### Task 5: Projects Page
- Project list with name, path, last review date
- "Add Project" button → `window.api.selectDirectory()` → `window.api.getGitInfo()` → `window.api.addProject()`
- Delete project with confirmation
- Click project → navigate to Review page with that project selected

### Task 6: Review Page (core workflow)
Three states:
1. **Config:** Select diff mode (staged/branch/commits), pick branch or commits, "Start Review" button
2. **Running:** Progress bar with stage label (10→20→40→80→100%)
3. **Results:** Score card, issue counts, issue list, file diff viewer

Issue list:
- Filter by severity (error/warning/suggestion)
- Filter by category
- Each issue: file:line, title, description, suggestion, fullstackTip badge

Diff viewer:
- File list on left, Monaco diff editor on right
- Click issue → jump to that file

### Task 7: History Page
- All reviews across all projects (or filtered by project)
- Each row: project name, date, score, error/warning/suggestion counts, model used
- Click row → navigate to Review page showing that review's results

## Implementation Order

1. Store → 2. Layout/Sidebar → 3. App.tsx wiring → 4. Settings → 5. Dashboard → 6. Projects → 7. Review → 8. History
