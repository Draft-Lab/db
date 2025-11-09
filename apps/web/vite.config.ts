import draftlab from "@draftlab/db/vite"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigpaths from "vite-tsconfig-paths"

export default defineConfig({
	plugins: [
		tanstackRouter({
			quoteStyle: "double",
			routeToken: "layout",
			autoCodeSplitting: true,
			routesDirectory: "./src/routes",
			generatedRouteTree: "./src/routeTree.gen.ts"
		}),
		react(),
		draftlab(),
		tailwindcss(),
		tsconfigpaths()
	]
})
