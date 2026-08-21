import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { LotStatusRow } from '../../../types/database.types'

export interface SellerStats {
  sellerNumber: number
  sellerName: string
  reservationsCount: number
  reservedValue: number
  clientsCount: number
  initialPaymentsCount: number
}

export interface RecentReservation {
  id: string
  lotCode: string
  clientName: string
  sellerName: string
  agreedPrice: number
  createdAt: string
}

export interface RecentPayment {
  id: string
  lotCode: string
  clientName: string
  amount: number
  paymentType: 'initial' | 'payment'
  createdAt: string
}

export interface DashboardStats {
  projectsCount: number | null
  lotsCount: number
  availableCount: number
  reservedCount: number
  paidCount: number
  totalReservedValue: number
  totalCollected: number
  totalBalance: number
  perSeller: SellerStats[]
  recentReservations: RecentReservation[]
  recentPayments: RecentPayment[]
}

const EMPTY_STATS: DashboardStats = {
  projectsCount: null,
  lotsCount: 0,
  availableCount: 0,
  reservedCount: 0,
  paidCount: 0,
  totalReservedValue: 0,
  totalCollected: 0,
  totalBalance: 0,
  perSeller: [],
  recentReservations: [],
  recentPayments: [],
}

// Dashboard general (sin projectId) y por terreno (con projectId) comparten
// este hook (spec §25): la única diferencia es filtrar `lot_status_view` y
// `payments` por `project_id`, y solo contar terrenos en el caso general.
export function useDashboardStats(projectId?: string) {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)

    let lotsQuery = supabase.from('lot_status_view').select('*')
    if (projectId) lotsQuery = lotsQuery.eq('project_id', projectId)

    let initialPaymentsQuery = supabase
      .from('payments')
      .select('reservations(seller_number)')
      .eq('payment_type', 'initial')
    if (projectId) initialPaymentsQuery = initialPaymentsQuery.eq('project_id', projectId)

    let recentReservationsQuery = supabase
      .from('reservations')
      .select('id, agreed_price, created_at, lots(lot_code), clients(name), sellers(display_name)')
      .eq('reservation_status', 'active')
      .order('created_at', { ascending: false })
      .limit(8)
    if (projectId) recentReservationsQuery = recentReservationsQuery.eq('project_id', projectId)

    let recentPaymentsQuery = supabase
      .from('payments')
      .select('id, amount, payment_type, created_at, reservations(lots(lot_code), clients(name))')
      .order('created_at', { ascending: false })
      .limit(8)
    if (projectId) recentPaymentsQuery = recentPaymentsQuery.eq('project_id', projectId)

    const [lotsRes, initialPaymentsRes, recentReservationsRes, recentPaymentsRes, projectsRes] =
      await Promise.all([
        lotsQuery,
        initialPaymentsQuery,
        recentReservationsQuery,
        recentPaymentsQuery,
        projectId ? Promise.resolve(null) : supabase.from('projects').select('id', { count: 'exact', head: true }),
      ])

    if (
      lotsRes.error ||
      initialPaymentsRes.error ||
      recentReservationsRes.error ||
      recentPaymentsRes.error ||
      projectsRes?.error
    ) {
      setError('No se pudieron cargar las estadísticas.')
      setLoading(false)
      return
    }

    const lots = (lotsRes.data ?? []) as LotStatusRow[]

    const initialPaymentsBySeller = new Map<number, number>()
    for (const row of (initialPaymentsRes.data ?? []) as unknown as { reservations: { seller_number: number } | null }[]) {
      const sellerNumber = row.reservations?.seller_number
      if (sellerNumber == null) continue
      initialPaymentsBySeller.set(sellerNumber, (initialPaymentsBySeller.get(sellerNumber) ?? 0) + 1)
    }

    const perSellerMap = new Map<number, SellerStats>()
    let totalReservedValue = 0
    let totalCollected = 0
    let totalBalance = 0
    let availableCount = 0
    let reservedCount = 0
    let paidCount = 0

    for (const lot of lots) {
      if (lot.status === 'available') {
        availableCount += 1
        continue
      }
      if (lot.status === 'reserved') reservedCount += 1
      if (lot.status === 'paid') paidCount += 1

      totalReservedValue += lot.agreed_price ?? 0
      totalCollected += lot.total_paid
      totalBalance += lot.balance ?? 0

      if (lot.seller_number == null) continue
      const existing = perSellerMap.get(lot.seller_number)
      if (existing) {
        existing.reservationsCount += 1
        existing.reservedValue += lot.agreed_price ?? 0
      } else {
        perSellerMap.set(lot.seller_number, {
          sellerNumber: lot.seller_number,
          sellerName: lot.seller_name ?? `Vendedor ${lot.seller_number}`,
          reservationsCount: 1,
          reservedValue: lot.agreed_price ?? 0,
          clientsCount: 0,
          initialPaymentsCount: 0,
        })
      }
    }

    // clientsCount cuenta clientes únicos por vendedor (un mismo cliente
    // puede tener varios lotes reservados), calculado aparte con un Set.
    const clientsBySeller = new Map<number, Set<string>>()
    for (const lot of lots) {
      if (lot.seller_number == null || !lot.client_id) continue
      const set = clientsBySeller.get(lot.seller_number) ?? new Set<string>()
      set.add(lot.client_id)
      clientsBySeller.set(lot.seller_number, set)
    }

    for (const [sellerNumber, seller] of perSellerMap) {
      seller.clientsCount = clientsBySeller.get(sellerNumber)?.size ?? 0
      seller.initialPaymentsCount = initialPaymentsBySeller.get(sellerNumber) ?? 0
    }

    const recentReservations: RecentReservation[] = (
      (recentReservationsRes.data ?? []) as unknown as {
        id: string
        agreed_price: number
        created_at: string
        lots: { lot_code: string } | null
        clients: { name: string } | null
        sellers: { display_name: string } | null
      }[]
    ).map((r) => ({
      id: r.id,
      lotCode: r.lots?.lot_code ?? '—',
      clientName: r.clients?.name ?? '—',
      sellerName: r.sellers?.display_name ?? '—',
      agreedPrice: r.agreed_price,
      createdAt: r.created_at,
    }))

    const recentPayments: RecentPayment[] = (
      (recentPaymentsRes.data ?? []) as unknown as {
        id: string
        amount: number
        payment_type: 'initial' | 'payment'
        created_at: string
        reservations: { lots: { lot_code: string } | null; clients: { name: string } | null } | null
      }[]
    ).map((p) => ({
      id: p.id,
      lotCode: p.reservations?.lots?.lot_code ?? '—',
      clientName: p.reservations?.clients?.name ?? '—',
      amount: p.amount,
      paymentType: p.payment_type,
      createdAt: p.created_at,
    }))

    setStats({
      projectsCount: projectId ? null : (projectsRes?.count ?? 0),
      lotsCount: lots.length,
      availableCount,
      reservedCount,
      paidCount,
      totalReservedValue,
      totalCollected,
      totalBalance,
      perSeller: [...perSellerMap.values()].sort((a, b) => b.reservationsCount - a.reservationsCount),
      recentReservations,
      recentPayments,
    })
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [refresh])

  return { stats, loading, error, refresh }
}
