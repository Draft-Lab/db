# @draftlab/db

🚀 **High-performance SQLite library** for the browser using Web Workers and OPFS (Origin Private File System).

## Features

- 🔎 **Any Query** - Full SQL support with template literals and parameterized queries
- ⚡ **Async/Await** - Modern async API for all operations
- 🧵 **Non-Blocking** - Web Worker + OPFS for non-blocking queries
- 📂 **Persistent** - All data stored in Origin Private File System
- 🔒 **Type Safe** - Full TypeScript support with generic interfaces
- 🛠️ **Drizzle Ready** - Drop-in compatibility with Drizzle ORM
- 🔧 **Kysely Ready** - Native support for Kysely query builder
- 🏗️ **Simple API** - Clean, developer-friendly interface
- 🔄 **Batch & Transactions** - Efficient bulk operations

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

// Create table
await db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`)

// Insert data
await db.run("INSERT INTO users (name, email) VALUES (?, ?)", ["John Doe", "john@example.com"])

// Query data
const users = await db.query<User>("SELECT * FROM users")
console.log(users) // [{ id: 1, name: "John Doe", email: "john@example.com" }]

// Get single record
const user = await db.get<User>("SELECT * FROM users WHERE id = ?", [1])
console.log(user) // { id: 1, name: "John Doe", email: "john@example.com" }
```

## Architecture

```
    Client
       │
   CoreSQLite
       │
   OPFS Worker
       │
   SQLite WASM
       │
   OPFS Storage
```

The library uses a **worker-only architecture**:

- **Web Worker**: All SQLite operations run in a dedicated worker thread
- **OPFS**: Data persisted to Origin Private File System with optimized PRAGMA settings
- **Lazy Initialization**: Worker and database are created on first use
- **Cross-Tab Coordination**: BroadcastChannel for multi-tab synchronization

## Methods

### Client

#### `query<T>(sql, params?): Promise<T[]>`

Execute SELECT queries returning array of typed objects.

```typescript
const users = await db.query<User>("SELECT * FROM users WHERE age > ?", [18])
```

#### `get<T>(sql, params?): Promise<T | undefined>`

Execute SELECT queries returning single typed object or undefined.

```typescript
const user = await db.get<User>("SELECT * FROM users WHERE id = ?", [1])
```

#### `run(sql, params?): Promise<void>`

Execute INSERT, UPDATE, DELETE queries without return value.

```typescript
await db.run("INSERT INTO users (name) VALUES (?)", ["Alice"])
await db.run("UPDATE users SET name = ? WHERE id = ?", ["Bob", 1])
await db.run("DELETE FROM users WHERE id = ?", [1])
```

#### `batch<T>(callback): Promise<T>`

Execute multiple operations efficiently in a single message to the worker.

```typescript
await db.batch(async (tx) => {
  await tx.run("INSERT INTO users (name) VALUES (?)", ["Alice"])
  await tx.run("INSERT INTO users (name) VALUES (?)", ["Bob"])
  await tx.run("UPDATE users SET active = ? WHERE name = ?", [true, "Alice"])
})
```

#### `transaction<T>(callback): Promise<T>`

Execute multiple operations in a SQLite transaction (atomic, all-or-nothing).

```typescript
await db.transaction(async (tx) => {
  await tx.run("INSERT INTO users (name) VALUES (?)", ["Alice"])
  await tx.run("INSERT INTO users (name) VALUES (?)", ["Bob"])
  await tx.run("UPDATE users SET active = ? WHERE name = ?", [true, "Alice"])
})
```

#### Status Properties

```typescript
const status = db.status
console.log({
  ready: status.ready,           // Database initialized
  persistent: status.persistent  // Worker active
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

// Define schema
const users = sqliteTable("users", {
  id: integer().primaryKey(),
  name: text().notNull(),
  email: text().unique()
})

// Create table
await client.sql(`
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

- **Single Queries**: ~5-15ms (worker communication overhead)
- **Batch Operations**: Single worker message for multiple queries
- **Transactions**: Atomic operations with SQLite transaction wrapper
- **Initial Lazy Load**: ~50-100ms (worker + OPFS initialization on first query)

### Optimization Tips

```typescript
// ✅ Use transactions for atomic bulk operations
await db.transaction(async (tx) => {
  for (const user of users) {
    await tx.run("INSERT INTO users (name) VALUES (?)", [user.name])
  }
})

// ✅ Use batch for multiple independent operations
await db.batch(async (batch) => {
  for (const user of users) {
    await batch.run("INSERT INTO users (name) VALUES (?)", [user.name])
  }
})

// ❌ Avoid individual operations for bulk data (many worker round-trips)
for (const user of users) {
  await db.run("INSERT INTO users (name) VALUES (?)", [user.name])
}
```

## Browser Requirements

- **Modern Browsers**: Chrome 86+, Firefox 79+, Safari 15.2+
- **Web Workers**: Required for background persistence
- **OPFS**: Required for persistent storage
- **Cross-Origin Isolation**: Required headers for SharedArrayBuffer

## Limitations

1. **Worker Communication**: All operations have ~5-15ms latency due to worker message passing
2. **Query Builder Transactions**: Cannot isolate from external queries (both Drizzle and Kysely)
3. **OPFS Only**: No fallback to other storage methods (requires modern browser)
4. **Browser Only**: Cannot run in Node.js (use better-sqlite3 instead)

## License

MIT
