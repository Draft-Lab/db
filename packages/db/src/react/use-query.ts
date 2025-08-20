import { useCallback, useEffect, useRef, useState } from "react"
import { useDatabaseContext } from "./provider"
import { queryClient } from "./query-client"
import type { UseQueryOptions, UseQueryResult } from "./types"

type InferReturn<T> = T extends Promise<infer R> ? R : T

export const useQuery = <T>(options: UseQueryOptions<T>): UseQueryResult<InferReturn<T>> => {
	const { isReady, error: dbError } = useDatabaseContext()
	const { queryKey, queryFn, enabled = true } = options

	const [data, setData] = useState<InferReturn<T> | undefined>(undefined)
	const [error, setError] = useState<Error | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)

	const queryFnRef = useRef(queryFn)
	queryFnRef.current = queryFn

	const executeQuery = useCallback(async (): Promise<void> => {
		if (!enabled || !isReady) return

		try {
			setIsLoading(true)
			setError(undefined)
			const result = await Promise.resolve(queryFnRef.current())
			setData(result as InferReturn<T>)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
		} finally {
			setIsLoading(false)
		}
	}, [enabled, isReady])

	useEffect(() => {
		executeQuery()
	}, [executeQuery])

	useEffect(() => {
		if (!queryKey) return
		return queryClient.subscribe(queryKey, executeQuery)
	}, [queryKey, executeQuery])

	return {
		data,
		error: error || dbError,
		isLoading: isLoading || (!isReady && enabled),
		refetch: executeQuery
	}
}
