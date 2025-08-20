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

	const refetchIntervalRef = useRef<NodeJS.Timeout>()
	const lastQueryFnRef = useRef<typeof queryFn>()

	const executeQuery = useCallback(async (): Promise<void> => {
		if (!enabled || !isReady) return

		setIsLoading(true)
		setError(undefined)

		try {
			const result = await Promise.resolve(queryFn())
			setData(result as InferReturn<T>)
			onSuccess?.(result)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			onError?.(errorObj)
		} finally {
			setIsLoading(false)
		}
	}, [enabled, isReady, queryFn, onSuccess, onError])

	const refetch = useCallback((): void => {
		executeQuery()
	}, [executeQuery])

	useEffect(() => {
		if (!queryKey) return

		const unsubscribe = queryClient.subscribe(queryKey, refetch)
		return unsubscribe
	}, [queryKey, refetch])

	useEffect(() => {
		if (lastQueryFnRef.current !== queryFn) {
			lastQueryFnRef.current = queryFn
			executeQuery()
		}
	}, [queryFn, executeQuery])

	useEffect(() => {
		if (refetchInterval && enabled && isReady) {
			refetchIntervalRef.current = setInterval(executeQuery, refetchInterval)
			return () => {
				if (refetchIntervalRef.current) {
					clearInterval(refetchIntervalRef.current)
				}
			}
		}
		return undefined
	}, [refetchInterval, enabled, isReady, executeQuery])

	useEffect(() => {
		return () => {
			if (refetchIntervalRef.current) {
				clearInterval(refetchIntervalRef.current)
			}
		}
	}, [])

	const finalError = error || dbError || undefined

	return {
		data,
		error: finalError,
		isLoading: isLoading || (!isReady && enabled),
		refetch
	}
}
