import type { DriverConfig, DriverStatement, RawResultData, SQLiteBackend } from "../types"
import { CoreSQLiteMemory } from "./core-sqlite-memory"
import { CoreSQLiteOPFS } from "./core-sqlite-opfs"
import { CoreSQLiteStorage } from "./core-sqlite-storage"

export class CoreSQLite {
	protected config?: DriverConfig
	protected backend!: SQLiteBackend

	setConfig(config: DriverConfig): void {
		this.config = config

		switch (config.backend) {
			case "memory":
				this.backend = new CoreSQLiteMemory()
				break
			case "localStorage":
				this.backend = new CoreSQLiteStorage("local")
				break
			case "sessionStorage":
				this.backend = new CoreSQLiteStorage("session")
				break
			case "worker":
				this.backend = new CoreSQLiteOPFS()
				break
		}

		this.backend.setConfig(config)
	}

	async exec(statement: DriverStatement): Promise<RawResultData> {
		return await this.backend.exec(statement)
	}

	async execBatch(statements: DriverStatement[]): Promise<RawResultData[]> {
		return await this.backend.execBatch(statements)
	}

	async transaction(statements: DriverStatement[]): Promise<RawResultData[]> {
		return await this.backend.transaction(statements)
	}

	async exportDatabase(): Promise<ArrayBuffer> {
		return await this.backend.exportDatabase()
	}

	async importDatabase(data: ArrayBuffer): Promise<void> {
		await this.backend.importDatabase(data)
	}

	async destroy(): Promise<void> {
		await this.backend.destroy()
	}

	get isReady(): boolean {
		return this.backend.isReady
	}

	get hasPersistentStorage(): boolean {
		return this.backend.hasPersistentStorage
	}
}
