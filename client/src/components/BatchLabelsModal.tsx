import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Copy, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { DisplayCardsModal } from "@/components/DisplayCardsModal";

interface BatchLabelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: string;
  model: string;
  type: string;
  salePrice?: number;
  codes: string[];
  branchName?: string;
  specs?: any;
}

export function BatchLabelsModal({
  open,
  onOpenChange,
  brand,
  model,
  type: _type,
  salePrice,
  codes,
  branchName,
  specs,
}: BatchLabelsModalProps) {
  const [isDisplayCardsOpen, setIsDisplayCardsOpen] = useState(false);

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(codes.join("\n"));
    toast.success(`${codes.length} códigos copiados al portapapeles`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 font-bold">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ¡Lote Registrado con Éxito!
            </DialogTitle>
            <DialogDescription>
              Se han creado <strong>{codes.length} unidades</strong> en el inventario listas para venta y control.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tarjeta de Resumen del Registro */}
            <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3.5 text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Producto:</span>
                <span className="font-bold text-foreground">{brand} {model}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Almacén / Sucursal:</span>
                <span className="font-extrabold text-blue-700 flex items-center gap-1.5 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200 text-xs">
                  <Building2 className="h-3.5 w-3.5" />
                  {branchName || "Sucursal Principal"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Cantidad registrada:</span>
                <Badge className="bg-emerald-600 text-white font-bold">{codes.length} {codes.length > 1 ? "unidades" : "unidad"}</Badge>
              </div>

              {salePrice && salePrice > 0 ? (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Precio de Venta Unitario:</span>
                  <span className="font-bold text-emerald-600 font-mono">{formatCurrency(salePrice)}</span>
                </div>
              ) : null}
            </div>

            {/* Lista de Códigos Creados */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Códigos Asignados ({codes.length}):
                </label>
                <Button variant="ghost" size="sm" onClick={handleCopyCodes} className="h-7 text-xs gap-1 font-semibold text-slate-600 hover:text-slate-900">
                  <Copy className="h-3.5 w-3.5" />
                  Copiar lista
                </Button>
              </div>
              <div className="max-h-36 overflow-y-auto bg-muted/40 p-2.5 rounded-xl border text-xs font-mono grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {codes.map((c, i) => (
                  <div key={i} className="bg-background px-2.5 py-1 rounded-lg border text-center font-bold text-slate-800 shadow-2xs">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 pt-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setIsDisplayCardsOpen(true)}
              className="w-full sm:w-auto flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 font-bold h-10 rounded-xl gap-2 text-xs"
            >
              <Sparkles className="h-4 w-4" />
              Imprimir Fichas de Vitrina
            </Button>
            <Button 
              className="w-full sm:w-auto flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 rounded-xl text-xs"
              onClick={() => onOpenChange(false)}
            >
              Aceptar y Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para generar Fichas de Exhibición del Lote recién registrado */}
      <DisplayCardsModal
        open={isDisplayCardsOpen}
        onOpenChange={setIsDisplayCardsOpen}
        units={codes.map((c, i) => ({
          id: i + 1,
          code: c,
          brand,
          model,
          type: _type,
          salePrice: salePrice || 0,
          branchName,
          specs,
        }))}
      />
    </>
  );
}


