import { CoreSQLite } from "./core"
import type { DriverConfig, SQLValue } from "./types"

export class Client {
	private db: CoreSQLite

	constructor(config: DriverConfig) {
		this.db = new CoreSQLite()
		this.db.setConfig(config)
	}

	async sql<T = Record<string, SQLValue>>(
		queryTemplate: TemplateStringsArray | string,
		...params: SQLValue[]
	): Promise<T[]> {
		const sql = this.buildQuery(queryTemplate, params)
		const result = await this.db.exec({ sql, params: [], method: "all" })

		return this.convertToObjects<T>(result)
	}

	async query<T = Record<string, SQLValue>>(
		sql: string,
		params: SQLValue[] = []
	): Promise<T[]> {
		const result = await this.db.exec({ sql, params, method: "all" })
		return this.convertToObjects<T>(result)
	}

	async get<T = Record<string, SQLValue>>(
		sql: string,
		params: SQLValue[] = []
	): Promise<T | undefined> {
		const result = await this.db.exec({ sql, params, method: "get" })
		const objects = this.convertToObjects<T>(result)
		return objects[0]
	}

	async run(sql: string, params: SQLValue[] = []): Promise<void> {
		await this.db.exec({ sql, params, method: "run" })
	}

	async batch<T>(callback: (tx: BatchInterface) => T | Promise<T>): Promise<T> {
		const statements: Array<{ sql: string; params: SQLValue[] }> = []

		const tx: BatchInterface = {
			sql: async (queryTemplate, ...params) => {
				const sql = this.buildQuery(queryTemplate, params)
				statements.push({ sql, params: [] })
				return []
			},
			query: async (sql, params = []) => {
				statements.push({ sql, params })
				return []
			},
			run: async (sql, params = []) => {
				statements.push({ sql, params })
			}
		}

		const result = await callback(tx)

		if (statements.length > 0) {
			const driverStatements = statements.map((stmt) => ({
				sql: stmt.sql,
				params: stmt.params,
				method: "run" as const
			}))

			await this.db.execBatch(driverStatements)
		}

		return result
	}

	async transaction<T>(callback: (tx: TransactionInterface) => T | Promise<T>): Promise<T> {
		const statements: Array<{ sql: string; params: SQLValue[] }> = []

		const tx: TransactionInterface = {
			sql: async (queryTemplate, ...params) => {
				const sql = this.buildQuery(queryTemplate, params)
				statements.push({ sql, params: [] })
				return []
			},
			query: async (sql, params = []) => {
				statements.push({ sql, params })
				return []
			},
			run: async (sql, params = []) => {
				statements.push({ sql, params })
			}
		}

		const result = await callback(tx)

		if (statements.length > 0) {
			const driverStatements = statements.map((stmt) => ({
				sql: stmt.sql,
				params: stmt.params,
				method: "run" as const
			}))

			await this.db.transaction(driverStatements)
		}

		return result
	}

	get status() {
		return {
			ready: this.db.isReady,
			persistent: this.db.hasPersistentStorage
		}
	}

	async exportDatabase(): Promise<ArrayBuffer> {
		return await this.db.exportDatabase()
	}

	async importDatabase(data: ArrayBuffer): Promise<void> {
		await this.db.importDatabase(data)
	}

	async close(): Promise<void> {
		await this.db.destroy()
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

	private convertToObjects<T = Record<string, SQLValue>>(result: {
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

interface BatchInterface {
	sql<T = Record<string, SQLValue>>(
		queryTemplate: TemplateStringsArray | string,
		...params: SQLValue[]
	): Promise<T[]>
	query<T = Record<string, SQLValue>>(sql: string, params?: SQLValue[]): Promise<T[]>
	run(sql: string, params?: SQLValue[]): Promise<void>
}

interface TransactionInterface {
	sql<T = Record<string, SQLValue>>(
		queryTemplate: TemplateStringsArray | string,
		...params: SQLValue[]
	): Promise<T[]>
	query<T = Record<string, SQLValue>>(sql: string, params?: SQLValue[]): Promise<T[]>
	run(sql: string, params?: SQLValue[]): Promise<void>
}
