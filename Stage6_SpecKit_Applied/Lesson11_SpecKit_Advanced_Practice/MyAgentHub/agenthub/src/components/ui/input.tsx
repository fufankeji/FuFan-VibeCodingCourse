import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-[40px] w-full rounded-[8px] border border-border-default bg-bg-base px-[12px] py-[8px] text-[14px] file:border-0 file:bg-transparent file:text-[14px] file:font-medium placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 disabled:cursor-not-allowed disabled:opacity-50 not-disabled:hover:border-border-strong not-disabled:active:bg-bg-subtle transition-colors',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';