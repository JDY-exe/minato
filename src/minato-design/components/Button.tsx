import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
};

export function Button({ variant = 'filled', size = 'medium', loading = false, disabled, className = '', children, type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} className={`mn-button mn-button--${variant} mn-button--${size} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading && <span className="mn-spinner" aria-hidden="true" />}{children}
  </button>;
}
