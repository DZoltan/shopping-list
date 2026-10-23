// Shape of the user stored in the sealed session cookie (nuxt-auth-utils)
declare module '#auth-utils' {
  interface User {
    id: number
    name: string
    isAdmin: boolean
  }

  // Server-only part of the session, never sent to the client
  interface SecureSessionData {
    // users.session_version at login, see server/utils/auth.ts
    sessionVersion?: number
  }
}

export {}
