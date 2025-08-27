import type { Client } from "../client"
import type { CoreSQLiteDrizzle } from "../drizzle-client"
import type { CoreSQLiteKysely } from "../kysely-client"
import type { QueryNotifier } from "./query-notifier"

export type DatabaseClient = Client | CoreSQLiteDrizzle | CoreSQLiteKysely

export type QueryFunction<T> = () => T | Promise<T>

export type UseQueryOptions<T> = {
	queryFn: QueryFunction<T>
	enabled?: boolean
	onError?: (error: Error) => void
	onSuccess?: (data: T) => void
}

export type UseQueryResult<T> = {
	data: T | undefined
	error: Error | undefined
	isLoading: boolean
	refetch: () => void
}

export type DatabaseContextValue = {
	isReady: boolean
	notifier: QueryNotifier
	error: Error | undefined
}
