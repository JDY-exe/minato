import type { HTMLAttributes } from 'react';

export type SurfaceProps = HTMLAttributes<HTMLDivElement> & { tone?: 'low' | 'default' | 'high' | 'primary' | 'secondary' | 'tertiary' };
export function Surface({ tone = 'default', className = '', ...props }: SurfaceProps) {
  return <div {...props} className={`mn-surface mn-surface--${tone} ${className}`} />;
}
