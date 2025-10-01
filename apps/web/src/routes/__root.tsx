import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { queryClient } from "@/libs/query-client"

export const Route = createRootRoute({
	component: Root,
	head: () => ({
		meta: [{ title: "Draft DB" }]
	})
})

function Root() {
	return (
		<QueryClientProvider client={queryClient}>
			<HeadContent />
			<Outlet />
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
		</QueryClientProvider>
	)
}
