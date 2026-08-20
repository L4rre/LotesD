import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Project } from '../../../types/database.types'

export interface ProjectWithLotCount extends Project {
  lotCount: number
}

interface ProjectRow extends Project {
  lots: { count: number }[] | null
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithLotCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [refresh])

  return { projects, loading, error, refresh }
}
