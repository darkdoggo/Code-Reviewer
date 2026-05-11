---
title: 循环性能优化
category: performance
description: 避免在循环中执行高开销操作
tags: [performance, loop, optimization]
---

# 循环性能优化

## 问题描述
在循环中执行数据库查询、网络请求或复杂计算，会导致 N+1 问题和性能瓶颈。

## 常见错误示例

```typescript
// ❌ N+1 查询问题
const orders = await Order.findAll()
for (const order of orders) {
  const user = await User.findById(order.userId) // 每次循环都查询数据库
  console.log(user.name)
}
```

## 正确做法

```typescript
// ✅ 批量查询
const orders = await Order.findAll()
const userIds = orders.map(o => o.userId)
const users = await User.findAll({ where: { id: userIds } })
const userMap = new Map(users.map(u => [u.id, u]))

for (const order of orders) {
  const user = userMap.get(order.userId)
  console.log(user?.name)
}

// ✅ 使用 JOIN
const ordersWithUsers = await Order.findAll({
  include: [{ model: User }]
})
```

## 全栈工程师建议
1. **批量操作**：将循环内的查询改为批量查询
2. **使用 JOIN**：在 SQL 层面关联数据
3. **缓存热点数据**：对频繁访问的数据使用 Redis 缓存
4. **分析慢查询**：使用 EXPLAIN 分析 SQL 执行计划
