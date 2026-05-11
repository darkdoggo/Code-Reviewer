---
title: 降低模块耦合度
category: architecture
description: 通过依赖注入和接口抽象降低耦合
tags: [architecture, coupling, dependency-injection]
---

# 降低模块耦合度

## 问题描述
模块之间紧密耦合会导致代码难以测试、修改和复用。

## 常见错误示例

```typescript
// ❌ 紧耦合：直接依赖具体实现
class UserService {
  private db = new MySQLDatabase() // 硬编码依赖

  async getUser(id: string) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id])
  }
}
```

## 正确做法

```typescript
// ✅ 依赖注入 + 接口抽象
interface Database {
  query(sql: string, params: any[]): Promise<any>
}

class UserService {
  constructor(private db: Database) {} // 注入依赖

  async getUser(id: string) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id])
  }
}

// 使用时注入具体实现
const db = new MySQLDatabase()
const userService = new UserService(db)

// 测试时注入 Mock
const mockDb = new MockDatabase()
const testService = new UserService(mockDb)
```

## 全栈工程师建议
1. **依赖倒置**：依赖抽象（接口）而非具体实现
2. **单一职责**：每个模块只负责一件事
3. **依赖注入**：通过构造函数或工厂函数注入依赖
4. **分层架构**：Controller → Service → Repository，层间通过接口通信
