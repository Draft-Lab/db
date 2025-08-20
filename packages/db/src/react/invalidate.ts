import { store } from "./store"
import type { QueryKey } from "./types"

export const invalidateQueries = (queryKey: QueryKey) => {
	store.invalidate(queryKey)
}

export const invalidateAllQueries = () => {
	store.invalidateAll()
}
