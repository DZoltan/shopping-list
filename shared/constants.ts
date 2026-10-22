// Plain constants shared by the DB schema, server validation and the client.
// Keep this file free of imports: drizzle-kit loads it outside of Nuxt.
export const LIST_TYPES = ['shopping', 'todo'] as const
export type ListType = (typeof LIST_TYPES)[number]
