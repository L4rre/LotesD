import type { ReactNode } from 'react'
import { Alert } from '../../components/ui/Alert'
import { FullScreenLoader } from '../../components/ui/FullScreenLoader'
import { formatCurrency, formatDate } from '../../domain/lotStatus'
import type { DashboardStats } from './hooks/useDashboardStats'

interface DashboardViewProps {
  header: ReactNode
  beforeStats?: ReactNode
  stats: DashboardStats
  loading: boolean
  error: string | null
}

// Presentacional puro: el dashboard general (sin projectId) y el de un
// terreno (con projectId) llaman a useDashboardStats con distinto filtro y
// pasan el resultado acá (spec §25) — misma pantalla, distintos datos. El
// encabezado se recibe como children porque difiere entre ambos (el
// general tiene botón de salir, el de terreno tiene enlace de "atrás").
export function DashboardView({ header, beforeStats, stats, loading, error }: DashboardViewProps) {
  if (loading) return <FullScreenLoader />

  return (
    <div className="dashboard-screen">
      {header}

      <div className="dashboard-content">
        {beforeStats}
        {error && <Alert variant="error">{error}</Alert>}

        <div className="stat-grid">
          {stats.projectsCount !== null && (
            <StatTile label="Terrenos" value={String(stats.projectsCount)} />
          )}
          <StatTile label="Lotes" value={String(stats.lotsCount)} />
          <StatTile label="🟢 Disponibles" value={String(stats.availableCount)} />
          <StatTile label="🟡 Reservados" value={String(stats.reservedCount)} />
          <StatTile label="🔴 Pagados" value={String(stats.paidCount)} />
          <StatTile label="Valor reservado" value={formatCurrency(stats.totalReservedValue)} />
          <StatTile label="Dinero cobrado" value={formatCurrency(stats.totalCollected)} />
          <StatTile label="Saldo por cobrar" value={formatCurrency(stats.totalBalance)} />
        </div>

        <section className="panel">
          <h2 className="panel__title">Estadísticas por vendedor</h2>
          {stats.perSeller.length === 0 ? (
            <Alert variant="info">Todavía no hay reservas registradas.</Alert>
          ) : (
            <div className="seller-stats-table-wrap">
              <table className="seller-stats-table">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th>Reservas</th>
                    <th>Iniciales</th>
                    <th>Clientes</th>
                    <th>Valor reservado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perSeller.map((seller) => (
                    <tr key={seller.sellerNumber}>
                      <td>{seller.sellerName}</td>
                      <td>{seller.reservationsCount}</td>
                      <td>{seller.initialPaymentsCount}</td>
                      <td>{seller.clientsCount}</td>
                      <td>{formatCurrency(seller.reservedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">Reservas recientes</h2>
          {stats.recentReservations.length === 0 ? (
            <Alert variant="info">Todavía no hay reservas registradas.</Alert>
          ) : (
            <ul className="recent-list">
              {stats.recentReservations.map((r) => (
                <li key={r.id} className="recent-list__item">
                  <span>
                    <strong>{r.lotCode}</strong> — {r.clientName} ({r.sellerName})
                  </span>
                  <span>
                    {formatCurrency(r.agreedPrice)} · {formatDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">Pagos recientes</h2>
          {stats.recentPayments.length === 0 ? (
            <Alert variant="info">Todavía no hay pagos registrados.</Alert>
          ) : (
            <ul className="recent-list">
              {stats.recentPayments.map((p) => (
                <li key={p.id} className="recent-list__item">
                  <span>
                    <strong>{p.lotCode}</strong> — {p.clientName}{' '}
                    {p.paymentType === 'initial' ? '(inicial)' : ''}
                  </span>
                  <span>
                    {formatCurrency(p.amount)} · {formatDate(p.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  )
}
