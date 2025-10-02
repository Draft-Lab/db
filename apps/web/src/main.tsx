import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app"
import type { router } from "./router"

import "@/styles/index.css"

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}

const rootElement = document.getElementById("root")

if (!rootElement) {
	throw new Error("Root element not found")
}

const root = createRoot(rootElement)

root.render(
	<StrictMode>
		<App />
	</StrictMode>
)
