# Code Reviewer Agent 桌面应用设计文档

**日期：** 2026-04-22  
**版本：** 1.0  
**状态：** 已批准

## 1. 项目概述

### 1.1 核心定位

为前端/后端工程师转型全栈开发提供"跨端思维补位"的代码 Review 工具。不仅是"找错"，更是"补位" — 帮助开发者发现跨技术栈的盲区。

### 1.2 目标用户

- 前端工程师转后端：关注安全性、数据库优化、并发处理
- 后端工程师转前端：关注性能优化、用户体验、异常处理
- 全栈学习者：建立跨端知识体系

### 1.3 核心差异化

- **全栈视角：** 每个问题都附带"全栈提示"，解释为什么这在另一端是问题
- **混合分析：** 静态分析（精确）+ LLM 分析（理解）
- **可配置：** 支持多种 LLM、自定义代理、内部仓库鉴权

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                         │
├─────────────────────────────────────────────────────────┤
│  渲染进程 (React + TypeScript)                           │
│  ├─ UI Layer: Monaco Editor + Radix UI + Tailwind      │
│  ├─ State: Zustand (全局状态管理)                        │
│  └─ IPC: 与主进程通信                                    │
├─────────────────────────────────────────────────────────┤
│  主进程 (Node.js)                                        │
│  ├─ Git Service: simple-git + Octokit + GitBeaker      │
│  ├─ LLM Service: 多模型适配器                            │
│  │   ├─ Anthropic SDK (Claude)                          │
│  │   ├─ OpenAI SDK (GPT)                                │
│  │   └─ 自定义代理支持                                   │
│  ├─ Static Analyzer: ts-morph (TypeScript AST)          │
│  ├─ Storage: better-sqlite3 (review 历史)               │
│  └─ Config: electron-store (用户配置)                    │
└─────────────────────────────────────────────────────────┘
```

## 3. LLM 适配层设计

### 3.1 统一接口

```typescript
interface LLMProvider {
  id: string                    // "anthropic" | "openai" | "custom"
  name: string                  // 显示名称
  chat(params: ReviewRequest): Promise<ReviewResponse>
  testConnection(): Promise<boolean>
}

interface LLMConfig {
  provider: string              // 当前选择的 provider
  apiKey: string                // 加密存储（electron safeStorage）
  model: string                 // 具体模型 ID
  baseUrl?: string              // 自定义代理地址
  temperature?: number
  maxTokens?: number
}
```

### 3.2 支持的模型

- **Anthropic:** Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5
- **OpenAI:** GPT-4o, GPT-4 Turbo
- **自定义:** 通过 baseUrl 支持兼容 OpenAI 格式的任何服务

## 4. 错误处理与用户反馈规范

### 4.1 错误分类

#### Toast 通知（临时消息，自动消失）

**适用场景：**
- 用户操作错误（无暂存文件、分支不存在、未选择模型）
- 成功消息（配置已保存、审查已导出、连接成功）
- 信息提示（分数已计算、迁移完成）
- 非阻塞警告（旧审查格式、功能已弃用）

**实现方式：**
- 使用 `toast.userError()` 显示用户操作错误（黄色，带💡图标）
- 使用 `toast.success()` 显示成功消息（绿色，3秒）
- 使用 `toast.info()` 显示信息提示（蓝色，4秒）
- 使用 `toast.warning()` 显示非阻塞警告（黄色，4秒）
- 使用 `toast.error()` 显示系统错误（红色，5秒）
- 自动消失，不阻塞 UI

**示例：**
```typescript
// 用户操作错误
toast.userError('无法开始审查', '请先使用 git add 暂存文件')

// 成功消息
toast.success('配置已保存')

