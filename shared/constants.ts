// Plain constants shared by the DB schema, server validation and the client.
// Keep this file free of imports: drizzle-kit loads it outside of Nuxt.
export const LIST_TYPES = ['shopping', 'todo'] as const
export type ListType = (typeof LIST_TYPES)[number]

// owner: can invite people to the household; member: can use its lists
export const HOUSEHOLD_ROLES = ['owner', 'member'] as const
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number]

export const INVITE_TTL_DAYS = 7
// Anyone who sees the QR code can log in as you, so keep it short
export const DEVICE_LINK_TTL_MINUTES = 10
// Recovery links are sent to someone who lost their devices, so they need more time
export const RECOVERY_LINK_TTL_HOURS = 24
