import { CoreSQLite } from "./core-sqlite"
import type { DriverStatement, SQLValue } from "./types"

export class CoreSQLiteDrizzle extends CoreSQLite {
	constructor(databasePath?: string) {
		super()

		if (databasePath) {
			this.config = {
				databasePath,
				verbose: false
			}
		}
	}

	driver = async (
		sql: string,
		params?: SQLValue[],
		method: "get" | "all" | "run" | "values" = "all"
	) => {
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

		return await this.exec({ sql, params, method })
	}

	batchDriver = async (
		queries: Array<{
			sql: string
			params?: SQLValue[]
			method?: "get" | "all" | "run" | "values"
		}>
	) => {
		const statements: DriverStatement[] = queries.map((query) => ({
			sql: query.sql,
			params: query.params,
			method: query.method || "all"
		}))

		return await this.execBatch(statements)
	}

	sql = async (sql: string, params?: SQLValue[]) => {
		return await this.driver(sql, params, "all")
	}
}
