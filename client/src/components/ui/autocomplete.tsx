import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
  value: string | number;
  label: string;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value?: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Autocomplete({
  options,
  value = "",
  onChange,
  onCommit,
  placeholder = "Escribir...",
  className,
  disabled = false,
}: AutocompleteProps) {
  const [inputValue, setInputValue] = React.useState(value);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [filteredOptions, setFilteredOptions] = React.useState<AutocompleteOption[]>([]);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Sincronizar con valor externo
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Cerrar sugerencias al hacer click fuera
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Filtrar opciones
    if (newValue.trim()) {
      const filtered = options.filter((option) =>
        option.label.toLowerCase().includes(newValue.toLowerCase())
      );
      setFilteredOptions(filtered);
      setShowSuggestions(filtered.length > 0);
      setHighlightedIndex(-1);
    } else {
      setFilteredOptions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectOption = (option: AutocompleteOption) => {
    setInputValue(option.label);
    onChange(option.label);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((!showSuggestions || filteredOptions.length === 0) && e.key === "Enter") {
      const committedValue = inputValue.trim();
      if (committedValue) onCommit?.(committedValue);
      return;
    }

    if (!showSuggestions || filteredOptions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        } else {
          const committedValue = inputValue.trim();
          if (committedValue) onCommit?.(committedValue);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          const committedValue = inputValue.trim();
          if (committedValue) onCommit?.(committedValue);
          setShowSuggestions(false);
        }}
        onFocus={() => {
          if (inputValue.trim() && filteredOptions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      {showSuggestions && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option, index) => (
            <div
              key={option.value}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm",
                index === highlightedIndex
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-slate-100"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectOption(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
