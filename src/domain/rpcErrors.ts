// Las funciones RPC (ver supabase/migrations/*_functions.sql) devuelven el
// código de error como mensaje de excepción tal cual (RAISE EXCEPTION
// 'CODE'), así que error.message ya llega siendo el código. Supabase Auth,
// en cambio, usa mensajes fijos en inglés. Este mapa cubre errores de
// cualquier RPC de la app, no solo los de autenticación (el nombre
// AuthFlowError se quedó del origen de este archivo en la Fase 3).
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
  // Reservas y pagos (Fases 10-13)
  NO_ACTIVE_SELLER_SESSION: 'Tu sesión de vendedor no está activa. Vuelve a ingresar.',
  INVALID_PRICE: 'El precio acordado debe ser mayor a 0.',
  INVALID_INITIAL_AMOUNT: 'El monto de la inicial no puede ser negativo.',
  CLIENT_NAME_REQUIRED: 'El nombre del cliente es obligatorio.',
  LOT_NOT_FOUND: 'Este lote ya no existe.',
  LOT_ALREADY_RESERVED: 'Este lote acaba de ser reservado por otro vendedor.',
  RESERVATION_NOT_FOUND: 'Esta reserva ya no existe.',
  RESERVATION_NOT_ACTIVE: 'Esta reserva ya no está activa.',
  INVALID_AMOUNT: 'El monto debe ser mayor a 0.',
  AMOUNT_EXCEEDS_BALANCE: 'Ese monto supera el saldo pendiente.',
  PAYMENT_NOT_FOUND: 'Ese pago ya no existe.',
  FORBIDDEN: 'No tienes permiso para hacer esto.',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 6 caracteres.',
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
