import { MutationCache, matchQuery, QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: Number.POSITIVE_INFINITY
		}
	},
	mutationCache: new MutationCache({
		onSuccess: (_data, _variables, _context, mutation) => {
			queryClient.invalidateQueries({
				predicate: (query) => {
					return (
						mutation.meta?.invalidates?.some((queryKey) => {
							return matchQuery({ queryKey }, query)
						}) ?? true
					)
				}
			})
		}
	})
})