// 异步操作
toast.promise(
  saveConfig(),
  {
    loading: '保存中...',
    success: '配置已保存',
    error: '保存失败'
  }
)
```

#### 内联错误（持久显示，需要用户操作）

**适用场景：**
- 表单验证错误（必填字段为空、格式无效）
- 关键系统错误（API key 缺失、数据库错误、网络故障）
- 需要上下文的错误（哪个字段错误、如何修复）
- 阻塞性错误（必须解决才能继续）

**实现方式：**
- 使用红色/黄色 alert 框显示在相关组件附近
- 包含错误原因和解决方法
- 用户操作后才消失
- 保持在视图中直到问题解决

**示例：**
```tsx
{error && (
  <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
    {error}
  </div>
)}
```

#### 错误边界（灾难性错误）

**适用场景：**
- 未捕获的异常
- React 渲染错误
- 应用崩溃

**实现方式：**
- 使用 ErrorBoundary 组件捕获
- 显示友好的错误页面
- 提供重启应用选项

### 4.2 实现规范

**Toast 库：** sonner
- 轻量级（4KB）
- 支持 TypeScript
- 与 Radix UI + Tailwind 兼容
- 自动堆叠和定位
- 支持 promise 状态

**工具函数位置：** `src/renderer/src/lib/toast.ts`

**Toaster 组件位置：** `src/renderer/src/App.tsx`

### 4.3 错误消息原则

1. **用户友好：** 使用通俗语言，避免技术术语
2. **可操作：** 告诉用户如何解决问题
3. **简洁明了：** 主消息 ≤ 10 字，描述 ≤ 30 字
4. **分类清晰：** 区分用户错误和系统错误
5. **视觉层次：**
   - 红色 = 系统错误（严重）
   - 黄色 = 用户错误/警告（需注意）
   - 绿色 = 成功（正面反馈）
   - 蓝色 = 信息（中性提示）

### 4.4 何时使用 Toast vs 内联错误

**使用 Toast：**
- 操作结果反馈（成功/失败）
- 不需要用户立即处理
- 不影响当前工作流
- 临时性信息

**使用内联错误：**
- 表单验证
- 阻塞性错误
- 需要上下文说明
- 必须解决才能继续

**使用错误边界：**
- 应用级崩溃
- 无法恢复的错误
- React 渲染失败

### 3.3 安全性

- API Key 使用 Electron `safeStorage` API 加密存储
- 不明文写入配置文件
- 支持代理配置（公司内部网络）

## 4. 代码来源适配层

### 4.1 统一接口

```typescript
interface CodeSource {
  type: 'local' | 'github' | 'gitlab' | 'custom'
  getDiff(options: DiffOptions): Promise<FileDiff[]>
  getFileContent(path: string, ref?: string): Promise<string>
  getProjectMeta(): Promise<ProjectMeta>
  getBranches(): Promise<string[]>
  getCommits(range?: string): Promise<Commit[]>
}

interface DiffOptions {
  mode: 'commits' | 'branch' | 'staged' | 'working'
  commits?: string[]
  baseBranch?: string
}
```

### 4.2 三种实现

- **LocalGitSource:** simple-git，零网络开销
- **GitHubSource:** Octokit，支持 OAuth + Personal Access Token
- **GitLabSource:** @gitbeaker/rest，支持 Private Token

## 5. Review 核心流程

```
用户选择 commit/分支
       ↓
  CodeSource 获取 diff + 相关文件
       ↓
  Context Builder
  ├─ 项目指纹: dependencies, tsconfig, 目录结构
  ├─ 相关文件: diff 涉及的 import/引用文件
  └─ 用户规则: .reviewerrc 自定义配置
       ↓
  Static Analysis (ts-morph)
  ├─ 前后端类型一致性检查 (Bridge Type Checker)
  ├─ 未使用的 import / 变量
  └─ 明显的模式匹配 (如 SQL 拼接)
       ↓
  LLM Review (单次调用，结构化输出)
  ├─ 安全性维度
  ├─ 性能维度
  ├─ 健壮性维度
  └─ 架构维度
       ↓
  Post Processor
  ├─ 合并静态分析 + LLM 结果
  ├─ 去重 & 按严重程度排序
  └─ 标记"全栈转型"相关建议
       ↓
  渲染到 UI (汇总列表 + 行内注释)
