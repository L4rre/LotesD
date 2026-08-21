import type { ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

// Panel deslizable desde abajo (spec §13): cómodo para usar con los
// dedos, se cierra tocando el fondo o el botón de cerrar.
export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  if (!open) return null

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet__handle" />
        <button type="button" className="bottom-sheet__close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
