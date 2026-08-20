// El administrador no usa un correo real (ver docs/ARCHITECTURE.md §4): el
// frontend traduce el "usuario" que escribe a un correo sintético fijo,
// que nunca se muestra en la interfaz.
const ADMIN_EMAIL_DOMAIN = 'lotesd.internal'

export function adminUsernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`
}

// Debe coincidir con el heartbeat técnico documentado en docs §5 (reap a
// los ~3 minutos): se envía con margen para que una sola pérdida de red no
// tire la sesión.
export const SELLER_HEARTBEAT_INTERVAL_MS = 45_000

// Expiración por inactividad (docs §10): 1 hora sin interacción, para
// admin y vendedor por igual.
export const IDLE_LOGOUT_LIMIT_MS = 60 * 60 * 1000
export const IDLE_CHECK_INTERVAL_MS = 60_000

export const SELLER_SESSION_STORAGE_KEY = 'lotesd.sellerSessionId'
