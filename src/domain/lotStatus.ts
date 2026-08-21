import type { LotCommercialStatus } from '../types/database.types'

// Única fuente de verdad para color/emoji/etiqueta por estado (spec §10):
// el mapa, el dashboard y cualquier otra pantalla futura leen de acá en
// vez de repetir la regla cada uno.
export const LOT_STATUS_META: Record<
  LotCommercialStatus,
  { emoji: string; label: string; fill: string; stroke: string }
> = {
  available: {
    emoji: '🟢',
    label: 'Disponible',
    fill: '#cdebd6',
    stroke: '#1f7a4d',
  },
  reserved: {
    emoji: '🟡',
    label: 'Reservado',
    fill: '#ffe6a8',
    stroke: '#a06b00',
  },
  paid: {
    emoji: '🔴',
    label: 'Pagado',
    fill: '#f6c9c5',
    stroke: '#b3261e',
  },
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—'
  return `S/ ${amount.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
