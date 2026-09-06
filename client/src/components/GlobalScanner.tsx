/**
 * GlobalScanner — Escáner rápido para ventas express.
 *
 * Flujo:
 *  1. Se escanea el código de barras del equipo
 *  2. El sistema busca automáticamente el equipo disponible
 *  3. Abre el modal de venta con el equipo ya cargado en el carrito
 *  4. Listo para completar cliente y finalizar venta rápidamente
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface GlobalScannerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GlobalScanner({ open, onOpenChange }: GlobalScannerProps) {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [lastScanned, setLastScanned] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  const lookupQuery = trpc.units.getByCode.useQuery(
    { code: code.trim() },
    { enabled: false }
  );

  // Auto-focus y animación de pulso
  useEffect(() => {
    if (open) {
      setCode("");
      setLastScanned("");
      setScanning(false);
      setTimeout(() => inputRef.current?.focus(), 80);
      
      // Pulso visual cada 750ms
      const interval = setInterval(() => setPulse(p => !p), 750);
      return () => clearInterval(interval);
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

  const handleScan = async (scannedCode: string) => {
    const trimmed = scannedCode.trim();
    if (!trimmed || trimmed.length < 2) return;

    setScanning(true);
    setLastScanned(trimmed);

    try {
      const res = await lookupQuery.refetch();
      const data = res.data;

      if (data?.found && data.unit) {
        const unit = data.unit;
        
        // Verificar que esté disponible
        if (unit.status !== "available") {
          toast.error("❌ Equipo no disponible", {
            description: `${unit.brand} ${unit.model} - Estado: ${unit.status}`,
            duration: 4000,
          });
          setScanning(false);
          setCode("");
          return;
        }

        // Éxito - mostrar mensaje
        toast.success("✅ Equipo encontrado", {
          description: `${unit.brand} ${unit.model} - Abriendo venta...`,
          duration: 2000,
        });

        // Cerrar escáner y redirigir a ventas con el equipo
        setTimeout(() => {
          onOpenChange(false);
          // Guardar el unitId en sessionStorage para que Sales.tsx lo capture
          sessionStorage.setItem("quickSaleUnitId", unit.id.toString());
          sessionStorage.setItem("quickSaleUnitCode", trimmed);
          navigate("/sales");
        }, 500);

      } else {
        toast.error("❌ CÓDIGO NO EXISTE", {
          description: `El código "${trimmed}" no se encuentra en el inventario`,
          duration: 4000,
        });
      }
    } catch (err) {
      toast.error("Error al buscar el código");
      console.error(err);
    } finally {
      setScanning(false);
      setCode("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.trim()) {
      handleScan(code.trim());
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-slate-900">
            <div className={`p-2.5 rounded-xl ${scanning ? "bg-emerald-500" : "bg-slate-900"} transition-colors`}>
              <Zap className="h-5 w-5 text-white" />
            </div>
            Venta Rápida con Escáner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instrucción */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-900 font-semibold flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              Escanea el código de barras del equipo para iniciar una venta
            </p>
            <p className="text-xs text-blue-700 mt-1">
              El sistema buscará el equipo y abrirá el formulario de venta automáticamente
            </p>
          </div>

          {/* Campo de entrada con indicador parpadeante */}
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-3 w-3 rounded-full transition-all duration-300 ${pulse ? "bg-emerald-600 scale-110" : "bg-emerald-400"}`} />
              <span className="text-xs font-bold text-slate-700">
                {scanning ? "Buscando equipo..." : "Listo para escanear"}
              </span>
            </div>
            
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escanea o escribe el código aquí..."
              className="h-14 text-lg font-mono font-bold border-2 border-emerald-300 bg-emerald-50/30 focus:border-emerald-600 focus:ring-emerald-500 transition-all"
              autoComplete="off"
              disabled={scanning}
            />

            {/* Indicador de escaneo activo */}
            {!scanning && (
              <div className="absolute right-3 top-[46px] flex items-center gap-1.5 text-emerald-600">
                <ScanLine className="h-5 w-5 animate-pulse" />
              </div>
            )}
          </div>

          {/* Último código escaneado */}
          {lastScanned && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600 font-medium">
                Último escaneado: <span className="font-mono font-bold text-slate-900">{lastScanned}</span>
              </p>
            </div>
          )}

          {/* Atajo de teclado */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Presiona <kbd className="mx-1 px-2 py-0.5 rounded border border-slate-300 bg-white font-mono text-slate-600">Enter</kbd> para buscar
            </span>
            <span className="flex items-center gap-1.5">
              Cerrar: <kbd className="px-2 py-0.5 rounded border border-slate-300 bg-white font-mono text-slate-600">ESC</kbd>
            </span>
          </div>

          {/* Info adicional */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-bold">Tip: Atajo rápido</p>
              <p className="mt-1">
                Presiona <kbd className="mx-1 px-1.5 py-0.5 rounded border border-amber-300 bg-white font-mono text-[10px]">Ctrl+Shift+S</kbd> desde cualquier módulo para abrir el escáner
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
