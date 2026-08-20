export function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="full-loader">
      <span>{label}</span>
    </div>
  )
}
