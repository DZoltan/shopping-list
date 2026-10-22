// Every /api route needs a logged-in user, except the ones used to get logged in.
// Pages are guarded on the client side by app/middleware/auth.global.ts.
const PUBLIC_API_PREFIXES = [
  '/api/_auth/', // nuxt-auth-utils session endpoints
  '/api/webauthn/', // passkey register / login; registration checks its own invite or setup token
  '/api/auth/setup-status',
  '/api/invites/lookup',
  '/api/health',
]

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]!
  if (!path.startsWith('/api/')) return
  if (PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix))) return
  await requireUserSession(event)
})
