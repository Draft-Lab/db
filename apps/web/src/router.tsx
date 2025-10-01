import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export const router = createRouter({
	routeTree,
	scrollRestoration: true,
	defaultPreload: "intent",
	defaultPreloadStaleTime: 0,
	scrollRestorationBehavior: "smooth"
})
