import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function TextField({ label, id, className, ...props }: TextFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="field">
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      <input id={inputId} className={['field__input', className].filter(Boolean).join(' ')} {...props} />
    </div>
  )
}
