import type { ReactNode } from 'react'

interface AlertProps {
  variant?: 'error' | 'info' | 'success'
  children: ReactNode
}

export function Alert({ variant = 'info', children }: AlertProps) {
  return <div className={`alert alert--${variant}`}>{children}</div>
}
