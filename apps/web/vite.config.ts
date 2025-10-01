import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigpaths from "vite-tsconfig-paths"

export default defineConfig({
	worker: {
		format: "es"
	},
	plugins: [
		tanstackRouter({
			quoteStyle: "double",
			routeToken: "layout",
			autoCodeSplitting: true,
			routesDirectory: "./src/routes",
			generatedRouteTree: "./src/routeTree.gen.ts"
		}),
		react(),
		tailwindcss(),
		tsconfigpaths()
	],
	optimizeDeps: {
		exclude: ["@sqlite.org/sqlite-wasm"]
	},
	server: {
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin"
		}
	}
})
