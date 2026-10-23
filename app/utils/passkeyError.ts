// Turns passkey and API errors into a message the user can act on
export function passkeyErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'A passkey művelet megszakadt vagy lejárt. Próbáld újra.'
  }
  if (error instanceof Error && error.name === 'InvalidStateError') {
    return 'Ezen az eszközön már van passkey ehhez a fiókhoz.'
  }
  const { statusCode: status, statusMessage } = (error ?? {}) as { statusCode?: number, statusMessage?: string }
  if (statusMessage === 'User verification required') {
    return 'A passkey-hez ujjlenyomat, arcfelismerés vagy PIN kell. Állíts be képernyőzárat az eszközön, és próbáld újra.'
  }
  if (status === 401) return 'Ismeretlen passkey. Lehet, hogy a fiókot törölték.'
  if (status === 400 || status === 403) {
    return statusMessage ?? 'A kérés érvénytelen.'
  }
  return 'Valami hiba történt. Próbáld újra.'
}
