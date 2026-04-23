import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'error';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-[12px] py-[4px] text-[12px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-default/40',
        {
          'border-transparent bg-primary-default text-primary-fg': variant === 'default',
          'border-transparent bg-bg-elevated text-fg-default': variant === 'secondary',
          'border-border-default text-fg-default': variant === 'outline',
          'border-transparent bg-status-success/10 text-status-success': variant === 'success',
          'border-transparent bg-status-warning/10 text-status-warning': variant === 'warning',
          'border-transparent bg-status-error/10 text-status-error': variant === 'error',
        },
        className
      )}
      {...props}
    />
  );
}
