# Monaco Diff Viewer 设计文档

**日期：** 2026-04-22
**状态：** 已批准

## 目标

在 Review 结果页集成 Monaco DiffEditor，让用户能看到真正的代码 diff，并支持点击 issue 跳转到对应文件和行。

## 方案

方案 A：前端通过 `window.api.getFileContent()` 按需加载 old/new 内容，喂给 `@monaco-editor/react` 的 `DiffEditor`。不改 backend。

## 布局变更

Review 结果页从两栏变为三栏：
- 左：文件列表（已有，w-56）
- 中：Monaco DiffEditor（新增，flex-1）
- 右：Issue 列表（已有，w-80）

选中文件时显示 diff，未选中时显示 issue 全列表。

## 数据流

1. 用户点击文件 → 根据 review.mode 推导 old ref：
   - `staged`: old = `HEAD`, new = 工作区（staged 内容）
   - `branch`: old = `baseBranch`, new = `HEAD`
   - `commits`: old = `commit~1`, new = `commit`（单 commit）或 `commits[0]` / `commits[1]`
2. 调用 `getFileContent(projectId, file, oldRef)` 和 `getFileContent(projectId, file, newRef)` 获取内容
3. 传入 `DiffEditor original={old} modified={new}`
4. 点击 issue → 切换到对应文件 + `editor.revealLineInCenter(line)`

## 文件变更

- 新增: `src/renderer/src/components/DiffViewer.tsx`
- 修改: `src/renderer/src/pages/ReviewPage.tsx`（布局调整 + issue 点击跳转）
