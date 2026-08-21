import { useState } from 'react'
import { LOT_STATUS_META, formatCurrency, formatDate } from '../../../domain/lotStatus'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import { useAuth } from '../../auth/useAuth'
import { CreateReservationForm } from '../../reservations/components/CreateReservationForm'
import { RegisterPaymentForm } from '../../payments/components/RegisterPaymentForm'
import type { LotStatusRow } from '../../../types/database.types'

interface LotDetailSheetProps {
  lot: LotStatusRow
  onActionSuccess: () => void
}

type Mode = 'view' | 'reserve' | 'payment'

export function LotDetailSheet({ lot, onActionSuccess }: LotDetailSheetProps) {
  const { status: authStatus } = useAuth()
  const [mode, setMode] = useState<Mode>('view')
  const [justDone, setJustDone] = useState<string | null>(null)

  function handleActionSuccess(message: string) {
    setMode('view')
    setJustDone(message)
    onActionSuccess()
  }

  if (mode === 'reserve') {
    return (
      <CreateReservationForm
        lotId={lot.lot_id}
        onSuccess={() => handleActionSuccess('Reserva registrada.')}
        onCancel={() => setMode('view')}
      />
    )
  }

  if (mode === 'payment' && lot.active_reservation_id) {
    return (
      <RegisterPaymentForm
        reservationId={lot.active_reservation_id}
        balance={lot.balance ?? 0}
        onSuccess={() => handleActionSuccess('Pago registrado.')}
        onCancel={() => setMode('view')}
      />
    )
  }

  const meta = LOT_STATUS_META[lot.status]

  return (
    <>
      <h2 className="lot-sheet__title">Lote {lot.lot_code}</h2>
      <p className="lot-sheet__status">
        {meta.emoji} {meta.label.toUpperCase()}
      </p>

      {justDone && <Alert variant="success">{justDone}</Alert>}

      <div className="lot-sheet__rows">
        <div className="lot-sheet__row">
          <span className="lot-sheet__row-label">Área</span>
          <span>{lot.area ? `${lot.area} m²` : '—'}</span>
        </div>

        {lot.status === 'available' ? (
          <div className="lot-sheet__row">
            <span className="lot-sheet__row-label">Precio de referencia</span>
            <span>{formatCurrency(lot.reference_price)}</span>
          </div>
        ) : (
          <>
            <div className="lot-sheet__row">
              <span className="lot-sheet__row-label">Precio acordado</span>
              <span>{formatCurrency(lot.agreed_price)}</span>
            </div>
            <div className="lot-sheet__row">
              <span className="lot-sheet__row-label">Cliente</span>
              <span>{lot.client_name ?? '—'}</span>
            </div>
            <div className="lot-sheet__row">
              <span className="lot-sheet__row-label">Vendedor</span>
              <span>{lot.seller_name ?? '—'}</span>
            </div>
            <div className="lot-sheet__row">
              <span className="lot-sheet__row-label">Pagado</span>
              <span>{formatCurrency(lot.total_paid)}</span>
            </div>
            <div className="lot-sheet__row">
              <span className="lot-sheet__row-label">Saldo</span>
              <span>{formatCurrency(lot.balance)}</span>
            </div>
            <div className="lot-sheet__row">
              <span className="lot-sheet__row-label">Progreso</span>
              <span>{lot.paid_percentage ?? 0}%</span>
            </div>
            <div className="lot-sheet__row">
              <span className="lot-sheet__row-label">Fecha de reserva</span>
              <span>{formatDate(lot.reserved_at)}</span>
            </div>
          </>
        )}
      </div>

      {lot.status === 'available' && authStatus === 'seller' && (
        <Button onClick={() => setMode('reserve')}>Reservar este lote</Button>
      )}

      {lot.status === 'reserved' && authStatus === 'admin' && (
        <Button onClick={() => setMode('payment')}>Registrar pago</Button>
      )}
    </>
  )
}
