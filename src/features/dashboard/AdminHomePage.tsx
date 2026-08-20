import { Button } from '../../components/ui/Button'
import { useAuth } from '../auth/useAuth'

// Marcador de posición: el dashboard real llega en la Fase 16.
export function AdminHomePage() {
  const { admin, signOutAdmin } = useAuth()

  return (
    <main className="screen">
      <div className="screen__card">
        <h1 className="screen__title">Hola, {admin?.displayName}</h1>
        <p className="screen__subtitle">
          Sesión de administrador activa. El dashboard llega en la Fase 16.
        </p>
        <Button variant="secondary" onClick={() => signOutAdmin()}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  )
}
