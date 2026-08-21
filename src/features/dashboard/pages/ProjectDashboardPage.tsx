import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { DashboardView } from '../DashboardView'
import { useDashboardStats } from '../hooks/useDashboardStats'
import type { Project } from '../../../types/database.types'

// Dashboard por terreno (spec §25, con projectId): mismo useDashboardStats
// y DashboardView que el dashboard general, solo que filtrado a un solo
// terreno. Fase 17.
export function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)

  const { stats, loading: loadingStats, error: statsError } = useDashboardStats(projectId)

  useEffect(() => {
    let cancelled = false
    // oxlint-disable-next-line react/set-state-in-effect
    setLoadingProject(true)
    setProjectError(null)
    supabase
      .from('projects')
      .select('id, name, description, created_at')
      .eq('id', projectId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setProjectError('No se pudo cargar este terreno.')
        } else {
          setProject(data)
        }
        setLoadingProject(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loadingProject) return <FullScreenLoader />

  if (projectError || !project) {
    return (
      <main className="screen">
        <div className="screen__card">
          <Link to="/terrenos">← Terrenos</Link>
          <Alert variant="error">{projectError ?? 'Terreno no encontrado.'}</Alert>
        </div>
      </main>
    )
  }

  return (
    <DashboardView
      header={
        <header className="map-screen__header">
          <Link to={`/terrenos/${projectId}`}>← {project.name}</Link>
          <h1 className="map-screen__title">Estadísticas</h1>
          <span />
        </header>
      }
      stats={stats}
      loading={loadingStats}
      error={statsError}
    />
  )
}
