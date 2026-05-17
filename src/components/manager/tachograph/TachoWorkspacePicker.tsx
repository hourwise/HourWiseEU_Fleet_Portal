interface PickerOption {
  id: string;
  label: string;
  meta?: string;
}

interface TachoWorkspacePickerProps {
  title: string;
  searchLabel: string;
  selectLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedValue: string;
  onSelectChange: (value: string) => void;
  options: PickerOption[];
  fallbackLabel: string;
}

export function TachoWorkspacePicker({
  title,
  searchLabel,
  selectLabel,
  searchValue,
  onSearchChange,
  selectedValue,
  onSelectChange,
  options,
  fallbackLabel,
}: TachoWorkspacePickerProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
          <label className="mt-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            {searchLabel}
          </label>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={fallbackLabel}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="min-w-0 flex-1">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
            {selectLabel}
          </label>
          <select
            value={selectedValue}
            onChange={(event) => onSelectChange(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{fallbackLabel}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.meta ? `${option.label} - ${option.meta}` : option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {options.length === 0 ? 'No matching records.' : `${options.length} matching option${options.length === 1 ? '' : 's'} available.`}
      </p>
    </div>
  );
}
