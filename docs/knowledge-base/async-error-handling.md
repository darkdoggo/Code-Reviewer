---
title: 异步错误处理
category: robustness
description: 正确处理 async/await 代码中的错误，防止未捕获的 Promise rejection
tags: [async, promises, error-handling]
---

# 异步错误处理

## 问题描述
未处理的 Promise rejection 是前后端 JavaScript/TypeScript 应用中常见的 bug 来源。

## 常见错误示例

```typescript
// ❌ 危险：没有错误处理
async function fetchData() {
  const response = await fetch('/api/data')
  return response.json() // 如果失败会怎样？
}
```

## 正确做法

始终用 try-catch 包裹异步操作：

```typescript
// ✅ 正确：完整的错误处理
async function fetchData() {
  try {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('获取数据失败:', error)
    throw error // 重新抛出或适当处理
  }
}
```

## 全栈工程师建议

1. **前端开发者**：网络请求可能以多种方式失败（超时、404、500、网络错误），不要假设请求一定成功
2. **后端开发者**：数据库查询同样可能失败，不要忽略错误处理
3. **统一处理**：前端使用 React Error Boundary，后端使用 Express/Node 全局错误处理中间件
4. **日志监控**：集成 Sentry 等工具，实现全链路错误追踪
