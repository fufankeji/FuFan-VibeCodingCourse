import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(
          // [Prep-02] 修复 #2: disabled 态用 opacity+cursor-not-allowed 但保留 pointer-events 让 cursor 生效
          'inline-flex items-center justify-center whitespace-nowrap rounded-[8px] text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-default/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-primary-default text-primary-fg not-disabled:hover:bg-primary-hover not-disabled:active:bg-primary-active': variant === 'primary',
            'bg-bg-elevated text-fg-default not-disabled:hover:bg-bg-muted not-disabled:active:bg-bg-subtle': variant === 'secondary',
            'border border-border-default bg-transparent text-fg-default not-disabled:hover:bg-bg-elevated not-disabled:active:bg-bg-subtle': variant === 'outline',
            'bg-transparent text-fg-secondary not-disabled:hover:bg-bg-subtle not-disabled:hover:text-fg-default not-disabled:active:bg-bg-muted': variant === 'ghost',
            'h-[32px] px-[12px] text-[13px]': size === 'sm',
            'h-[40px] px-[16px] py-[8px]': size === 'md',
            'h-[40px] px-[20px] text-[15px]': size === 'lg',
            'h-[40px] w-[40px]': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';