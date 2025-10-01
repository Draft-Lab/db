import type {
	DriverConfig,
	DriverStatement,
	RawResultData,
	SQLite,
	SQLiteDatabase
} from "./types"
import type {
	WorkerErrorResponse,
	WorkerMessage,
	WorkerResponse,
	WorkerSuccessResponse
} from "./worker-types"

export class CoreSQLite {
	private sqlite?: SQLite
	private memory?: SQLiteDatabase
	private worker?: Worker
	private config?: DriverConfig
	private syncQueue: DriverStatement[] = []
	private isInitialized = false
	private isSyncing = false
	private isImporting = false
	private messageId = 0
	private pendingMessages = new Map<
		string,
		{
			resolve: (value: unknown) => void
			reject: (error: Error) => void
		}
	>()

	private retryCount = 0
	private readonly maxRetries = 3

	async init(config: DriverConfig): Promise<void> {
		this.config = config

		await this.initMemory()

		if (typeof window !== "undefined") {
			await this.initWorker()
			await this.bootSync()
		}

		this.isInitialized = true
	}

	private async initMemory(): Promise<void> {
		const { default: sqliteInitModule } = await import("@sqlite.org/sqlite-wasm")
		this.sqlite = await sqliteInitModule()

		this.memory = new this.sqlite.oo1.DB(":memory:")

		this.memory.exec({ sql: "PRAGMA synchronous = OFF" })
		this.memory.exec({ sql: "PRAGMA journal_mode = MEMORY" })
		this.memory.exec({ sql: "PRAGMA temp_store = MEMORY" })
		this.memory.exec({ sql: "PRAGMA locking_mode = EXCLUSIVE" })
		this.memory.exec({ sql: "PRAGMA cache_size = -64000" })
	}

	private async initWorker(): Promise<void> {
		if (typeof Worker === "undefined") {
			console.warn("@draftlab/db: Workers not available - running in memory-only mode")
			return
		}

		this.worker = new Worker(new URL("./opfs-worker", import.meta.url), {
			type: "module"
		})

		this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			const { id, success } = event.data
			const pending = this.pendingMessages.get(id)

			if (pending) {
				this.pendingMessages.delete(id)
				if (success) {
					const successResponse = event.data as WorkerSuccessResponse<unknown>
					pending.resolve(successResponse.result)
				} else {
					const errorResponse = event.data as WorkerErrorResponse
					pending.reject(new Error(errorResponse.error))
				}
			}
		}

		this.worker.onerror = (error) => {
			console.error("Worker error:", error)
		}

