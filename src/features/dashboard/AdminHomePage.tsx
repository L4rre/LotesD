import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../auth/useAuth'
import { DashboardView } from './DashboardView'
import { useDashboardStats } from './hooks/useDashboardStats'

// Dashboard general (spec §25, sin projectId): agrega los terrenos y
// resume la actividad de los vendedores. Fase 16.
export function AdminHomePage() {
  const { admin, signOutAdmin } = useAuth()
  const { stats, loading, error } = useDashboardStats()

  return (
    <DashboardView
      header={
        <header className="map-screen__header">
          <Link to="/">← Inicio</Link>
          <h1 className="map-screen__title">Hola, {admin?.displayName}</h1>
          <Button variant="secondary" onClick={() => signOutAdmin()}>
            Salir
          </Button>
        </header>
      }
      beforeStats={
        <div className="dashboard-quicklinks">
          <Link to="/terrenos">
            <Button variant="secondary" type="button">
              Terrenos
            </Button>
          </Link>
          <Link to="/admin/vendedores">
            <Button variant="secondary" type="button">
              Vendedores
            </Button>
          </Link>
        </div>
      }
      stats={stats}
      loading={loading}
      error={error}
    />
  )
}
