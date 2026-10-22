import type { User } from '#auth-utils'

type Db = ReturnType<typeof useDb>

// Admins can invite anyone anywhere (including into a new household);
// household owners can invite people into their own household.
export async function canInviteTo(db: Db, user: User, householdId: number | null) {
  if (user.isAdmin) return true
  if (householdId === null) return false
  const membership = await getMembership(db, user.id, householdId)
  return membership?.role === 'owner'
}
