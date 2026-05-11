# 国际化（i18n）实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Reviewer Agent 添加中英文切换支持，包括 UI 语言和 LLM 输出语言的独立控制

**Architecture:** 使用 react-i18next 处理 UI 翻译，在配置中添加 uiLanguage 和 outputLanguage 字段，顶部导航栏添加语言切换器，Settings 页面添加 LLM 输出语言选择器，LLM prompt 根据 outputLanguage 动态调整

**Tech Stack:** React, TypeScript, react-i18next, i18next, Zustand, Electron

---

## Phase 1: 基础设施

### Task 1: 安装 i18n 依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装依赖**

Run: `npm install react-i18next i18next`

Expected: 依赖安装成功

**Step 2: 验证安装**

Run: `npm list react-i18next i18next`

Expected: 显示已安装的版本

**Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "deps: add react-i18next and i18next for internationalization"
```

---

### Task 2: 更新配置类型

**Files:**
- Modify: `src/shared/types/config.ts`
- Modify: `src/shared/schemas.ts`

**Step 1: 添加语言字段到 UIConfig**

In `src/shared/types/config.ts`, update:

```typescript
export interface UIConfig {
  theme: 'light' | 'dark' | 'system'
  diffMode: 'unified' | 'split'
  uiLanguage: 'en' | 'zh'
}
```

**Step 2: 添加语言字段到 LLMConfig**

In `src/shared/types/config.ts`, update:

```typescript
export interface LLMConfig {
  provider: 'anthropic' | 'openai'
  model: string
  apiKey: string
  baseUrl?: string
  temperature: number
  maxTokens: number
  outputLanguage: 'en' | 'zh'
}
```

**Step 3: 更新 Zod schemas**

In `src/shared/schemas.ts`, update the schemas to include the new fields:

```typescript
// Find UIConfigSchema and add:
uiLanguage: z.enum(['en', 'zh'])

// Find LLMConfigSchema and add:
outputLanguage: z.enum(['en', 'zh'])
```

**Step 4: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过（可能有错误，因为 ConfigService 还未更新默认值）

**Step 5: 提交**

```bash
git add src/shared/types/config.ts src/shared/schemas.ts
git commit -m "feat: add uiLanguage and outputLanguage to config types"
```

---

### Task 3: 更新 ConfigService 默认值

**Files:**
- Modify: `src/main/services/config.ts`

**Step 1: 更新默认配置**

In `src/main/services/config.ts`, update the `defaults` object:

```typescript
const defaults: UserConfig = {
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
    temperature: 0.3,
    maxTokens: 4096,
    outputLanguage: 'en'  // 新增
  },
  ui: {
    theme: 'system',
    diffMode: 'unified',
    uiLanguage: 'en'  // 新增
  }
}
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 3: 提交**

```bash
git add src/main/services/config.ts
git commit -m "feat: add default language settings to config"
```

---

### Task 4: 创建翻译文件结构

**Files:**
- Create: `src/renderer/src/locales/en/common.json`
- Create: `src/renderer/src/locales/en/pages.json`
- Create: `src/renderer/src/locales/en/settings.json`
- Create: `src/renderer/src/locales/en/review.json`
- Create: `src/renderer/src/locales/en/errors.json`
- Create: `src/renderer/src/locales/zh/common.json`
- Create: `src/renderer/src/locales/zh/pages.json`
- Create: `src/renderer/src/locales/zh/settings.json`
- Create: `src/renderer/src/locales/zh/review.json`
- Create: `src/renderer/src/locales/zh/errors.json`

**Step 1: 创建目录结构**

Run: `mkdir -p src/renderer/src/locales/en src/renderer/src/locales/zh`

**Step 2: 创建 common.json (英文)**

Create `src/renderer/src/locales/en/common.json`:

```json
{
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "confirm": "Confirm",
  "loading": "Loading...",
  "error": "Error",
  "success": "Success",
  "back": "Back",
  "next": "Next",
  "close": "Close",
  "edit": "Edit",
  "add": "Add",
  "remove": "Remove",
  "search": "Search",
  "filter": "Filter",
  "refresh": "Refresh",
  "export": "Export",
  "import": "Import"
}
```

**Step 3: 创建 common.json (中文)**

Create `src/renderer/src/locales/zh/common.json`:

```json
{
  "save": "保存",
  "cancel": "取消",
  "delete": "删除",
  "confirm": "确认",
  "loading": "加载中...",
  "error": "错误",
  "success": "成功",
  "back": "返回",
  "next": "下一步",
  "close": "关闭",
  "edit": "编辑",
  "add": "添加",
  "remove": "移除",
  "search": "搜索",
  "filter": "筛选",
  "refresh": "刷新",
  "export": "导出",
  "import": "导入"
}
```

**Step 4: 创建 pages.json (英文)**

Create `src/renderer/src/locales/en/pages.json`:

```json
{
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Overview of your code reviews"
  },
  "projects": {
    "title": "Projects",
    "subtitle": "Manage your repositories",
    "addProject": "Add Project",
    "selectDirectory": "Select Directory",
    "noProjects": "No projects yet. Add one to get started.",
    "lastReview": "Last review"
  },
  "review": {
    "title": "Review",
    "newReview": "New Review",
    "startReview": "Start Review",
    "reviewResults": "Review Results",
    "noChanges": "No changes found",
    "selectProject": "No project selected"
  },
  "history": {
    "title": "History",
    "subtitle": "Past code reviews",
    "noHistory": "No review history yet"
  },
  "settings": {
    "title": "Settings",
    "subtitle": "Configure your preferences"
  }
}
```

**Step 5: 创建 pages.json (中文)**

Create `src/renderer/src/locales/zh/pages.json`:

```json
{
  "dashboard": {
    "title": "仪表盘",
    "subtitle": "代码审查概览"
  },
  "projects": {
    "title": "项目",
    "subtitle": "管理你的代码仓库",
    "addProject": "添加项目",
    "selectDirectory": "选择目录",
    "noProjects": "还没有项目。添加一个开始吧。",
    "lastReview": "最后审查"
  },
  "review": {
    "title": "审查",
    "newReview": "新建审查",
    "startReview": "开始审查",
    "reviewResults": "审查结果",
    "noChanges": "未找到变更",
    "selectProject": "未选择项目"
  },
  "history": {
    "title": "历史",
    "subtitle": "过往代码审查",
    "noHistory": "还没有审查历史"
  },
  "settings": {
    "title": "设置",
    "subtitle": "配置你的偏好"
  }
}
```

**Step 6: 创建其他翻译文件（占位符）**

Create empty JSON files for now (will be filled in later tasks):

```bash
echo '{}' > src/renderer/src/locales/en/settings.json
echo '{}' > src/renderer/src/locales/en/review.json
echo '{}' > src/renderer/src/locales/en/errors.json
echo '{}' > src/renderer/src/locales/zh/settings.json
echo '{}' > src/renderer/src/locales/zh/review.json
echo '{}' > src/renderer/src/locales/zh/errors.json
```

**Step 7: 提交**

```bash
git add src/renderer/src/locales/
git commit -m "feat: create initial translation file structure"
```

---

### Task 5: 配置 i18next

**Files:**
- Create: `src/renderer/src/i18n.ts`
- Modify: `src/renderer/src/main.tsx`

**Step 1: 创建 i18n 配置文件**

Create `src/renderer/src/i18n.ts`:

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import commonEn from './locales/en/common.json'
import pagesEn from './locales/en/pages.json'
import settingsEn from './locales/en/settings.json'
import reviewEn from './locales/en/review.json'
import errorsEn from './locales/en/errors.json'

import commonZh from './locales/zh/common.json'
import pagesZh from './locales/zh/pages.json'
import settingsZh from './locales/zh/settings.json'
import reviewZh from './locales/zh/review.json'
import errorsZh from './locales/zh/errors.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        pages: pagesEn,
        settings: settingsEn,
        review: reviewEn,
        errors: errorsEn,
      },
      zh: {
        common: commonZh,
        pages: pagesZh,
        settings: settingsZh,
        review: reviewZh,
        errors: errorsZh,
      },
    },
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common', 'pages', 'settings', 'review', 'errors'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
```

**Step 2: 在 main.tsx 中导入 i18n**

In `src/renderer/src/main.tsx`, add at the top (before React imports):

```typescript
import './i18n'
```

**Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 4: 提交**

```bash
git add src/renderer/src/i18n.ts src/renderer/src/main.tsx
git commit -m "feat: configure i18next for internationalization"
```

---

## Phase 2: UI 语言切换

### Task 6: 创建语言切换器组件

**Files:**
- Create: `src/renderer/src/components/LanguageSwitcher.tsx`

**Step 1: 创建组件文件**

Create `src/renderer/src/components/LanguageSwitcher.tsx`:

```typescript
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu'
import { useReviewerStore } from '../store'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const { config, saveConfig } = useReviewerStore()

  const currentLanguage = config?.ui.uiLanguage || 'en'
  const displayLanguage = currentLanguage === 'zh' ? '中' : 'EN'

  const handleLanguageChange = async (lang: 'en' | 'zh') => {
    await saveConfig({ ui: { ...config!.ui, uiLanguage: lang } })
    i18n.changeLanguage(lang)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[hsl(var(--secondary))] transition-colors text-sm"
          aria-label="Change language"
        >
          <Globe size={16} />
          <span className="font-medium">{displayLanguage}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[140px] bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md shadow-lg p-1 z-50"
      >
        <DropdownMenuItem
          onClick={() => handleLanguageChange('en')}
          className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-[hsl(var(--secondary))] outline-none"
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLanguageChange('zh')}
          className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-[hsl(var(--secondary))] outline-none"
        >
          中文
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 3: 提交**

```bash
git add src/renderer/src/components/LanguageSwitcher.tsx
git commit -m "feat: create language switcher component"
```

---

### Task 7: 集成语言切换器到 Layout

**Files:**
- Modify: `src/renderer/src/components/layout/Layout.tsx`

**Step 1: 导入 LanguageSwitcher**

In `src/renderer/src/components/layout/Layout.tsx`, add import:

```typescript
import { LanguageSwitcher } from '../LanguageSwitcher'
```

**Step 2: 添加到顶部导航栏**

Find the header section and add LanguageSwitcher before the theme toggle:

```typescript
{/* Add before theme toggle button */}
<LanguageSwitcher />
```

**Step 3: 运行类型检查和构建**

Run: `npm run typecheck && npm run build`

Expected: 构建成功

**Step 4: 提交**

```bash
git add src/renderer/src/components/layout/Layout.tsx
git commit -m "feat: integrate language switcher into layout"
```

---

### Task 8: 同步 i18n 语言与配置

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Step 1: 在 App 组件中同步语言**

In `src/renderer/src/App.tsx`, add useEffect to sync language:

```typescript
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Inside App component:
const { i18n } = useTranslation()
const { config } = useReviewerStore()

useEffect(() => {
  if (config?.ui.uiLanguage) {
    i18n.changeLanguage(config.ui.uiLanguage)
  }
}, [config?.ui.uiLanguage, i18n])
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 3: 提交**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: sync i18n language with config on app load"
```

---

### Task 9: 翻译 Sidebar 组件

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

**Step 1: 导入 useTranslation**

In `src/renderer/src/components/layout/Sidebar.tsx`, add:

```typescript
import { useTranslation } from 'react-i18next'
```

**Step 2: 使用翻译**

Replace hardcoded text with translations:

```typescript
const { t } = useTranslation('pages')

// Replace menu items:
{ icon: LayoutDashboard, label: t('dashboard.title'), page: 'dashboard' }
{ icon: FolderGit2, label: t('projects.title'), page: 'projects' }
{ icon: FileSearch, label: t('review.title'), page: 'review' }
{ icon: History, label: t('history.title'), page: 'history' }
{ icon: Settings, label: t('settings.title'), page: 'settings' }
```

**Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 4: 提交**

```bash
git add src/renderer/src/components/layout/Sidebar.tsx
git commit -m "feat: translate sidebar menu items"
```

---

### Task 10: 翻译 ProjectsPage

**Files:**
- Modify: `src/renderer/src/pages/ProjectsPage.tsx`
- Modify: `src/renderer/src/locales/en/pages.json`
- Modify: `src/renderer/src/locales/zh/pages.json`

**Step 1: 添加缺失的翻译键**

In `src/renderer/src/locales/en/pages.json`, add to projects section:

