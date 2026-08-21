import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Project } from '../../../types/database.types'

export interface ProjectWithLotCount extends Project {
  lotCount: number
}

interface ProjectRow extends Project {
  lots: { count: number }[] | null
}

// `enabled` deja retrasar el fetch hasta que exista una sesión (§4: la
// pantalla que llama a este hook es pública, así que espera a que
// AuthProvider termine de darle una sesión anónima al visitante antes de
// consultar `projects`, igual que useSellerAvailability).
export function useProjects(enabled = true) {
  const [projects, setProjects] = useState<ProjectWithLotCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setError(null)
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description, created_at, lots(count)')
      .order('created_at')

    if (error) {
      setError('No se pudieron cargar los terrenos.')
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as ProjectRow[]
    setProjects(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        created_at: row.created_at,
        lotCount: row.lots?.[0]?.count ?? 0,
      })),
    )
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [refresh])

  return { projects, loading, error, refresh }
}
