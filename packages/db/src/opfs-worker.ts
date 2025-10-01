import type { DriverStatement, RawResultData, SQLite, SQLiteDatabase } from "./types"
import type {
	ExecBatchPayload,
	ExecPayload,
	ExportResult,
	ImportPayload,
	InitPayload,
	WorkerErrorResponse,
	WorkerMessage,
	WorkerSuccessResponse
} from "./worker-types"

let sqlite: SQLite | undefined
let db: SQLiteDatabase | undefined
let isReady = false

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const { id, type, payload } = event.data

	try {
		switch (type) {
			case "init": {
				await handleInit(payload)
				const response: WorkerSuccessResponse<void> = {
					id,
					success: true,
					result: undefined
				}
				self.postMessage(response)
				break
			}
			case "exec": {
				const result = await handleExec(payload)
				const response: WorkerSuccessResponse<RawResultData> = {
					id,
					success: true,
					result
				}
				self.postMessage(response)
				break
			}
			case "execBatch": {
				const result = await handleExecBatch(payload)
				const response: WorkerSuccessResponse<RawResultData[]> = {
					id,
					success: true,
					result
				}
				self.postMessage(response)
				break
			}
			case "export": {
				const result = await handleExport()
				const response: WorkerSuccessResponse<ExportResult> = {
					id,
					success: true,
					result
				}
				self.postMessage(response)
				break
			}
			case "import": {
				await handleImport(payload)
				const response: WorkerSuccessResponse<void> = {
					id,
					success: true,
					result: undefined
				}
				self.postMessage(response)
				break
			}
			case "destroy": {
				await handleDestroy()
				const response: WorkerSuccessResponse<void> = {
					id,
					success: true,
					result: undefined
				}
				self.postMessage(response)
				break
			}
		}
	} catch (error) {
		const response: WorkerErrorResponse = {
			id,
			success: false,
			error: error instanceof Error ? error.message : String(error)
		}
		self.postMessage(response)
	}
}

const handleInit = async (config: InitPayload): Promise<void> => {
	const { default: sqliteInitModule } = await import("@sqlite.org/sqlite-wasm")
	sqlite = await sqliteInitModule()

	if (!("storage" in navigator) || !("getDirectory" in navigator.storage)) {
		throw new Error("OPFS not supported in worker")
	}

	try {
		db = new sqlite.oo1.DB(config.databasePath, "cw", "opfs-sahpool")
	} catch {
		try {
			db = new sqlite.oo1.OpfsDb(config.databasePath, "cw")
		} catch {
			db = new sqlite.oo1.DB(config.databasePath, "cw", "opfs")
		}
	}

	db.exec({ sql: "PRAGMA journal_mode = WAL" })
	db.exec({ sql: "PRAGMA synchronous = NORMAL" })
	db.exec({ sql: "PRAGMA cache_size = 5000" })
	db.exec({ sql: "PRAGMA foreign_keys = ON" })

	isReady = true
}

const handleExec = async (statement: ExecPayload): Promise<RawResultData> => {
	if (!isReady || !db) {
		throw new Error("Worker database not initialized")
	}

	return execOnDb(db, statement)
}

const handleExecBatch = async (statements: ExecBatchPayload): Promise<RawResultData[]> => {
	if (!isReady || !db) {
		throw new Error("Worker database not initialized")
	}

	const results: RawResultData[] = []

	if (db) {
		const workerDb = db
		workerDb.transaction(() => {
			for (const statement of statements) {
				results.push(execOnDb(workerDb, statement))
			}
		})
	}

	return results
}

const handleExport = async (): Promise<{ name: string; data: ArrayBuffer }> => {
	if (!sqlite || !db) {
		throw new Error("Worker database not initialized")
	}

	const exportedData = sqlite.capi.sqlite3_js_db_export(db)
	return {
		name: "database.sqlite3",
		data: exportedData.buffer.slice(0)
	}
}

const handleImport = async (payload: ImportPayload): Promise<void> => {
	if (!sqlite || !db) {
		throw new Error("Worker database not initialized")
	}

	const databasePath = db.filename
	db.close()

	const tempDb = new sqlite.oo1.DB(":memory:")
	const dataArray = new Uint8Array(payload.data)

	const dbPointer = tempDb.pointer
	if (!dbPointer) {
		tempDb.close()
		throw new Error("Failed to get database pointer")
	}

	const pData = sqlite.wasm.alloc(dataArray.byteLength)
	if (!pData) {
		tempDb.close()
		throw new Error("Failed to allocate memory")
	}

	sqlite.wasm.heap8u().set(dataArray, pData)

	const rc = sqlite.capi.sqlite3_deserialize(
		dbPointer,
		"main",
		pData,
		dataArray.byteLength,
		dataArray.byteLength,
		sqlite.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite.capi.SQLITE_DESERIALIZE_RESIZEABLE
	)

	if (rc !== sqlite.capi.SQLITE_OK) {
		tempDb.close()
		throw new Error(`Failed to deserialize: ${sqlite.capi.sqlite3_errstr(rc)}`)
	}

	const root = await navigator.storage.getDirectory()
	try {
		await root.removeEntry(databasePath)
	} catch {}

	tempDb.exec({
		sql: `VACUUM main INTO '${databasePath}'`
	})

	tempDb.close()

	try {
		db = new sqlite.oo1.DB(databasePath, "cw", "opfs-sahpool")
	} catch {
		try {
			db = new sqlite.oo1.OpfsDb(databasePath, "cw")
		} catch {
			db = new sqlite.oo1.DB(databasePath, "cw", "opfs")
		}
	}

	db.exec({ sql: "PRAGMA journal_mode = WAL" })
	db.exec({ sql: "PRAGMA synchronous = NORMAL" })
	db.exec({ sql: "PRAGMA cache_size = 5000" })
	db.exec({ sql: "PRAGMA foreign_keys = ON" })
}

const handleDestroy = async (): Promise<void> => {
	if (db) {
		db.close()
		db = undefined
	}

	isReady = false
}

const execOnDb = (database: SQLiteDatabase, statement: DriverStatement): RawResultData => {
	const result: RawResultData = { rows: [], columns: [] }

	const rows = database.exec({
		rowMode: "array",
		sql: statement.sql,
		bind: statement.params || [],
		returnValue: "resultRows",
		columnNames: result.columns
	})

	switch (statement.method) {
		case "run":
			break
		case "get":
			result.rows = rows[0] ? [rows[0]] : []
			break
		default:
			result.rows = rows
			break
	}

	return result
}
