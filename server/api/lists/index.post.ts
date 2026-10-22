import { createListSchema } from '#shared/schemas'
import { lists } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { householdId, ...body } = await readValidatedBody(event, createListSchema.parse)
  const db = useDb(event)

  const myHouseholds = await getMyHouseholds(db, user.id)
  const target = householdId
    ? myHouseholds.find((h) => h.id === householdId)
    : myHouseholds.length === 1 ? myHouseholds[0] : undefined
  if (!target) {
    throw createError({
      statusCode: householdId ? 403 : 400,
      statusMessage: householdId ? 'Not a member of this household' : 'householdId is required',
    })
  }

  const list = await db.insert(lists).values({ ...body, householdId: target.id }).returning().get()
  setResponseStatus(event, 201)
  return list
})
