import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Alert } from '../../../components/ui/Alert'
import type { LotStatusRow } from '../../../types/database.types'

interface EditLotDimensionsFormProps {
  lot: LotStatusRow
  onSuccess: () => void
  onCancel: () => void
}

// Solo el admin edita la dimensión de un lote (spec: los terrenos/lotes se
// cargan por diseño de plano, no se crean desde la app, pero sí se pueden
// corregir sus medidas). Update directo a `lots`: la política RLS
// `lots_admin_write` ya exige is_admin(), no hace falta una RPC aparte
// (no es una operación crítica de concurrencia, docs §0.4).
export function EditLotDimensionsForm({ lot, onSuccess, onCancel }: EditLotDimensionsFormProps) {
  const [area, setArea] = useState(lot.area?.toString() ?? '')
  const [perimeter, setPerimeter] = useState(lot.perimeter?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function toNullableNumber(value: string): number | null {
    if (value.trim() === '') return null
    return Number(value)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const values = {
      area: toNullableNumber(area),
      perimeter: toNullableNumber(perimeter),
    }
    for (const value of Object.values(values)) {
      if (value !== null && (!Number.isFinite(value) || value <= 0)) {
        setError('Las medidas deben ser mayores a 0.')
        return
      }
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('lots').update(values).eq('id', lot.lot_id)
      if (error) throw error
      onSuccess()
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel__form" onSubmit={handleSubmit}>
      <h3 className="panel__title">Editar dimensión — Lote {lot.lot_code}</h3>
      {error && <Alert variant="error">{error}</Alert>}

      <TextField
        label="Área (m²)"
        type="number"
        min="0"
        step="0.01"
        value={area}
        onChange={(e) => setArea(e.target.value)}
      />
      <TextField
        label="Perímetro (m)"
        type="number"
        min="0"
        step="0.01"
        value={perimeter}
        onChange={(e) => setPerimeter(e.target.value)}
      />

      <Button type="submit" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar dimensión'}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
    </form>
  )
}
