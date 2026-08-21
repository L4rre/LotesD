import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Alert } from '../../../components/ui/Alert'
import { formatCurrency } from '../../../domain/lotStatus'
import { translateAuthError } from '../../../domain/rpcErrors'

interface RegisterPaymentFormProps {
  reservationId: string
  balance: number
  onSuccess: () => void
  onCancel: () => void
}

// Pagos posteriores: solo el administrador (spec §29, §41). No hay botón
// "marcar como pagado" -- el estado pasa a PAGADO solo cuando la suma de
// pagos alcanza el precio acordado (calculado en lot_status_view).
export function RegisterPaymentForm({
  reservationId,
  balance,
  onSuccess,
  onCancel,
}: RegisterPaymentFormProps) {
  const [amount, setAmount] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('El monto debe ser mayor a 0.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('admin_register_payment', {
        p_reservation_id: reservationId,
        p_amount: value,
        p_effective_at: effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
      })
      if (error) throw error
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : 'Error inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="panel__form" onSubmit={handleSubmit}>
      <h3 className="panel__title">Registrar pago</h3>
      <p className="lot-sheet__row-label">Saldo pendiente: {formatCurrency(balance)}</p>
      {error && <Alert variant="error">{error}</Alert>}

      <TextField
        label="Monto (S/)"
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <TextField
        label="Fecha (opcional, hoy por defecto)"
        type="date"
        value={effectiveDate}
        onChange={(e) => setEffectiveDate(e.target.value)}
      />

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Registrar pago'}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
        Cancelar
      </Button>
    </form>
  )
}
