import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RefreshCw, Plus, Search, AlertCircle, Wrench, Wallet, QrCode, Landmark, DollarSign, ShieldCheck, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export default function Returns() {
  const utils = trpc.useUtils();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [unitCodeInput, setUnitCodeInput] = useState("");
  const [foundUnit, setFoundUnit] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("");
  const [reenterRepair, setReenterRepair] = useState(true);

  // Reembolso de dinero
  const [doRefund, setDoRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<"cash" | "qr" | "transfer">("cash");

  const { data: returnsData, isLoading, refetch } = trpc.returns.list.useQuery();

  const codeLookupQuery = trpc.units.getByCode.useQuery(
    { code: unitCodeInput },
    { enabled: false }
  );

  const { data: warrantiesData } = trpc.warranties.list.useQuery(
    { unitId: foundUnit?.id, status: "active" as any, limit: 5 },
    { enabled: !!foundUnit }
  );
  const activeWarranty = warrantiesData?.items?.[0] ?? null;

  // Saldos de cajas para mostrar disponibilidad
  const { data: globalBalances } = (trpc.finance as any).getGlobalBalances.useQuery();

  const createReturnMutation = trpc.returns.create.useMutation({
    onSuccess: () => {
      const msg = reenterRepair
        ? doRefund
          ? "Devolución registrada: Unidad ingresó a taller y se procesó el reembolso de caja."
          : "Devolución registrada. La unidad ingresó a Taller y la garantía fue pausada."
        : doRefund
        ? "Devolución registrada. Reembolso de caja procesado y garantía marcada como reclamada."
        : "Devolución registrada correctamente.";
      toast.success(msg);
      closeDialog();
      refetch();
      utils.returns.invalidate();
      utils.units.invalidate();
      utils.warranties.invalidate();
      utils.repairs.invalidate();
      (utils.finance as any)?.getGlobalBalances?.invalidate?.();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setFoundUnit(null);
    setUnitCodeInput("");
    setReason("");
    setResolution("");
    setReenterRepair(true);
    setDoRefund(false);
    setRefundAmount("");
    setRefundPaymentMethod("cash");
  };

  const handleLookup = async () => {
    if (!unitCodeInput.trim()) return;
    const res = await codeLookupQuery.refetch();
    if (res.data?.found && res.data.unit) {
      setFoundUnit(res.data.unit);
      // Pre-fill refund amount with sale price if available
      if (res.data.unit.salePrice) {
        setRefundAmount((res.data.unit.salePrice / 100).toFixed(2));
      }
      toast.success(`Unidad encontrada: ${res.data.unit.brand} ${res.data.unit.model}`);
    } else {
      toast.error("Código no encontrado");
    }
  };

  const handleCreateReturn = () => {
    if (!foundUnit) { toast.error("Selecciona una unidad válida"); return; }
    if (!reason.trim()) { toast.error("Ingresa el motivo de devolución"); return; }
    if (doRefund) {
      const amt = parseFloat(refundAmount);
      if (isNaN(amt) || amt <= 0) { toast.error("Ingresa un monto de reembolso válido"); return; }
    }

    const refundCents = (doRefund && refundAmount)
      ? Math.round(parseFloat(refundAmount) * 100)
      : undefined;

    createReturnMutation.mutate({
      unitId: foundUnit.id,
      warrantyId: activeWarranty?.id,
      reason,
      resolution,
      reenteredRepair: reenterRepair,
      refundAmount: refundCents,
      refundPaymentMethod: doRefund ? refundPaymentMethod : undefined,
    });
  };

  // Balance for selected refund method
  const selectedBalance =
    refundPaymentMethod === "cash" ? (globalBalances?.cash ?? 0) :
    refundPaymentMethod === "qr" ? (globalBalances?.qr ?? 0) :
    (globalBalances?.transfer ?? 0);

  const refundCents = refundAmount ? Math.round(parseFloat(refundAmount) * 100) : 0;
  const isInsufficient = doRefund && refundCents > 0 && selectedBalance < refundCents;

  const BOX_CONFIG = [
    { method: "cash", label: "Efectivo", icon: Wallet, color: "emerald", balance: globalBalances?.cash ?? 0 },
    { method: "qr", label: "QR", icon: QrCode, color: "blue", balance: globalBalances?.qr ?? 0 },
    { method: "transfer", label: "Banco", icon: Landmark, color: "purple", balance: globalBalances?.transfer ?? 0 },
  ] as const;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RefreshCw className="h-7 w-7 text-primary" />
            Devoluciones y RMA
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro de equipos devueltos, reingresos a taller y reembolsos al cliente.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Registrar Devolución (RMA)
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Cargando devoluciones...</div>
      ) : !returnsData?.items || returnsData.items.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent>
            <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <h3 className="text-lg font-semibold">No hay devoluciones registradas</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {returnsData.items.map((ret: any) => (
            <Card key={ret.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <Badge variant="outline" className="font-mono text-xs">{ret.unitCode}</Badge>
                  <CardTitle className="text-base font-bold">{ret.unitBrand} {ret.unitModel}</CardTitle>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {ret.reenteredRepair ? (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <Wrench className="h-3 w-3" /> Taller
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Devuelto</Badge>
                  )}
                  {ret.refundAmount > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] gap-1">
                      <DollarSign className="h-2.5 w-2.5" /> Reembolso
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block font-semibold">Motivo:</span>
                  <p className="text-xs bg-muted p-2 rounded">{ret.reason}</p>
                </div>
                {ret.refundAmount > 0 && (
                  <div className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 p-2 rounded">
                    <span className="font-semibold text-amber-800">Reembolso entregado:</span>
                    <span className="font-black text-amber-900">{formatCurrency(ret.refundAmount)}</span>
                  </div>
                )}
                {ret.resolution && (
                  <div>
                    <span className="text-xs text-muted-foreground font-semibold">Resolución:</span>
                    <p className="text-xs">{ret.resolution}</p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground border-t pt-2">
                  {new Date(ret.returnDate).toLocaleString("es-BO")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Registrar Devolución (RMA)
            </DialogTitle>
            <DialogDescription>
              Registra la devolución del equipo. Elige si va a taller o si se le devuelve el dinero al cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Buscar unidad */}
            <div>
              <Label className="text-xs font-semibold block mb-1">Escanear o escribir Código de Unidad:</Label>
              <div className="flex gap-2">
                <Input
                  value={unitCodeInput}
                  onChange={(e) => setUnitCodeInput(e.target.value)}
                  placeholder="ej. LT-0001 ó escanear QR"
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                />
                <Button variant="secondary" onClick={handleLookup} className="shrink-0">
                  <Search className="h-4 w-4 mr-1" /> Buscar
                </Button>
              </div>
            </div>

            {/* Info de la unidad encontrada */}
            {foundUnit && (
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 space-y-1.5 text-sm">
                <p className="font-bold text-slate-800">{foundUnit.brand} {foundUnit.model}</p>
                <p className="text-xs text-muted-foreground">
                  Código: <span className="font-mono font-bold">{foundUnit.code}</span> · Estado: {foundUnit.status}
                </p>
                {foundUnit.salePrice && (
                  <p className="text-xs text-slate-600">
                    Precio de venta: <span className="font-bold">{formatCurrency(foundUnit.salePrice)}</span>
                  </p>
                )}
                {activeWarranty ? (
                  <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-200">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    Garantía activa: {activeWarranty.daysLeft ?? activeWarranty.days} días restantes · vence {new Date(activeWarranty.endDate).toLocaleDateString("es-BO")}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Sin garantía activa — procesando como RMA sin garantía
                  </div>
                )}
              </div>
            )}

            {/* Motivo */}
            <div>
              <Label className="text-xs font-semibold block mb-1">Motivo de la devolución *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Pantalla parpadea, tecla no responde, equipo no enciende..."
                className="min-h-[70px]"
              />
            </div>

            {/* Resolución */}
            <div>
              <Label className="text-xs font-semibold block mb-1">Resolución sugerida (opcional)</Label>
              <Input
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Cambio de pantalla / Reembolso / Reparación..."
              />
            </div>

            {/* Opciones de resolución */}
            <div className="space-y-3 rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">¿Qué ocurre con el equipo?</p>

              {/* Opción A: reingresa a taller */}
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${reenterRepair ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"}`}
                onClick={() => setReenterRepair(true)}
              >
                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${reenterRepair ? "border-blue-500 bg-blue-500" : "border-slate-300"}`}>
                  {reenterRepair && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" /> Reingresar a Taller
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">El equipo entra al taller para reparación o revisión técnica.</p>
                </div>
              </div>

              {/* Opción B: devolución directa (sin taller) */}
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${!reenterRepair ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-200"}`}
                onClick={() => setReenterRepair(false)}
              >
                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${!reenterRepair ? "border-amber-500 bg-amber-500" : "border-slate-300"}`}>
                  {!reenterRepair && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                    <PackageOpen className="h-3.5 w-3.5" /> Devolución directa (sin taller)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">El equipo se devuelve directamente sin abrir orden de taller.</p>
                </div>
              </div>

              {/* Opción de Reembolso de Dinero al Cliente (Válido para ambos casos) */}
              <div className="pt-2 border-t border-slate-200">
                <div
                  className="flex items-center gap-2 cursor-pointer p-1"
                  onClick={() => setDoRefund(!doRefund)}
                >
                  <Checkbox checked={doRefund} onCheckedChange={(c) => setDoRefund(!!c)} />
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    Devolver dinero al cliente inmediatamente (Egreso de Caja)
                  </span>
                </div>

                {doRefund && (
                  <div className="mt-3 space-y-3 p-3 bg-white rounded-xl border border-emerald-200">
                    {/* Selector de caja con saldos */}
                    <div>
                      <Label className="text-xs font-semibold mb-1 block text-slate-700">Seleccionar Caja de Egreso:</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {BOX_CONFIG.map((box) => (
                          <button
                            key={box.method}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRefundPaymentMethod(box.method); }}
                            className={`flex flex-col items-start gap-1 p-2 rounded-xl border-2 text-left transition-all ${
                              refundPaymentMethod === box.method
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <box.icon className={`h-3.5 w-3.5 ${refundPaymentMethod === box.method ? "text-emerald-600" : "text-slate-400"}`} />
                              <span className="text-[10px] font-black uppercase tracking-wide">{box.label}</span>
                            </div>
                            <p className={`text-xs font-black tabular-nums ${box.balance > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                              {formatCurrency(box.balance)}
                            </p>
                            <p className="text-[9px] text-slate-400">disponible</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Monto a reembolsar */}
                    <div>
                      <Label className="text-xs font-semibold">Monto a reembolsar (Bs)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder="0.00"
                        className="mt-1 h-10"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Aviso saldo insuficiente */}
                    {isInsufficient && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Saldo insuficiente en {BOX_CONFIG.find(b => b.method === refundPaymentMethod)?.label}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={handleCreateReturn}
              disabled={!foundUnit || !reason.trim() || createReturnMutation.isPending || isInsufficient}
              className={reenterRepair ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}
            >
              {createReturnMutation.isPending
                ? "Procesando..."
                : reenterRepair
                ? "Enviar a Taller"
                : doRefund
                ? `Devolver ${refundAmount ? `Bs. ${refundAmount}` : "dinero"} al cliente`
                : "Registrar Devolución"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
