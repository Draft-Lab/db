import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useDatabaseContext } from "./provider"
import { store } from "./store"
import type { QueryFunction, UseQueryOptions, UseQueryResult } from "./types"
import { useIsClient } from "./use-is-client"

type InferReturn<T> = T extends Promise<infer R> ? R : T

const createQueryId = <T>(fn: QueryFunction<T>): string => {
	const fnString = fn.toString()
	let hash = 0
	for (let i = 0; i < fnString.length; i++) {
		const char = fnString.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	return `query-${Math.abs(hash)}`
}

export const useQuery = <T>(options: UseQueryOptions<T>): UseQueryResult<InferReturn<T>> => {
	const { isReady, error: dbError } = useDatabaseContext()
	const { queryFn, enabled = true, onError, onSuccess } = options
	const isClient = useIsClient()

	const queryId = createQueryId(queryFn)

	useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

	const data = store.getData<InferReturn<T>>(queryId)

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

			store.setData(queryId, result)
			onSuccess?.(result)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			onError?.(errorObj)
		} finally {
			setIsLoading(false)
			isExecutingRef.current = false
		}
	}, [enabled, isReady, isClient, queryId, onSuccess, onError])

	useEffect(() => {
		if (enabled && isReady && isClient && data === undefined) {
			executeQuery()
		}
	}, [enabled, isReady, isClient, data, executeQuery])

	return {
		data,
		isLoading,
		error: error || dbError
	}
}
