// Single source of truth for the database schema.
// Change this file, then run `npx drizzle-kit generate` to create a migration.
import type { WebAuthnCredential } from '#auth-utils'
import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { HOUSEHOLD_ROLES, LIST_TYPES } from '../../shared/constants'

const createdAt = integer('created_at', { mode: 'timestamp' })
  .notNull()
  .default(sql`(unixepoch())`)

const timestamps = {
  createdAt,
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
}

// --- users and households ---

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
})

// WebAuthn passkeys; a user can have several (one per device or password manager)
export const credentials = sqliteTable(
  'credentials',
  {
    // Credential ID from the authenticator, base64url
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull(),
    backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
    transports: text('transports', { mode: 'json' }).$type<NonNullable<WebAuthnCredential['transports']>>(),
    createdAt,
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  },
  (t) => [index('credentials_user_idx').on(t.userId)],
)

// Short-lived, single-use WebAuthn challenges, keyed by the attempt ID sent to the client
export const authChallenges = sqliteTable(
  'auth_challenges',
  {
    attemptId: text('attempt_id').primaryKey(),
    challenge: text('challenge').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('auth_challenges_expires_idx').on(t.expiresAt)],
)

export const households = sqliteTable('households', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  ...timestamps,
})

export const householdMembers = sqliteTable(
  'household_members',
  {
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: HOUSEHOLD_ROLES }).notNull(),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.userId] }),
    // Access checks look up memberships by user
    index('household_members_user_idx').on(t.userId),
    check('household_members_role_check', sql`${t.role} in ('owner', 'member')`),
  ],
)

export const invites = sqliteTable(
  'invites',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // SHA-256 of the token in the invite link; the token itself is never stored
    tokenHash: text('token_hash').notNull().unique(),
    name: text('name').notNull(),
    // null: the invitee gets a new household of their own (admin only)
    householdId: integer('household_id').references(() => households.id, { onDelete: 'cascade' }),
    role: text('role', { enum: HOUSEHOLD_ROLES }).notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp' }),
    usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    index('invites_household_idx').on(t.householdId),
    check('invites_role_check', sql`${t.role} in ('owner', 'member')`),
  ],
)

// --- lists ---

export const lists = sqliteTable(
  'lists',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: LIST_TYPES }).notNull(),
    name: text('name').notNull(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    index('lists_household_type_idx').on(t.householdId, t.type),
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
    addedBy: integer('added_by').references(() => users.id, { onDelete: 'set null' }),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('items_list_done_position_idx').on(t.listId, t.done, t.position)],
)

export type User = typeof users.$inferSelect
export type Household = typeof households.$inferSelect
export type List = typeof lists.$inferSelect
export type NewList = typeof lists.$inferInsert
export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert
