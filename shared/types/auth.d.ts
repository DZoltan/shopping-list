// Shape of the user stored in the sealed session cookie (nuxt-auth-utils)
declare module '#auth-utils' {
  interface User {
    id: number
    name: string
    isAdmin: boolean
  }
}

export {}
