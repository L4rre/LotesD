import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { Alert } from '../../../components/ui/Alert'
import { FullScreenLoader } from '../../../components/ui/FullScreenLoader'
import { useAuth } from '../../auth/useAuth'
import { useProjects } from '../hooks/useProjects'

export function ProjectsListPage() {
  const { status } = useAuth()
  const { projects, loading, error, refresh } = useProjects()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setFormError(null)
    setSaving(true)
    try {
      const { error } = await supabase
        .from('projects')
        .insert({ name: name.trim(), description: description.trim() || null })
      if (error) throw error
      setName('')
      setDescription('')
      setShowForm(false)
      await refresh()
    } catch {
      setFormError('No se pudo crear el terreno. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <FullScreenLoader />

  return (
    <main className="screen">
      <div className="screen__card" style={{ maxWidth: '32rem' }}>
        <Link to={status === 'admin' ? '/admin' : '/vendedor'}>← Volver</Link>
        <h1 className="screen__title">Terrenos</h1>

        {error && <Alert variant="error">{error}</Alert>}

        {projects.length === 0 && !error && (
          <Alert variant="info">Todavía no hay terrenos creados.</Alert>
        )}

        <ul className="seller-list">
          {projects.map((p) => (
            <li key={p.id} className="seller-list__item">
              <Link to={`/terrenos/${p.id}`} className="project-link">
                <span>{p.name}</span>
                <span>{p.lotCount} lotes</span>
              </Link>
            </li>
          ))}
        </ul>

        {status === 'admin' && !showForm && (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Nuevo terreno
          </Button>
        )}

        {status === 'admin' && showForm && (
          <form className="panel__form" onSubmit={handleCreate}>
            {formError && <Alert variant="error">{formError}</Alert>}
            <TextField
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextField
              label="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando…' : 'Crear terreno'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
