# Monaco Diff Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real Monaco diff viewer to the Review results page so users can inspect old vs new code and jump from issues to the relevant file and line.

**Architecture:** Keep backend and IPC unchanged. Compute the old/new refs in the renderer from the existing `Review` metadata, fetch file contents on demand through `window.api.getFileContent()`, and render them with `@monaco-editor/react`'s `DiffEditor`. Update the Review page layout from two columns to three columns so file selection, diff viewing, and issue browsing all stay visible.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS v4, Electron preload API, `@monaco-editor/react`, existing `window.api` IPC bridge

---

## Preconditions

- The repo already has `@monaco-editor/react` installed in `package.json`.
- The existing Review UI lives in `src/renderer/src/pages/ReviewPage.tsx`.
- The only file-content API available is `window.api.getFileContent(projectId, filePath, ref?)`.
- This repo currently has no renderer test runner. Do not add Vitest/Jest for this feature. Verification for this change is `npm run typecheck:web`, `npm run build`, and manual UI validation in `npm run dev`.

## Reference Files To Read Before Editing

- `src/renderer/src/pages/ReviewPage.tsx`
- `src/shared/types/models.ts`
- `src/shared/types/git.ts`
- `src/shared/types/ipc.ts`
- `src/main/services/git.ts`

### Task 1: Add diff ref resolution helper

**Files:**
- Create: `src/renderer/src/lib/review-diff.ts`
- Modify: `src/renderer/src/pages/ReviewPage.tsx`
- Verify: `npm run typecheck:web`

**Step 1: Create the helper file**

Create `src/renderer/src/lib/review-diff.ts` with these exact exports:

```ts
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
    return { oldRef: review.baseBranch, newRef: 'HEAD' }
  }

  if (review.mode === 'commits') {
    const commits = review.commits?.split(',').map((item) => item.trim()).filter(Boolean) ?? []

    if (commits.length >= 2) {
      return { oldRef: commits[0], newRef: commits[1] }
    }

    if (commits.length === 1) {
      return { oldRef: `${commits[0]}~1`, newRef: commits[0] }
    }
  }

  return { oldRef: undefined, newRef: undefined }
}
```

**Step 2: Run verification**

Run: `npm run typecheck:web`

Expected: success with no TypeScript errors.

**Step 3: Commit**

```bash
git add src/renderer/src/lib/review-diff.ts
git commit -m "feat: add review diff ref resolver"
```

### Task 2: Build the Monaco diff viewer component

**Files:**
- Create: `src/renderer/src/components/DiffViewer.tsx`
- Modify: `src/renderer/src/lib/review-diff.ts`
- Verify: `npm run typecheck:web`

**Step 1: Create the viewer component**

Create `src/renderer/src/components/DiffViewer.tsx`.

Use this component shape:

```ts
interface DiffViewerProps {
  projectId: string
  review: Review
  file: FileDiff | null
  targetLine?: number | null
}
```

Implementation requirements:

1. Import `DiffEditor` from `@monaco-editor/react`.
2. Use `useEffect` to fetch contents when `projectId`, `review`, or `file` changes.
3. Use `getDiffRefs(review)` from `src/renderer/src/lib/review-diff.ts`.
4. For the selected file:
   - fetch original content with `window.api.getFileContent(projectId, file.file, oldRef)` when `oldRef` exists
   - fetch modified content with `window.api.getFileContent(projectId, file.file, newRef)` when `newRef` exists
   - for `undefined` ref, call `window.api.getFileContent(projectId, file.file)`
5. Handle added/deleted files safely:
   - if fetching the old side fails for an added file, use `''`
   - if fetching the new side fails for a deleted file, use `''`
6. Track `isLoading`, `error`, `original`, and `modified` in local state.
7. Render states:
   - no file selected: centered placeholder `Select a file to preview the diff`
   - loading: centered spinner text
   - error: compact error panel
   - ready: `DiffEditor`
8. Set editor options:

```ts
{
  readOnly: true,
  renderSideBySide: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on'
}
```

9. Capture the modified editor instance in `onMount` and, when `targetLine` changes, call:

```ts
editor.revealLineInCenter(targetLine)
editor.setPosition({ lineNumber: targetLine, column: 1 })
```

10. Infer the Monaco language from the file extension with a small local helper inside the component. Support at least: `ts`, `tsx`, `js`, `jsx`, `json`, `css`, `md`, `html`, `yml`, `yaml`.

**Step 2: Run verification**

Run: `npm run typecheck:web`

Expected: success with no TypeScript errors.

**Step 3: Commit**

