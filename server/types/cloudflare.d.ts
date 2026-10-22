import type { D1Database, ExecutionContext } from '@cloudflare/workers-types'

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
  }
}
