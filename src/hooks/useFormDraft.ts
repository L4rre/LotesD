import { useEffect, useState } from 'react'

function readDraft<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // localStorage inaccesible (modo privado, cuota) o JSON corrupto; usar
    // el valor inicial.
  }
  return initial
}

// Autoguardado de borrador en localStorage: estos formularios no
// persisten nada en el servidor hasta el submit final (nunca hay una
// reserva/pago a medias en la base de datos), así que es seguro guardar
// el borrador en el navegador para no perder lo ya escrito si se cierra
// la app o se apaga el celular a medio formulario.
//
// El estado se inicializa de forma perezosa leyendo localStorage
// directamente (no con un efecto de "restaurar" aparte): un efecto
// separado que primero lee y luego otro que escribe deja una ventana
// donde el efecto de guardado corre con el valor todavía-no-restaurado y
// pisa el borrador guardado -- se nota sobre todo en desarrollo, donde
// StrictMode invoca los efectos dos veces.
export function useDraftState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readDraft(key, initial))

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignorar
    }
  }, [key, value])

  return [value, setValue]
}

export function clearFormDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignorar
  }
}
