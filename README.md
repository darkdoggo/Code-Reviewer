# Code Reviewer

**全栈代码审查桌面应用** — 结合静态分析与 LLM，从安全性、性能、健壮性和架构四个维度对代码进行深度审查，并提供"全栈视角"的改进建议。

> 不仅找错，更要补位 —— 帮助开发者发现跨技术栈的盲区

---

## 核心特性

- **全栈视角审查**：每个问题附带跨端提示，帮助前后端互补盲区
- **混合分析引擎**：静态分析（ts-morph）精确定位 + LLM（Claude/GPT）深度理解
- **Bridge Type Checker**：检测前后端 IPC 类型定义不一致
- **智能知识库**：从历史审查中自动聚合高频问题
- **多源代码支持**：本地 Git / GitHub / GitLab，支持企业代理
- **Monaco Diff Viewer**：与 VS Code 相同的代码对比体验
- **多语言 UI**：中文 / English（i18next）
- **亮色 / 暗色主题**：跟随系统或手动切换

---

## 技术架构

```
┌──────────────────────────────────────────────────────────┐
│                      Electron 33                         │
├──────────────────────────────────────────────────────────┤
│  渲染进程 (React 18 + TypeScript 5)                       │
│  ├─ UI: Monaco Editor + Radix UI + Tailwind CSS 4       │
│  ├─ 状态管理: Zustand 5                                  │
│  ├─ 图表: Recharts                                       │
│  └─ 国际化: i18next                                      │
├──────────────────────────────────────────────────────────┤
│  主进程 (Node.js)                                         │
│  ├─ Git Service: simple-git                              │
│  ├─ LLM Service                                          │
│  │   ├─ Anthropic SDK → Claude                           │
│  │   └─ OpenAI SDK → GPT                                 │
│  ├─ Static Analyzer: ts-morph (TypeScript AST)           │
│  ├─ Bridge Type Checker: IPC 契约一致性检查                │
│  ├─ Context Builder: 项目指纹 + 相关文件发现               │
│  ├─ Knowledge Service: 历史 + 本地文档 + 远程             │
│  ├─ Storage: better-sqlite3                              │
│  └─ Config: electron-store (safeStorage 加密)             │
├──────────────────────────────────────────────────────────┤
│  Preload (contextBridge 安全通信)                          │
├──────────────────────────────────────────────────────────┤
│  Shared (跨进程共享类型 + Zod Schema)                      │
└──────────────────────────────────────────────────────────┘
```

### 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Electron | ^33.0 |
| 前端 | React + TypeScript | ^18.3 + ^5.7 |
| 构建 | electron-vite (Vite) | ^2.3 |
| UI 组件 | Radix UI + Tailwind CSS | latest + ^4.0 |
| 状态管理 | Zustand | ^5.0 |
| 代码编辑器 | Monaco Editor (@monaco-editor/react) | ^4.7 |
| Git 操作 | simple-git | ^3.27 |
| LLM SDK | @anthropic-ai/sdk / openai | ^0.62 / ^6.34 |
| 静态分析 | ts-morph | ^28.0 |
| 数据库 | better-sqlite3 | ^11.7 |
| 国际化 | i18next + react-i18next | ^26.0 + ^17.0 |
| 数据校验 | Zod | ^3.24 |
| 打包 | electron-builder | ^25.0 |

---

## 项目结构

```
Code-Reviewer/
├── build/                          # 打包资源（图标等）
│   ├── icon.png                    # 1024x1024 应用图标源文件
│   ├── icon.icns                   # macOS 图标
│   └── icon.svg                    # SVG 源图标
├── docs/
│   ├── knowledge-base/             # 本地知识库文档
│   │   ├── security-injection.md
│   │   ├── performance-loop.md
│   │   ├── async-error-handling.md
│   │   └── ...
│   └── plans/                      # 设计文档
├── src/
│   ├── main/                       # Electron 主进程
│   │   ├── index.ts                # 主进程入口，窗口创建
│   │   ├── ipc-handlers.ts         # IPC 通道注册
│   │   ├── database/
│   │   │   └── dashboard.ts        # 仪表盘数据聚合
│   │   └── services/
│   │       ├── config.ts           # 配置管理（electron-store + safeStorage）
│   │       ├── database.ts         # SQLite 数据层
│   │       ├── git.ts              # 本地 Git 操作（simple-git）
│   │       ├── remote-git.ts       # 远程仓库（GitHub/GitLab）
│   │       ├── review-engine.ts    # 审查引擎（编排全流程）
│   │       ├── prompts.ts          # LLM Prompt 模板
│   │       ├── scoring-algorithm.ts # 确定性评分算法
│   │       ├── static-analyzer.ts  # 静态分析（ts-morph）
│   │       ├── bridge-checker.ts   # IPC 类型桥接检查
│   │       ├── context-builder.ts  # 项目上下文构建器
│   │       ├── llm/
│   │       │   ├── types.ts        # LLM Provider 接口
│   │       │   ├── provider-factory.ts
│   │       │   ├── anthropic-provider.ts
│   │       │   └── openai-provider.ts
│   │       └── knowledge/
│   │           ├── knowledge-service.ts
│   │           ├── history-adapter.ts
│   │           ├── local-adapter.ts
│   │           └── remote-adapter.ts
│   ├── renderer/                   # React 渲染进程
│   │   └── src/
│   │       ├── main.tsx            # 渲染进程入口
│   │       ├── App.tsx             # 根组件 + 路由
│   │       ├── i18n.ts             # 国际化配置
│   │       ├── pages/
│   │       │   ├── DashboardPage.tsx   # 仪表盘（图表 + 统计）
│   │       │   ├── ProjectsPage.tsx    # 项目管理
│   │       │   ├── ReviewPage.tsx      # 代码审查（核心页面）
│   │       │   ├── HistoryPage.tsx     # 审查历史
│   │       │   ├── LearningPage.tsx    # 知识学习中心
│   │       │   └── SettingsPage.tsx    # 设置（LLM / UI / 主题）
│   │       ├── components/
│   │       │   ├── DiffViewer.tsx      # Monaco Diff 查看器
│   │       │   ├── FileTreeView.tsx    # 文件树
│   │       │   ├── ResizablePanel.tsx  # 可调整面板
│   │       │   ├── layout/
│   │       │   │   ├── Layout.tsx
│   │       │   │   └── Sidebar.tsx
│   │       │   └── charts/
│   │       │       ├── TrendChart.tsx
│   │       │       ├── IssueDistributionChart.tsx
│   │       │       └── ProjectHealthChart.tsx
│   │       ├── store/
│   │       │   └── index.ts        # Zustand 全局状态
│   │       ├── locales/
│   │       │   ├── en/             # English
│   │       │   └── zh/             # 简体中文
│   │       ├── lib/                # 工具函数
│   │       └── styles/             # 全局样式
│   ├── preload/                    # Preload 安全桥接
│   │   ├── index.ts
│   │   └── index.d.ts
│   └── shared/                     # 跨进程共享代码
│       ├── types/
│       │   ├── index.ts            # 核心类型（Review, ReviewIssue, Project...）
│       │   ├── config.ts           # 配置类型（LLMConfig, UIConfig）
│       │   ├── git.ts              # Git 相关类型
│       │   ├── ipc.ts              # IPC 契约接口（ElectronAPI）
│       │   ├── knowledge.ts        # 知识库类型
│       │   ├── context.ts          # 上下文类型
│       │   └── models.ts           # 模型类型
│       └── schemas/
│           ├── review.ts           # Zod 审查结果 Schema
│           └── ...
├── electron-builder.yml            # 打包配置
├── electron.vite.config.ts         # Vite 构建配置
├── tsconfig.json                   # TypeScript 项目引用
├── tsconfig.node.json              # 主进程 + Preload TS 配置
├── tsconfig.web.json               # 渲染进程 TS 配置
└── package.json
```

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **Git** 已安装
- **LLM API Key**（Anthropic 或 OpenAI，至少一个）

### 安装

```bash
git clone https://github.com/darkdoggo/Code-Reviewer.git
cd Code-Reviewer
npm install
```

### 开发模式

```bash
npm run dev
```

应用将以开发模式启动，支持 HMR 热更新。

### 类型检查

```bash
# 检查全部
npm run typecheck

# 仅检查主进程 + preload
npm run typecheck:node

# 仅检查渲染进程
npm run typecheck:web
```

### 构建（仅编译，不打包）

```bash
npm run build
```

输出到 `out/` 目录，可通过 `npm run preview` 预览。

---

## 打包发布

打包使用 [electron-builder](https://www.electron.build/)，配置文件为 `electron-builder.yml`。

### macOS

```bash
# Apple Silicon (M1/M2/M3/M4)
npm run pack:mac-arm64

# Intel
npm run pack:mac-x64

# 双架构（同时生成 arm64 + x64）
npm run pack:mac
```

**输出产物：**
- `dist/Code Reviewer-{version}-mac-arm64.dmg`
- `dist/Code Reviewer-{version}-mac-x64.dmg`
- `dist/Code Reviewer-{version}-mac-arm64.zip`
- `dist/Code Reviewer-{version}-mac-x64.zip`

### Windows

```bash
npm run pack:win
```

**输出产物：**
- `dist/Code Reviewer-{version}-win-setup.exe` — NSIS 安装包（支持自定义安装目录）
- `dist/Code Reviewer-{version}-win-portable.exe` — 便携版（免安装）

### 全平台

```bash
npm run pack:all
```

同时生成 macOS (arm64 + x64) 和 Windows (x64) 的全部安装包。

### 调试打包

```bash
npm run pack:dir
```

仅生成未压缩的应用目录（`dist/mac-arm64/`），用于快速验证打包配置。

### 打包注意事项

- **原生模块**：`better-sqlite3` 会在打包时自动为目标架构重新编译
- **macOS 代码签名**：未配置 Apple Developer ID 时会跳过签名，首次打开需右键 → 打开
- **跨平台打包 Windows**：在 macOS 上打包 Windows 版本需要 Wine 环境，建议在 CI 或 Windows 机器上打包

### 全部 npm scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（HMR） |
| `npm run build` | 编译主进程 + 渲染进程 |
| `npm run preview` | 预览编译产物 |
| `npm run typecheck` | 全量类型检查 |
| `npm run pack:mac` | 打包 macOS（arm64 + x64） |
| `npm run pack:mac-arm64` | 打包 macOS Apple Silicon |
| `npm run pack:mac-x64` | 打包 macOS Intel |
| `npm run pack:win` | 打包 Windows（x64） |
| `npm run pack:all` | 打包全平台 |
| `npm run pack:dir` | 打包为目录（调试用） |

---

## 审查流程

```
用户选择 commit / 分支 / 暂存文件
        ↓
   Git Service 获取 diff
        ↓
   Context Builder（项目指纹 + 依赖分析 + 相关文件发现）
        ↓
   ┌────────────────────────────────────────┐
   │           并行执行                      │
   │  ┌─────────────┐  ┌─────────────────┐ │
   │  │ LLM Review  │  │ Static Analysis │ │
   │  │ (分批调用)   │  │ + Bridge Check  │ │
   │  └─────────────┘  └─────────────────┘ │
   └────────────────────────────────────────┘
        ↓
   合并 + 去重 + 评分
        ↓
   渲染到 UI（分数 + 问题列表 + Diff 查看器）
```

### 审查维度

| 维度 | 前端转后端重点 | 后端转前端重点 |
|------|--------------|--------------|
| 安全性 | SQL 注入、越权校验 | XSS、敏感信息泄露 |
| 性能 | N+1 查询、索引建议 | Re-render、资源加载 |
| 健壮性 | 并发、事务 | 弱网、Loading 状态 |
| 架构 | 领域模型、分层 | 组件拆分、状态管理 |

### 审查模式

- **Staged**：审查已暂存的文件
- **Branch**：对比两个分支的差异
- **Commits**：审查指定 commit

---

## 配置说明

### LLM 配置

首次使用需在设置页面配置 LLM：

1. 选择提供商：Anthropic（Claude）或 OpenAI（GPT）
2. 输入 API Key（使用 Electron safeStorage 加密存储）
3. 选择模型
4. 点击"测试连接"验证
5. 可选：配置自定义 Base URL 和代理（适配企业内网）

### 知识库

将 Markdown 文件放入 `docs/knowledge-base/` 即可被知识服务读取：

```markdown
---
title: SQL 注入防护
category: security
tags: [sql, injection, backend]
---

## 描述
直接拼接用户输入到 SQL 语句中会导致注入攻击...

## 全栈提示
前端工程师习惯字符串拼接，但在后端操作数据库时必须使用参数化查询...
```

---

## 数据存储

| 数据 | 存储位置 | 说明 |
|------|---------|------|
| 审查记录 | `~/Library/Application Support/Code Reviewer/reviewer-agent.db` (macOS) | SQLite |
| 用户配置 | `~/Library/Application Support/Code Reviewer/config.json` | electron-store |
| API Key | 同上（safeStorage 加密） | Electron safeStorage API |

> Windows 路径：`%APPDATA%/Code Reviewer/`

---

## 安全与隐私

- 代码完全在本地处理，不上传到第三方服务器（除非用户主动配置远程仓库）
- API Key 使用 Electron `safeStorage` API 加密存储
- 所有审查历史保存在本地 SQLite
- 无遥测数据收集
- 支持企业内网代理

---

## 许可证

MIT License
