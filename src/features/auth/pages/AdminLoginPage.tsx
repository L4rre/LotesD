import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Alert } from '../../../components/ui/Alert'
import { useAuth } from '../useAuth'

export function AdminLoginPage() {
  const { status, seller, signInAdmin, signOutSeller } = useAuth()
  const navigate = useNavigate()
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
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'seller' && seller) {
    return (
      <main className="screen">
        <div className="screen__card">
          <h1 className="screen__title">Administrador</h1>
          <Alert variant="info">
            Ya iniciaste sesión como {seller.displayName} (Vendedor{' '}
            {String(seller.sellerNumber).padStart(2, '0')}). Cierra esa sesión para
            continuar como administrador.
          </Alert>
          <Button variant="secondary" onClick={() => signOutSeller('switch-role')}>
            Cerrar sesión de vendedor y continuar
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="screen">
      <form className="screen__card" onSubmit={handleSubmit}>
        <h1 className="screen__title">Administrador</h1>
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
    </main>
  )
}
