// Refetch when the user comes back to the tab or the installed app.
// This is how other people's changes show up: no sockets, see CLAUDE.md.
export function useRefreshOnFocus(refresh: () => Promise<unknown>, minIntervalMs = 2000) {
  let last = 0

  function onReturn() {
    if (document.visibilityState !== 'visible') return
    // `focus` and `visibilitychange` often fire together; refetch only once
    const now = Date.now()
    if (now - last < minIntervalMs) return
    last = now
    refresh()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onReturn)
    window.removeEventListener('focus', onReturn)
  })
}