```json
"projects": {
  "title": "Projects",
  "subtitle": "Manage your repositories",
  "addProject": "Add Project",
  "selectDirectory": "Select Directory",
  "noProjects": "No projects yet. Add one to get started.",
  "lastReview": "Last review",
  "projectName": "Project Name",
  "projectPath": "Project Path",
  "deleteConfirm": "Are you sure you want to delete this project?"
}
```

In `src/renderer/src/locales/zh/pages.json`, add:

```json
"projects": {
  "title": "项目",
  "subtitle": "管理你的代码仓库",
  "addProject": "添加项目",
  "selectDirectory": "选择目录",
  "noProjects": "还没有项目。添加一个开始吧。",
  "lastReview": "最后审查",
  "projectName": "项目名称",
  "projectPath": "项目路径",
  "deleteConfirm": "确定要删除此项目吗？"
}
```

**Step 2: 在 ProjectsPage 中使用翻译**

In `src/renderer/src/pages/ProjectsPage.tsx`, add:

```typescript
import { useTranslation } from 'react-i18next'

// Inside component:
const { t } = useTranslation('pages')

// Replace hardcoded strings with t() calls
```

**Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 4: 提交**

```bash
git add src/renderer/src/pages/ProjectsPage.tsx src/renderer/src/locales/
git commit -m "feat: translate ProjectsPage"
```

---

### Task 11: 翻译 SettingsPage

**Files:**
- Modify: `src/renderer/src/pages/SettingsPage.tsx`
- Modify: `src/renderer/src/locales/en/settings.json`
- Modify: `src/renderer/src/locales/zh/settings.json`

**Step 1: 创建 settings 翻译**

In `src/renderer/src/locales/en/settings.json`:

```json
{
  "modelConfig": "Model Config",
  "uiConfig": "UI Config",
  "provider": "Provider",
  "model": "Model",
  "outputLanguage": "Output Language",
  "outputLanguageDesc": "Language for LLM review results",
  "apiKey": "API Key",
  "baseUrl": "Base URL",
  "baseUrlPlaceholder": "Optional custom API endpoint",
  "temperature": "Temperature",
  "maxTokens": "Max Tokens",
  "theme": "Theme",
  "diffMode": "Diff Mode",
  "testConnection": "Test Connection",
  "testing": "Testing...",
  "connectionSuccess": "Connection successful!",
  "connectionFailed": "Connection failed"
}
```

In `src/renderer/src/locales/zh/settings.json`:

```json
{
  "modelConfig": "模型配置",
  "uiConfig": "界面配置",
  "provider": "提供商",
  "model": "模型",
  "outputLanguage": "输出语言",
  "outputLanguageDesc": "LLM 审查结果的语言",
  "apiKey": "API 密钥",
  "baseUrl": "基础 URL",
  "baseUrlPlaceholder": "可选的自定义 API 端点",
  "temperature": "温度",
  "maxTokens": "最大 Token 数",
  "theme": "主题",
  "diffMode": "差异模式",
  "testConnection": "测试连接",
  "testing": "测试中...",
  "connectionSuccess": "连接成功！",
  "connectionFailed": "连接失败"
}
```

**Step 2: 在 SettingsPage 中使用翻译**

In `src/renderer/src/pages/SettingsPage.tsx`, add translations for all text.

**Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 4: 提交**

```bash
git add src/renderer/src/pages/SettingsPage.tsx src/renderer/src/locales/
git commit -m "feat: translate SettingsPage"
```

---

### Task 12: 添加 LLM 输出语言选择器到 Settings

**Files:**
- Modify: `src/renderer/src/pages/SettingsPage.tsx`

**Step 1: 添加输出语言选择器**

In SettingsPage, after the Model selector, add:

```typescript
<label className="block">
  <span className="text-sm font-medium">{t('settings:outputLanguage')}</span>
  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
    {t('settings:outputLanguageDesc')}
  </p>
  <select
    value={outputLanguage}
    onChange={(e) => setOutputLanguage(e.target.value as 'en' | 'zh')}
    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
  >
    <option value="en">English - LLM will respond in English</option>
    <option value="zh">中文 - LLM 将使用中文回复</option>
  </select>
</label>
```

**Step 2: 添加 outputLanguage 状态**

Add state variable:

```typescript
const [outputLanguage, setOutputLanguage] = useState<'en' | 'zh'>('en')
```

