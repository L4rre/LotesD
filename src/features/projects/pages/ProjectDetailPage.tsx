import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { DemoMap } from '../../map/DemoMap'
import { useLotStatuses } from '../../map/hooks/useLotStatuses'
import { useAuth } from '../../auth/useAuth'
import type { Project } from '../../../types/database.types'

// Pública (§4): espera a que AuthProvider termine de darle una sesión
// anónima al visitante (bootstrap de AuthContext) antes de consultar
// `projects`/`lot_status_view`, para que un enlace directo a este terreno
// no dispare la query antes de que exista sesión.
export function ProjectDetailPage() {
  const { admin, status } = useAuth()
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)

  const { lots, loading: loadingLots, error: lotsError, refresh: refreshLots } = useLotStatuses(
    status !== 'loading' ? projectId : undefined,
  )

  useEffect(() => {
    if (status === 'loading') return
    let cancelled = false
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
  }, [status, projectId])

  if (status === 'loading' || loadingProject || loadingLots) return <FullScreenLoader />

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
    <div className="map-screen">
      <header className="map-screen__header">
        <Link to="/terrenos">← Terrenos</Link>
        <h1 className="map-screen__title">{project.name}</h1>
        {admin ? <Link to={`/terrenos/${projectId}/dashboard`}>Estadísticas</Link> : <span />}
      </header>

      {lotsError && <Alert variant="error">{lotsError}</Alert>}

      {lots.length === 0 ? (
        <div className="screen__card">
          <Alert variant="info">Este terreno todavía no tiene lotes cargados.</Alert>
        </div>
      ) : (
        <DemoMap lots={lots} onRefresh={refreshLots} />
      )}
    </div>
  )
}
