type QueryKey = string | readonly unknown[]

class QueryClient {
	private queryMap = new Map<string, Set<() => void>>()

	private keyToString(key: QueryKey): string {
		return typeof key === "string" ? key : JSON.stringify(key)
	}

	subscribe(key: QueryKey, refetch: () => void) {
		const keyStr = this.keyToString(key)
		if (!this.queryMap.has(keyStr)) {
			this.queryMap.set(keyStr, new Set())
		}
		this.queryMap.get(keyStr)?.add(refetch)

		return () => {
			this.queryMap.get(keyStr)?.delete(refetch)
			if (this.queryMap.get(keyStr)?.size === 0) {
				this.queryMap.delete(keyStr)
			}
		}
	}

	invalidateQueries(key: QueryKey) {
		const keyStr = this.keyToString(key)
		const refetchers = this.queryMap.get(keyStr)
		if (refetchers) {
			for (const refetch of refetchers) {
				refetch()
			}
		}
	}

	invalidateAll() {
		for (const refetchers of this.queryMap.values()) {
			for (const refetch of refetchers) {
				refetch()
			}
		}
	}
}

export const queryClient = new QueryClient()