**Step 3: 在 useEffect 中初始化**

```typescript
useEffect(() => {
  if (config) {
    // ... existing code
    setOutputLanguage(config.llm.outputLanguage)
  }
}, [config])
```

**Step 4: 在 handleSave 中保存**

```typescript
await saveConfig({
  llm: { provider, model, apiKey, baseUrl: baseUrl || undefined, temperature, maxTokens, outputLanguage },
  ui: { theme, diffMode },
})
```

**Step 5: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 6: 提交**

```bash
git add src/renderer/src/pages/SettingsPage.tsx
git commit -m "feat: add LLM output language selector to Settings"
```

---

### Task 13: 翻译 ReviewPage

**Files:**
- Modify: `src/renderer/src/pages/ReviewPage.tsx`
- Modify: `src/renderer/src/locales/en/review.json`
- Modify: `src/renderer/src/locales/zh/review.json`

**Step 1: 创建 review 翻译**

In `src/renderer/src/locales/en/review.json`:

```json
{
  "newReview": "New Review",
  "startReview": "Start Review",
  "reviewResults": "Review Results",
  "diffMode": "Diff Mode",
  "stagedChanges": "Staged Changes",
  "branchComparison": "Branch Comparison",
  "specificCommits": "Specific Commits",
  "baseBranch": "Base Branch",
  "selectBranch": "Select branch...",
  "selectCommits": "Select Commits",
  "noChanges": "No changes found in the selected diff range.",
  "noProject": "No project selected.",
  "goToProjects": "Go to Projects",
  "errors": "Errors",
  "warnings": "Warnings",
  "suggestions": "Suggestions",
  "files": "Files",
  "noIssues": "No issues found.",
  "noIssuesFiltered": "No {{severity}}s found."
}
```

In `src/renderer/src/locales/zh/review.json`:

```json
{
  "newReview": "新建审查",
  "startReview": "开始审查",
  "reviewResults": "审查结果",
  "diffMode": "差异模式",
  "stagedChanges": "暂存的变更",
  "branchComparison": "分支对比",
  "specificCommits": "指定提交",
  "baseBranch": "基础分支",
  "selectBranch": "选择分支...",
  "selectCommits": "选择提交",
  "noChanges": "在选定的差异范围内未找到变更。",
  "noProject": "未选择项目。",
  "goToProjects": "前往项目",
  "errors": "错误",
  "warnings": "警告",
  "suggestions": "建议",
  "files": "文件",
  "noIssues": "未发现问题。",
  "noIssuesFiltered": "未发现{{severity}}。"
}
```

**Step 2: 在 ReviewPage 中使用翻译**

Add translations throughout the component.

**Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 4: 提交**

```bash
git add src/renderer/src/pages/ReviewPage.tsx src/renderer/src/locales/
git commit -m "feat: translate ReviewPage"
```

---

## Phase 3: LLM 输出语言控制

### Task 14: 更新 LLM Provider 接口

**Files:**
- Modify: `src/main/services/llm/types.ts`

**Step 1: 添加 outputLanguage 参数**

In `src/main/services/llm/types.ts`, update the `LLMProvider` interface:

