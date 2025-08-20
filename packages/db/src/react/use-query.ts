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

	const refetchIntervalRef = useRef<NodeJS.Timeout | undefined>()
	const lastQueryFnRef = useRef<typeof queryFn>()
	const stableQueryFn = useCallback(queryFn, [queryFn])

	const executeQuery = useCallback(async (): Promise<void> => {
		if (!enabled || !isReady) return

		setIsLoading(true)
		setError(undefined)

		try {
			const result = await Promise.resolve(stableQueryFn())
			setData(result as InferReturn<T>)
			onSuccess?.(result)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			onError?.(errorObj)
		} finally {
			setIsLoading(false)
		}
	}, [enabled, isReady, stableQueryFn, onSuccess, onError])

	const refetchRef = useRef<() => void>()
	refetchRef.current = () => executeQuery()

	const refetch = useCallback((): void => {
		refetchRef.current?.()
	}, [])

	useEffect(() => {
		let unsubscribe: (() => void) | undefined
		if (queryKey) {
			unsubscribe = queryClient.subscribe(queryKey, refetch)
		}

		if (lastQueryFnRef.current !== stableQueryFn) {
			lastQueryFnRef.current = stableQueryFn
			executeQuery()
		}

		if (refetchInterval && enabled && isReady) {
			refetchIntervalRef.current = setInterval(executeQuery, refetchInterval)
		}

		return () => {
			unsubscribe?.()
			if (refetchIntervalRef.current) {
				clearInterval(refetchIntervalRef.current)
				refetchIntervalRef.current = undefined
			}
		}
	}, [queryKey, stableQueryFn, refetchInterval, enabled, isReady, refetch])

	const finalError = error || dbError || undefined

	return {
		data,
		error: finalError,
		isLoading: isLoading || (!isReady && enabled),
		refetch
	}
}
