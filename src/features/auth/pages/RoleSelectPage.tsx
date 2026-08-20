import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { useAuth } from '../useAuth'

export function RoleSelectPage() {
  const { status } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'admin') navigate('/admin', { replace: true })
    if (status === 'seller') navigate('/vendedor', { replace: true })
  }, [status, navigate])

  return (
    <main className="screen">
      <div className="screen__card">
        <h1 className="screen__title">LotesD</h1>
        <p className="screen__subtitle">
          Administración y reserva de lotes en tiempo real
        </p>
        <div className="role-options">
          <Button variant="primary" onClick={() => navigate('/admin/login')}>
            Administrador
          </Button>
          <Button variant="secondary" onClick={() => navigate('/vendedor/login')}>
            Vendedor
          </Button>
        </div>
      </div>
    </main>
  )
}
