import { useCallback, useEffect, useRef, useState } from "react"
import { useDatabaseContext } from "./provider"
import { queryClient } from "./query-client"
import type { UseQueryOptions, UseQueryResult } from "./types"

type InferReturn<T> = T extends Promise<infer R> ? R : T

export const useQuery = <T>(options: UseQueryOptions<T>): UseQueryResult<InferReturn<T>> => {
	const { isReady, error: dbError } = useDatabaseContext()
	const { queryKey, queryFn, enabled = true, refetchInterval, onError, onSuccess } = options

	const [data, setData] = useState<InferReturn<T> | undefined>(undefined)
	const [error, setError] = useState<Error | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)

	const queryFnRef = useRef(queryFn)
	const hasInitializedRef = useRef(false)
	const refetchIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

	queryFnRef.current = queryFn

	const executeQuery = useCallback(async (): Promise<void> => {
		if (!enabled || !isReady) return

		setIsLoading(true)
		setError(undefined)

		try {
			const result = await Promise.resolve(queryFnRef.current())
			setData(result as InferReturn<T>)
			onSuccess?.(result)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			onError?.(errorObj)
		} finally {
			setIsLoading(false)
		}
	}, [enabled, isReady, onSuccess, onError])

	const refetch = useCallback((): void => {
		executeQuery()
	}, [executeQuery])

	useEffect(() => {
		if (!queryKey) return
		return queryClient.subscribe(queryKey, refetch)
	}, [queryKey, refetch])

	useEffect(() => {
		if (!hasInitializedRef.current && enabled && isReady) {
			hasInitializedRef.current = true
			executeQuery()
		}
	}, [enabled, isReady, executeQuery])

	useEffect(() => {
		if (!refetchInterval || !enabled || !isReady) return

		refetchIntervalRef.current = setInterval(executeQuery, refetchInterval)
		return () => {
			if (refetchIntervalRef.current) {
				clearInterval(refetchIntervalRef.current)
			}
		}
	}, [refetchInterval, enabled, isReady, executeQuery])

	const finalError = error || dbError || undefined

	return {
		data,
		error: finalError,
		isLoading: isLoading || (!isReady && enabled),
		refetch
	}
}
