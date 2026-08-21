import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { LotStatusRow } from '../../../types/database.types'

// Snapshot de lot_status_view para un terreno, con Realtime sobre
// reservations/payments (Fase 15): cuando alguien reserva o paga en
// cualquier dispositivo conectado, el mapa recalcula el estado del
// terreno completo. A 48-200 lotes por terreno, un refetch simple de
// lot_status_view es más simple y suficientemente barato que intentar
// actualizar una sola fila a mano.
export function useLotStatuses(projectId: string | undefined) {
  const [lots, setLots] = useState<LotStatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) return
    setError(null)
    const { data, error } = await supabase
      .from('lot_status_view')
      .select('*')
      .eq('project_id', projectId)
      .order('block')
      .order('lot_number')

    if (error) {
      setError('No se pudo cargar el estado de los lotes.')
      setLoading(false)
      return
    }
    setLots((data ?? []) as LotStatusRow[])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!projectId) return

    const channel = supabase
      .channel(`lot-status-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `project_id=eq.${projectId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `project_id=eq.${projectId}` },
        () => refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, refresh])

  return { lots, loading, error, refresh }
}
