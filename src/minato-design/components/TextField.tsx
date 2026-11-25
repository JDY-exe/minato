import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };
export function TextField({ label, hint, error, id, className = '', 'aria-describedby': describedBy, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error || hint;
  const descriptionId = `${inputId}-description`;
  return <div className={`mn-field ${className}`}>
    <label htmlFor={inputId}>{label}</label>
    <input {...props} id={inputId} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={[describedBy, message ? descriptionId : undefined].filter(Boolean).join(' ') || undefined} />
    {message && <span id={descriptionId} className={error ? 'mn-field__error' : 'mn-field__hint'}>{message}</span>}
  </div>;
}
