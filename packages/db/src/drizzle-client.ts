import { CoreSQLite } from "./core-sqlite"
import type { DriverStatement, SQLValue } from "./types"

export class CoreSQLiteDrizzle extends CoreSQLite {
	private initPromise?: Promise<void>

	constructor(databasePath?: string) {
		super()

		if (databasePath) {
			this.initPromise = this.init({
				databasePath,
				verbose: false
			}).catch(console.error)
		}
	}

	async ready(): Promise<void> {
		if (this.initPromise) {
			await this.initPromise
		}
	}

	driver = async (
		sql: string,
		params?: SQLValue[],
		method: "get" | "all" | "run" | "values" = "all"
	) => {
		if (this.initPromise) {
			await this.initPromise
		}

		if (
			/^begin\b/i.test(sql) &&
			typeof globalThis.sessionStorage !== "undefined" &&
			!sessionStorage._coresqlite_sent_drizzle_transaction_warning
		) {
			console.warn(
				"Drizzle's transaction method cannot isolate transactions from outside queries."
			)
			sessionStorage._coresqlite_sent_drizzle_transaction_warning = "1"
		}

		return this.exec({ sql, params, method })
	}

	batchDriver = async (
		queries: Array<{
			sql: string
			params?: SQLValue[]
			method?: "get" | "all" | "run" | "values"
		}>
	) => {
		if (this.initPromise) {
			await this.initPromise
		}

		const statements: DriverStatement[] = queries.map((query) => ({
			sql: query.sql,
			params: query.params,
			method: query.method || "all"
		}))

		return this.execBatch(statements)
	}

	sql = async (sql: string, params?: SQLValue[]) => {
		return this.driver(sql, params, "all")
	}
}
