// Single source of truth for the database schema.
// Change this file, then run `npx drizzle-kit generate` to create a migration.
import type { WebAuthnCredential } from '#auth-utils'
import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { HOUSEHOLD_ROLES, LIST_TYPES } from '../../shared/constants'
import { blindIndexText, encryptedText } from './encryption'

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
  name: encryptedText('name').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  // Copied into the session at login; bumping it logs out every session that holds an older value
  sessionVersion: integer('session_version').notNull().default(0),
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
  name: encryptedText('name').notNull(),
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
    name: encryptedText('name').notNull(),
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

// Short-lived, single-use links that log an existing user in on another device
// (shown as a QR code on the profile page, or created by an admin for account recovery)
export const deviceLinks = sqliteTable(
  'device_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tokenHash: text('token_hash').notNull().unique(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp' }),
    createdAt,
  },
  (t) => [index('device_links_user_idx').on(t.userId)],
)

// --- lists ---

export const lists = sqliteTable(
  'lists',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: LIST_TYPES }).notNull(),
    name: encryptedText('name').notNull(),
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
    text: encryptedText('text').notNull(),
    quantity: encryptedText('quantity'),
    reason: encryptedText('reason'),
    addedBy: integer('added_by').references(() => users.id, { onDelete: 'set null' }),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('items_list_done_position_idx').on(t.listId, t.done, t.position)],
)

// What a household tends to add, per list type; feeds autocomplete and the "frequent" chips.
// Kept apart from items, so deleting a list does not erase the history.
export const itemSuggestions = sqliteTable(
  'item_suggestions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    type: text('type', { enum: LIST_TYPES }).notNull(),
    // As last typed (for display), and a blind index of the normalized text (shared/text.ts) for the unique key
    text: encryptedText('text').notNull(),
    normalized: blindIndexText('normalized').notNull(),
    lastQuantity: encryptedText('last_quantity'),
    useCount: integer('use_count').notNull().default(1),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }).notNull(),
    createdAt,
  },
  (t) => [
    uniqueIndex('item_suggestions_household_type_text_idx').on(t.householdId, t.type, t.normalized),
    check('item_suggestions_type_check', sql`${t.type} in ('shopping', 'todo')`),
  ],
)

export type User = typeof users.$inferSelect
export type Household = typeof households.$inferSelect
export type List = typeof lists.$inferSelect
export type NewList = typeof lists.$inferInsert
export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert
