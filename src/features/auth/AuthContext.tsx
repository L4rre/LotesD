import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import {
  IDLE_CHECK_INTERVAL_MS,
  IDLE_LOGOUT_LIMIT_MS,
  SELLER_HEARTBEAT_INTERVAL_MS,
  SELLER_SESSION_STORAGE_KEY,
  adminUsernameToEmail,
} from '../../config/auth'
import { AuthFlowError } from './authErrors'
import type { SellerSessionRow } from '../../types/database.types'

type AuthStatus = 'loading' | 'signed-out' | 'admin' | 'seller'

interface AdminInfo {
  id: string
  displayName: string
}

interface SellerInfo {
  sessionId: string
  sellerNumber: number
  displayName: string
}

interface AuthContextValue {
  status: AuthStatus
  admin: AdminInfo | null
  seller: SellerInfo | null
  ensureAnonymousSession: () => Promise<Session>
  signInAdmin: (username: string, password: string) => Promise<void>
  signOutAdmin: () => Promise<void>
  signInSeller: (sellerNumber: number, name: string, password: string) => Promise<void>
  signOutSeller: (reason?: string) => Promise<void>
}

// El objeto de contexto vive junto a AuthProvider a propósito (patrón
// estándar de React); solo afecta la granularidad de Fast Refresh, no la
// corrección del código.
// oxlint-disable-next-line react/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null)
export type { AuthContextValue }

async function loadAdminProfile(userId: string): Promise<AdminInfo | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  if (!data) return null
  return { id: data.id, displayName: data.display_name ?? 'Administrador' }
}

async function loadActiveSellerSession(userId: string, preferredSessionId: string | null) {
  let query = supabase
    .from('seller_sessions')
    .select('id, seller_number, status, created_at')
    .eq('auth_user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (preferredSessionId) {
    query = query.eq('id', preferredSessionId)
  }

  const { data } = await query
  const row = data?.[0] as Pick<SellerSessionRow, 'id' | 'seller_number'> | undefined
  if (!row) return null

  const { data: sellerRow } = await supabase
    .from('sellers')
    .select('display_name')
    .eq('seller_number', row.seller_number)
    .maybeSingle()

  return {
    sessionId: row.id,
    sellerNumber: row.seller_number,
    displayName: sellerRow?.display_name ?? `Vendedor ${row.seller_number}`,
  } satisfies SellerInfo
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [seller, setSeller] = useState<SellerInfo | null>(null)
  const lastActivityRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return

      if (!session) {
        setStatus('signed-out')
        return
      }

      const adminInfo = await loadAdminProfile(session.user.id)
      if (cancelled) return
      if (adminInfo) {
        setAdmin(adminInfo)
        setStatus('admin')
        return
      }

      const storedSessionId = sessionStorage.getItem(SELLER_SESSION_STORAGE_KEY)
      const sellerInfo = await loadActiveSellerSession(session.user.id, storedSessionId)
      if (cancelled) return
      if (sellerInfo) {
        sessionStorage.setItem(SELLER_SESSION_STORAGE_KEY, sellerInfo.sessionId)
        setSeller(sellerInfo)
        setStatus('seller')
        return
      }

      sessionStorage.removeItem(SELLER_SESSION_STORAGE_KEY)
      setStatus('signed-out')
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const ensureAnonymousSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) return session

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.session) {
      throw new AuthFlowError(error?.message ?? 'NO_AUTH_SESSION')
    }
    return data.session
  }, [])

  const signInAdmin = useCallback(async (username: string, password: string) => {
    const email = adminUsernameToEmail(username)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      throw new AuthFlowError(error?.message ?? 'INVALID_PASSWORD')
    }

    const adminInfo = await loadAdminProfile(data.user.id)
    if (!adminInfo) {
      await supabase.auth.signOut()
      throw new AuthFlowError('NOT_ADMIN')
    }

    sessionStorage.removeItem(SELLER_SESSION_STORAGE_KEY)
    setSeller(null)
    setAdmin(adminInfo)
    setStatus('admin')
  }, [])

  const signOutAdmin = useCallback(async () => {
    await supabase.auth.signOut()
    setAdmin(null)
    setStatus('signed-out')
  }, [])

  const signInSeller = useCallback(
    async (sellerNumber: number, name: string, password: string) => {
      await ensureAnonymousSession()

      const { data, error } = await supabase.rpc('seller_login', {
        p_seller_number: sellerNumber,
        p_name: name,
        p_password: password,
      })
      if (error || !data) {
        throw new AuthFlowError(error?.message ?? 'NO_AUTH_SESSION')
      }

      const row = data as SellerSessionRow
      const { data: sellerRow } = await supabase
        .from('sellers')
        .select('display_name')
        .eq('seller_number', row.seller_number)
        .maybeSingle()

      sessionStorage.setItem(SELLER_SESSION_STORAGE_KEY, row.id)
      setAdmin(null)
      setSeller({
        sessionId: row.id,
        sellerNumber: row.seller_number,
        displayName: sellerRow?.display_name ?? name,
      })
      setStatus('seller')
    },
    [ensureAnonymousSession],
  )

  const signOutSeller = useCallback(
    async (reason = 'manual') => {
      if (seller) {
        await supabase
          .rpc('seller_logout', { p_session_id: seller.sessionId, p_reason: reason })
          .then(
            () => undefined,
            () => undefined,
          )
      }
      sessionStorage.removeItem(SELLER_SESSION_STORAGE_KEY)
      setSeller(null)
      setStatus('signed-out')
    },
    [seller],
  )

  // Heartbeat técnico (docs §5): mantiene viva la sesión del vendedor
  // mientras la pestaña está abierta, para que no la reclamen como
  // abandonada a los ~3 minutos.
  useEffect(() => {
    if (status !== 'seller' || !seller) return
    const sessionId = seller.sessionId
    const id = window.setInterval(() => {
      supabase.rpc('seller_heartbeat', { p_session_id: sessionId }).then(
        () => undefined,
        () => undefined,
      )
    }, SELLER_HEARTBEAT_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [status, seller])

  // Expiración por inactividad (docs §10): 1h sin interacción cierra la
  // sesión, sea admin o vendedor, aunque el heartbeat siga "vivo".
  useEffect(() => {
    if (status !== 'admin' && status !== 'seller') return

    lastActivityRef.current = Date.now()
    const bump = () => {
      lastActivityRef.current = Date.now()
    }
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    events.forEach((event) => window.addEventListener(event, bump, { passive: true }))

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current < IDLE_LOGOUT_LIMIT_MS) return
      if (status === 'admin') {
        signOutAdmin()
      } else if (status === 'seller') {
        signOutSeller('idle')
      }
    }, IDLE_CHECK_INTERVAL_MS)

    return () => {
      events.forEach((event) => window.removeEventListener(event, bump))
      window.clearInterval(interval)
    }
  }, [status, signOutAdmin, signOutSeller])

  const value: AuthContextValue = {
    status,
    admin,
    seller,
    ensureAnonymousSession,
    signInAdmin,
    signOutAdmin,
    signInSeller,
    signOutSeller,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
