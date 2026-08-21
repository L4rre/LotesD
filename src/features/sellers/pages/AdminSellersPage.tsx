import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { useSellerAccessEnabled } from '../hooks/useSellerAccessEnabled'
import { useSellerAvailability } from '../hooks/useSellerAvailability'
import { translateAuthError } from '../../../domain/rpcErrors'

function timeSince(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'hace instantes'
  if (minutes === 1) return 'hace 1 minuto'
  if (minutes < 60) return `hace ${minutes} minutos`
  const hours = Math.round(minutes / 60)
  return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`
}

export function AdminSellersPage() {
  const {
    enabled: accessEnabled,
    error: accessError,
    loading: loadingAccess,
    refresh: refreshAccess,
  } = useSellerAccessEnabled()
  const { availability, loading: loadingAvailability, error: availabilityError } = useSellerAvailability()

  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [confirmingBlock, setConfirmingBlock] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  async function handleToggle(nextEnabled: boolean) {
    setToggleError(null)
    setToggling(true)
    try {
      const { error } = await supabase.rpc('admin_toggle_seller_access', { p_enabled: nextEnabled })
      if (error) throw error
      await refreshAccess()
      setConfirmingBlock(false)
    } catch (err) {
      setToggleError(err instanceof Error ? translateAuthError(err.message) : 'Error inesperado.')
    } finally {
      setToggling(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await supabase.rpc('admin_set_global_password', { p_new_password: newPassword })
      if (error) throw error
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? translateAuthError(err.message) : 'Error inesperado.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loadingAccess || loadingAvailability) return <FullScreenLoader />

  return (
    <main className="screen">
      <div className="screen__card" style={{ maxWidth: '32rem' }}>
        <Link to="/admin">← Volver</Link>
        <h1 className="screen__title">Vendedores</h1>

        {(accessError || availabilityError) && (
          <Alert variant="error">No se pudo cargar todo. Algunos datos pueden estar desactualizados.</Alert>
        )}

        <section className="panel">
          <h2 className="panel__title">Acceso de vendedores</h2>
          {accessEnabled ? (
            <Alert variant="success">🟢 ACCESO DE VENDEDORES HABILITADO</Alert>
          ) : (
            <Alert variant="error">🔴 ACCESO DE VENDEDORES BLOQUEADO</Alert>
          )}
          {toggleError && <Alert variant="error">{toggleError}</Alert>}

          {accessEnabled && !confirmingBlock && (
            <Button variant="danger" onClick={() => setConfirmingBlock(true)} disabled={toggling}>
              Bloquear acceso de vendedores
            </Button>
          )}
          {accessEnabled && confirmingBlock && (
            <>
              <Alert variant="info">
                Esto corta el acceso de los 10 vendedores de inmediato, incluidas las
                sesiones ya activas. ¿Confirmas?
              </Alert>
              <Button variant="danger" onClick={() => handleToggle(false)} disabled={toggling}>
                {toggling ? 'Bloqueando…' : 'Sí, bloquear ahora'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingBlock(false)} disabled={toggling}>
                Cancelar
              </Button>
            </>
          )}
          {!accessEnabled && (
            <Button variant="primary" onClick={() => handleToggle(true)} disabled={toggling}>
              {toggling ? 'Habilitando…' : 'Habilitar acceso de vendedores'}
            </Button>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">Contraseña global</h2>
          <form onSubmit={handlePasswordSubmit} className="panel__form">
            {passwordError && <Alert variant="error">{passwordError}</Alert>}
            {passwordSuccess && <Alert variant="success">Contraseña actualizada.</Alert>}
            <TextField
              label="Nueva contraseña"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <TextField
              label="Confirmar contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="secondary" disabled={savingPassword}>
              {savingPassword ? 'Guardando…' : 'Cambiar contraseña global'}
            </Button>
          </form>
        </section>

        <section className="panel">
          <h2 className="panel__title">Estado de los 10 vendedores</h2>
          <ul className="seller-list">
            {availability.map((s) => (
              <li key={s.sellerNumber} className="seller-list__item">
                <span>
                  Vendedor {String(s.sellerNumber).padStart(2, '0')} — {s.displayName}
                </span>
                <span>
                  {s.busy ? `🔴 en uso (${timeSince(s.activeSince!)})` : '🟢 disponible'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
