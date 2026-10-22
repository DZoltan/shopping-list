// Client-side page guard; the API enforces access on its own (server/middleware/auth.ts)
const isPublic = (path: string) =>
  path === '/login' || path === '/setup' || path.startsWith('/invite/') || path.startsWith('/device/')

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value && !isPublic(to.path)) {
    return navigateTo({ path: '/login', query: to.fullPath === '/' ? undefined : { redirect: to.fullPath } })
  }
  if (loggedIn.value && to.path === '/login') {
    return navigateTo('/')
  }
})
