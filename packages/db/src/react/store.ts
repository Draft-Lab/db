type Listener = () => void

class LocalStore {
	private listeners = new Set<Listener>()
	private queryResults = new Map<string, unknown>()
	private version = 0

	getData<T>(queryId: string): T | undefined {
		return this.queryResults.get(queryId) as T | undefined
	}

	setData<T>(queryId: string, value: T): void {
		this.queryResults.set(queryId, value)
		this.version++
		this.notifyAll()
	}

	private notifyAll(): void {
		queueMicrotask(() => {
			this.listeners.forEach((listener) => {
				listener()
			})
		})
	}

	invalidateAll(): void {
		this.queryResults.clear()
		this.version++
		this.notifyAll()
	}

	subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	getSnapshot = () => this.version
	getServerSnapshot = () => 0
}

export const store = new LocalStore()
