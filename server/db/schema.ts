// Single source of truth for the database schema.
// Change this file, then run `npx drizzle-kit generate` to create a migration.
import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const LIST_TYPES = ['shopping', 'todo'] as const

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
}

export const lists = sqliteTable(
  'lists',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: LIST_TYPES }).notNull(),
    name: text('name').notNull(),
    // No families table yet; becomes a foreign key once families exist
    familyId: integer('family_id'),
    ...timestamps,
  },
  (t) => [
    index('lists_family_type_idx').on(t.familyId, t.type),
    check('lists_type_check', sql`${t.type} in ('shopping', 'todo')`),
  ],
)

export const items = sqliteTable(
  'items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    listId: integer('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    quantity: text('quantity'),
    reason: text('reason'),
    // No users table yet; becomes a foreign key once auth is decided
    addedBy: integer('added_by'),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('items_list_done_position_idx').on(t.listId, t.done, t.position)],
)

export type List = typeof lists.$inferSelect
export type NewList = typeof lists.$inferInsert
export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert
