import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  noOptionsMessage?: string;
}

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  required = false,
  className = '',
  noOptionsMessage = 'No matching options found.',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option.value);
    inputRef.current?.setCustomValidity('');
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && filtered[activeIndex]) {
      event.preventDefault();
      selectOption(filtered[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
        autoComplete="off"
        required={required && !value}
        disabled={disabled}
        value={open ? query : selected?.label || ''}
        placeholder={placeholder}
        className={className}
        onFocus={() => {
          setQuery('');
          setActiveIndex(0);
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
          if (value) onChange('');
          inputRef.current?.setCustomValidity(
            event.target.value ? 'Select an option from the search results.' : '',
          );
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!value && required) inputRef.current?.setCustomValidity('Select an option from the list.');
          else inputRef.current?.setCustomValidity('');
        }}
      />
      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-[70] mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
        >
          {filtered.length ? filtered.map((option, index) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-blue-50 text-blue-800' : 'text-gray-800 hover:bg-gray-50'}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            </li>
          )) : (
            <li className="px-3 py-2 text-sm text-gray-500">{noOptionsMessage}</li>
          )}
        </ul>
      )}
    </div>
  );
}