```typescript
export interface LLMProvider {
  configure(config: LLMConfig): void
  isConfigured(): boolean
  testConnection(): Promise<{ success: boolean; error?: string }>
  review(
    diff: string, 
    projectContext?: string,
    outputLanguage?: 'en' | 'zh'
  ): Promise<ReviewResult>
}
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型错误（AnthropicProvider 和 OpenAIProvider 需要更新）

**Step 3: 提交**

```bash
git add src/main/services/llm/types.ts
git commit -m "feat: add outputLanguage parameter to LLMProvider interface"
```

---

### Task 15: 更新 AnthropicProvider

**Files:**
- Modify: `src/main/services/llm/anthropic-provider.ts`

**Step 1: 更新 review 方法签名**

In `src/main/services/llm/anthropic-provider.ts`, update:

```typescript
async review(
  diff: string, 
  projectContext?: string,
  outputLanguage: 'en' | 'zh' = 'en'
): Promise<ReviewResult> {
```

**Step 2: 添加语言指令**

Add language instruction to system prompt:

```typescript
const languageInstruction = outputLanguage === 'zh' 
  ? '\n\nIMPORTANT: Please respond in Simplified Chinese (简体中文). All issue titles, descriptions, suggestions, and fullstack tips should be in Chinese. Keep the JSON structure unchanged.'
  : ''

const systemPrompt = `You are an expert code reviewer for full-stack applications...${languageInstruction}`
```

**Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过（OpenAIProvider 仍有错误）

**Step 4: 提交**

```bash
git add src/main/services/llm/anthropic-provider.ts
git commit -m "feat: add output language support to AnthropicProvider"
```

---

### Task 16: 更新 OpenAIProvider

**Files:**
- Modify: `src/main/services/llm/openai-provider.ts`

**Step 1: 更新 review 方法签名**

Same as AnthropicProvider, update the method signature and add language instruction.

**Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 3: 提交**

```bash
git add src/main/services/llm/openai-provider.ts
git commit -m "feat: add output language support to OpenAIProvider"
```

---

### Task 17: 在 ReviewEngine 中传递语言参数

**Files:**
- Modify: `src/main/services/review-engine.ts`

**Step 1: 传递 outputLanguage 到 provider**

In `src/main/services/review-engine.ts`, update the review call:

```typescript
const [llmResult, staticIssues, bridgeIssues] = await Promise.all([
  provider.review(truncatedDiff, undefined, llmConfig.outputLanguage),
  Promise.resolve(this.staticAnalyzer.analyze(project.path, diffs)),
  Promise.resolve(this.bridgeChecker.check(project.path)),
])
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 3: 提交**

```bash
git add src/main/services/review-engine.ts
git commit -m "feat: pass output language to LLM provider in ReviewEngine"
```

---

## Phase 4: 系统语言检测

### Task 18: 实现系统语言检测

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Step 1: 添加语言检测逻辑**

In `src/renderer/src/App.tsx`, add language detection:

```typescript
useEffect(() => {
  const detectAndSetLanguage = async () => {
    if (!config) return
    
    // If language is already set, use it
    if (config.ui.uiLanguage) {
      i18n.changeLanguage(config.ui.uiLanguage)
      return
    }
    
    // Detect system language
    const systemLang = navigator.language.toLowerCase()
    const detectedLang = systemLang.startsWith('zh') ? 'zh' : 'en'
    
    // Save detected language to config
    await saveConfig({
      ui: { ...config.ui, uiLanguage: detectedLang },
      llm: { ...config.llm, outputLanguage: detectedLang },
    })
    
    i18n.changeLanguage(detectedLang)
  }
  
  detectAndSetLanguage()
}, [config, i18n, saveConfig])
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 类型检查通过

**Step 3: 提交**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: auto-detect system language on first launch"
```

---

## 测试与验证

### Task 19: 手动测试

**Step 1: 启动应用**

Run: `npm run dev`

**Step 2: 测试 UI 语言切换**

- 点击顶部导航栏的语言切换器
- 切换到中文，验证所有已翻译的文本显示为中文
- 切换回英文，验证恢复正常
- 重启应用，验证语言设置持久化

**Step 3: 测试 LLM 输出语言**

- 进入 Settings，设置 Output Language 为中文
- 运行代码审查
- 验证 LLM 生成的 issues 为中文
- 切换回英文，再次运行审查，验证 issues 为英文

**Step 4: 测试系统语言检测**

- 清空配置文件（删除 electron-store 数据）
- 重启应用
- 验证根据系统语言自动设置

**Step 5: 记录测试结果**

Create a test report documenting all test results.

---

## 执行顺序

```
Phase 1: Task 1 → Task 2 → Task 3 → Task 4 → Task 5
Phase 2: Task 6 → Task 7 → Task 8 → Task 9 → Task 10 → Task 11 → Task 12 → Task 13
Phase 3: Task 14 → Task 15 → Task 16 → Task 17
Phase 4: Task 18
Testing: Task 19
```

**依赖关系：**
- Phase 2 依赖 Phase 1（需要 i18n 配置和翻译文件）
- Phase 3 独立于 Phase 2（可以并行）
- Phase 4 依赖 Phase 1 和 Phase 2（需要配置类型和 UI 集成）
- Testing 依赖所有 Phase

**推荐执行顺序：** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Testing

**总任务数：** 19 个任务
