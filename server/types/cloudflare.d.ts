import type { D1Database, ExecutionContext } from '@cloudflare/workers-types'
import type { User } from '#auth-utils'

// Bindings declared in wrangler.jsonc
export interface Env {
  DB: D1Database
}

declare module 'h3' {
  interface H3EventContext {
    cloudflare: {
      env: Env
      context: ExecutionContext
    }
    // Set by requireUser (server/utils/auth.ts) after checking the session against the database
    user?: User
  }
}
