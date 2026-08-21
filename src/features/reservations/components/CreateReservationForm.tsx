import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Alert } from '../../../components/ui/Alert'
import { translateAuthError } from '../../../domain/rpcErrors'
import { clearFormDraft, useDraftState } from '../../../hooks/useFormDraft'

interface CreateReservationFormProps {
  lotId: string
  onSuccess: () => void
  onCancel: () => void
}

interface ReservationDraft {
  clientName: string
  clientPhone: string
  clientDni: string
  agreedPrice: string
  initialAmount: string
  notes: string
}

const EMPTY_DRAFT: ReservationDraft = {
  clientName: '',
  clientPhone: '',
  clientDni: '',
  agreedPrice: '',
  initialAmount: '',
  notes: '',
}

// Registra la reserva de un lote (spec §22): el vendedor completa cliente
// + precio acordado + inicial, y create_reservation (SECURITY DEFINER)
// resuelve el vendedor del lado del servidor a partir de su sesión
// activa -- este formulario nunca envía "quién soy" como parámetro.
export function CreateReservationForm({ lotId, onSuccess, onCancel }: CreateReservationFormProps) {
  const draftKey = `lotesd.draft.reservation.${lotId}`
  const [draft, setDraft] = useDraftState<ReservationDraft>(draftKey, EMPTY_DRAFT)
  const { clientName, clientPhone, clientDni, agreedPrice, initialAmount, notes } = draft

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateDraft(patch: Partial<ReservationDraft>) {
    setDraft({ ...draft, ...patch })
  }

  function handleCancel() {
    clearFormDraft(draftKey)
    onCancel()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const price = Number(agreedPrice)
    if (!clientName.trim()) {
      setError('El nombre del cliente es obligatorio.')
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('El precio acordado debe ser mayor a 0.')
      return
    }
    const initial = initialAmount.trim() === '' ? 0 : Number(initialAmount)
    if (!Number.isFinite(initial) || initial < 0) {
      setError('El monto de la inicial no puede ser negativo.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('create_reservation', {
        p_lot_id: lotId,
        p_client_name: clientName.trim(),
        p_client_phone: clientPhone.trim() || null,
        p_client_dni: clientDni.trim() || null,
        p_agreed_price: price,
        p_initial_amount: initial,
        p_notes: notes.trim() || null,
      })
      if (error) throw error
      clearFormDraft(draftKey)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : 'Error inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="panel__form" onSubmit={handleSubmit}>
      <h3 className="panel__title">Reservar lote</h3>
      {error && <Alert variant="error">{error}</Alert>}

      <TextField
        label="Cliente"
        value={clientName}
        onChange={(e) => updateDraft({ clientName: e.target.value })}
        required
      />
      <TextField
        label="Teléfono (opcional)"
        value={clientPhone}
        onChange={(e) => updateDraft({ clientPhone: e.target.value })}
      />
      <TextField
        label="DNI (opcional)"
        value={clientDni}
        onChange={(e) => updateDraft({ clientDni: e.target.value })}
      />
      <TextField
        label="Precio acordado (S/)"
        type="number"
        min="0"
        step="0.01"
        value={agreedPrice}
        onChange={(e) => updateDraft({ agreedPrice: e.target.value })}
        required
      />
      <TextField
        label="Inicial / adelanto (S/, opcional)"
        type="number"
        min="0"
        step="0.01"
        value={initialAmount}
        onChange={(e) => updateDraft({ initialAmount: e.target.value })}
      />
      <TextField
        label="Observaciones (opcional)"
        value={notes}
        onChange={(e) => updateDraft({ notes: e.target.value })}
      />

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Confirmar reserva'}
      </Button>
      <Button type="button" variant="secondary" onClick={handleCancel} disabled={submitting}>
        Cancelar
      </Button>
    </form>
  )
}
