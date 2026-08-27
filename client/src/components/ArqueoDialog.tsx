import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { AlertTriangle, Calculator, UserX } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { generateArqueoPDF, downloadPDF } from "@/utils/pdfReports";

const BILLS = [200, 100, 50, 20, 10];
const COINS = [5, 2, 1, 0.5, 0.2, 0.1];

export function ArqueoDialog({
  expectedCash,
  expectedQr,
  expectedTransfer,
  disabled,
  branchName,
  companyConfig,
  openingAmount,
  cashSales,
  cashPurchases,
  otherExpenses,
}: {
  expectedCash: number;
  expectedQr: number;
  expectedTransfer: number;
  disabled?: boolean;
  branchName?: string;
  companyConfig?: any;
  openingAmount?: number;
  cashSales?: number;
  cashPurchases?: number;
  otherExpenses?: number;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reportedQr, setReportedQr] = useState<number>(0);
  const [reportedTransfer, setReportedTransfer] = useState<number>(0);
  const [observation, setObservation] = useState<string>("");

  const utils = trpc.useContext();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: deliveryStatus } = trpc.finance.getDeliveryOpenBoxStatus.useQuery(undefined, {
    enabled: open,
  });

  const getLocalDateInputValue = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
  };

  const calculateTotalCash = () => {
    // If user pressed "Completar monto total", we stored a direct_total key
    if ("direct_total" in counts) {
      return (counts["direct_total"] || 0) * 100; // already in Bs, convert to cents
    }
    let total = 0;
    Object.entries(counts).forEach(([denomination, qty]) => {
      total += parseFloat(denomination) * qty;
    });
    return total * 100; // Convert to cents
  };

  const totalReportedCash = calculateTotalCash();
  const cashDifference = totalReportedCash - Math.abs(expectedCash);
  const qrDifference = (reportedQr * 100) - Math.abs(expectedQr);
  const transferDifference = (reportedTransfer * 100) - Math.abs(expectedTransfer);

  const pendingDeliveries = (deliveryStatus as any)?.deliveryUsers?.filter((u: any) => u.hasOpenBox) ?? [];

  const mutation = trpc.finance.submitClosure.useMutation({
    onSuccess: () => {
      toast.success("Cierre de caja procesado exitosamente.");
      
      const today = getLocalDateInputValue();
      const nowTime = new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });

      const pdfData = {
        date: today,
        userName: user?.name || user?.username || "Usuario",
        branchName: branchName || "Principal",
        closingDate: today,
        closingTime: nowTime,
        // Ingresos
        openingAmount: openingAmount ?? 0,
        cashSales: cashSales ?? expectedCash,
        creditCollections: 0,
        otherIncome: 0,
        // Egresos
        cashPurchases: cashPurchases ?? 0,
        creditPayments: 0,
        otherExpenses: otherExpenses ?? 0,
        // Medios de pago
        totalCash: expectedCash,
        totalQr: expectedQr,
        totalReceipt: cashSales ?? 0,
        // Cuadre
        expectedCash,
        reportedCash: totalReportedCash,
        expectedQr,
        reportedQr: Math.round(reportedQr * 100),
        expectedTransfer,
        reportedTransfer: Math.round(reportedTransfer * 100),
        // Observación
        observation,
      };
      
      try {
        const doc = generateArqueoPDF(pdfData, companyConfig);
        downloadPDF(doc, `Arqueo_Caja_${pdfData.date}.pdf`);
      } catch (err) {
        console.error("Error generando PDF", err);
        toast.error("Cierre procesado, pero falló la generación del PDF.");
      }

      setOpen(false);
      setCounts({});
      setReportedQr(0);
      setReportedTransfer(0);
      setObservation("");
      utils.finance.getTransactions.invalidate();
      utils.finance.listAllClosures.invalidate();
      utils.finance.getCashOpenings.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Error al procesar el cierre");
    }
  });

  const handleProcessClosure = () => {
    mutation.mutate({
      date: getLocalDateInputValue(),
      initialCash: Math.round(openingAmount ?? 0),
      reportedCash: totalReportedCash,
      reportedQr: Math.round(reportedQr * 100),
      reportedTransfer: Math.round(reportedTransfer * 100),
      expectedCash: expectedCash,
      expectedQr: expectedQr,
      expectedTransfer: expectedTransfer,
      expenses: Math.round((cashPurchases ?? 0) + (otherExpenses ?? 0)),
    });
  };



  const handleCountChange = (denom: number, val: string) => {
    const parsed = parseInt(val, 10);
    setCounts(prev => {
      const next = { ...prev };
      delete next["direct_total"];
      next[denom.toString()] = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      return next;
    });
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-orange-600 hover:bg-orange-700 h-10 px-4" disabled={disabled}>
          <Calculator className="h-4 w-4" /> Arqueo y Cierre
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Arqueo y Cierre de Caja</DialogTitle>
          <DialogDescription>
            Cuenta y declara tu efectivo (Billetaje), así como los reportes de QR y Cuenta Bancaria.
          </DialogDescription>
        </DialogHeader>

        {/* ── ALERTA REPARTIDORES CON CAJA ABIERTA ──────────────────────── */}
        {pendingDeliveries.length > 0 && (
          <div className="flex gap-3 items-start p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="text-sm font-bold">⚠️ Repartidores con caja aún abierta:</p>
              <ul className="text-xs space-y-0.5">
                {pendingDeliveries.map((u: any) => (
                  <li key={u.userId} className="flex items-center gap-1.5">
                    <UserX className="h-3.5 w-3.5 text-amber-600" />
                    <span className="font-semibold">{u.name}</span>
                    <span className="text-amber-700">— pendiente de entregar su caja</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700 mt-1">
                Puedes cerrar tu caja principal, pero recuerda solicitar la entrega a estos repartidores.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Calculadora de Billetes y Monedas */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b pb-2">Calculadora de Billetaje</h3>

            {/* Botón para completar automáticamente el monto total esperado */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-800">Completar monto total</p>
                <p className="text-[10px] text-emerald-600">Registra directamente el monto esperado por el sistema sin contar billetaje</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-emerald-400 text-emerald-700 hover:bg-emerald-100 text-xs h-8 px-3"
                onClick={() => {
                  // Clear bill counts and set a special "direct entry" flag using a large denomination placeholder
                  // We use 1 Bs coin count to set the total: expectedCash / 100 (in Bs)
                  setCounts({ "direct_total": Math.round(Math.abs(expectedCash) / 100) });
                }}
              >
                Usar total: {formatCurrency(Math.abs(expectedCash))}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">

              <div className="bg-slate-50 p-2 rounded border space-y-2">
                <p className="font-bold text-center text-slate-600">Billetes (Bs)</p>
                {BILLS.map(denom => (
                  <div key={denom} className="flex items-center gap-2">
                    <Label className="w-10 text-right">{denom}</Label>
                    <span>x</span>
                    <Input 
                      type="number" 
                      className="h-7 text-xs" 
                      min="0"
                      value={counts[denom.toString()] || ""} 
                      onChange={(e) => handleCountChange(denom, e.target.value)} 
                    />
                    <div className="w-16 text-right font-mono font-medium text-slate-500">
                      {(denom * (counts[denom.toString()] || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 p-2 rounded border space-y-2">
                <p className="font-bold text-center text-slate-600">Monedas (Bs)</p>
                {COINS.map(denom => (
                  <div key={denom} className="flex items-center gap-2">
                    <Label className="w-10 text-right">{denom}</Label>
                    <span>x</span>
                    <Input 
                      type="number" 
                      className="h-7 text-xs" 
                      min="0"
                      step="1"
                      value={counts[denom.toString()] || ""} 
                      onChange={(e) => handleCountChange(denom, e.target.value)} 
                    />
                    <div className="w-16 text-right font-mono font-medium text-slate-500">
                      {(denom * (counts[denom.toString()] || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {"direct_total" in counts ? (
              <div className="bg-emerald-100 p-3 rounded-lg border border-emerald-300 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-800 uppercase">Monto Completado</p>
                  <button
                    type="button"
                    className="text-[10px] text-emerald-700 underline hover:text-emerald-900"
                    onClick={() => setCounts({})}
                  >
                    Usar billetaje
                  </button>
                </div>
                <p className="text-2xl font-black text-emerald-900">{formatCurrency(totalReportedCash)}</p>
                <p className="text-[10px] text-emerald-600">Monto ingresado directamente sin contar billetaje</p>
              </div>
            ) : (
              <div className="bg-orange-100 p-3 rounded-lg border border-orange-200">
                <p className="text-xs font-bold text-orange-800 uppercase">Total Billetaje Contado</p>
                <p className="text-2xl font-black text-orange-900">{formatCurrency(totalReportedCash)}</p>
              </div>
            )}
          </div>

          {/* Cuadre del Sistema */}
          <div className="space-y-4">
             <h3 className="font-bold text-sm text-slate-800 border-b pb-2">Cuadre del Sistema</h3>
             
             <div className="space-y-3">
               <div className="flex flex-col gap-1">
                 <Label className="text-xs font-bold">1. Caja Efectivo</Label>
                 <div className="flex justify-between items-center bg-slate-50 border p-2 rounded text-sm mb-1">
                   <span className="text-muted-foreground">Esperado Sist:</span>
                   <span className="font-mono font-bold">{formatCurrency(expectedCash)}</span>
                 </div>
                 {cashDifference < 0 ? (
                   <div className="flex justify-between items-center p-2 rounded text-sm border bg-red-50 border-red-200">
                     <span className="text-red-800 font-bold">Faltante:</span>
                     <span className="font-mono font-bold text-red-600">
                       {formatCurrency(Math.abs(cashDifference))}
                     </span>
                   </div>
                 ) : cashDifference > 0 ? (
                   <div className="flex justify-between items-center p-2 rounded text-sm border bg-blue-50 border-blue-200">
                     <span className="text-blue-800 font-bold">Sobrante:</span>
                     <span className="font-mono font-bold text-blue-600">
                       {formatCurrency(cashDifference)}
                     </span>
                   </div>
                 ) : (
                   <div className="flex justify-between items-center p-2 rounded text-sm border bg-green-50 border-green-200">
                     <span className="text-green-800 font-bold">Estado:</span>
                     <span className="font-mono font-bold text-green-600">CUADRADO (OK)</span>
                   </div>
                 )}
               </div>

               <Separator />

               <div className="flex flex-col gap-1">
                 <Label className="text-xs font-bold">2. Caja QR</Label>
                 <div className="flex justify-between items-center text-sm mb-1">
                   <span className="text-muted-foreground">Total Reportado:</span>
                   <Input 
                     type="number" 
                     className="w-24 h-7 text-right" 
                     value={reportedQr || ""}
                     onChange={(e) => setReportedQr(parseFloat(e.target.value) || 0)}
                   />
                 </div>
                 <div className="flex justify-between items-center bg-slate-50 border p-2 rounded text-sm">
                   <span className="text-muted-foreground">Esperado Sist:</span>
                   <span className="font-mono font-bold">{formatCurrency(expectedQr)}</span>
                 </div>
                 <div className="flex justify-between text-xs px-2 py-1">
                   <span className="font-medium">Resultado:</span>
                   {qrDifference < 0 ? (
                     <span className="text-red-600 font-bold">Faltante: {formatCurrency(Math.abs(qrDifference))}</span>
                   ) : qrDifference > 0 ? (
                     <span className="text-blue-600 font-bold">Sobrante: {formatCurrency(qrDifference)}</span>
                   ) : (
                     <span className="text-green-600 font-bold">CUADRADO</span>
                   )}
                 </div>
               </div>

               <div className="flex flex-col gap-1">
                 <Label className="text-xs font-bold">3. Cuenta Bancaria</Label>
                 <div className="flex justify-between items-center text-sm mb-1">
                   <span className="text-muted-foreground">Total Reportado:</span>
                   <Input 
                     type="number" 
                     className="w-24 h-7 text-right" 
                     value={reportedTransfer || ""}
                     onChange={(e) => setReportedTransfer(parseFloat(e.target.value) || 0)}
                   />
                 </div>
                 <div className="flex justify-between items-center bg-slate-50 border p-2 rounded text-sm">
                   <span className="text-muted-foreground">Esperado Sist:</span>
                   <span className="font-mono font-bold">{formatCurrency(expectedTransfer)}</span>
                 </div>
                 <div className="flex justify-between text-xs px-2 py-1">
                   <span className="font-medium">Resultado:</span>
                   {transferDifference < 0 ? (
                     <span className="text-red-600 font-bold">Faltante: {formatCurrency(Math.abs(transferDifference))}</span>
                   ) : transferDifference > 0 ? (
                     <span className="text-blue-600 font-bold">Sobrante: {formatCurrency(transferDifference)}</span>
                   ) : (
                     <span className="text-green-600 font-bold">CUADRADO</span>
                   )}
                 </div>
               </div>
               
             </div>
          </div>
        </div>

        {/* ── OBSERVACIÓN ───────────────────────────────────────────────── */}
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs font-bold text-slate-700">Observación / Motivo de descuadre</Label>
          <Textarea
            className="text-xs min-h-[60px] resize-none"
            placeholder="Ej: Faltante por vuelto incorrecto en venta #32, sobrante por..."
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
          />
        </div>

        <Button 
          className="w-full mt-2 bg-slate-900 hover:bg-slate-800 font-bold" 
          size="lg"
          onClick={handleProcessClosure}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "PROCESANDO..." : "PROCESAR CIERRE DE CAJA"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
