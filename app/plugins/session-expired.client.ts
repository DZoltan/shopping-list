// When the server stops accepting this device's session (logged out from another device, passkey
// deleted, account deleted), every API call answers 401. Instead of showing a generic error for each,
// refresh the login state once and go to /login.
// Replacing the global $fetch covers both $fetch calls and useFetch / useAsyncData on the client.
export default defineNuxtPlugin(() => {
  const { loggedIn, fetch: fetchSession } = useUserSession()
  const route = useRoute()
  let handling = false

  globalThis.$fetch = $fetch.create({
    async onResponseError({ response }) {
      if (response.status !== 401 || !loggedIn.value || handling) return
      handling = true
      try {
        // The session endpoint also answers 401 now, so loggedIn turns false
        await fetchSession()
        if (loggedIn.value) return
        await clearLocalData()
        await navigateTo({ path: '/login', query: route.fullPath === '/' ? undefined : { redirect: route.fullPath } })
      } finally {
        handling = false
      }
    },
  }) as typeof globalThis.$fetch
})
