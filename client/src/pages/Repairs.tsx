import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpecsCard } from "@/components/SpecsCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import {
  Wrench,
  CheckCircle,
  Clock,
  Plus,
  Search,
  Laptop,
  Shield,
  PackageOpen,
  CalendarClock,
  History,
  AlertCircle,
  Eye,
  X,
  Image as ImageIcon,
  Camera,
  Printer,
  FileText,
  Grid,
  List,
  DollarSign,
  Repeat,
  CheckCircle2,
  BadgeCent,
  ArrowRightLeft,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { WorkOrderModal } from "@/components/WorkOrderModal";

type ResolutionType = "return_to_customer" | "return_to_inventory";

const formatLongDateTime = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" })
    + " " + date.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
};

const formatShortDate = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function RepairDetailsDialog({
  open,
  onOpenChange,
  repair,
  onOpenWorkOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: any;
  onOpenWorkOrder?: (repairId?: number, unitId?: number) => void;
}) {
  // getById ahora devuelve Kardex completo — repairHistory, warrantyHistory, etc.
  const { data: unit, isLoading: loadingUnit } = trpc.units.getById.useQuery(
    { id: repair?.unitId },
    { enabled: open && !!repair?.unitId }
  );

  const events = unit?.events || [];
  // Usar el historial de OTs del Kardex
  const unitRepairs: any[] = (unit as any)?.repairHistory || [];
  const warrantyHistory: any[] = (unit as any)?.warrantyHistory || [];
  const activeWarranties = unit?.status === "available"
    ? []
    : warrantyHistory.filter((w: any) => w.status === "active");
  const unitPhotos: string[] = unit?.photos
    ? (typeof unit.photos === "string" ? JSON.parse(unit.photos) : unit.photos)
    : [];

  const batteryLabel: Record<string, string> = {
    "100": "100%",
    "90": "90%",
    "80": "80%",
    "70": "70%",
    "60": "60%",
    "50": "50%",
    "40": "40%",
    plugged_only: "Solo conectada",
    bad_plugged_only: "Solo conectada",
    good: "100%",
    fair: "70%",
    n_a: "N/A",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-primary" />
            Kardex del equipo — {unit?.brand} {unit?.model}
          </DialogTitle>
          <DialogDescription>
            {unit?.rmaNumber
              ? <span>RMA permanente: <strong className="font-mono">{unit.rmaNumber}</strong> · </span>
              : null}
            OT actual: <strong className="font-mono">{repair?.otNumber || repair?.rmaNumber || `#${repair?.id}`}</strong> · Código: {unit?.code || "—"}
          </DialogDescription>
        </DialogHeader>

        {loadingUnit ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando detalles…</div>
        ) : !unit ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No se encontró la unidad.</div>
        ) : (
          <div className="space-y-5 py-2">
            {/* === Sección 1: Datos del equipo === */}
            <section className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2 text-slate-700">
                <Laptop className="h-4 w-4" /> Datos del equipo
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <Field label="Código" value={unit.code} />
                <Field label="Marca" value={unit.brand} />
                <Field label="Modelo" value={unit.model} />
                <Field label="Tipo" value={unit.type === "laptop" ? "Laptop" : "Accesorio"} />
                <Field label="Condición" value={unit.condition ? `${unit.condition}/10` : "—"} />
                <Field label="Batería" value={batteryLabel[unit.batteryHealth] || unit.batteryHealth} />
                <Field label="Estado actual" value={unit.status} />
                <Field label="Precio venta" value={unit.salePrice != null ? formatCurrency(unit.salePrice / 100) : "—"} />
                <Field label="Precio compra" value={unit.purchasePrice != null ? formatCurrency(unit.purchasePrice / 100) : "—"} />
              </div>
              {unitPhotos.length > 0 && (
                <RepairUnitPhotoGallery photos={unitPhotos} />
              )}
              <SpecsCard
                specs={unit.specs}
                unitType={unit.type as any}
                serialNumber={unit.serialNumber}
                compact
              />
              {unit.damageNotes && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Notas de daño:</p>
                  <p className="text-xs bg-amber-50 border border-amber-200 p-2 rounded">{unit.damageNotes}</p>
                </div>
              )}
            </section>

            {/* === Sección 2: Códigos asignados === */}
            <section className="rounded-lg border bg-card p-4 space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2 text-slate-700">
                <PackageOpen className="h-4 w-4" /> Códigos asignados
              </h3>
              {unit.codeId ? (
                <div className="text-xs space-y-1">
                  <p><span className="text-muted-foreground">codeId interno:</span> <span className="font-mono">#{unit.codeId}</span></p>
                  <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                    La resolución del código QR/Barcode a texto se realiza en el inventario del equipo (módulo Unidades).
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin código QR/Barcode asignado.</p>
              )}
            </section>

            {/* === Sección 3: Garantía activa === */}
            <section className="rounded-lg border bg-card p-4 space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2 text-slate-700">
                <Shield className="h-4 w-4" /> Garantía
              </h3>
              {loadingUnit ? (
                <p className="text-xs text-muted-foreground">Cargando garantías…</p>
              ) : activeWarranties.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin garantías activas para esta unidad.</p>
              ) : (
                <div className="space-y-2">
                  {activeWarranties.map((w: any) => {
                    const end = new Date(w.endDate);
                    const daysLeft = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                    return (
                      <div key={w.id} className="text-xs bg-green-50 border border-green-200 p-2 rounded">
                        <p><strong>{w.days} días</strong> · inicia {formatShortDate(w.startDate)} · vence <strong>{formatLongDateTime(w.endDate)}</strong></p>
                        <p className="text-muted-foreground">{daysLeft > 0 ? `${daysLeft} día(s) restantes` : daysLeft === 0 ? "Vence hoy" : `Vencida hace ${Math.abs(daysLeft)} día(s)`}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* === Sección 4: Historial de Órdenes de Trabajo === */}
            <section className="rounded-lg border bg-card p-4 space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2 text-slate-700">
                <History className="h-4 w-4" /> Órdenes de Trabajo ({unitRepairs.length})
              </h3>
              {loadingUnit ? (
                <p className="text-xs text-muted-foreground">Cargando historial…</p>
              ) : unitRepairs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Esta unidad no tiene reparaciones previas.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {unitRepairs.map((r: any) => {
                    const isCurrent = r.id === repair?.id;
                    const otLabel = r.otNumber || r.rmaNumber || `#${r.id}`;
                    return (
                      <div
                        key={r.id}
                        className={`text-xs p-2 rounded border ${
                          isCurrent ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-[10px] border-blue-300 text-blue-700">
                              {otLabel}
                            </Badge>
                            {isCurrent && <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700">Actual</Badge>}
                            <Badge
                              variant={r.status === "completed" ? "default" : r.status === "in_progress" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {r.status === "in_progress" ? "En Proceso" : r.status === "completed" ? "Completado" : "Cancelado"}
                            </Badge>
                            {r.resolutionType && (
                              <Badge variant="outline" className="text-[10px]">
                                {r.resolutionType === "return_to_customer" ? "Devuelto al cliente" : "Retornado a inventario"}
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground">{formatLongDateTime(r.startDate)}</span>
                        </div>
                        {(r.laborCost || r.partsCost) && (
                          <p className="mt-1 text-muted-foreground">
                            M.O.: {formatCurrency(r.laborCost || 0)} · Repuestos: {formatCurrency(r.partsCost || 0)}
                          </p>
                        )}
                        {r.endDate && (
                          <p className="text-muted-foreground text-[10px]">Cerrada: {formatLongDateTime(r.endDate)}</p>
                        )}
                        {r.notes && <p className="mt-1 italic text-muted-foreground line-clamp-2">{r.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* === Sección 5: Timeline de eventos === */}
            <section className="rounded-lg border bg-card p-4 space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2 text-slate-700">
                <Clock className="h-4 w-4" /> Timeline de eventos ({events.length})
              </h3>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin eventos registrados para esta unidad.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {events.map((ev: any) => (
                    <div key={ev.id} className="text-xs border-l-2 border-slate-300 pl-3 py-1">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-semibold">{ev.eventType}</span>
                        <span className="text-muted-foreground">{formatLongDateTime(ev.createdAt)}</span>
                      </div>
                      {ev.fromStatus && ev.toStatus && (
                        <p className="text-muted-foreground">
                          {ev.fromStatus} → <span className="font-medium text-foreground">{ev.toStatus}</span>
                        </p>
                      )}
                      {ev.notes && <p className="text-muted-foreground italic mt-0.5">{ev.notes}</p>}
                      {ev.userName && <p className="text-muted-foreground text-[10px]">por {ev.userName}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <Button
            variant="default"
            className="gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold"
            onClick={() => {
              onOpenWorkOrder?.(repair?.id, repair?.unitId);
            }}
          >
            <Printer className="h-4 w-4" />
            Imprimir Orden de Trabajo (OT)
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function CompleteRepairDialog({
  open,
  onOpenChange,
  repair,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: any;
  onConfirm: (payload: {
    laborCost: number;
    partsCost: number;
    notes: string;
    resolutionType?: ResolutionType;
    extendWarrantyDays?: number;
    warrantyId?: number;
    customerResolution?: "refund" | "exchange" | "none";
    refundAmount?: number;
    refundPaymentMethod?: "cash" | "qr" | "transfer";
    replacementUnitId?: number;
    priceDifference?: number;
    differencePaymentMethod?: "cash" | "qr" | "transfer";
  }) => void;
  isPending: boolean;
}) {
  const [laborCost, setLaborCost] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [notes, setNotes] = useState("");
  const [resolutionType, setResolutionType] = useState<ResolutionType | null>(null);
  const [extendDays, setExtendDays] = useState(30);

  // Compensación al cliente cuando retorna a inventario de venta
  const [customerResolution, setCustomerResolution] = useState<"refund" | "exchange" | "none">("none");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<"cash" | "qr" | "transfer">("cash");
  const [replacementUnitId, setReplacementUnitId] = useState<number | null>(null);
  const [differencePaymentMethod, setDifferencePaymentMethod] = useState<"cash" | "qr" | "transfer">("cash");

  // Detección de 2do ingreso: otras repairs completadas para esta misma unidad
  const { data: completedHistory } = trpc.repairs.list.useQuery(
    {
      unitId: repair?.unitId,
      status: "completed" as any,
      limit: 100,
    },
    { enabled: open && !!repair?.unitId }
  );
  const otherCompleted = (completedHistory?.items || []).filter((r: any) => r.id !== repair?.id);
  const isSecondEntry = otherCompleted.length >= 1;

  // Garantía activa de la unidad
  const { data: warrantiesData } = trpc.warranties.list.useQuery(
    { unitId: repair?.unitId, status: "active" as any, limit: 5 },
    { enabled: open && !!repair?.unitId }
  );
  const activeWarranty = warrantiesData?.items?.[0] ?? null;

  // Unidades disponibles en stock para reemplazo / cambio
  const { data: availableUnitsData } = trpc.units.list.useQuery(
    { status: "available", limit: 100 },
    { enabled: open }
  );
  const availableUnits = (availableUnitsData?.items || []).filter((u: any) => u.id !== repair?.unitId);

  // Cálculo de precios para cambio de equipo
  const selectedReplacementUnit = availableUnits.find((u: any) => u.id === replacementUnitId) || null;
  const originalPriceCents = repair?.unitSalePrice || 0;
  const replacementPriceCents = selectedReplacementUnit?.salePrice || 0;
  const priceDiffCents = selectedReplacementUnit ? replacementPriceCents - originalPriceCents : 0;

  // Resetear al abrir (preseleccionar return_to_inventory por defecto)
  useEffect(() => {
    if (open) {
      setLaborCost("");
      setPartsCost("");
      setNotes("");
      setResolutionType("return_to_inventory");
      setExtendDays(30);
      setCustomerResolution("none");
      const unitSalePrice = repair?.unitSalePrice || 0;
      setRefundAmount(unitSalePrice > 0 ? (unitSalePrice / 100).toFixed(2) : "");
      setRefundPaymentMethod("cash");
      setReplacementUnitId(null);
      setDifferencePaymentMethod("cash");
    }
  }, [open, repair]);

  const formatLongDate = (d: Date) =>
    d.toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" });

  const newWarrantyEndDate = activeWarranty && extendDays > 0
    ? new Date(
        new Date(activeWarranty.endDate).getTime() + extendDays * 24 * 60 * 60 * 1000
      )
    : null;

  const handleConfirm = () => {
    if (!resolutionType) {
      toast.error("Elige una opción de resolución antes de confirmar");
      return;
    }
    const laborCents = laborCost ? Math.round(parseFloat(laborCost) * 100) : 0;
    const partsCents = partsCost ? Math.round(parseFloat(partsCost) * 100) : 0;

    let refundCents: number | undefined = undefined;
    if (resolutionType === "return_to_inventory" && customerResolution === "refund") {
      const amt = parseFloat(refundAmount);
      if (isNaN(amt) || amt <= 0) {
        toast.error("Por favor ingresa un monto válido a devolver al cliente");
        return;
      }
      refundCents = Math.round(amt * 100);
    }

    if (resolutionType === "return_to_inventory" && customerResolution === "exchange") {
      if (!replacementUnitId) {
        toast.error("Por favor selecciona el equipo disponible que se entregará al cliente");
        return;
      }
    }

    onConfirm({
      laborCost: laborCents,
      partsCost: partsCents,
      notes,
      resolutionType,
      extendWarrantyDays: resolutionType === "return_to_customer" ? extendDays : undefined,
      warrantyId: resolutionType === "return_to_customer" && activeWarranty ? activeWarranty.id : undefined,
      customerResolution: resolutionType === "return_to_inventory" ? customerResolution : undefined,
      refundAmount: refundCents,
      refundPaymentMethod: customerResolution === "refund" ? refundPaymentMethod : undefined,
      replacementUnitId: customerResolution === "exchange" ? (replacementUnitId ?? undefined) : undefined,
      priceDifference: customerResolution === "exchange" ? priceDiffCents : undefined,
      differencePaymentMethod: customerResolution === "exchange" && priceDiffCents !== 0 ? differencePaymentMethod : undefined,
    });
  };

  const rmaLabel = repair?.otNumber || repair?.rmaNumber || (repair?.id ? `#${repair.id}` : "");

  const confirmLabel = !resolutionType
    ? "Confirmar cierre"
    : resolutionType === "return_to_customer"
    ? "✅ Confirmar: Ya Reparada → Devolver al Cliente"
    : "✅ Confirmar: Ya Reparada → Retornar a Inventario (Disponible)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-emerald-800 text-lg font-bold">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Finalizar Reparación — Orden {rmaLabel}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">
              {repair?.unitBrand} {repair?.unitModel}
            </span>
            <span>•</span>
            <span>Código: <strong className="text-slate-700">{repair?.unitCode}</strong></span>
            {repair?.unitSalePrice ? (
              <>
                <span>•</span>
                <span>Precio Venta Orig.: <strong className="text-emerald-700">{formatCurrency(repair.unitSalePrice)}</strong></span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* 1. Costos y notas técnicas */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <BadgeCent className="h-3.5 w-3.5 text-slate-500" />
              1. Costos y Observaciones de Taller
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1 block">Costo Mano de Obra (Bs):</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="0.00"
                  className="h-9 bg-white"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1 block">Costo Repuestos (Bs):</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={partsCost}
                  onChange={(e) => setPartsCost(e.target.value)}
                  placeholder="0.00"
                  className="h-9 bg-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1 block">Notas del técnico / Diagnóstico final:</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalle de trabajos realizados, componentes reparados o cambiados..."
                className="min-h-[60px] text-xs bg-white"
              />
            </div>
          </div>

          {/* 2. Destino del equipo */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <PackageOpen className="h-3.5 w-3.5 text-slate-500" />
              2. Destino del Equipo Reparado
            </div>

            {isSecondEntry && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <History className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <strong className="font-semibold">Reingreso previo detectado:</strong> Este equipo ya tuvo {otherCompleted.length} reparación(es) previa(s). Si los problemas persisten, considera la <em>Opción B</em> para retornar el equipo a stock y compensar al cliente.
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Opción A */}
              <div
                onClick={() => setResolutionType("return_to_customer")}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  resolutionType === "return_to_customer"
                    ? "border-emerald-600 bg-emerald-50/40 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="resolution_choice"
                    checked={resolutionType === "return_to_customer"}
                    onChange={() => setResolutionType("return_to_customer")}
                    className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                      <Shield className="h-4 w-4 text-emerald-700" />
                      Opción A — Devolver al cliente (Equipo Reparado)
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      El cliente se lleva el mismo equipo. La unidad se mantiene como Vendida y la garantía continúa activa.
                    </p>

                    {resolutionType === "return_to_customer" && (
                      <div className="mt-3 pt-3 border-t border-emerald-200/80 space-y-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-emerald-700" />
                          <Label className="text-xs font-semibold text-slate-700">Extender garantía en días:</Label>
                          <Input
                            type="number"
                            min={0}
                            max={365}
                            value={extendDays}
                            onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                            className="h-8 w-24 bg-white"
                          />
                          <span className="text-xs text-slate-500">(compensación por tiempo en taller)</span>
                        </div>
                        {activeWarranty && newWarrantyEndDate ? (
                          <div className="text-xs text-slate-600 bg-white p-2.5 rounded-md border border-emerald-200 space-y-1">
                            <div><strong>Vencimiento actual:</strong> {formatLongDate(new Date(activeWarranty.endDate))} ({activeWarranty.days} días)</div>
                            <div>
                              <strong>Con extensión (+{extendDays} días):</strong>{" "}
                              <span className="text-emerald-700 font-bold">{formatLongDate(newWarrantyEndDate)}</span> ({activeWarranty.days + extendDays} días totales)
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" /> No se encontró garantía activa registrada para este equipo.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opción B */}
              <div
                onClick={() => setResolutionType("return_to_inventory")}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  resolutionType === "return_to_inventory"
                    ? "border-blue-600 bg-blue-50/30 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="resolution_choice"
                    checked={resolutionType === "return_to_inventory"}
                    onChange={() => setResolutionType("return_to_inventory")}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                      <PackageOpen className="h-4 w-4 text-blue-700" />
                      Opción B — Retornar a inventario (Disponible para la venta)
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      El equipo reparado regresa al stock disponible de la tienda. La garantía anterior del cliente se da por concluida.
                    </p>

                    {resolutionType === "return_to_inventory" && (
                      <div className="mt-4 pt-4 border-t border-blue-200 space-y-3 cursor-default" onClick={(e) => e.stopPropagation()}>
                        <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                          <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />
                          ¿Cómo se compensa al cliente?:
                        </div>

                        {/* Selector de tipo de compensación */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* 1. Devolución de dinero */}
                          <div
                            onClick={() => setCustomerResolution("refund")}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                              customerResolution === "refund"
                                ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>Devolución de Dinero</span>
                            </div>
                            <span className="text-[11px] text-slate-500 mt-1">Egreso de caja al cliente</span>
                          </div>

                          {/* 2. Cambio por otro equipo */}
                          <div
                            onClick={() => setCustomerResolution("exchange")}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                              customerResolution === "exchange"
                                ? "border-indigo-500 bg-indigo-50 text-indigo-950 shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <Repeat className="h-4 w-4 text-indigo-600 shrink-0" />
                              <span>Cambio de Equipo</span>
                            </div>
                            <span className="text-[11px] text-slate-500 mt-1">Entregar otro del stock</span>
                          </div>

                          {/* 3. Ya resuelto / Sin movimiento */}
                          <div
                            onClick={() => setCustomerResolution("none")}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                              customerResolution === "none"
                                ? "border-slate-600 bg-slate-100 text-slate-900 shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <CheckCircle2 className="h-4 w-4 text-slate-600 shrink-0" />
                              <span>Ya compensado en RMA</span>
                            </div>
                            <span className="text-[11px] text-slate-500 mt-1">Sin movimiento de dinero</span>
                          </div>
                        </div>

                        {/* Sub-formulario: Reembolso */}
                        {customerResolution === "refund" && (
                          <div className="p-3.5 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs font-bold text-emerald-900 mb-1 block">Monto a reembolsar (Bs):</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={refundAmount}
                                  onChange={(e) => setRefundAmount(e.target.value)}
                                  placeholder="0.00"
                                  className="h-9 text-sm font-bold text-emerald-900 bg-white border-emerald-300"
                                />
                              </div>
                              <div>
                                <Label className="text-xs font-bold text-emerald-900 mb-1 block">Caja de egreso:</Label>
                                <Select value={refundPaymentMethod} onValueChange={(v: any) => setRefundPaymentMethod(v)}>
                                  <SelectTrigger className="h-9 text-xs bg-white border-emerald-300">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cash">Efectivo (Caja Física)</SelectItem>
                                    <SelectItem value="qr">QR Simple / Banco</SelectItem>
                                    <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <p className="text-[11px] text-emerald-800 flex items-center gap-1">
                              💡 Se registrará automáticamente un <strong>Egreso de Caja</strong> y un <strong>Gasto Operativo</strong> por este importe.
                            </p>
                          </div>
                        )}

                        {/* Sub-formulario: Cambio de equipo */}
                        {customerResolution === "exchange" && (
                          <div className="p-3.5 bg-indigo-50/90 border border-indigo-300 rounded-xl space-y-3">
                            <div>
                              <Label className="text-xs font-bold text-indigo-950 mb-1 block">
                                Seleccionar equipo sustituto del inventario disponible:
                              </Label>
                              {availableUnits.length === 0 ? (
                                <p className="text-xs text-amber-700 bg-white p-2 rounded border border-amber-200">
                                  No hay otras unidades en estado disponible actualmente en el inventario.
                                </p>
                              ) : (
                                <Select
                                  value={replacementUnitId ? String(replacementUnitId) : ""}
                                  onValueChange={(v) => setReplacementUnitId(Number(v))}
                                >
                                  <SelectTrigger className="h-9 text-xs bg-white border-indigo-300">
                                    <SelectValue placeholder="Selecciona el equipo a entregar al cliente..." />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {availableUnits.map((u: any) => (
                                      <SelectItem key={u.id} value={String(u.id)}>
                                        {u.code} — {u.brand} {u.model} ({formatCurrency(u.salePrice)})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            {selectedReplacementUnit && (
                              <div className="p-3 bg-white rounded-lg border border-indigo-200 text-xs space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-slate-600 pb-2 border-b">
                                  <div>Equipo original: <span className="font-semibold text-slate-800">{formatCurrency(originalPriceCents)}</span></div>
                                  <div>Equipo nuevo ({selectedReplacementUnit.code}): <span className="font-semibold text-slate-800">{formatCurrency(selectedReplacementUnit.salePrice)}</span></div>
                                </div>

                                <div className="flex items-center justify-between font-bold text-xs pt-1">
                                  <span>Diferencia comercial:</span>
                                  <span className={priceDiffCents > 0 ? "text-emerald-700 font-bold" : priceDiffCents < 0 ? "text-red-600 font-bold" : "text-slate-700"}>
                                    {priceDiffCents > 0
                                      ? `+Bs. ${(priceDiffCents / 100).toFixed(2)} (Cliente PAGA la diferencia)`
                                      : priceDiffCents < 0
                                      ? `-Bs. ${(Math.abs(priceDiffCents) / 100).toFixed(2)} (Tienda REEMBOLSA la diferencia)`
                                      : "Bs. 0.00 (Mismo valor - sin diferencia)"}
                                  </span>
                                </div>

                                {priceDiffCents !== 0 && (
                                  <div className="pt-2 flex items-center gap-2">
                                    <Label className="text-xs font-medium text-slate-700 shrink-0">Caja para diferencia:</Label>
                                    <Select value={differencePaymentMethod} onValueChange={(v: any) => setDifferencePaymentMethod(v)}>
                                      <SelectTrigger className="h-8 text-xs bg-slate-50 flex-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="cash">Efectivo</SelectItem>
                                        <SelectItem value="qr">QR Simple</SelectItem>
                                        <SelectItem value="transfer">Transferencia</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                <p className="text-[11px] text-indigo-800 pt-1">
                                  💡 El nuevo equipo pasará a <strong>Vendido</strong> y se le generará una <strong>nueva garantía</strong> transferida al cliente.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-formulario: Sin compensación ahora */}
                        {customerResolution === "none" && (
                          <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] text-slate-600 border border-slate-200 flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-slate-500 shrink-0" />
                            <span>No se realizarán egresos ni ingresos de caja. Útil si la compensación ya fue tramitada o convenida en RMA/Devoluciones.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !resolutionType}
            className={resolutionType === "return_to_customer" ? "bg-emerald-700 hover:bg-emerald-800 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
          >
            {isPending ? "Procesando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Repairs() {
  const utils = trpc.useUtils();
  const { activeBranchId } = useBranch();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [unitCodeInput, setUnitCodeInput] = useState("");
  const [foundUnit, setFoundUnit] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [partsCost, setPartsCost] = useState("");

  // Dialog de cierre
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<any>(null);

  // Buscador y modal de detalles
  const [searchTerm, setSearchTerm] = useState("");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailRepair, setDetailRepair] = useState<any>(null);

  // Modal de Orden de Trabajo (OT)
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [selectedWorkOrderRepairId, setSelectedWorkOrderRepairId] = useState<number | null>(null);
  const [selectedWorkOrderUnitId, setSelectedWorkOrderUnitId] = useState<number | null>(null);

  const handleOpenWorkOrder = (repairId?: number, unitId?: number) => {
    setSelectedWorkOrderRepairId(repairId || null);
    setSelectedWorkOrderUnitId(unitId || null);
    setWorkOrderModalOpen(true);
  };

  const { data: repairsData, isLoading, refetch } = trpc.repairs.list.useQuery({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    search: searchTerm.trim() || undefined,
    branchId: activeBranchId || undefined,
  });

  const { data: usersData } = trpc.users.listDeliveryPersons.useQuery();

  const codeLookupQuery = trpc.units.getByCode.useQuery(
    { code: unitCodeInput },
    { enabled: false }
  );

  const createRepairMutation = trpc.repairs.create.useMutation({
    onSuccess: (res: any) => {
      toast.success("✅ Orden de reparación creada");
      setIsNewDialogOpen(false);
      if (res?.repairId) {
        setSelectedWorkOrderRepairId(res.repairId);
      } else if (foundUnit?.id) {
        setSelectedWorkOrderUnitId(foundUnit.id);
      }
      setWorkOrderModalOpen(true);
      setFoundUnit(null);
      setUnitCodeInput("");
      setNotes("");
      setLaborCost("");
      setPartsCost("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRepairMutation = trpc.repairs.update.useMutation({
    onSuccess: () => {
      toast.success("✅ Reparación finalizada correctamente");
      setIsCompleteOpen(false);
      setSelectedRepair(null);
      refetch();
      utils.repairs.invalidate();
      utils.units.invalidate();
      utils.warranties.invalidate();
      (utils.finance as any)?.getGlobalBalances?.invalidate?.();
      (utils.stats as any)?.getProfitability?.invalidate?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleLookupUnit = async () => {
    if (!unitCodeInput.trim()) return;
    const res = await codeLookupQuery.refetch();
    if (res.data?.found && res.data.unit) {
      if (res.data.unit.type !== "laptop") {
        toast.error("El taller solo aplica a laptops");
        return;
      }
      setFoundUnit(res.data.unit);
      toast.success(`Laptop encontrada: ${res.data.unit.brand} ${res.data.unit.model}`);
    } else {
      toast.error("Unidad no encontrada con ese código");
    }
  };

  const handleCreateRepair = () => {
    if (!foundUnit) {
      toast.error("Busca y selecciona una laptop primero");
      return;
    }

    const laborCents = laborCost ? Math.round(parseFloat(laborCost) * 100) : 0;
    const partsCents = partsCost ? Math.round(parseFloat(partsCost) * 100) : 0;

    createRepairMutation.mutate({
      unitId: foundUnit.id,
      notes,
      laborCost: laborCents,
      partsCost: partsCents,
    });
  };

  const handleOpenComplete = (rep: any) => {
    setSelectedRepair(rep);
    setIsCompleteOpen(true);
  };

  const handleOpenDetails = (rep: any) => {
    setDetailRepair(rep);
    setIsDetailsOpen(true);
  };

  const handleConfirmComplete = (payload: {
    laborCost: number;
    partsCost: number;
    notes: string;
    resolutionType?: ResolutionType;
    extendWarrantyDays?: number;
    warrantyId?: number;
    customerResolution?: "refund" | "exchange" | "none";
    refundAmount?: number;
    refundPaymentMethod?: "cash" | "qr" | "transfer";
    replacementUnitId?: number;
    priceDifference?: number;
    differencePaymentMethod?: "cash" | "qr" | "transfer";
  }) => {
    updateRepairMutation.mutate({
      id: selectedRepair.id,
      status: "completed",
      targetUnitStatus: payload.resolutionType === "return_to_inventory" ? "available" : "sold",
      laborCost: payload.laborCost,
      partsCost: payload.partsCost,
      notes: payload.notes || undefined,
      resolutionType: payload.resolutionType,
      extendWarrantyDays: payload.extendWarrantyDays,
      warrantyId: payload.warrantyId,
      customerResolution: payload.customerResolution,
      refundAmount: payload.refundAmount,
      refundPaymentMethod: payload.refundPaymentMethod,
      replacementUnitId: payload.replacementUnitId,
      priceDifference: payload.priceDifference,
      differencePaymentMethod: payload.differencePaymentMethod,
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary" />
            Taller y Servicio Técnico (Laptops)
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de reparación, diagnóstico y reacondicionamiento técnico.
          </p>
        </div>

        <Button onClick={() => setIsNewDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva Orden de Taller
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por RMA, modelo, código, QR, barcode o fecha (dd/mm/aaaa)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm("")}
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Estado de Reparación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las órdenes</SelectItem>
            <SelectItem value="in_progress">En Proceso</SelectItem>
            <SelectItem value="completed">Completadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        {/* Toggle vista */}
        <div className="flex rounded-md border overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"}`}
            title="Vista tarjetas"
          >
            <Grid className="h-4 w-4" />
            <span className="hidden sm:inline">Tarjetas</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"}`}
            title="Vista lista"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
      </div>

      {/* Lista de Reparaciones */}
      {isLoading ? (
        <div>Cargando taller...</div>
      ) : !repairsData?.items || repairsData.items.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent>
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <h3 className="text-lg font-semibold">No hay reparaciones en registro</h3>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        /* ── VISTA LISTA ────────────────────────────────────────── */
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">OT / RMA</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Equipo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Técnico / Falla</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Fechas</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Costos</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Estado</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {repairsData.items.map((ot: any) => {
                const otLabel = ot.otNumber || `OT-#${ot.id}`;
                const totalCost = (ot.laborCost || 0) + (ot.partsCost || 0);
                return (
                  <tr key={ot.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="font-mono text-[10px] border-blue-300 text-blue-700 bg-blue-50 w-fit">
                          {otLabel}
                        </Badge>
                        {(ot.unitRmaNumber || ot.rmaNumber) && (
                          <Badge variant="outline" className="font-mono text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 w-fit">
                            {ot.unitRmaNumber || ot.rmaNumber}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{ot.unitBrand} {ot.unitModel}</p>
                      {ot.unitCode && <p className="text-[11px] text-slate-400 font-mono">{ot.unitCode}</p>}
                      {ot.unitSerialNumber && <p className="text-[11px] text-slate-400">S/N: {ot.unitSerialNumber}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      {ot.technicianName && (
                        <p className="text-xs font-medium text-slate-700 mb-0.5">
                          <span className="text-slate-400">Técnico:</span> {ot.technicianName}
                        </p>
                      )}
                      {ot.notes && (
                        <p className="text-xs text-slate-500 line-clamp-2">{ot.notes}</p>
                      )}
                      {ot.reportedIssue && (
                        <p className="text-xs text-slate-500 line-clamp-2">{ot.reportedIssue}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      <p>Inicio: {ot.startDate ? new Date(ot.startDate).toLocaleDateString("es-BO") : "—"}</p>
                      <p>Fin: {ot.endDate ? new Date(ot.endDate).toLocaleDateString("es-BO") : "en curso"}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {totalCost > 0 ? (
                        <div className="text-xs">
                          <p className="text-slate-500">M.O.: {formatCurrency(ot.laborCost || 0)}</p>
                          <p className="text-slate-500">Rep.: {formatCurrency(ot.partsCost || 0)}</p>
                          <p className="font-bold text-slate-800">{formatCurrency(totalCost)}</p>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={ot.status === "completed" ? "default" : ot.status === "in_progress" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {ot.status === "in_progress" ? "En Proceso" : ot.status === "completed" ? "Completado" : "Cancelado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => handleOpenWorkOrder(ot.id, ot.unitId)}
                        >
                          <Printer className="h-3 w-3" /> OT
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] gap-1"
                          onClick={() => handleOpenDetails(ot)}
                        >
                          <Eye className="h-3 w-3" /> Kardex
                        </Button>
                        {ot.status === "in_progress" && (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            onClick={() => handleOpenComplete(ot)}
                          >
                            <CheckCircle className="h-3 w-3" /> Finalizar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── VISTA TARJETAS ──────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(() => {
            // ── Agrupar OTs por unitId ──────────────────────────────────────
            const grouped = new Map<number, any[]>();
            for (const rep of repairsData.items) {
              const existing = grouped.get(rep.unitId) || [];
              existing.push(rep);
              grouped.set(rep.unitId, existing);
            }

            return Array.from(grouped.entries()).map(([unitId, unitOTs]) => {
              // Ordenar OTs cronológicamente (la más reciente al inicio)
              const sortedOTs = [...unitOTs].sort((a, b) =>
                new Date(b.startDate || b.createdAt).getTime() -
                new Date(a.startDate || a.createdAt).getTime()
              );

              // La OT activa es la que está en progreso (si existe)
              const activeOT = sortedOTs.find((r) => r.status === "in_progress");
              // Representante del equipo: OT más reciente
              const latestOT = sortedOTs[0];
              const unitRma = latestOT.unitRmaNumber || latestOT.rmaNumber;

              // Estado del equipo: en progreso si hay alguna activa
              const equipoStatus = activeOT ? "in_progress"
                : sortedOTs.every((r) => r.status === "cancelled") ? "cancelled"
                : "completed";

              return (
                <Card key={unitId} className="hover:shadow-md transition-shadow flex flex-col">
                  {/* ── Encabezado del equipo ──────────────────────────── */}
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      {/* RMA permanente del equipo */}
                      {unitRma && (
                        <Badge variant="outline" className="font-mono text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
                          {unitRma}
                        </Badge>
                      )}
                      <CardTitle className="text-base font-bold truncate">
                        {latestOT.unitBrand} {latestOT.unitModel}
                      </CardTitle>
                      {latestOT.unitCode && (
                        <p className="text-[10px] text-slate-400 font-mono">{latestOT.unitCode}</p>
                      )}
                    </div>
                    {/* Estado global del equipo */}
                    <Badge
                      variant={
                        equipoStatus === "completed" ? "default"
                        : equipoStatus === "in_progress" ? "destructive"
                        : "secondary"
                      }
                      className="shrink-0 ml-2"
                    >
                      {equipoStatus === "in_progress" ? "En Taller"
                        : equipoStatus === "completed" ? "Completado"
                        : "Cancelado"}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-3 flex-1">
                    {/* ── Lista de OTs del equipo ────────────────────────── */}
                    <div className="space-y-2">
                      {sortedOTs.map((ot, idx) => {
                        const otLabel = ot.otNumber || `OT-#${ot.id}`;
                        const isActive = ot.status === "in_progress";
                        const isFirst = idx === 0;

                        return (
                          <div
                            key={ot.id}
                            className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                              isActive
                                ? "border-red-200 bg-red-50/40"
                                : "border-slate-100 bg-slate-50/50"
                            }`}
                          >
                            {/* Número de OT + estado */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] border-blue-300 text-blue-700 bg-blue-50"
                              >
                                {otLabel}
                              </Badge>
                              <Badge
                                variant={
                                  ot.status === "completed" ? "default"
                                  : ot.status === "in_progress" ? "destructive"
                                  : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {ot.status === "in_progress" ? "En Proceso"
                                  : ot.status === "completed" ? "Completado"
                                  : "Cancelado"}
                              </Badge>
                              {/* Fechas */}
                              <span className="text-[10px] text-slate-400 ml-auto">
                                {ot.startDate
                                  ? new Date(ot.startDate).toLocaleDateString("es-BO")
                                  : "—"}
                                {ot.endDate
                                  ? ` → ${new Date(ot.endDate).toLocaleDateString("es-BO")}`
                                  : " (en curso)"}
                              </span>
                            </div>

                            {/* Técnico */}
                            {ot.technicianName && (
                              <p className="text-muted-foreground">
                                Técnico: <span className="font-medium text-foreground">{ot.technicianName}</span>
                              </p>
                            )}

                            {/* Notas */}
                            {ot.notes && (
                              <p className="text-muted-foreground bg-white/60 px-2 py-1 rounded border border-slate-100 line-clamp-2">
                                {ot.notes}
                              </p>
                            )}

                            {/* Costos (solo si > 0) */}
                            {((ot.laborCost || 0) + (ot.partsCost || 0)) > 0 && (
                              <div className="flex justify-between text-[10px] text-muted-foreground border-t pt-1.5 mt-1">
                                <span>M.O.: {formatCurrency(ot.laborCost || 0)}</span>
                                <span>Repuestos: {formatCurrency(ot.partsCost || 0)}</span>
                              </div>
                            )}

                            {/* Botón Imprimir OT individual */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-1.5 h-7 text-[11px] font-bold border-blue-200 text-blue-700 bg-white hover:bg-blue-50 hover:border-blue-300 mt-1.5"
                              onClick={() => handleOpenWorkOrder(ot.id, ot.unitId)}
                            >
                              <Printer className="h-3.5 w-3.5 text-blue-600" />
                              Imprimir OT ({otLabel})
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Acciones (solo si hay OT activa) ──────────────── */}
                    {activeOT && (
                      <div className="space-y-2 pt-1 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-bold bg-blue-50/50"
                          onClick={() => handleOpenWorkOrder(activeOT.id, activeOT.unitId)}
                        >
                          <Printer className="h-4 w-4 text-blue-600" /> Imprimir OT de Ingreso
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => handleOpenDetails(activeOT)}
                        >
                          <Eye className="h-4 w-4" /> Ver Kardex del equipo
                        </Button>
                        <Button
                          size="sm"
                          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                          onClick={() => handleOpenComplete(activeOT)}
                        >
                          <CheckCircle className="h-4 w-4" /> ✅ Marcar como YA REPARADA / Finalizar ({activeOT.otNumber || `#${activeOT.id}`})
                        </Button>
                      </div>
                    )}

                    {/* Si no hay OT activa, solo mostrar Kardex */}
                    {!activeOT && (
                      <div className="space-y-2 pt-1 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
                          onClick={() => handleOpenWorkOrder(sortedOTs[0]?.id, sortedOTs[0]?.unitId)}
                        >
                          <Printer className="h-4 w-4 text-blue-600" /> Imprimir Última OT
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => handleOpenDetails(sortedOTs[0])}
                        >
                          <Eye className="h-4 w-4" /> Ver Kardex del equipo
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>
      )}

      {/* Modal Nueva Reparación */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Nueva Orden de Trabajo (OT) — Ingreso a Taller
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registra el ingreso del equipo a servicio técnico. Se generará automáticamente el comprobante en PDF con formato Carta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold block mb-1">Escanear o escribir Código de Laptop:</label>
              <div className="flex gap-2">
                <Input
                  value={unitCodeInput}
                  onChange={(e) => setUnitCodeInput(e.target.value)}
                  placeholder="ej. LT-0001"
                  onKeyDown={(e) => e.key === "Enter" && handleLookupUnit()}
                />
                <Button variant="secondary" onClick={handleLookupUnit}>
                  <Search className="h-4 w-4 mr-1" /> Buscar
                </Button>
              </div>
            </div>

            {foundUnit && (
              <div className="bg-blue-50/80 p-3 rounded-xl text-xs space-y-1 border border-blue-200 text-slate-800">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-blue-900">{foundUnit.brand} {foundUnit.model}</p>
                  <Badge variant="outline" className="font-mono text-xs border-blue-300 text-blue-700 bg-white">
                    {foundUnit.code}
                  </Badge>
                </div>
                {foundUnit.serialNumber && (
                  <p className="text-[11px] text-slate-500 font-mono">S/N: {foundUnit.serialNumber}</p>
                )}
                {foundUnit.specs && (
                  <p className="text-[11px] text-slate-600">
                    {typeof foundUnit.specs === "string" ? foundUnit.specs : `${foundUnit.specs.cpu || ""} ${foundUnit.specs.ram || ""} ${foundUnit.specs.storage || ""}`.trim()}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold block mb-1">Motivo de Ingreso / Falla Reportada por el Cliente *:</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describa el problema reportado (ej: no enciende, cambio de pantalla, teclado con fallas, mantenimiento térmico)..."
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold block mb-1">Costo Estimado Mano de Obra (Bs):</label>
                <Input
                  type="number"
                  step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Costo Estimado Repuestos (Bs):</label>
                <Input
                  type="number"
                  step="0.01"
                  value={partsCost}
                  onChange={(e) => setPartsCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateRepair}
              disabled={!foundUnit || createRepairMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2"
            >
              <Wrench className="h-4 w-4" />
              {createRepairMutation.isPending ? "Ingresando..." : "Ingresar a Taller y Generar OT"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Finalizar Reparación (con flujo bifucardo) */}
      <CompleteRepairDialog
        open={isCompleteOpen}
        onOpenChange={setIsCompleteOpen}
        repair={selectedRepair}
        onConfirm={handleConfirmComplete}
        isPending={updateRepairMutation.isPending}
      />

      {/* Modal Detalles del Equipo */}
      <RepairDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        repair={detailRepair}
        onOpenWorkOrder={handleOpenWorkOrder}
      />

      {/* Modal Oficial de Orden de Trabajo (Formato Carta / PDF) */}
      <WorkOrderModal
        open={workOrderModalOpen}
        onOpenChange={setWorkOrderModalOpen}
        repairId={selectedWorkOrderRepairId}
        unitId={selectedWorkOrderUnitId}
      />
    </div>
  );
}

/* ─── Galería de fotos del equipo (en el modal de detalle de taller) ─── */
function RepairUnitPhotoGallery({ photos }: { photos: string[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  if (!photos || photos.length === 0) return null;
  return (
    <div className="pt-3 border-t">
      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5" /> Fotos del equipo ({photos.length})
      </p>
      <div className="rounded-lg overflow-hidden bg-black flex items-center justify-center h-56 border">
        <img
          src={photos[activeIdx]}
          alt={`Foto ${activeIdx + 1} del equipo`}
          className="w-full h-full object-contain cursor-zoom-in"
          onClick={() => setLightboxOpen(true)}
        />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2">
          {photos.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all ${
                i === activeIdx ? "border-blue-500 scale-105" : "border-transparent hover:border-blue-300"
              }`}
            >
              <img src={p} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl bg-black/95 border-slate-700 p-2">
          <img
            src={photos[activeIdx]}
            alt={`Foto ${activeIdx + 1} del equipo`}
            className="w-full h-auto max-h-[85vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
