---
title: 命名规范与代码可读性
category: code-quality
description: 良好的命名习惯提升代码可维护性
tags: [code-quality, naming, readability]
---

# 命名规范与代码可读性

## 问题描述
模糊的变量名、函数名会让代码难以理解和维护，增加 Bug 风险。

## 常见错误示例

```typescript
// ❌ 模糊命名
const d = new Date()
const arr = users.filter(u => u.a > 18)
function proc(x: any) { ... }

// ❌ 魔法数字
if (status === 2) { ... }
setTimeout(fn, 86400000)
```

## 正确做法

```typescript
// ✅ 清晰命名
const currentDate = new Date()
const adultUsers = users.filter(user => user.age > 18)
function processUserRegistration(userData: UserData) { ... }

// ✅ 使用常量
const STATUS_ACTIVE = 2
const ONE_DAY_MS = 24 * 60 * 60 * 1000

if (status === STATUS_ACTIVE) { ... }
setTimeout(fn, ONE_DAY_MS)

// ✅ 布尔变量用 is/has/can 前缀
const isLoading = true
const hasPermission = false
const canEdit = user.role === 'admin'
```

## 全栈工程师建议
1. **见名知意**：变量名应该描述其用途，而非类型
2. **避免缩写**：除非是广泛认知的缩写（如 id、url）
3. **函数名用动词**：`getUserById`、`validateEmail`
4. **常量全大写**：`MAX_RETRY_COUNT`、`API_BASE_URL`
