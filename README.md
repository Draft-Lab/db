# @draftlab/db

🚀 **High-performance SQLite library** combining in-memory speed with persistent storage using Web Workers and OPFS.

## Features

- 🔎 **Any Query** - Full SQL support with template literals and parameterized queries
- ⚡ **Ultra Fast** - In-memory SQLite for sub-millisecond queries  
- 🧵 **Threaded** - Web Worker + OPFS for non-blocking persistence
- 📂 **Persisted** - Automatic write-through caching to Origin Private File System
- 🔒 **Type Safe** - Full TypeScript support with generic interfaces
- 🛠️ **Drizzle Ready** - Drop-in compatibility with Drizzle ORM
- 🏗️ **Simple API** - Clean, developer-friendly interface

## Installation

```bash
npm install @draftlab/db
# or
yarn add @draftlab/db  
# or
pnpm install @draftlab/db
```

## Vite Configuration

Add to your `vite.config.ts`:

```typescript
export default {
  optimizeDeps: {
    exclude: ['@draftlab/db']
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
}
```

> **Note**: Cross-origin isolation headers are required for SQLite WASM and Web Workers.

## Quick Start

```typescript
import { Client } from '@draftlab/db'

interface User {
  id: number
  name: string
  email: string
}

const db = new Client('my-app.sqlite')
await db.ready()

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`)

// Insert data
db.run('INSERT INTO users (name, email) VALUES (?, ?)', ['John Doe', 'john@example.com'])

// Query data
const users = db.query<User>('SELECT * FROM users')
console.log(users) // [{ id: 1, name: 'John Doe', email: 'john@example.com' }]

// Get single record
const user = db.get<User>('SELECT * FROM users WHERE id = ?', [1])
console.log(user) // { id: 1, name: 'John Doe', email: 'john@example.com' }
```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │────│ CoreSQLite  │────│ OPFS Worker │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                   ┌─────────────┐
                   │ Memory DB   │ (< 1ms queries)
                   └─────────────┘
```

The library uses a **dual-engine architecture**:
- **Memory SQLite**: Handles all queries with ultra-low latency
- **OPFS Worker**: Persists changes in background via Origin Private File System  
- **Write-Through Cache**: Automatic synchronization without blocking your app

## Methods

### Client

#### `query<T>(sql, params?): T[]`
Execute SELECT queries returning array of typed objects.

```typescript
const users = db.query<User>('SELECT * FROM users WHERE age > ?', [18])
```

#### `get<T>(sql, params?): T | undefined`
Execute SELECT queries returning single typed object or undefined.

```typescript
const user = db.get<User>('SELECT * FROM users WHERE id = ?', [1])
```

#### `run(sql, params?): void`
Execute INSERT, UPDATE, DELETE queries without return value.

```typescript
db.run('INSERT INTO users (name) VALUES (?)', ['Alice'])
db.run('UPDATE users SET name = ? WHERE id = ?', ['Bob', 1])
db.run('DELETE FROM users WHERE id = ?', [1])
```

#### `transaction(callback): T`
Execute multiple operations in a single transaction.

```typescript
db.transaction((tx) => {
  tx.run('INSERT INTO users (name) VALUES (?)', ['Alice'])
  tx.run('INSERT INTO users (name) VALUES (?)', ['Bob'])  
  tx.run('UPDATE users SET active = ? WHERE name = ?', [true, 'Alice'])
})
```

#### `ready(): Promise<void>`
Wait for database initialization to complete.

```typescript
await db.ready() // Ensure database is ready before queries
```

#### Status Properties

```typescript
const status = db.status
console.log({
  ready: status.ready,              // Database initialized
  persistent: status.persistent,    // Worker active  
  pendingSync: status.pendingSync   // Background sync queue size
})
```

## Drizzle ORM Integration

For advanced type-safe queries, use with [Drizzle ORM](https://orm.drizzle.team/):

### Setup

```typescript
import { CoreSQLiteDrizzle } from '@draftlab/db'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

const client = new CoreSQLiteDrizzle('database.sqlite')
const db = drizzle(client.driver, client.batchDriver)

await client.ready()
```

### Define Schema

```typescript
const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text().unique(),
  createdAt: text().default(sql`(datetime('now'))`)
})
```

### CRUD Operations

```typescript
import { eq, gt, count } from 'drizzle-orm'

// Create table
await client.driver(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  )
`, [], 'run')

// Insert
await db.insert(users).values({
  name: 'John Doe',
  email: 'john@example.com'
})

// Select  
const allUsers = await db.select().from(users)
const activeUsers = await db.select().from(users).where(gt(users.id, 0))

// Update
await db.update(users)
  .set({ name: 'Jane Doe' })
  .where(eq(users.id, 1))

// Delete
await db.delete(users).where(eq(users.id, 1))

// Joins & Aggregations
const userStats = await db
  .select({ count: count() })
  .from(users)
  .where(gt(users.id, 0))
```

## Performance

### Benchmarks

- **Read Queries**: ~0.1ms (in-memory)
- **Write Queries**: ~0.1ms (memory) + background sync
- **Initial Boot**: ~10-50ms (OPFS synchronization)
- **Batch Operations**: 10x faster with transactions

### Optimization Tips

```typescript
// ✅ Use transactions for bulk operations
db.transaction((tx) => {
  users.forEach(user => {
    tx.run('INSERT INTO users (name) VALUES (?)', [user.name])
  })
})

// ❌ Avoid individual operations for bulk data
users.forEach(user => {
  db.run('INSERT INTO users (name) VALUES (?)', [user.name])
})
```

## Browser Requirements

- **Modern Browsers**: Chrome 86+, Firefox 79+, Safari 15.2+
- **Web Workers**: Required for background persistence
- **OPFS**: Required for persistent storage
- **Cross-Origin Isolation**: Required headers for SharedArrayBuffer

## Limitations

1. **Drizzle Transactions**: Cannot isolate from external queries
2. **OPFS Only**: No fallback to other storage methods
3. **Worker Recovery**: Automatic reconnection on failures
4. **Sync Delays**: Write operations may have persistence delays

## Complete Example

```typescript
import { CoreSQLiteDrizzle } from '@draftlab/db'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

// Setup
const client = new CoreSQLiteDrizzle('todo-app.sqlite')
const db = drizzle(client.driver, client.batchDriver)

// Schema
const todos = sqliteTable('todos', {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  completed: integer().default(0),
  createdAt: text().default(sql`(datetime('now'))`)
})

// Wait for initialization
await client.ready()

// Create table
await client.driver(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`, [], 'run')

// Use with Drizzle
await db.insert(todos).values({ title: 'Learn @draftlab/db' })
await db.insert(todos).values({ title: 'Build awesome app' })

const allTodos = await db.select().from(todos)
console.log(allTodos)
// [
//   { id: 1, title: 'Learn @draftlab/db', completed: 0, createdAt: '2024-01-01 12:00:00' },
//   { id: 2, title: 'Build awesome app', completed: 0, createdAt: '2024-01-01 12:00:01' }
// ]
```

## License

MIT
