import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { LotStatusRow } from '../../../types/database.types'

// Snapshot de lot_status_view para un terreno. Sin Realtime todavía (eso
// es la Fase 15, junto con el resto de las pantallas que lo necesitan) —
// por ahora el mapa se actualiza al recargar o al llamar `refresh()`.
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

  return { lots, loading, error, refresh }
}
