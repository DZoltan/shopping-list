// Turns passkey and API errors into a message the user can act on
export function passkeyErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'A passkey művelet megszakadt vagy lejárt. Próbáld újra.'
  }
  if (error instanceof Error && error.name === 'InvalidStateError') {
    return 'Ezen az eszközön már van passkey ehhez a fiókhoz.'
  }
  const status = (error as { statusCode?: number })?.statusCode
  if (status === 401) return 'Ismeretlen passkey. Lehet, hogy a fiókot törölték.'
  if (status === 400 || status === 403) {
    return (error as { statusMessage?: string }).statusMessage ?? 'A kérés érvénytelen.'
  }
  return 'Valami hiba történt. Próbáld újra.'
}
