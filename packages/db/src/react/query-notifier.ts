type Listener = () => void

export class QueryNotifier {
	private listeners = new Set<Listener>()

	subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	notify = (): void => {
		queueMicrotask(() => {
			this.listeners.forEach((listener) => {
				listener()
			})
		})
	}
}
