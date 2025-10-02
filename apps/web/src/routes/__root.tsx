import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

export const Route = createRootRoute({
	component: Root,
	head: () => ({
		meta: [{ title: "Draft DB" }]
	})
})

function Root() {
	return (
		<>
			<HeadContent />
			<Outlet />
			<TanStackRouterDevtools position="bottom-left" />
		</>
	)
}
