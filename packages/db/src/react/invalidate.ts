import { queryClient } from "./query-client"
import type { QueryKey } from "./types"

export const invalidateQueries = (queryKey: QueryKey) => {
	queryClient.invalidateQueries(queryKey)
}

export const invalidateAllQueries = () => {
	queryClient.invalidateAll()
}
