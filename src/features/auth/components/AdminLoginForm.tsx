import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Alert } from '../../../components/ui/Alert'
import { useAuth } from '../useAuth'

interface AdminLoginFormProps {
  onSuccess: () => void
}

// Formulario puro (sin <main>/useNavigate): vive dentro del BottomSheet de
// login de la home pública (§4), no en su propia ruta.
export function AdminLoginForm({ onSuccess }: AdminLoginFormProps) {
  const { signInAdmin } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInAdmin(username, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="panel__form" onSubmit={handleSubmit}>
      <h2 className="panel__title">Administrador</h2>
      {error && <Alert variant="error">{error}</Alert>}
      <TextField
        label="Usuario"
        name="username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
}
