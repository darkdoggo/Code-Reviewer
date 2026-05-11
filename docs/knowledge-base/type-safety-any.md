---
title: 避免滥用 any 类型
category: type-safety
description: TypeScript 类型安全最佳实践
tags: [typescript, type-safety, any]
---

# 避免滥用 any 类型

## 问题描述
过度使用 `any` 类型会丧失 TypeScript 的类型检查优势，导致运行时错误。

## 常见错误示例

```typescript
// ❌ 滥用 any
function processData(data: any) {
  return data.map((item: any) => item.value) // 没有类型检查
}

// ❌ 类型断言逃避检查
const user = response.data as any
```

## 正确做法

```typescript
// ✅ 定义明确的类型
interface DataItem {
  id: number
  value: string
}

function processData(data: DataItem[]) {
  return data.map(item => item.value) // 类型安全
}

// ✅ 使用泛型
function processGeneric<T extends { value: string }>(data: T[]) {
  return data.map(item => item.value)
}

// ✅ 使用 unknown 代替 any
function parseJSON(json: string): unknown {
  return JSON.parse(json)
}
```

## 全栈工程师建议
1. **定义接口**：为所有数据结构定义 TypeScript 接口
2. **使用 unknown**：需要动态类型时用 `unknown` 代替 `any`
3. **启用严格模式**：在 tsconfig.json 中开启 `strict: true`
4. **类型守卫**：使用类型守卫函数进行运行时类型检查
