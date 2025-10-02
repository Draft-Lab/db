import { CoreSQLiteKysely } from "@draftlab/db"
import { type Generated, Kysely } from "kysely"

interface Database {
	users: {
		id: Generated<number>
		name: string
		email: string
	}
}

export const client = new CoreSQLiteKysely("db.sqlite")
export const db = new Kysely<Database>({ dialect: client.dialect })
