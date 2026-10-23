// Every /api route needs a logged-in user, except the ones used to get logged in.
// Pages are guarded on the client side by app/middleware/auth.global.ts.
const PUBLIC_API_PREFIXES = [
  '/api/_auth/', // nuxt-auth-utils session endpoints
  '/api/webauthn/', // passkey register / login; registration checks its own invite or setup token
  '/api/auth/setup-status',
  '/api/invites/lookup',
  '/api/device-links/lookup',
  '/api/device-links/redeem',
  '/api/health',
]

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]!
  if (!path.startsWith('/api/')) return
  // The client (also during SSR) asks this endpoint whether it is logged in: a revoked session
  // must answer 401 here too, so the page goes to /login instead of failing on every API call
  if (path === '/api/_auth/session' && event.method === 'GET') {
    if ((await getUserSession(event)).user) await requireUser(event)
    return
  }
  if (PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix))) return
  await requireUser(event)
})
