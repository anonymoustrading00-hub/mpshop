/**
 * GlobalScanner — Escáner QR/barcode disponible desde cualquier módulo.
 *
 * Al escanear o escribir un código:
 *  1. Busca la unidad por código o RMA
 *  2. Si la encuentra → abre el Kardex completo de esa unidad
 *  3. Si no la encuentra → muestra mensaje de error
 *
 * Se activa con el botón en AppHeader o con el atajo Ctrl+Shift+S.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UnitKardex } from "@/components/UnitKardex";
import { QrCode, Search, Scan, X, Laptop, Smartphone, Tablet, Monitor, Box, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const TYPE_ICON: Record<string, any> = {
  laptop: Laptop, phone: Smartphone, tablet: Tablet,
  monitor: Monitor, charger: Box, accessory: Box, other: Box,
};

const STATUS_LABEL: Record<string, string> = {
  in_diagnosis: "En Diagnóstico", in_repair: "En Taller",
  available: "Disponible", sold: "Vendida", returned: "Devuelta",
};

const STATUS_COLOR: Record<string, string> = {
  in_diagnosis: "border-amber-300 text-amber-700 bg-amber-50",
  in_repair:    "border-red-300 text-red-700 bg-red-50",
  available:    "border-emerald-300 text-emerald-700 bg-emerald-50",
  sold:         "border-slate-300 text-slate-600 bg-slate-50",
  returned:     "border-purple-300 text-purple-700 bg-purple-50",
};

interface GlobalScannerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GlobalScanner({ open, onOpenChange }: GlobalScannerProps) {
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUnit, setFoundUnit] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [kardexOpen, setKardexOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lookupQuery = trpc.units.getByCode.useQuery(
    { code: code.trim() },
    { enabled: false }
  );

  // Auto-focus when dialog opens
  useEffect(() => {
    if (open) {
      setCode("");
      setFoundUnit(null);
      setNotFound(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Keyboard shortcut Ctrl+Shift+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const handleSearch = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSearching(true);
    setFoundUnit(null);
    setNotFound(false);

    try {
      const res = await lookupQuery.refetch();
      const data = res.data;

      if (data?.found && data.unit) {
        setFoundUnit(data.unit);
        setNotFound(false);
      } else {
        setFoundUnit(null);
        setNotFound(true);
      }
    } catch {
      toast.error("Error al buscar el código");
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const openKardex = () => {
    if (!foundUnit) return;
    setKardexOpen(true);
  };

  const reset = () => {
    setCode("");
    setFoundUnit(null);
    setNotFound(false);
  };

  const TypeIcon = foundUnit ? (TYPE_ICON[foundUnit.type] || Box) : Box;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <div className="p-2 rounded-xl bg-slate-900">
                <Scan className="h-4 w-4 text-white" />
              </div>
              Escáner Global de Equipos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instrucción */}
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5 shrink-0" />
              Escanea el código QR del equipo o escribe el código / RMA
            </p>

            {/* Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setFoundUnit(null);
                    setNotFound(false);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ej: LT-0001, RMA-2026-000001, 78a..."
                  className="pl-9 font-mono"
                  autoComplete="off"
                />
              </div>
              {code && (
                <Button size="icon" variant="ghost" onClick={reset} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={handleSearch}
                disabled={!code.trim() || searching}
                className="shrink-0 bg-slate-900 hover:bg-slate-800"
              >
                {searching ? "Buscando..." : "Buscar"}
              </Button>
            </div>

            {/* Atajo de teclado */}
            <p className="text-[10px] text-slate-400 text-center">
              Atajo: <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono text-slate-500 text-[10px]">Ctrl+Shift+S</kbd>
            </p>

            {/* Not found */}
            {notFound && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">Código no encontrado</p>
                  <p className="text-xs text-red-600">Verifica que el código esté bien escrito o registrado en el sistema</p>
                </div>
              </div>
            )}

            {/* Found unit preview */}
            {foundUnit && (
              <div
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/50 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={openKardex}
              >
                <div className="p-2.5 rounded-xl bg-white border border-blue-100 shrink-0">
                  <TypeIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 truncate">
                    {foundUnit.brand} {foundUnit.model}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">{foundUnit.code}</span>
                    {foundUnit.rmaNumber && (
                      <span className="font-mono text-xs font-bold text-emerald-600">{foundUnit.rmaNumber}</span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold px-1.5 ${STATUS_COLOR[foundUnit.status] || ""}`}
                    >
                      {STATUS_LABEL[foundUnit.status] || foundUnit.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-blue-600 font-bold shrink-0">Ver Kardex →</div>
              </div>
            )}

            {/* Action button */}
            {foundUnit && (
              <Button
                className="w-full bg-slate-900 hover:bg-slate-800 gap-2"
                onClick={openKardex}
              >
                <QrCode className="h-4 w-4" />
                Abrir Kardex completo
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Kardex modal */}
      {foundUnit && (
        <UnitKardex
          unitId={foundUnit.id}
          open={kardexOpen}
          onOpenChange={(v) => {
            setKardexOpen(v);
            if (!v) onOpenChange(false); // cierra el scanner también
          }}
        />
      )}
    </>
  );
}
