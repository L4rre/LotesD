import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Select } from '../../../components/ui/Select'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { useAuth } from '../useAuth'
import { useSellerAccessEnabled } from '../../sellers/hooks/useSellerAccessEnabled'
import { useSellerAvailability } from '../../sellers/hooks/useSellerAvailability'

export function SellerLoginPage() {
  const { status, admin, signInSeller, signOutAdmin, ensureAnonymousSession } = useAuth()
  const navigate = useNavigate()

  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'admin') return
    let cancelled = false
    ensureAnonymousSession()
      .then(() => {
        if (!cancelled) setAuthReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setAuthError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [status, ensureAnonymousSession])

  const {
    enabled: accessEnabled,
    error: accessError,
    loading: loadingAccess,
    refresh: refreshAccess,
  } = useSellerAccessEnabled()
  const {
    availability,
    loading: loadingAvailability,
    error: availabilityError,
    refresh: refreshAvailability,
  } = useSellerAvailability(authReady)

  const [sellerNumber, setSellerNumber] = useState<number | ''>('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      refreshAvailability()
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

  if (authError) {
    return (
      <main className="screen">
        <div className="screen__card">
          <h1 className="screen__title">Vendedor</h1>
          <Alert variant="error">{authError}</Alert>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </main>
    )
  }

  const stillLoading = !authReady || loadingAccess || loadingAvailability
  if (stillLoading) return <FullScreenLoader label="Cargando…" />

  if (accessError || availabilityError) {
    return (
      <main className="screen">
        <div className="screen__card">
          <h1 className="screen__title">Vendedor</h1>
          <Alert variant="error">
            No se pudo conectar. Revisa tu conexión e intenta de nuevo.
          </Alert>
          <Button
            variant="secondary"
            onClick={() => {
              refreshAccess()
              refreshAvailability()
            }}
          >
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
          {availability.map((s) => (
            <option key={s.sellerNumber} value={s.sellerNumber} disabled={s.busy}>
              Vendedor {String(s.sellerNumber).padStart(2, '0')}
              {s.busy ? ' — 🔴 en uso' : ' — 🟢 disponible'}
            </option>
          ))}
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
