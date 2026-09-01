import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, X, Check } from "lucide-react";

export interface AutocompleteOption {
  value: string | number;
  label: string;
  secondaryLabel?: string;
  metadata?: any;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value?: string;
  onChange: (value: string) => void;
  onSelect?: (option: AutocompleteOption) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showSearchIcon?: boolean;
  maxSuggestions?: number;
}

export function Autocomplete({
  options,
  value = "",
  onChange,
  onSelect,
  onCommit,
  placeholder = "Escribir o buscar...",
  className,
  disabled = false,
  showSearchIcon = false,
  maxSuggestions = 25,
}: AutocompleteProps) {
  const [inputValue, setInputValue] = React.useState(value);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Sincronizar con valor externo
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filtrar opciones basado en búsqueda multi-término insensible a mayúsculas y acentos
  const filteredOptions = React.useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) {
      return options.slice(0, maxSuggestions);
    }
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = options.filter((option) => {
      const label = option.label.toLowerCase();
      const secondary = (option.secondaryLabel || "").toLowerCase();
      const target = `${label} ${secondary}`;
      return terms.every((t) => target.includes(t));
    });
    return matches.slice(0, maxSuggestions);
  }, [options, inputValue, maxSuggestions]);

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

  // Mantener visible el elemento resaltado con scroll automático
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-autocomplete-item]");
      const item = items[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setShowSuggestions(true);
    setHighlightedIndex(0);
  };

  const handleSelectOption = (option: AutocompleteOption) => {
    setInputValue(option.label);
    onChange(option.label);
    onSelect?.(option);
    onCommit?.(option.label);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue("");
    onChange("");
    setShowSuggestions(true);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredOptions.length === 0) {
      if (e.key === "Enter") {
        const committedValue = inputValue.trim();
        if (committedValue) onCommit?.(committedValue);
      } else if (e.key === "ArrowDown") {
        setShowSuggestions(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
      case "Tab":
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          e.preventDefault();
          handleSelectOption(filteredOptions[highlightedIndex]);
        } else {
          const committedValue = inputValue.trim();
          if (committedValue) onCommit?.(committedValue);
          setShowSuggestions(false);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Resaltado de coincidencia
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <strong key={i} className="text-primary font-bold bg-primary/10 rounded px-0.5">
              {part}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        {showSearchIcon && (
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            const committedValue = inputValue.trim();
            if (committedValue) onCommit?.(committedValue);
          }}
          onFocus={() => {
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full transition-all pr-8",
            showSearchIcon && "pl-8",
            showSuggestions && filteredOptions.length > 0 && "rounded-b-none border-primary ring-1 ring-primary/20",
            className
          )}
          autoComplete="off"
          spellCheck={false}
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Limpiar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showSuggestions && filteredOptions.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 mt-0.5 z-50 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {filteredOptions.map((option, index) => {
            const isSelected = String(option.label).toLowerCase() === String(inputValue).toLowerCase();
            const isHighlighted = index === highlightedIndex;

            return (
              <div
                key={`${option.value}-${index}`}
                data-autocomplete-item
                className={cn(
                  "px-3 py-2.5 cursor-pointer text-xs flex items-center justify-between gap-2 transition-colors select-none",
                  isHighlighted
                    ? "bg-primary/10 text-primary font-medium"
                    : isSelected
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-medium"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectOption(option);
                }}
                onClick={() => handleSelectOption(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center gap-2 truncate flex-1">
                  <Search className={cn("h-3 w-3 shrink-0", isHighlighted ? "text-primary" : "text-slate-400")} />
                  <span className="truncate">
                    {highlightMatch(option.label, inputValue)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {option.secondaryLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                      {option.secondaryLabel}
                    </span>
                  )}
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

