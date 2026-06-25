import React from 'react';
import { cn } from '../../lib/utils';

interface HWBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export function HWBadge({
  children,
  className,
  variant = 'neutral',
  size = 'sm',
  ...props
}: HWBadgeProps) {
  const variants = {
    success: 'bg-hw-green-500/10 text-hw-green-500 border-hw-green-500/20',
    warning: 'bg-hw-amber-500/10 text-hw-amber-500 border-hw-amber-500/20',
    danger: 'bg-hw-red-500/10 text-hw-red-500 border-hw-red-500/20',
    info: 'bg-hw-cyan-500/10 text-hw-cyan-500 border-hw-cyan-500/20',
    neutral: 'bg-hw-navy-800 text-hw-slate-300 border-hw-navy-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-bold uppercase tracking-wider border rounded',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
