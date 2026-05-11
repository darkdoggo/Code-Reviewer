---
title: SQL 注入防护
category: security
description: 防止 SQL 注入攻击的最佳实践
tags: [security, sql, injection]
---

# SQL 注入防护

## 问题描述
SQL 注入是最常见的 Web 安全漏洞之一。攻击者通过在输入中插入恶意 SQL 代码，可以绕过身份验证、窃取数据或破坏数据库。

## 常见错误示例

```typescript
// ❌ 危险：直接拼接 SQL
const userId = req.query.id
const query = `SELECT * FROM users WHERE id = ${userId}`
db.query(query)
```

## 正确做法

```typescript
// ✅ 使用参数化查询
const userId = req.query.id
const query = 'SELECT * FROM users WHERE id = ?'
db.query(query, [userId])

// ✅ 使用 ORM
const user = await User.findOne({ where: { id: userId } })
```

## 全栈工程师建议
1. **永远不要拼接 SQL**：使用参数化查询或 ORM
2. **输入验证**：在应用层验证所有用户输入
3. **最小权限原则**：数据库账户只授予必要的权限
4. **使用 WAF**：部署 Web 应用防火墙作为额外防护层
