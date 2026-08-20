import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import type { Project } from '../../../types/database.types'

// Placeholder: el mapa conceptual llega en la Fase 8, el dashboard por
// terreno en la Fase 17. Por ahora esta pantalla solo confirma que la app
// puede navegar a un terreno específico por id.
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setError(null)
    supabase
      .from('projects')
      .select('id, name, description, created_at')
      .eq('id', projectId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setError('No se pudo cargar este terreno.')
        } else {
          setProject(data)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading) return <FullScreenLoader />

  return (
    <main className="screen">
      <div className="screen__card">
        <Link to="/terrenos">← Terrenos</Link>
        {error && <Alert variant="error">{error}</Alert>}
        {project && (
          <>
            <h1 className="screen__title">{project.name}</h1>
            {project.description && (
              <p className="screen__subtitle">{project.description}</p>
            )}
            <Alert variant="info">
              El mapa de este terreno llega en la Fase 8, y su dashboard en la
              Fase 17.
            </Alert>
          </>
        )}
      </div>
    </main>
  )
}
