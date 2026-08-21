import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { FullScreenLoader } from '../../components/ui/FullScreenLoader'
import { formatCurrency, formatDate } from '../../domain/lotStatus'
import { useAuth } from '../auth/useAuth'
import { useSellerActivity } from './hooks/useSellerActivity'

// "Mi actividad" (spec §49/§51): un vendedor solo ve sus propias reservas
// y clientes, nunca los de otro vendedor (a diferencia del dashboard de
// admin, spec §41, que agrega a todos).
export function SellerHomePage() {
  const { seller, signOutSeller } = useAuth()
  const { activity, loading, error } = useSellerActivity(seller?.sellerNumber)

  return (
    <div className="dashboard-screen">
      <header className="map-screen__header">
        <span />
        <h1 className="map-screen__title">Hola, {seller?.displayName}</h1>
        <Button variant="secondary" onClick={() => signOutSeller()}>
          Salir
        </Button>
      </header>

      <div className="dashboard-content">
        <p className="screen__subtitle" style={{ margin: 0 }}>
          Vendedor {String(seller?.sellerNumber).padStart(2, '0')}
        </p>

        <Link to="/terrenos">
          <Button variant="secondary" type="button">
            Terrenos
          </Button>
        </Link>

        {loading ? (
          <FullScreenLoader label="Cargando tu actividad…" />
        ) : (
          <>
            {error && <Alert variant="error">{error}</Alert>}

            <div className="stat-grid">
              <div className="stat-tile">
                <span className="stat-tile__value">{activity.reservationsCount}</span>
                <span className="stat-tile__label">Mis reservas</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile__value">{activity.clientsCount}</span>
                <span className="stat-tile__label">Mis clientes</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile__value">{activity.initialPaymentsCount}</span>
                <span className="stat-tile__label">Iniciales registradas</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile__value">{formatCurrency(activity.reservedValue)}</span>
                <span className="stat-tile__label">Valor reservado</span>
              </div>
            </div>

            <section className="panel">
              <h2 className="panel__title">Mis reservas recientes</h2>
              {activity.recentReservations.length === 0 ? (
                <Alert variant="info">Todavía no tienes reservas registradas.</Alert>
              ) : (
                <ul className="recent-list">
                  {activity.recentReservations.map((r) => (
                    <li key={r.id} className="recent-list__item">
                      <span>
                        <strong>{r.lotCode}</strong> ({r.projectName}) — {r.clientName}
                      </span>
                      <span>
                        {formatCurrency(r.agreedPrice)} · {formatDate(r.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