```bash
git add src/renderer/src/components/DiffViewer.tsx src/renderer/src/lib/review-diff.ts
git commit -m "feat: add Monaco diff viewer"
```

### Task 3: Update Review page state to drive file and line focus

**Files:**
- Modify: `src/renderer/src/pages/ReviewPage.tsx`
- Verify: `npm run typecheck:web`

**Step 1: Add selected line state**

In `ReviewPage`, add:

```ts
const [selectedLine, setSelectedLine] = useState<number | null>(null)
```

Reset it in `handleBack()`:

```ts
setSelectedLine(null)
```

**Step 2: Wire file selection to clear line focus**

When a file is selected from the file list, update both states:

```ts
onClick={() => {
  onSelectFile(selectedFile?.file === diff.file ? null : diff)
  onSeverityFilter(null)
}}
```

In the local `ReviewPage` wrapper, set `selectedLine` to `null` when selecting a file directly.

**Step 3: Add issue click behavior**

Change `IssueCard` to accept:

```ts
onSelect?: (issue: ReviewIssue) => void
```

When the issue card header is clicked:
- keep the existing expand/collapse behavior
- also call `onSelect?.(issue)`

In `ReviewResults`, pass a handler that:
1. finds the matching `FileDiff` by `issue.file`
2. sets that file as selected
3. sets `selectedLine` to `issue.line`

**Step 4: Run verification**

Run: `npm run typecheck:web`

Expected: success with no TypeScript errors.

**Step 5: Commit**

```bash
git add src/renderer/src/pages/ReviewPage.tsx
git commit -m "feat: add file and line selection in review results"
```

### Task 4: Replace the results layout with a three-column workspace

**Files:**
- Modify: `src/renderer/src/pages/ReviewPage.tsx:187-352`
- Verify: `npm run typecheck:web`

**Step 1: Keep the existing header and stats row**

Do not change the review score summary behavior.

**Step 2: Replace the current two-column content area**

Change the main results content from:
- file list
- issue list

To:
- left sidebar: file list (`w-56`)
- center pane: diff viewer (`flex-1 min-w-0`)
- right sidebar: issue list (`w-[360px] shrink-0 overflow-y-auto`)

Use this layout skeleton:

```tsx
<div className="flex gap-4 flex-1 min-h-0">
  <div className="w-56 shrink-0 ...">...</div>
  <div className="flex-1 min-w-0 rounded-md border border-[hsl(var(--border))] overflow-hidden">
    <DiffViewer
      projectId={project.id}
      review={review}
      file={selectedFile}
      targetLine={selectedLine}
    />
  </div>
  <div className="w-[360px] shrink-0 overflow-y-auto space-y-2">...</div>
</div>
```

**Step 3: Preserve current filters**

Keep the existing severity filter behavior. The issue list should still show:
- all filtered issues when no file is selected
- only that file's filtered issues when a file is selected

**Step 4: Improve empty states**

- if there are no issues after filtering, keep the empty message in the right sidebar
- if there is no selected file, the center pane shows the diff placeholder from `DiffViewer`

**Step 5: Run verification**

Run: `npm run typecheck:web`

Expected: success with no TypeScript errors.

**Step 6: Commit**

```bash
git add src/renderer/src/pages/ReviewPage.tsx src/renderer/src/components/DiffViewer.tsx
git commit -m "feat: add three-column review workspace"
```

### Task 5: Verify build and manually validate the interaction flow

**Files:**
- Verify only: no new files required

**Step 1: Run renderer typecheck**

Run: `npm run typecheck:web`

Expected: success with no TypeScript errors.

**Step 2: Run full build**

Run: `npm run build`

Expected: Electron main, preload, and renderer all build successfully.

**Step 3: Run the app manually**

Run: `npm run dev`

Manual checklist:
1. Open a project with at least one review result.
2. Open Review results.
3. Click a file in the left sidebar.
4. Confirm Monaco shows old/new code.
5. Click an issue on the right.
6. Confirm the matching file becomes selected.
7. Confirm the diff view scrolls near the issue line.
8. Switch severity filters and confirm the right sidebar updates.
9. Deselect the file and confirm the center pane returns to placeholder state.

**Step 4: Commit**

```bash
git add src/renderer/src/components/DiffViewer.tsx src/renderer/src/pages/ReviewPage.tsx src/renderer/src/lib/review-diff.ts
git commit -m "feat: finish Monaco diff review flow"
```

## Notes For Execution

- Do not modify `src/main/services/git.ts` or any IPC types for this feature.
- Prefer small commits after each task.
- Keep the editor read-only.
- Do not add a new dependency.
- Do not rewrite the entire Review page; keep existing stats, filters, and cards unless required for the new layout.
