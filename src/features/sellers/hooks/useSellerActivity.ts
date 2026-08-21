import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export interface SellerRecentReservation {
  id: string
  lotCode: string
  projectName: string
  clientName: string
  agreedPrice: number
  createdAt: string
}

export interface SellerActivity {
  reservationsCount: number
  clientsCount: number
  initialPaymentsCount: number
  reservedValue: number
  recentReservations: SellerRecentReservation[]
}

const EMPTY: SellerActivity = {
  reservationsCount: 0,
  clientsCount: 0,
  initialPaymentsCount: 0,
  reservedValue: 0,
  recentReservations: [],
}

// "Mi actividad" (spec §49/§51): un vendedor solo ve sus propias reservas,
// nunca las de otro — a diferencia de useDashboardStats (solo para admin,
// spec §41), acá se filtra por seller_number desde el inicio en cada
// query, no en el cliente.
export function useSellerActivity(sellerNumber: number | undefined) {
  const [activity, setActivity] = useState<SellerActivity>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (sellerNumber == null) return
    setError(null)

    const [reservationsRes, initialPaymentsRes] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, agreed_price, created_at, client_id, lots(lot_code, projects(name)), clients(name)')
        .eq('seller_number', sellerNumber)
        .eq('reservation_status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('payments')
        .select('id, reservations!inner(seller_number)')
        .eq('payment_type', 'initial')
        .eq('reservations.seller_number', sellerNumber),
    ])

    if (reservationsRes.error || initialPaymentsRes.error) {
      setError('No se pudo cargar tu actividad.')
      setLoading(false)
      return
    }

    const rows = (reservationsRes.data ?? []) as unknown as {
      id: string
      agreed_price: number
      created_at: string
      client_id: string
      lots: { lot_code: string; projects: { name: string } | null } | null
      clients: { name: string } | null
    }[]

    const clientIds = new Set(rows.map((r) => r.client_id))
    const reservedValue = rows.reduce((sum, r) => sum + r.agreed_price, 0)

    setActivity({
      reservationsCount: rows.length,
      clientsCount: clientIds.size,
      initialPaymentsCount: (initialPaymentsRes.data ?? []).length,
      reservedValue,
      recentReservations: rows.slice(0, 8).map((r) => ({
        id: r.id,
        lotCode: r.lots?.lot_code ?? '—',
        projectName: r.lots?.projects?.name ?? '—',
        clientName: r.clients?.name ?? '—',
        agreedPrice: r.agreed_price,
        createdAt: r.created_at,
      })),
    })
    setLoading(false)
  }, [sellerNumber])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [refresh])

  return { activity, loading, error, refresh }
}
