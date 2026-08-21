import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FullScreenLoader } from '../../components/ui/FullScreenLoader'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { TerrainMap } from '../map/TerrainMap'
import { BUENA_FORTUNA_LAYOUT } from '../map/terrainData/buenaFortuna'
import { useLotStatuses } from '../map/hooks/useLotStatuses'
import { useAuth } from '../auth/useAuth'
import { AdminLoginForm } from '../auth/components/AdminLoginForm'
import { SellerLoginForm } from '../auth/components/SellerLoginForm'
import type { Project } from '../../types/database.types'

type LoginModal = 'none' | 'admin' | 'seller'

// Home pública (spec: cualquier curioso debe poder ver disponibilidad y
// dimensiones sin iniciar sesión): en vez de una pantalla intermedia de
// "elige tu rol", "/" es directamente el mapa del terreno. Para que RLS
// (abierta solo a `authenticated`) deje leerlo, AuthProvider ya le da a
// cualquier visitante sin sesión una sesión anónima transparente antes de
// que `status` salga de 'loading' (docs §4), así que esta pantalla no
// necesita pedirla ella misma. Iniciar sesión es un Bottom Sheet sobre
// este mismo mapa, no una navegación a otra pantalla; una vez logeado, el
// encabezado cambia según el rol.
export function HomePage() {
  const { status, admin, seller, signOutAdmin, signOutSeller } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [loginModal, setLoginModal] = useState<LoginModal>('none')

  const { lots, loading: loadingLots, error: lotsError, refresh: refreshLots } = useLotStatuses(project?.id)

  useEffect(() => {
    if (status === 'loading') return
    let cancelled = false
    supabase
      .from('projects')
      .select('id, name, description, created_at')
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setProjectError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
        } else {
          setProject(data)
        }
        setLoadingProject(false)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  if (status === 'loading' || loadingProject) return <FullScreenLoader />

  return (
    <div className="map-screen">
      <header className="map-screen__header">
        <span />
        <h1 className="map-screen__title">LotesD</h1>
        {status === 'admin' && admin ? (
          <div className="dashboard-quicklinks">
            <Link to="/admin">Dashboard</Link>
            <Button variant="secondary" onClick={() => signOutAdmin()}>
              Cerrar sesión
            </Button>
          </div>
        ) : status === 'seller' && seller ? (
          <div className="dashboard-quicklinks">
            <Link to="/vendedor">Mi actividad</Link>
            <Button variant="secondary" onClick={() => signOutSeller()}>
              Cerrar sesión
            </Button>
          </div>
        ) : (
          <div className="dashboard-quicklinks">
            <Button variant="secondary" onClick={() => setLoginModal('admin')}>
              Administrador
            </Button>
            <Button variant="secondary" onClick={() => setLoginModal('seller')}>
              Vendedor
            </Button>
          </div>
        )}
      </header>

      {projectError && <Alert variant="error">{projectError}</Alert>}
      {lotsError && <Alert variant="error">{lotsError}</Alert>}

      {!project && !projectError && (
        <div className="screen__card">
          <Alert variant="info">Todavía no hay terrenos cargados.</Alert>
        </div>
      )}

      {project &&
        (loadingLots ? (
          <FullScreenLoader />
        ) : (
          // Único terreno por ahora -> layout fijo; con más de uno, esto
          // sería un lookup por project.id (docs §16).
          <TerrainMap layout={BUENA_FORTUNA_LAYOUT} lots={lots} onRefresh={refreshLots} />
        ))}

      <BottomSheet open={loginModal !== 'none'} onClose={() => setLoginModal('none')}>
        {loginModal === 'admin' && <AdminLoginForm onSuccess={() => setLoginModal('none')} />}
        {loginModal === 'seller' && <SellerLoginForm onSuccess={() => setLoginModal('none')} />}
      </BottomSheet>
    </div>
  )
}
