import { useCallback, useState } from "react"
import { useDatabaseContext } from "./provider"

export type MutationFunction<T, V> = (variables: V) => T | Promise<T>

export type UseMutationOptions<T, V> = {
	mutationFn: MutationFunction<T, V>
	onSuccess?: (data: T, variables: V) => void
	onError?: (error: Error, variables: V) => void
}

export type UseMutationResult<T, V> = {
	mutate: (variables: V) => void
	mutateAsync: (variables: V) => Promise<T>
	isLoading: boolean
	error: Error | undefined
	data: T | undefined
	reset: () => void
}

export const useMutation = <T, V = void>(
	options: UseMutationOptions<T, V>
): UseMutationResult<T, V> => {
	const { mutationFn, onSuccess, onError } = options
	const { notifier } = useDatabaseContext()

	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | undefined>(undefined)
	const [data, setData] = useState<T | undefined>(undefined)

	const executeMutation = useCallback(
		async (variables: V): Promise<T> => {
			setIsLoading(true)
			setError(undefined)

			try {
				const result = await Promise.resolve(mutationFn(variables))
				setData(result)

				onSuccess?.(result, variables)

				notifier.notify()

				return result
			} catch (err) {
				const errorObj = err instanceof Error ? err : new Error(String(err))
				setError(errorObj)
				onError?.(errorObj, variables)
				throw errorObj
			} finally {
				setIsLoading(false)
			}
		},
		[mutationFn, onSuccess, onError, notifier]
	)

	const mutate = useCallback(
		(variables: V) => {
			executeMutation(variables).catch(() => {})
		},
		[executeMutation]
	)

	const mutateAsync = useCallback(
		(variables: V) => {
			return executeMutation(variables)
		},
		[executeMutation]
	)

	const reset = useCallback(() => {
		setData(undefined)
		setError(undefined)
		setIsLoading(false)
	}, [])

	return {
		mutate,
		mutateAsync,
		isLoading,
		error,
		data,
		reset
	}
}
