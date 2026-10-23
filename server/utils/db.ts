import type { H3Event } from 'h3'
import { drizzle } from 'drizzle-orm/d1'
import { setDataKey } from '../db/encryption'
import * as schema from '../db/schema'

// Files in server/utils are auto-imported by Nitro, so routes can call useDb(event) directly.
export function useDb(event: H3Event) {
  // Encrypted columns (server/db/encryption.ts) need the key before the first query
  setDataKey(useRuntimeConfig(event).dataKey)
  return drizzle(event.context.cloudflare.env.DB, { schema })
}
