import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { db } from "@/libs/db"
import { Button } from "@/shared/components/button"

export const Route = createFileRoute("/")({
	component: RouteComponent,
	beforeLoad: async () => {
		await db.schema
			.createTable("users")
			.ifNotExists()
			.addColumn("id", "text")
			.addColumn("name", "text")
			.addColumn("email", "text")
			.execute()
	}
})

function RouteComponent() {
	const { data: users } = useQuery({
		queryKey: ["users"],
		queryFn: async () => {
			return await db.selectFrom("users").selectAll().execute()
		}
	})

	const { mutate: createUser } = useMutation({
		mutationFn: async (data: { name: string; email: string }) => {
			const id = crypto.randomUUID()

			await db
				.insertInto("users")
				.values({
					id,
					name: data.name,
					email: data.email
				})
				.execute()
		}
	})

	const { mutate: deleteUser } = useMutation({
		mutationFn: async ({ id }: { id: string }) => {
			await db.deleteFrom("users").where("id", "==", id).execute()
		}
	})

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
								deleteUser({ id: user.id })
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
