import { createElement } from 'react';
import type { ComponentPropsWithRef, ElementType } from 'react';

export type TextSize = 'small' | 'medium' | 'large';
export type TextWeight = 'regular' | 'medium' | 'bold';
type TextStyleProps = {
  italic?: boolean;
  className?: string;
} & (
  | { variant?: 'body' | 'mono'; size?: TextSize; weight?: TextWeight }
  | { variant: 'title' | 'display'; size?: never; weight?: never }
);

export type TextProps<T extends ElementType = 'span'> = TextStyleProps & { as?: T } &
  Omit<ComponentPropsWithRef<T>, keyof TextStyleProps | 'as'>;

/** Visual role is independent of HTML semantics. Language inherits through CSS :lang(). */
export function Text<T extends ElementType = 'span'>({
  as, variant = 'body', size = 'medium', weight = 'regular', italic = false,
  className = '', ...props
}: TextProps<T>) {
  const normal = variant === 'body' || variant === 'mono';
  const classes = [
    'mn-text', `mn-text--${variant}`,
    normal && `mn-text--size-${size}`, normal && `mn-text--weight-${weight}`,
    italic && 'mn-text--italic', className,
  ].filter(Boolean).join(' ');
  return createElement(as ?? 'span', { ...props, className: classes });
}
