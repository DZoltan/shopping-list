export function notFound(what: string) {
  return createError({ statusCode: 404, statusMessage: `${what} not found` })
}

// D1 reports constraint violations only in the error message; Drizzle wraps it in `cause`
export function isForeignKeyError(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (e.message.includes('FOREIGN KEY constraint failed')) return true
  }
  return false
}
