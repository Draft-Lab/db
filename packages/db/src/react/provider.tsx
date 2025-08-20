import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import type { DatabaseClient, DatabaseContextValue } from "./types"

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export const useDatabaseContext = (): DatabaseContextValue => {
	const context = useContext(DatabaseContext)
	if (!context) {
		throw new Error("useDatabaseContext must be used within a DatabaseProvider")
	}
	return context
}

interface DatabaseProviderProps {
	client: DatabaseClient
	children: ReactNode
}

export const DatabaseProvider = ({ client, children }: DatabaseProviderProps) => {
	const [isReady, setIsReady] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		const initDatabase = async () => {
			try {
				if ("ready" in client && typeof client.ready === "function") {
					await client.ready()
				}
				setIsReady(true)
				setError(null)
			} catch (err) {
				setError(err instanceof Error ? err : new Error(String(err)))
				setIsReady(false)
			}
		}

		initDatabase()
	}, [client])

	const contextValue: DatabaseContextValue = {
		isReady,
		error
	}

	return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
}
