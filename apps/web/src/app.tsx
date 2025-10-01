import { RouterProvider } from "@tanstack/react-router"
import { router } from "./router"

const InnerApp = () => {
	return <RouterProvider router={router} />
}

export const App = () => {
	return <InnerApp />
}
