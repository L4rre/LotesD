import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { DemoMap } from '../../map/DemoMap'
import { useLotStatuses } from '../../map/hooks/useLotStatuses'
import type { Project } from '../../../types/database.types'

// El dashboard por terreno llega en la Fase 17; esta pantalla es el mapa
// (Fase 8-9).
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)

  const { lots, loading: loadingLots, error: lotsError } = useLotStatuses(projectId)

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

  if (loadingProject || loadingLots) return <FullScreenLoader />

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
        <span />
      </header>

      {lotsError && <Alert variant="error">{lotsError}</Alert>}

      {lots.length === 0 ? (
        <div className="screen__card">
          <Alert variant="info">Este terreno todavía no tiene lotes cargados.</Alert>
        </div>
      ) : (
        <DemoMap lots={lots} />
      )}
    </div>
  )
}
