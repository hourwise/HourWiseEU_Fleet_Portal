import React from 'react';
import { cn } from '../../lib/utils';

interface HWCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function HWCard({
  children,
  className,
  variant = 'default',
  padding = 'md',
  ...props
}: HWCardProps) {
  const variants = {
    default: 'bg-hw-navy-900 border border-hw-navy-800 shadow-xl',
    outline: 'bg-transparent border border-hw-navy-800',
    glass: 'bg-hw-navy-900/40 backdrop-blur-md border border-white/5',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'rounded-xl transition-all',
        variants[variant],
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
