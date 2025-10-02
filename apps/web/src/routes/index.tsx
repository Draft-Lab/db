import { createFileRoute, useRouter } from "@tanstack/react-router"
import { db } from "@/libs/db"
import { Button } from "@/shared/components/button"

export const Route = createFileRoute("/")({
	component: RouteComponent,
	beforeLoad: async () => {
		await db.schema
			.createTable("users")
			.ifNotExists()
			.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
			.addColumn("name", "text")
			.addColumn("email", "text")
			.execute()
	},
	loader: async () => {
		const users = await db.selectFrom("users").selectAll().execute()

		return { users }
	}
})

function RouteComponent() {
	const router = useRouter()
	const { users } = Route.useLoaderData()

	const createUser = async (data: { name: string; email: string }) => {
		await db
			.insertInto("users")
			.values({
				name: data.name,
				email: data.email
			})
			.execute()

		router.invalidate()
	}

	const deleteUser = async (id: number) => {
		await db.deleteFrom("users").where("id", "==", id).execute()
		router.invalidate()
	}

	return (
		<main className="h-dvh w-screen flex flex-col items-center justify-center p-8">
			<div className="flex gap-3 mb-5">
				<Button
					onClick={() => {
						createUser({ name: "Matheus", email: "matheus@email.com" })
					}}
				>
					Criar usuário
				</Button>
			</div>

			<section className="flex flex-col items-center gap-3 w-full max-w-md">
				{users && users.length === 0 && (
					<p className="text-muted-foreground">Nenhum usuário encontrado</p>
				)}
				{users?.map((user) => (
					<div key={user.id} className="border-2 px-4 py-3 w-full rounded-lg">
						<p className="font-mono text-xs text-muted-foreground">ID: {user.id}</p>
						<p className="font-semibold">Nome: {user.name}</p>
						<p>Email: {user.email}</p>
						<Button
							onClick={() => {
								deleteUser(user.id)
							}}
							variant="destructive"
							size="sm"
							className="mt-2"
						>
							Excluir
						</Button>
					</div>
				))}
			</section>
		</main>
	)
}
