import { useCallback, useEffect, useRef, useState } from "react"
import { useDatabaseContext } from "./provider"
import type { UseQueryOptions, UseQueryResult } from "./types"
import { useIsClient } from "./use-is-client"

type InferReturn<T> = T extends Promise<infer R> ? R : T

export const useQuery = <T>(options: UseQueryOptions<T>): UseQueryResult<InferReturn<T>> => {
	const { isReady, error: dbError } = useDatabaseContext()
	const { queryFn, enabled = true, onError, onSuccess } = options
	const isClient = useIsClient()

	const [data, setData] = useState<InferReturn<T> | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | undefined>(undefined)

	const queryFnRef = useRef(queryFn)
	const isExecutingRef = useRef(false)

	queryFnRef.current = queryFn

	const executeQuery = useCallback(async (): Promise<void> => {
		if (!enabled || !isReady || !isClient || isExecutingRef.current) {
			return
		}

		isExecutingRef.current = true

		try {
			setIsLoading(true)
			setError(undefined)

			const result = await Promise.resolve(queryFnRef.current())

			setData(result)
			onSuccess?.(result)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			onError?.(errorObj)
		} finally {
			setIsLoading(false)
			isExecutingRef.current = false
		}
	}, [enabled, isReady, isClient, onSuccess, onError])

	useEffect(() => {
		if (enabled && isReady && isClient) {
			executeQuery()
		}
	}, [enabled, isReady, isClient, executeQuery])

	const refetch = useCallback(() => {
		executeQuery()
	}, [executeQuery])

	return {
		data,
		isLoading,
		error: error || dbError,
		refetch
	}
}
