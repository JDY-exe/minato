import type { InputHTMLAttributes } from 'react';

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'size'> & { label: string };
export function Switch({ label, className = '', ...props }: SwitchProps) {
  return <label className={`mn-switch ${className}`}>
    <input {...props} type="checkbox" role="switch" />
    <span className="mn-switch__track" aria-hidden="true"><span /></span>
    <span>{label}</span>
  </label>;
}
