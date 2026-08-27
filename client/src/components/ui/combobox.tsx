import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  value: string | number;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | number;
  onChange: (value: string | number) => void;
  onTextChange?: (text: string) => void; // Nuevo: para texto libre
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  allowCustomValue?: boolean; // Nuevo: permite escribir texto libre
}

export function Combobox({
  options,
  value,
  onChange,
  onTextChange,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron resultados.",
  className,
  disabled = false,
  allowCustomValue = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);
  
  // Si hay valor pero no está en opciones (texto personalizado), mostrarlo
  const displayText = selectedOption?.label || (typeof value === 'string' && value) || "";

  React.useEffect(() => {
    if (selectedOption) {
      setInputValue(selectedOption.label);
    } else if (typeof value === 'string') {
      setInputValue(value);
    }
  }, [value, selectedOption]);

  const handleSelect = (selectedValue: string) => {
    const option = options.find(opt => opt.label === selectedValue);
    if (option) {
      onChange(option.value);
      setInputValue(option.label);
    }
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    if (allowCustomValue && onTextChange) {
      onTextChange(newValue);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <span className="truncate">
            {displayText || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={true}>
          <CommandInput 
            placeholder="Buscar o escribir..." 
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustomValue ? (
                <div className="px-2 py-3 text-sm">
                  <p className="text-muted-foreground mb-2">{emptyMessage}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (inputValue.trim()) {
                        onChange(inputValue.trim());
                        if (onTextChange) {
                          onTextChange(inputValue.trim());
                        }
                        setOpen(false);
                      }
                    }}
                  >
                    Usar "{inputValue}"
                  </Button>
                </div>
              ) : (
                emptyMessage
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
