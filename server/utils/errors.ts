export function notFound(what: string) {
  return createError({ statusCode: 404, statusMessage: `${what} not found` })
}
