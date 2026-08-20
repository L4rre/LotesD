import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Select } from '../../../components/ui/Select'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { useAuth } from '../useAuth'
import type { Seller } from '../../../types/database.types'

export function SellerLoginPage() {
  const { status, admin, signInSeller, signOutAdmin, ensureAnonymousSession } = useAuth()
  const navigate = useNavigate()

  const [loadingScreen, setLoadingScreen] = useState(true)
  const [accessEnabled, setAccessEnabled] = useState(true)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [busySellerNumbers, setBusySellerNumbers] = useState<Set<number>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)

  const [sellerNumber, setSellerNumber] = useState<number | ''>('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadScreenData = useCallback(async () => {
    setLoadError(null)
    try {
      await ensureAnonymousSession()

      const [{ data: settings }, { data: sellerRows }, { data: activeSessions }] = await Promise.all([
        supabase.from('system_settings_public').select('seller_access_enabled').maybeSingle(),
        supabase.from('sellers').select('seller_number, display_name, created_at').order('seller_number'),
        supabase.from('seller_sessions').select('seller_number').eq('status', 'active'),
      ])

      setAccessEnabled(settings?.seller_access_enabled ?? true)
      setSellers(sellerRows ?? [])
      setBusySellerNumbers(new Set((activeSessions ?? []).map((row) => row.seller_number)))
    } catch {
      setLoadError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setLoadingScreen(false)
    }
  }, [ensureAnonymousSession])

  useEffect(() => {
    // Si ya hay una sesión de administrador activa, el render de abajo
    // muestra el aviso de cambio de rol antes de llegar al estado de
    // carga — no hace falta tocarlo, y así evitamos crear una sesión
    // anónima de vendedor sin necesidad.
    if (status === 'admin') return
    // Carga de datos al montar (vendedores, bloqueo global, sesiones
    // activas) — es exactamente el caso de uso que un efecto cubre.
    // oxlint-disable-next-line react/set-state-in-effect
    loadScreenData()
  }, [status, loadScreenData])

  // Refleja el bloqueo global al instante si el admin lo activa mientras
  // esta pantalla está abierta (docs §5).
  useEffect(() => {
    const channel = supabase
      .channel('seller-login-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings' },
        () => {
          supabase
            .from('system_settings_public')
            .select('seller_access_enabled')
            .maybeSingle()
            .then(({ data }) => {
              if (data) setAccessEnabled(data.seller_access_enabled)
            })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (sellerNumber === '') return
    setFormError(null)
    setSubmitting(true)
    try {
      await signInSeller(sellerNumber, name, password)
      navigate('/vendedor', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado.')
      loadScreenData()
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'admin' && admin) {
    return (
      <main className="screen">
        <div className="screen__card">
          <h1 className="screen__title">Vendedor</h1>
          <Alert variant="info">
            Ya iniciaste sesión como administrador ({admin.displayName}). Cierra esa
            sesión para continuar como vendedor.
          </Alert>
          <Button variant="secondary" onClick={() => signOutAdmin()}>
            Cerrar sesión de administrador y continuar
          </Button>
        </div>
      </main>
    )
  }

  if (loadingScreen) return <FullScreenLoader label="Cargando…" />

  if (loadError) {
    return (
      <main className="screen">
        <div className="screen__card">
          <h1 className="screen__title">Vendedor</h1>
          <Alert variant="error">{loadError}</Alert>
          <Button variant="secondary" onClick={loadScreenData}>
            Reintentar
          </Button>
        </div>
      </main>
    )
  }

  if (!accessEnabled) {
    return (
      <main className="screen">
        <div className="screen__card">
          <h1 className="screen__title">Vendedor</h1>
          <Alert variant="error">
            🔴 ACCESO DE VENDEDORES BLOQUEADO
            <br />
            El acceso de vendedores está temporalmente bloqueado por el
            administrador.
          </Alert>
        </div>
      </main>
    )
  }

  return (
    <main className="screen">
      <form className="screen__card" onSubmit={handleSubmit}>
        <h1 className="screen__title">Vendedor</h1>
        <Alert variant="success">🟢 ACCESO DE VENDEDORES HABILITADO</Alert>
        {formError && <Alert variant="error">{formError}</Alert>}

        <Select
          label="Número de vendedor"
          value={sellerNumber}
          onChange={(e) => setSellerNumber(e.target.value ? Number(e.target.value) : '')}
          required
        >
          <option value="" disabled>
            Selecciona tu número
          </option>
          {sellers.map((s) => {
            const busy = busySellerNumbers.has(s.seller_number)
            return (
              <option key={s.seller_number} value={s.seller_number} disabled={busy}>
                Vendedor {String(s.seller_number).padStart(2, '0')}
                {busy ? ' — 🔴 en uso' : ' — 🟢 disponible'}
              </option>
            )
          })}
        </Select>

        <TextField
          label="Nombre"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          label="Contraseña"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={submitting || sellerNumber === ''}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </main>
  )
}
