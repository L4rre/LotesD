import { Link } from 'react-router-dom'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { useAuth } from '../../auth/useAuth'
import { useProjects } from '../hooks/useProjects'

// Terrenos y lotes se cargan por diseño de plano, fuera de la app: esta
// pantalla es solo un listado (sin "crear terreno") para cambiar entre
// varios terrenos cuando exista más de uno.
export function ProjectsListPage() {
  const { status } = useAuth()
  // Pantalla pública (§4): espera a que AuthProvider termine de darle una
  // sesión anónima al visitante antes de consultar `projects`.
  const { projects, loading, error } = useProjects(status !== 'loading')

  const backTo = status === 'admin' ? '/admin' : status === 'seller' ? '/vendedor' : '/'

  if (status === 'loading' || loading) return <FullScreenLoader />

  return (
    <main className="screen">
      <div className="screen__card" style={{ maxWidth: '32rem' }}>
        <Link to={backTo}>← Volver</Link>
        <h1 className="screen__title">Terrenos</h1>

        {error && <Alert variant="error">{error}</Alert>}

        {projects.length === 0 && !error && (
          <Alert variant="info">Todavía no hay terrenos creados.</Alert>
        )}

        <ul className="seller-list">
          {projects.map((p) => (
            <li key={p.id} className="seller-list__item">
              <Link to={`/terrenos/${p.id}`} className="project-link">
                <span>{p.name}</span>
                <span>{p.lotCount} lotes</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
