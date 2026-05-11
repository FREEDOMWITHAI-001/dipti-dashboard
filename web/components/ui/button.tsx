'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'primary' | 'ghost';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const styles: Record<Variant, string> = {
  default: 'border border-ink-200 text-ink-800 bg-white hover:bg-ink-50',
  primary: 'btn-primary',
  ghost:   'text-ink-700 hover:bg-ink-100',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'default', className, children, ...rest }, ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'h-9 px-3 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed',
        styles[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
