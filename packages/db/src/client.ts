import { CoreSQLite } from "./core-sqlite"
import type { SQLValue } from "./types"

export class Client {
	private db: CoreSQLite
	private isReady = false

	constructor(databasePath: string) {
		this.db = new CoreSQLite()
		this.init(databasePath)
	}

	private async init(databasePath: string): Promise<void> {
		try {
			await this.db.init({ databasePath })
			this.isReady = true
		} catch (error) {
			console.error("Client initialization failed:", error)
			throw error
		}
	}

	async ready(): Promise<void> {
		while (!this.isReady) {
			await new Promise((resolve) => setTimeout(resolve, 50))
		}
	}

	sql<T extends Record<string, SQLValue>>(
		queryTemplate: TemplateStringsArray | string,
		...params: SQLValue[]
	): T[] {
		this.ensureReady()

		const sql = this.buildQuery(queryTemplate, params)
		const result = this.db.exec({ sql, params: [], method: "all" })

		return this.convertToObjects<T>(result)
	}

	query<T extends Record<string, SQLValue>>(sql: string, params: SQLValue[] = []): T[] {
		this.ensureReady()

		const result = this.db.exec({ sql, params, method: "all" })
		return this.convertToObjects<T>(result)
	}

	get<T extends Record<string, SQLValue>>(
		sql: string,
		params: SQLValue[] = []
	): T | undefined {
		this.ensureReady()

		const result = this.db.exec({ sql, params, method: "get" })
		const objects = this.convertToObjects<T>(result)
		return objects[0]
	}

	run(sql: string, params: SQLValue[] = []): void {
		this.ensureReady()
		this.db.exec({ sql, params, method: "run" })
	}

	transaction<T>(callback: (tx: TransactionInterface) => T): T {
		this.ensureReady()

		const statements: Array<{ sql: string; params: SQLValue[] }> = []

		const tx: TransactionInterface = {
			sql: (queryTemplate, ...params) => {
				const sql = this.buildQuery(queryTemplate, params)
				statements.push({ sql, params: [] })
				return []
			},
			query: (sql, params = []) => {
				statements.push({ sql, params })
				return []
			},
			run: (sql, params = []) => {
				statements.push({ sql, params })
			}
		}

		const result = callback(tx)

		if (statements.length > 0) {
			const driverStatements = statements.map((stmt) => ({
				sql: stmt.sql,
				params: stmt.params,
				method: "run" as const
			}))

			this.db.execBatch(driverStatements)
		}

		return result
	}

	get status() {
		return {
			ready: this.db.isReady,
			persistent: this.db.hasPersistentStorage,
			pendingSync: this.db.pendingSyncCount
		}
	}

	async close(): Promise<void> {
		await this.db.destroy()
		this.isReady = false
	}

	private ensureReady(): void {
		if (!this.isReady) {
			throw new Error("Database not ready. Wait for initialization to complete.")
		}
	}

	private buildQuery(
		queryTemplate: TemplateStringsArray | string,
		params: SQLValue[]
	): string {
		if (typeof queryTemplate === "string") {
			return queryTemplate
		}

		let sql = queryTemplate[0] || ""
		for (let i = 0; i < params.length; i++) {
			sql += `?${queryTemplate[i + 1] || ""}`
		}
		return sql
	}

	private convertToObjects<T extends Record<string, SQLValue>>(result: {
		rows: SQLValue[][] | SQLValue[]
		columns: string[]
	}): T[] {
		if (!Array.isArray(result.rows)) {
			return []
		}

		const objects: T[] = []

		for (const row of result.rows) {
			if (Array.isArray(row)) {
				const obj = {} as T
				for (let i = 0; i < result.columns.length; i++) {
					const column = result.columns[i]
					if (column) {
						const key = column as keyof T
						obj[key] = row[i] as T[keyof T]
					}
				}
				objects.push(obj)
			}
		}

		return objects
	}
}

interface TransactionInterface {
	sql<T extends Record<string, SQLValue>>(
		queryTemplate: TemplateStringsArray | string,
		...params: SQLValue[]
	): T[]
	query<T extends Record<string, SQLValue>>(sql: string, params?: SQLValue[]): T[]
	run(sql: string, params?: SQLValue[]): void
}