```

### 5.1 结构化输出（Zod Schema）

```typescript
const ReviewIssueSchema = z.object({
  file: z.string(),
  line: z.number(),
  severity: z.enum(['error', 'warning', 'suggestion']),
  category: z.enum(['security', 'performance', 'robustness', 'architecture']),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().optional(),
  fullstackTip: z.string().optional(),  // 差异化关键
})
```

### 5.2 全栈提示示例

- 前端工程师写 N+1 查询 → "后端不像前端调 API，这里直接操作数据库，N+1 会导致严重性能问题"
- 后端工程师未处理弱网 → "前端环境不稳定，需要 Loading 状态和错误兜底"

## 6. UI 设计

### 6.1 整体布局

参考 OpenClaw Desktop 风格：

- **左侧导航栏（220px）：** 仪表板、项目管理、Review 记录、模型配置、设置、学习中心
- **主工作区：** 根据左侧菜单动态切换内容
- **主题支持：** 亮色/暗色/跟随系统

### 6.2 核心页面

#### 仪表板
- 快速开始（本地/GitHub/GitLab）
- 统计数据（本周 Review 数、Token 消耗、平均耗时）
- 最近 Review 列表

#### Review 工作页
- Tab 切换：概览 | 文件详情 | 问题列表 | 趋势
- 文件详情：Monaco Diff Editor（unified/split 可切换）
- 行内注释：点击代码行展开评论气泡
- 问题列表：按严重程度分类，点击跳转到代码

#### 模型配置页
- 当前模型状态
- 可用模型列表（Anthropic/OpenAI/自定义）
- 自定义代理配置
- 测试连接功能

## 7. 技术栈

### 7.1 核心框架
```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "typescript": "^5.3.0",
  "vite": "^5.0.0"
}
```

### 7.2 UI 组件
```json
{
  "@radix-ui/react-*": "latest",
  "tailwindcss": "^3.4.0",
  "lucide-react": "^0.300.0",
  "monaco-editor": "^0.45.0",
  "react-monaco-editor": "^0.52.0"
}
```

### 7.3 状态管理
```json
{
  "zustand": "^4.4.0"
}
```

### 7.4 Git 操作
```json
{
  "simple-git": "^3.21.0",
  "@octokit/rest": "^20.0.0",
  "@gitbeaker/rest": "^39.0.0"
}
```

### 7.5 LLM SDK
```json
{
  "@anthropic-ai/sdk": "^0.17.0",
  "openai": "^4.24.0",
  "zod": "^3.22.0"
}
```

### 7.6 静态分析
```json
{
  "ts-morph": "^21.0.0"
}
```

### 7.7 存储
```json
{
  "better-sqlite3": "^9.2.0",
  "electron-store": "^8.1.0"
}
```

## 8. 数据模型

### 8.1 SQLite 表结构

#### Project（项目/仓库源）
```typescript
interface Project {
  id: string
  name: string
  type: 'local' | 'github' | 'gitlab' | 'custom'
  path?: string
  url?: string
  authToken?: string         // 加密存储
  createdAt: number
  lastReviewAt?: number
}
```

#### Review（Review 记录）
```typescript
interface Review {
  id: string
  projectId: string
  mode: 'commits' | 'branch' | 'staged'
  commits?: string[]
  baseBranch?: string
  score: number              // 0-10
  issueCount: {
    error: number
    warning: number
    suggestion: number
  }
  llmProvider: string
  llmModel: string
  tokenUsed: number
  costEstimate: number       // USD
  duration: number           // ms
  createdAt: number
}
```

#### ReviewIssue（Review 问题）
```typescript
interface ReviewIssue {
  id: string
  reviewId: string
  file: string
  line: number
  severity: 'error' | 'warning' | 'suggestion'
  category: 'security' | 'performance' | 'robustness' | 'architecture'
  title: string
  description: string
  suggestion?: string
  fullstackTip?: string
  source: 'static' | 'llm'
}
```

### 8.2 用户配置（electron-store）

```typescript
interface UserConfig {
  llm: {
    provider: string
    model: string
    apiKey: string           // 加密
    baseUrl?: string
    temperature: number
    maxTokens: number
  }
  ui: {
    theme: 'light' | 'dark' | 'system'
    diffMode: 'unified' | 'split'
  }
  review: {
    autoSave: boolean
    enableStaticAnalysis: boolean
    customRules?: string
  }
}
```

## 9. 核心功能特性

### 9.1 Bridge Type Checker

检测前后端类型定义不一致：

- 使用 ts-morph 解析前后端类型定义
- 对比字段名、类型、必填性
- 发现不一致时高亮警告
- 建议使用 tRPC/Zod/共享类型包

### 9.2 多维度 Review

| 维度 | 前端转后端重点 | 后端转前端重点 |
|------|---------------|---------------|
| 安全性 | SQL 注入、越权校验 | XSS、敏感信息泄露 |
| 性能 | N+1 查询、索引建议 | Re-render、资源加载 |
| 健壮性 | 并发、事务 | 弱网、Loading 状态 |
| 架构 | 领域模型、分层 | 组件拆分、状态管理 |

### 9.3 学习中心

内置全栈知识库：

- 常见跨端问题解析
- 最佳实践文档
- 历史 Review 中的高频问题汇总

## 10. 开发阶段规划

### Phase 1: 核心功能（MVP）
- Electron + React 基础框架
- 本地 Git 支持
- Anthropic Claude 集成
- 基础 UI（仪表板 + Review 工作页）
- SQLite 存储

### Phase 2: 增强功能
- GitHub/GitLab 远程支持
- 多模型支持（OpenAI）
- 静态分析（ts-morph）
- Bridge Type Checker
- 完整 UI（所有页面）

### Phase 3: 高级功能
- 学习中心
- 自定义规则（.reviewerrc）
- 导出报告（PDF/Markdown）
- 团队协作（分享 Review）

## 11. 成本估算

### 11.1 单次 Review 成本

假设 diff 约 500 行代码：

- Token 消耗：2k-5k tokens
- 使用 Claude Sonnet 4.6：$0.01-0.05
- 使用 Claude Haiku 4.5：$0.003-0.01

### 11.2 优化策略

- 静态分析前置，减少 LLM 调用
- 用户自带 API Key，无需后端服务
- 支持 Haiku 做初筛，Sonnet 做深度分析

## 12. 安全与隐私

- API Key 加密存储（electron safeStorage）
- 代码不上传到第三方服务器（除非用户选择远程仓库）
- 本地 SQLite 存储，数据完全本地化
- 支持代理配置，适配企业内网环境

## 13. 下一步

设计已完成并获批准，接下来：

1. 创建详细的实现计划（调用 writing-plans skill）
2. 搭建项目脚手架
3. 实现 Phase 1 核心功能

---

**设计批准：** ✅ 用户已确认所有设计细节
