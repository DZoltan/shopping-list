// "Log out everywhere else": every other device has to log in again, this one stays logged in
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await endOtherSessions(event, user)
  setResponseStatus(event, 204)
  return null
})
