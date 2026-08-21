// Tipos manuales, escritos a mano contra las migraciones de
// supabase/migrations/ (todavía no hay un proyecto Supabase real del que
// generar `supabase gen types`). Se amplía en cada fase con las tablas que
// vaya necesitando la UI.

export interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Seller {
  seller_number: number
  display_name: string
  created_at: string
}

export interface Profile {
  id: string
  role: 'admin'
  display_name: string | null
  created_at: string
}

export interface SellerSessionRow {
  id: string
  seller_number: number
  auth_user_id: string
  status: 'active' | 'closed'
  last_heartbeat: string
  created_at: string
}

export interface SellerAccessState {
  enabled: boolean
  updated_at: string
}

export type LotCommercialStatus = 'available' | 'reserved' | 'paid'

// Refleja supabase/migrations/20260820120400_lot_status_view.sql: estado
// y saldo siempre calculados, nunca almacenados (spec §10, §11, §30).
export interface LotStatusRow {
  lot_id: string
  project_id: string
  block: string
  lot_number: number
  lot_code: string
  area: number | null
  front: number | null
  depth: number | null
  reference_price: number | null
  geometry_id: string
  active_reservation_id: string | null
  client_id: string | null
  client_name: string | null
  seller_number: number | null
  seller_name: string | null
  agreed_price: number | null
  reserved_at: string | null
  reservation_notes: string | null
  total_paid: number
  balance: number | null
  paid_percentage: number | null
  status: LotCommercialStatus
}
