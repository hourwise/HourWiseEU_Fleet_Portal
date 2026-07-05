import React from 'react';

interface AtlasSuggestionChipsProps {
  chips: string[];
  onChipClick: (chip: string) => void;
}

export function AtlasSuggestionChips({ chips, onChipClick }: AtlasSuggestionChipsProps) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onChipClick(chip)}
          className="px-3 py-1.5 rounded-full bg-hw-blue-600/10 border border-hw-blue-600/20 text-[10px] font-bold text-hw-blue-600 uppercase tracking-widest hover:bg-hw-blue-600/20 transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
