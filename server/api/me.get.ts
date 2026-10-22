export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const households = await getMyHouseholds(useDb(event), user.id)
  return { ...user, households }
})
