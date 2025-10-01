import { CoreSQLiteKysely } from "@draftlab/db"
import { Kysely } from "kysely"

interface Database {
	users: {
		id: string
		name: string
		email: string
	}
}

export const client = new CoreSQLiteKysely("db.sqlite")
export const db = new Kysely<Database>({ dialect: client.dialect })
