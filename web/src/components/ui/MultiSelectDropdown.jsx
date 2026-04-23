import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function MultiSelectDropdown({
  label,
  name,
  options = [],
  value = [],
  onChange,
  helperText,
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const selectedLabels = options
    .filter((option) => selectedSet.has(option.value))
    .map((option) => option.label)
    .join(', ');

  const toggleValue = (optionValue) => {
    const next = selectedSet.has(optionValue)
      ? value.filter((item) => item !== optionValue)
      : [...value, optionValue];
    onChange?.(next);
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-zinc-700">{label}</label>
      <input type="hidden" name={name} value={value.join(',')} required={required && !value.length} />
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-800"
        >
          <span className="truncate">{selectedLabels || 'Select subject(s)'}</span>
          <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen ? (
          <div className="absolute z-30 mt-2 w-full rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
            {options.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.value)}
                  onChange={() => toggleValue(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
      {helperText ? <p className="text-xs text-zinc-500">{helperText}</p> : null}
    </div>
  );
}
