import { useSyncExternalStore } from "react"

type QueryKey = string | readonly unknown[]
type Listener = () => void

class LocalStore {
	private listeners = new Map<string, Set<Listener>>()
	private data = new Map<string, unknown>()
	private version = 0

	private keyToString(key: QueryKey): string {
		return typeof key === "string" ? key : JSON.stringify(key)
	}

	getData<T>(key: QueryKey): T | undefined {
		return this.data.get(this.keyToString(key)) as T | undefined
	}

	setData<T>(key: QueryKey, value: T): void {
		const keyStr = this.keyToString(key)
		this.data.set(keyStr, value)
		this.version++
		this.notify(keyStr)
	}

	subscribe(key: QueryKey, listener: Listener): () => void {
		const keyStr = this.keyToString(key)

		if (!this.listeners.has(keyStr)) {
			this.listeners.set(keyStr, new Set())
		}

		this.listeners.get(keyStr)?.add(listener)

		return () => {
			const set = this.listeners.get(keyStr)
			if (set) {
				set.delete(listener)
				if (set.size === 0) {
					this.listeners.delete(keyStr)
				}
			}
		}
	}

	private notify(keyStr: string): void {
		const set = this.listeners.get(keyStr)
		if (set) {
			queueMicrotask(() => {
				set.forEach((listener) => {
					listener()
				})
			})
		}
	}

	invalidate(key: QueryKey): void {
		const keyStr = this.keyToString(key)
		this.data.delete(keyStr)
		this.version++
		this.notify(keyStr)
	}

	invalidateAll(): void {
		const keys = Array.from(this.listeners.keys())
		this.data.clear()
		this.version++

		queueMicrotask(() => {
			keys.forEach((keyStr) => {
				this.notify(keyStr)
			})
		})
	}

	getSnapshot = () => this.version
	getServerSnapshot = () => 0
}

export const store = new LocalStore()

export const useStore = <T>(key: QueryKey | undefined): T | undefined => {
	const snapshot = useSyncExternalStore(
		(callback) => {
			if (!key) return () => {}
			return store.subscribe(key, callback)
		},
		() => (key ? store.getData<T>(key) : undefined),
		() => undefined
	)

	return snapshot
}
