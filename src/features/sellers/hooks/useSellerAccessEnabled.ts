import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// seller_access_state es legible incluso sin sesión (grant a anon +
// authenticated, ver supabase/migrations/20260821090000_seller_access_state.sql)
// y no contiene ningún secreto, así que puede transmitirse por Realtime
// sin riesgo (a diferencia de system_settings, que sí tiene el hash de la
// contraseña global). Este hook tampoco depende de que ya exista una
// sesión anónima de vendedor.
export function useSellerAccessEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('seller_access_state')
      .select('enabled')
      .maybeSingle()
    if (error) {
      // Antes esto dejaba `enabled` en null para siempre y la pantalla de
      // login quedaba cargando de forma infinita, porque el llamador solo
      // miraba `enabled === null` para saber si ya terminó de cargar, sin
      // enterarse de que hubo un error. `loading` distingue "todavía no
      // llega" de "llegó y falló".
      setError(true)
      setLoading(false)
      return
    }
    setError(false)
    setEnabled(data?.enabled ?? true)
    setLoading(false)
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()

    // Bloqueo/desbloqueo global en vivo (docs §5, §10): si el admin lo
    // cambia mientras esta pantalla está abierta, se refleja al instante.
    const channel = supabase
      .channel('seller-access-state-watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'seller_access_state' },
        () => refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { enabled, error, loading, refresh }
}
