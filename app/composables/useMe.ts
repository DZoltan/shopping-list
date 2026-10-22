// The logged-in user with their households. Shared by key, so every caller gets the same data.
export function useMe() {
  const { loggedIn } = useUserSession()
  return useFetch('/api/me', {
    key: 'me',
    immediate: loggedIn.value,
    watch: [loggedIn],
    default: () => null,
  })
}