		await this.sendToWorker<void>({
			type: "init",
			payload: { databasePath: this.config?.databasePath || "" }
		})
	}

	private async bootSync(): Promise<void> {
		if (!this.memory) return

		try {
			const tables = await this.sendToWorker<RawResultData>({
				type: "exec",
				payload: {
					sql: "SELECT name, sql FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'",
					method: "all"
				}
			})

			for (const table of tables.rows) {
				if (!Array.isArray(table)) continue
				const [tableName, createSql] = table as [string, string]

				this.execOnDb(this.memory, { sql: createSql, method: "run" })

				const data = await this.sendToWorker<RawResultData>({
					type: "exec",
					payload: {
						sql: `SELECT * FROM "${tableName}"`,
						method: "all"
					}
				})

				if (data.rows.length > 0) {
					const placeholders = data.columns.map(() => "?").join(", ")
					const insertSql = `INSERT INTO "${tableName}" ("${data.columns.join('", "')}")VALUES (${placeholders})`

					if (this.memory) {
						const memoryDb = this.memory
						memoryDb.transaction(() => {
							for (const row of data.rows) {
								this.execOnDb(memoryDb, {
									sql: insertSql,
									params: Array.isArray(row) ? row : [row],
									method: "run"
								})
							}
						})
					}
				}
			}
		} catch (error) {
			console.warn("Boot sync failed:", error)
		}
	}

	exec(statement: DriverStatement): RawResultData {
		if (!this.isInitialized || !this.memory) {
			throw new Error("CoreSQLite not initialized")
		}

		const result = this.execOnDb(this.memory, statement)

		if (this.isWriteOperation(statement.sql)) {
			this.queueForSync(statement)
		}

		return result
	}

	execBatch(statements: DriverStatement[]): RawResultData[] {
		if (!this.isInitialized || !this.memory) {
			throw new Error("CoreSQLite not initialized")
		}

		const results: RawResultData[] = []

		if (this.memory) {
			const memoryDb = this.memory
			memoryDb.transaction(() => {
				for (const statement of statements) {
					results.push(this.execOnDb(memoryDb, statement))
				}
			})
		}

		const writeStatements = statements.filter((stmt) => this.isWriteOperation(stmt.sql))
		if (writeStatements.length > 0) {
			this.syncQueue.push(...writeStatements)
			this.flushSyncQueue()
		}

		return results
	}

	private async sendToWorker<T>(message: Omit<WorkerMessage, "id">): Promise<T> {
		if (!this.worker) {
			console.warn("@draftlab/db: Worker operation skipped (running in memory-only mode)")
			return {} as T
		}

		const id = (++this.messageId).toString()

		return new Promise<T>((resolve, reject) => {
			this.pendingMessages.set(id, {
				resolve: (value: unknown) => resolve(value as T),
				reject
			})

			const fullMessage = {
				id,
				...message
			} as WorkerMessage

			this.worker?.postMessage(fullMessage)

			const timeoutMs = this.getTimeoutForOperation(message.type)
			const timeoutId = setTimeout(() => {
				if (this.pendingMessages.has(id)) {
					this.pendingMessages.delete(id)
					reject(
						new Error(
							`Worker message timeout after ${timeoutMs}ms for operation: ${message.type}`
						)
					)
				}
			}, timeoutMs)

			const originalResolve = this.pendingMessages.get(id)?.resolve
			const originalReject = this.pendingMessages.get(id)?.reject

			if (originalResolve && originalReject) {
				this.pendingMessages.set(id, {
					resolve: (value: unknown) => {
						clearTimeout(timeoutId)
						originalResolve(value)
					},
					reject: (error: Error) => {
						clearTimeout(timeoutId)
						originalReject(error)
					}
				})
			}
		})
	}

	private getTimeoutForOperation(type: string): number {
		switch (type) {
			case "init":
				return 30000
			case "import":
				return 60000
			case "export":
				return 30000
			case "execBatch":
				return 15000
			case "exec":
				return 5000
			case "destroy":
				return 2000
			default:
				return 10000
		}
	}

	private queueForSync(statement: DriverStatement): void {
		this.syncQueue.push(statement)
		this.flushSyncQueue()
	}

	private async flushSyncQueue(): Promise<void> {
		if (this.isSyncing || this.isImporting || this.syncQueue.length === 0 || !this.worker) {
			return
		}

		this.isSyncing = true
		const batch = [...this.syncQueue]
		this.syncQueue = []

		try {
			await this.sendToWorker<RawResultData[]>({
				type: "execBatch",
				payload: batch
			})

			this.retryCount = 0
		} catch (error) {
			await this.handleSyncError(error as Error, batch)
		} finally {
			this.isSyncing = false

			if (this.syncQueue.length > 0) {
				const delay = this.getRetryDelay()
				setTimeout(() => this.flushSyncQueue(), delay)
			}
		}
	}

	private async handleSyncError(error: Error, batch: DriverStatement[]): Promise<void> {
		this.retryCount++

		if (this.retryCount <= this.maxRetries) {
			console.warn(
				`Worker sync failed (attempt ${this.retryCount}/${this.maxRetries}):`,
				error.message
			)

			this.syncQueue.unshift(...batch)

			if (error.message.includes("timeout") || error.message.includes("Worker")) {
				await this.tryRecoverWorker()
			}
		} else {
			console.error(
				`Worker sync failed after ${this.maxRetries} attempts, dropping batch:`,
				error
			)
			this.retryCount = 0

			await this.tryRecoverWorker()
		}
	}

	private async tryRecoverWorker(): Promise<void> {
		if (typeof window === "undefined") {
			return
		}

		try {
			console.warn("Attempting to recover worker connection...")

			if (this.worker) {
				this.worker.terminate()
				this.worker = undefined
			}

			await this.initWorker()
			console.log("Worker recovery successful")
		} catch (recoveryError) {
			console.error("Worker recovery failed:", recoveryError)
		}
	}

	private getRetryDelay(): number {
		return Math.min(100 * 2 ** this.retryCount, 5000)
	}

	private execOnDb(db: SQLiteDatabase, statement: DriverStatement): RawResultData {
		const result: RawResultData = { rows: [], columns: [] }

		try {
			if (statement.method === "run") {
				db.exec({
					sql: statement.sql,
					bind: statement.params || [],
					returnValue: "resultRows"
				})

				result.rows = []
				result.columns = []
			} else {
				const rows = db.exec({
					rowMode: "array",
					sql: statement.sql,
					bind: statement.params || [],
					returnValue: "resultRows",
					columnNames: result.columns
				})

				switch (statement.method) {
					case "get":
						result.rows = rows[0] ? [rows[0]] : []
						break
					case "values":
						result.rows = rows
						break
					default:
						result.rows = rows
						break
				}
			}
		} catch (error) {
			console.error("❌ SQL execution error:", error, statement)
			throw error
		}

		return result
	}

	private isWriteOperation(sql: string): boolean {
		const normalized = sql.trim().toUpperCase()
		return (
			normalized.startsWith("INSERT") ||
			normalized.startsWith("UPDATE") ||
			normalized.startsWith("DELETE") ||
			normalized.startsWith("CREATE") ||
			normalized.startsWith("DROP") ||
			normalized.startsWith("ALTER")
		)
	}

	async exportDatabase(): Promise<ArrayBuffer> {
		if (!this.worker) {
			throw new Error("Export requires persistent storage (OPFS worker)")
		}

		this.isImporting = true

		try {
			await this.flushSyncQueue()

			const result = await this.sendToWorker<{ name: string; data: ArrayBuffer }>({
				type: "export",
				payload: undefined
			})

			return result.data
		} finally {
			this.isImporting = false
		}
	}

	async importDatabase(data: ArrayBuffer): Promise<void> {
		if (!this.worker) {
			throw new Error("Import requires persistent storage (OPFS worker)")
		}

		this.isImporting = true

		try {
			await this.flushSyncQueue()

			await this.sendToWorker<void>({
				type: "import",
				payload: { data }
			})

			if (this.memory) {
				this.memory.close()
				this.memory = new (this.sqlite as SQLite).oo1.DB(":memory:")

				this.memory.exec({ sql: "PRAGMA synchronous = OFF" })
				this.memory.exec({ sql: "PRAGMA journal_mode = MEMORY" })
				this.memory.exec({ sql: "PRAGMA temp_store = MEMORY" })
				this.memory.exec({ sql: "PRAGMA locking_mode = EXCLUSIVE" })
				this.memory.exec({ sql: "PRAGMA cache_size = -64000" })
			}

			await this.bootSync()
		} finally {
			this.isImporting = false
		}
	}

	async destroy(): Promise<void> {
		if (this.worker) {
			await this.flushSyncQueue()
		}

		if (this.memory) {
			this.memory.close()
			this.memory = undefined
		}

		if (this.worker) {
			await this.sendToWorker<void>({
				type: "destroy",
				payload: undefined
			})
			this.worker.terminate()
			this.worker = undefined
		}

		this.isInitialized = false
	}

	get isReady(): boolean {
		return this.isInitialized && !!this.memory
	}

	get hasPersistentStorage(): boolean {
		return !!this.worker
	}

	get pendingSyncCount(): number {
		return this.syncQueue.length
	}
}
