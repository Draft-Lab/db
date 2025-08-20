import type { Client } from "../client"
import type { CoreSQLiteDrizzle } from "../drizzle-client"
import type { CoreSQLiteKysely } from "../kysely-client"

export type DatabaseClient = Client | CoreSQLiteDrizzle | CoreSQLiteKysely

export type QueryKey = string | readonly unknown[]
export type QueryFunction<T> = () => T | Promise<T>

export type UseQueryOptions<T> = {
	queryKey?: QueryKey
	queryFn: QueryFunction<T>
	enabled?: boolean
	refetchInterval?: number
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
	error: Error | null
}
