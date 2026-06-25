import React from 'react';
import { cn } from '../../lib/utils'; // Assuming there's a utils file for clsx/tailwind-merge

interface HWButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function HWButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  ...props
}: HWButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-hw-blue-600 focus:ring-offset-2 focus:ring-offset-hw-navy-950 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-hw-blue-600 text-white hover:bg-hw-blue-700 shadow-lg shadow-hw-blue-600/20',
    secondary: 'bg-hw-navy-800 text-hw-slate-100 hover:bg-hw-navy-700 border border-hw-navy-700',
    outline: 'bg-transparent border-2 border-hw-navy-800 text-hw-slate-300 hover:border-hw-blue-600 hover:text-white',
    ghost: 'bg-transparent text-hw-slate-400 hover:bg-hw-navy-800 hover:text-white',
    danger: 'bg-hw-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}
