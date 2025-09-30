# @draftlab/db

🚀 **High-performance SQLite library** combining in-memory speed with persistent storage using Web Workers and OPFS.

## Features

- 🔎 **Any Query** - Full SQL support with template literals and parameterized queries
- ⚡ **Ultra Fast** - In-memory SQLite for sub-millisecond queries  
- 🧵 **Threaded** - Web Worker + OPFS for non-blocking persistence
- 📂 **Persisted** - Automatic write-through caching to Origin Private File System
- 🔒 **Type Safe** - Full TypeScript support with generic interfaces
- 🛠️ **Drizzle Ready** - Drop-in compatibility with Drizzle ORM
- 🔧 **Kysely Ready** - Native support for Kysely query builder
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
  worker: {
    format: "es"
  },
  optimizeDeps: {
    exclude: ["@draftlab/db"]
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  }
}
```

> **Note**: Cross-origin isolation headers are required for SQLite WASM and Web Workers.

## Quick Start

```typescript
import { Client } from "@draftlab/db"

interface User {
  id: number
  name: string
  email: string
}

const db = new Client("database.sqlite")
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
db.run("INSERT INTO users (name, email) VALUES (?, ?)", ["John Doe", "john@example.com"])

// Query data
const users = db.query<User>("SELECT * FROM users")
console.log(users) // [{ id: 1, name: "John Doe", email: "john@example.com" }]

// Get single record
const user = db.get<User>("SELECT * FROM users WHERE id = ?", [1])
console.log(user) // { id: 1, name: "John Doe", email: "john@example.com" }
```

## Architecture

```
    Client
       │
   CoreSQLite ──── OPFS Worker
       │              │
   Memory DB      Persistent
  (< 1ms read)     Storage
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
const users = db.query<User>("SELECT * FROM users WHERE age > ?", [18])
```

#### `get<T>(sql, params?): T | undefined`

Execute SELECT queries returning single typed object or undefined.

```typescript
const user = db.get<User>("SELECT * FROM users WHERE id = ?", [1])
```

#### `run(sql, params?): void`

Execute INSERT, UPDATE, DELETE queries without return value.

```typescript
db.run("INSERT INTO users (name) VALUES (?)", ["Alice"])
db.run("UPDATE users SET name = ? WHERE id = ?", ["Bob", 1])
db.run("DELETE FROM users WHERE id = ?", [1])
```

#### `transaction(callback): T`

Execute multiple operations in a single transaction.

```typescript
db.transaction((tx) => {
  tx.run("INSERT INTO users (name) VALUES (?)", ["Alice"])
  tx.run("INSERT INTO users (name) VALUES (?)", ["Bob"])
  tx.run("UPDATE users SET active = ? WHERE name = ?", [true, "Alice"])
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

```typescript
import { CoreSQLiteDrizzle } from "@draftlab/db"
import { drizzle } from "drizzle-orm/sqlite-proxy"
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core"

// Setup
const client = new CoreSQLiteDrizzle("database.sqlite")
const db = drizzle(client.driver, client.batchDriver)

await client.ready()

// Define schema
const users = sqliteTable("users", {
  id: integer().primaryKey(),
  name: text().notNull(),
  email: text().unique()
})

// Create table
client.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`)

// Use Drizzle ORM
await db.insert(users).values({ name: "John Doe", email: "john@example.com" })
const allUsers = await db.select().from(users)
```

> 📖 **Learn more**: Visit [Drizzle ORM Documentation](https://orm.drizzle.team/) for advanced queries, relations, migrations, and more.

## Kysely Query Builder Integration

For developers who prefer [Kysely](https://kysely.dev/), we provide native support:

```typescript
import { CoreSQLiteKysely } from "@draftlab/db"
import { type Generated, Kysely } from "kysely"

interface Database {
  users: {
    id: Generated<number>
    name: string
    email: string
  }
}

// Setup
const client = new CoreSQLiteKysely("database.sqlite")
const db = new Kysely<Database>({ dialect: client.dialect })

await client.ready()

// Create table
await db.schema
  .createTable("users")
  .ifNotExists()
  .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
  .addColumn("name", "text")
  .addColumn("email", "text")
  .execute()


// Use Kysely
await db.insertInto("users").values({ name: "John Doe", email: "john@example.com" }).execute()
const allUsers = await db.selectFrom("users").selectAll().execute()
```

> 📖 **Learn more**: Visit [Kysely Documentation](https://kysely.dev/) for advanced queries, transactions, migrations, and more.

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
    tx.run("INSERT INTO users (name) VALUES (?)", [user.name])
  })
})

// ❌ Avoid individual operations for bulk data
users.forEach(user => {
  db.run("INSERT INTO users (name) VALUES (?)", [user.name])
})
```

## Browser Requirements

- **Modern Browsers**: Chrome 86+, Firefox 79+, Safari 15.2+
- **Web Workers**: Required for background persistence
- **OPFS**: Required for persistent storage
- **Cross-Origin Isolation**: Required headers for SharedArrayBuffer

## Limitations

1. **Query Builder Transactions**: Cannot isolate from external queries (both Drizzle and Kysely)
2. **OPFS Only**: No fallback to other storage methods
3. **Worker Recovery**: Automatic reconnection on failures
4. **Sync Delays**: Write operations may have persistence delays

## License

MIT
