import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Select } from '../../../components/ui/Select'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { useAuth } from '../useAuth'
import { useSellerAccessEnabled } from '../../sellers/hooks/useSellerAccessEnabled'
import { useSellerAvailability } from '../../sellers/hooks/useSellerAvailability'

interface SellerLoginFormProps {
  onSuccess: () => void
}

// Formulario puro (sin <main>/useNavigate): vive dentro del BottomSheet de
// login de la home pública (§4), no en su propia ruta. AuthProvider ya le
// da a cualquier visitante una sesión anónima antes de que la home
// termine de cargar, así que este formulario no necesita pedirla él mismo.
export function SellerLoginForm({ onSuccess }: SellerLoginFormProps) {
  const { signInSeller } = useAuth()

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
  } = useSellerAvailability()

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
      onSuccess()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado.')
      refreshAvailability()
    } finally {
      setSubmitting(false)
    }
  }

  const stillLoading = loadingAccess || loadingAvailability
  if (stillLoading) return <FullScreenLoader label="Cargando…" />

  if (accessError || availabilityError) {
    return (
      <div className="panel__form">
        <h2 className="panel__title">Vendedor</h2>
        <Alert variant="error">No se pudo conectar. Revisa tu conexión e intenta de nuevo.</Alert>
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
    )
  }

  if (!accessEnabled) {
    return (
      <div className="panel__form">
        <h2 className="panel__title">Vendedor</h2>
        <Alert variant="error">
          🔴 ACCESO DE VENDEDORES BLOQUEADO
          <br />
          El acceso de vendedores está temporalmente bloqueado por el administrador.
        </Alert>
      </div>
    )
  }

  return (
    <form className="panel__form" onSubmit={handleSubmit}>
      <h2 className="panel__title">Vendedor</h2>
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
  )
}
