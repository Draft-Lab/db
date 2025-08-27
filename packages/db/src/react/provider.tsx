import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"
import { QueryNotifier } from "./query-notifier"
import type { DatabaseClient, DatabaseContextValue } from "./types"
import { useIsClient } from "./use-is-client"

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
	const [error, setError] = useState<Error | undefined>(undefined)
	const isClient = useIsClient()

	const notifier = useMemo(() => new QueryNotifier(), [])

	useEffect(() => {
		if (!isClient) return

		const initDatabase = async () => {
			try {
				if ("ready" in client && typeof client.ready === "function") {
					await client.ready()
				}
				setIsReady(true)
				setError(undefined)
			} catch (err) {
				setError(err instanceof Error ? err : new Error(String(err)))
				setIsReady(false)
			}
		}

		initDatabase()
	}, [client, isClient])

	const contextValue: DatabaseContextValue = {
		error,
		isReady,
		notifier
	}

	return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
}
