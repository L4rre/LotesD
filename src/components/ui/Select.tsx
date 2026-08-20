import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
}

export function Select({ label, id, className, children, ...props }: SelectProps) {
  const selectId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="field">
      <label htmlFor={selectId} className="field__label">
        {label}
      </label>
      <select id={selectId} className={['field__input', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
    </div>
  )
}
