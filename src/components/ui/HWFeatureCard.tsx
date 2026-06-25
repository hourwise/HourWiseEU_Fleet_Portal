import React from 'react';
import { HWCard } from './HWCard';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HWFeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
}

export function HWFeatureCard({
  title,
  description,
  icon: Icon,
  className,
  iconClassName,
}: HWFeatureCardProps) {
  return (
    <HWCard className={cn('group hover:border-hw-blue-600/30 transition-all duration-300', className)}>
      <div className={cn(
        'w-12 h-12 rounded-xl bg-hw-blue-600/10 flex items-center justify-center mb-6 group-hover:bg-hw-blue-600 group-hover:text-white transition-all duration-300',
        iconClassName
      )}>
        <Icon size={24} className="group-hover:scale-110 transition-transform" />
      </div>
      <h4 className="text-xl font-bold text-hw-white mb-3">{title}</h4>
      <p className="text-hw-slate-400 leading-relaxed text-sm">{description}</p>
    </HWCard>
  );
}
