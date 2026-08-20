import { Button } from '../../components/ui/Button'
import { useAuth } from '../auth/useAuth'

// Marcador de posición: el mapa/reservas llegan en fases posteriores.
export function SellerHomePage() {
  const { seller, signOutSeller } = useAuth()

  return (
    <main className="screen">
      <div className="screen__card">
        <h1 className="screen__title">Hola, {seller?.displayName}</h1>
        <p className="screen__subtitle">
          Vendedor {String(seller?.sellerNumber).padStart(2, '0')} — sesión activa.
          El mapa y las reservas llegan en fases posteriores.
        </p>
        <Button variant="secondary" onClick={() => signOutSeller()}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  )
}
