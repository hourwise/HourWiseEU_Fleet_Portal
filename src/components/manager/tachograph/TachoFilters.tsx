import type { TachoAnalysisRange } from '../../../lib/tacho/rules/types';

const OPTIONS: { id: TachoAnalysisRange; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: '12m', label: '12 Months' },
];

interface TachoFiltersProps {
  value: TachoAnalysisRange;
  onChange: (next: TachoAnalysisRange) => void;
}

export function TachoFilters({ value, onChange }: TachoFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition ${
            value === option.id
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
