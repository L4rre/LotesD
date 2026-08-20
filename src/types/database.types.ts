// Tipos manuales, escritos a mano contra las migraciones de
// supabase/migrations/ (todavía no hay un proyecto Supabase real del que
// generar `supabase gen types`). Se amplía en cada fase con las tablas que
// vaya necesitando la UI.

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

export interface SystemSettingsPublic {
  seller_access_enabled: boolean
  updated_at: string
}
