import type { Database, Sqlite3Static } from "@sqlite.org/sqlite-wasm"

export type SQLite = Sqlite3Static
export type SQLiteDatabase = Database
export type SQLiteInitModule = () => Promise<Sqlite3Static>
export type SQLiteMethod = "get" | "all" | "run" | "values"

export type SQLValue =
	| string
	| number
	| bigint
	| boolean
	| null
	| Uint8Array
	| ArrayBuffer
	| Int8Array

export type SQLRow = Record<string, SQLValue>

export interface RawResultData {
	columns: string[]
	rows: SQLValue[][] | SQLValue[]
}

export type DatabasePath = string

export interface DriverConfig {
	verbose?: boolean
	readOnly?: boolean
	databasePath: DatabasePath
}

export interface DriverStatement {
	sql: string
	params?: SQLValue[]
	method?: SQLiteMethod
}

export interface Statement {
	sql: string
	params: SQLValue[]
}
