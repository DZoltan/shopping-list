// Plain constants shared by the DB schema, server validation and the client.
// Keep this file free of imports: drizzle-kit loads it outside of Nuxt.
export const LIST_TYPES = ['shopping', 'todo'] as const
export type ListType = (typeof LIST_TYPES)[number]

// owner: can invite people to the household; member: can use its lists
export const HOUSEHOLD_ROLES = ['owner', 'member'] as const
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number]

export const INVITE_TTL_DAYS = 7
