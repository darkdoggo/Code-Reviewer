# Context Builder

Context Builder 在代码审查前分析项目结构，为 LLM 提供更精准的上下文信息。

## 功能

### 1. 项目指纹提取

自动提取：
- package.json 中的依赖信息
- TypeScript 配置（tsconfig.json）
- 框架检测（React, Vue, Express 等）
- 目录结构（是否有测试、文档）

### 2. 相关文件发现

通过 import 分析识别与变更相关的文件：
- 正向查找：变更文件导入了哪些文件
- 反向查找：哪些文件导入了变更文件
- 限制返回前 20 个最相关的文件

### 3. 自定义规则（.reviewerrc）

在项目根目录创建 `.reviewerrc` 文件来自定义审查规则：

```json
{
  "ignore": ["**/*.test.ts"],
  "focus": ["security", "performance"],
  "customPrompts": {
    "security": "重点检查认证和授权问题"
  },
  "rules": {
    "maxFunctionLength": 50,
    "requireTests": true
  }
}
```

## 工作原理

1. 启动审查时，Context Builder 分析项目结构
2. 提取项目元数据并识别相关文件
3. 将上下文格式化后与 diff 一起发送给 LLM
4. LLM 利用上下文提供更准确的审查反馈

## 输出示例

```
# Project Context

## Framework & Dependencies
Framework: react
Key dependencies: react, typescript, zustand, tailwindcss

## TypeScript Config
Strict mode: true
Target: ES2020

## Related Files
- src/store/index.ts (imports)
- src/components/Layout.tsx (imported-by)

## Custom Review Rules
Focus areas: security, performance
Max function length: 50 lines
```
