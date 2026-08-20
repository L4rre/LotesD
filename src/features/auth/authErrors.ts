// Las funciones RPC (ver supabase/migrations/20260820120600_functions.sql)
// devuelven el código de error como mensaje de excepción tal cual
// (RAISE EXCEPTION 'CODE'), así que error.message ya llega siendo el
// código. Supabase Auth, en cambio, usa mensajes fijos en inglés.
const MESSAGES: Record<string, string> = {
  NO_AUTH_SESSION: 'No se pudo iniciar la sesión. Intenta de nuevo.',
  SELLER_ACCESS_BLOCKED:
    'El acceso de vendedores está bloqueado por el administrador.',
  SELLER_NOT_FOUND: 'Ese número de vendedor no existe.',
  NAME_MISMATCH: 'El nombre no coincide con el vendedor seleccionado.',
  INVALID_PASSWORD: 'Contraseña incorrecta.',
  SELLER_IN_USE: 'Este vendedor ya tiene una sesión activa en otro dispositivo.',
  SESSION_NOT_FOUND: 'Tu sesión ya no está activa. Vuelve a ingresar.',
  NOT_ADMIN: 'Esta cuenta no tiene permisos de administrador.',
  'Invalid login credentials': 'Usuario o contraseña incorrectos.',
}

export class AuthFlowError extends Error {
  code: string

  constructor(code: string) {
    super(MESSAGES[code] ?? 'Ocurrió un error inesperado. Intenta de nuevo.')
    this.code = code
    this.name = 'AuthFlowError'
  }
}

export function translateAuthError(code: string): string {
  return MESSAGES[code] ?? 'Ocurrió un error inesperado. Intenta de nuevo.'
}
