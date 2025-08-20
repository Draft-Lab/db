import { useCallback, useEffect, useRef, useState } from "react"
import { useDatabaseContext } from "./provider"
import { store, useStore } from "./store"
import type { UseQueryOptions, UseQueryResult } from "./types"
import { useIsClient } from "./use-is-client"

type InferReturn<T> = T extends Promise<infer R> ? R : T

export const useQuery = <T>(options: UseQueryOptions<T>): UseQueryResult<InferReturn<T>> => {
	const { isReady, error: dbError } = useDatabaseContext()
	const { queryKey, queryFn, enabled = true } = options
	const isClient = useIsClient()

	const data = useStore<InferReturn<T>>(queryKey)

	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | undefined>(undefined)

	const queryFnRef = useRef(queryFn)
	const isExecutingRef = useRef(false)
	const hasFetchedRef = useRef(false)

	queryFnRef.current = queryFn

	const executeQuery = useCallback(async (): Promise<void> => {
		if (!enabled || !isReady || !isClient || isExecutingRef.current) {
			return
		}

		if (data !== undefined && hasFetchedRef.current) {
			return
		}

		isExecutingRef.current = true

		try {
			setIsLoading(true)
			setError(undefined)

			const result = await Promise.resolve(queryFnRef.current())

			if (queryKey) {
				store.setData(queryKey, result)
			}

			hasFetchedRef.current = true

			options.onSuccess?.(result)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)

			options.onError?.(errorObj)
		} finally {
			setIsLoading(false)
			isExecutingRef.current = false
		}
	}, [enabled, isReady, isClient, queryKey, data, options])

	useEffect(() => {
		if (enabled && isReady && isClient && !hasFetchedRef.current) {
			executeQuery()
		}
	}, [enabled, isReady, isClient])

	useEffect(() => {
		if (!queryKey || !enabled) return

		if (data === undefined && hasFetchedRef.current) {
			hasFetchedRef.current = false
			executeQuery()
		}
	}, [data, queryKey, enabled, executeQuery])

	return {
		data,
		error: error || dbError,
		isLoading: isLoading || (!isReady && enabled && isClient && !data)
	}
}
