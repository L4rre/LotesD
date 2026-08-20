import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { SellerSessionRow } from '../../../types/database.types'

export interface SellerAvailability {
  sellerNumber: number
  displayName: string
  busy: boolean
  activeSince: string | null
}

// Requiere una sesión autenticada (admin o vendedor anónimo) porque
// `sellers` y `seller_sessions` no son legibles por `anon` (a diferencia
// de seller_access_state). Pasa `enabled: false` mientras esa sesión
// todavía no existe para no disparar un fetch que va a fallar por RLS.
export function useSellerAvailability(enabled = true) {
  const [sellers, setSellers] = useState<{ seller_number: number; display_name: string }[]>([])
  const [activeSessions, setActiveSessions] = useState<Map<number, SellerSessionRow>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setError(null)
    const [{ data: sellerRows, error: sellersError }, { data: sessionRows, error: sessionsError }] =
      await Promise.all([
        supabase.from('sellers').select('seller_number, display_name').order('seller_number'),
        supabase
          .from('seller_sessions')
          .select('id, seller_number, auth_user_id, status, last_heartbeat, created_at')
          .eq('status', 'active'),
      ])

    if (sellersError || sessionsError) {
      setError('No se pudo cargar la disponibilidad de vendedores.')
      setLoading(false)
      return
    }

    setSellers(sellerRows ?? [])
    const map = new Map<number, SellerSessionRow>()
    for (const row of (sessionRows ?? []) as SellerSessionRow[]) {
      map.set(row.seller_number, row)
    }
    setActiveSessions(map)
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()

    // Exclusividad en vivo (docs §5, §19): un login/logout en otro
    // dispositivo actualiza 🟢/🔴 acá sin recargar.
    const channel = supabase
      .channel('seller-sessions-watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seller_sessions' },
        () => refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, refresh])

  const availability: SellerAvailability[] = sellers.map((s) => {
    const session = activeSessions.get(s.seller_number)
    return {
      sellerNumber: s.seller_number,
      displayName: s.display_name,
      busy: Boolean(session),
      activeSince: session?.created_at ?? null,
    }
  })

  return { availability, loading, error, refresh }
}
