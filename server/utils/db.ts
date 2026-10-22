import type { H3Event } from 'h3'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../db/schema'

// Files in server/utils are auto-imported by Nitro, so routes can call useDb(event) directly.
export function useDb(event: H3Event) {
  return drizzle(event.context.cloudflare.env.DB, { schema })
}
