import React from 'react';
import { HWCard } from './HWCard';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface HWMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isUp: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function HWMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: HWMetricCardProps) {
  const iconVariants = {
    default: 'text-hw-slate-400 bg-hw-navy-800',
    success: 'text-hw-green-500 bg-hw-green-500/10',
    warning: 'text-hw-amber-500 bg-hw-amber-500/10',
    danger: 'text-hw-red-500 bg-hw-red-500/10',
    info: 'text-hw-cyan-500 bg-hw-cyan-500/10',
  };

  return (
    <HWCard className={cn('flex flex-col gap-1', className)}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-hw-slate-500 uppercase tracking-widest">{title}</span>
        {Icon && (
          <div className={cn('p-2 rounded-lg', iconVariants[variant])}>
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-hw-white metric-value">{value}</span>
        {trend && (
          <span className={cn(
            'text-xs font-semibold',
            trend.isUp ? 'text-hw-green-500' : 'text-hw-red-500'
          )}>
            {trend.isUp ? '+' : '-'}{Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {subtitle && (
        <span className="text-sm text-hw-slate-400 mt-1">{subtitle}</span>
      )}
    </HWCard>
  );
}
