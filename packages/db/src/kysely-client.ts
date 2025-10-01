import {
	type CompiledQuery,
	type DatabaseConnection,
	type Dialect,
	type Driver,
	type QueryResult,
	SqliteAdapter,
	SqliteIntrospector,
	SqliteQueryCompiler
} from "kysely"
import { Client } from "./client"
import type { SQLValue } from "./types"

interface Transaction {
	query<T = Record<string, SQLValue>>(compiledQuery: unknown): Promise<T[]>
	commit(): Promise<void>
	rollback(): Promise<void>
}

export class CoreSQLiteKysely extends Client {
	dialect: Dialect = {
		createAdapter: () => new SqliteAdapter(),
		createDriver: () => new KyselyDriver(this),
		createIntrospector: (db) => new SqliteIntrospector(db),
		createQueryCompiler: () => new SqliteQueryCompiler()
	}

	async beginTransaction(): Promise<Transaction> {
		const statements: Array<{ sql: string; params: SQLValue[] }> = []
		let committed = false
		let rolledBack = false
		const client = this

		return {
			async query<T = Record<string, SQLValue>>(compiledQuery: CompiledQuery): Promise<T[]> {
				if (committed || rolledBack) {
					throw new Error("Transaction is already completed")
				}
				statements.push({
					sql: compiledQuery.sql,
					params: compiledQuery.parameters as SQLValue[]
				})
				return []
			},

			async commit(): Promise<void> {
				if (committed || rolledBack) {
					throw new Error("Transaction is already completed")
				}

				if (statements.length > 0) {
					await client.transaction(async (tx) => {
						for (const stmt of statements) {
							await tx.run(stmt.sql, stmt.params)
						}
					})
				}
				committed = true
			},

			async rollback(): Promise<void> {
				if (committed || rolledBack) {
					throw new Error("Transaction is already completed")
				}
				rolledBack = true
			}
		}
	}
}

class KyselyDriver implements Driver {
	private client: CoreSQLiteKysely

	constructor(client: CoreSQLiteKysely) {
		this.client = client
	}

	async init(): Promise<void> {}
	async releaseConnection(): Promise<void> {}

	async acquireConnection(): Promise<KyselyConnection> {
		return new KyselyConnection(this.client)
	}

	async beginTransaction(connection: KyselyConnection): Promise<void> {
		connection.transaction = await this.client.beginTransaction()
	}

	async commitTransaction(connection: KyselyConnection): Promise<void> {
		await connection.transaction?.commit()
		connection.transaction = null
	}

	async rollbackTransaction(connection: KyselyConnection): Promise<void> {
		await connection.transaction?.rollback()
		connection.transaction = null
	}

	async destroy(): Promise<void> {
		await this.client.close()
	}
}

class KyselyConnection implements DatabaseConnection {
	transaction: Transaction | null = null
	private client: CoreSQLiteKysely

	constructor(client: CoreSQLiteKysely) {
		this.client = client
	}

	async executeQuery<Result>(query: CompiledQuery): Promise<QueryResult<Result>> {
		let rows: Result[]

		if (this.transaction === null) {
			rows = (await this.client.query(query.sql, query.parameters as SQLValue[])) as Result[]
		} else {
			rows = await this.transaction.query(query)
		}

		return {
			rows: rows as Result[]
		}
	}

	// biome-ignore lint/correctness/useYield: SQLite does not support streaming
	async *streamQuery(): AsyncGenerator<never, void, unknown> {
		throw new Error("SQLite3 does not support streaming.")
	}
}
