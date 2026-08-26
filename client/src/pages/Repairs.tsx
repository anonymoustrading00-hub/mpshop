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
  const activeWarranties = warrantyHistory.filter((w: any) => w.status === "active");
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
                            M.O.: {formatCurrency((r.laborCost || 0) / 100)} · Repuestos: {formatCurrency((r.partsCost || 0) / 100)}
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
  }) => void;
  isPending: boolean;
}) {
  const [laborCost, setLaborCost] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [notes, setNotes] = useState("");
  const [resolutionType, setResolutionType] = useState<ResolutionType | null>(null);
  const [extendDays, setExtendDays] = useState(30);

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

  // Resetear al abrir (preseleccionar return_to_inventory por defecto)
  useEffect(() => {
    if (open) {
      setLaborCost("");
      setPartsCost("");
      setNotes("");
      setResolutionType("return_to_inventory");
      setExtendDays(30);
    }
  }, [open]);

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
    onConfirm({
      laborCost: laborCents,
      partsCost: partsCents,
      notes,
      resolutionType,
      extendWarrantyDays: resolutionType === "return_to_customer" ? extendDays : undefined,
      warrantyId: resolutionType === "return_to_customer" && activeWarranty ? activeWarranty.id : undefined,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700 font-bold">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
            Marcar como YA REPARADA — Orden {rmaLabel}
          </DialogTitle>
          <DialogDescription>
            {repair?.unitBrand} {repair?.unitModel} · Código {repair?.unitCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Costos y notas (siempre se muestran) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Costo Mano de Obra (Bs):</Label>
              <Input
                type="number"
                step="0.01"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Costo Repuestos (Bs):</Label>
              <Input
                type="number"
                step="0.01"
                value={partsCost}
                onChange={(e) => setPartsCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Notas del técnico al cierre (opcional):</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Repuestos cambiados, diagnóstico final, observaciones..."
              className="min-h-[70px]"
            />
          </div>

          {/* === BLOQUE DE RESOLUCIÓN: siempre visible al cerrar === */}
          <div className={`rounded-lg border-2 p-4 space-y-3 ${isSecondEntry ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-slate-50/40"}`}>
            {isSecondEntry && (
              <div className="flex items-start gap-2">
                <History className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-900">Esta unidad ya tuvo reparaciones previas</h4>
                  <p className="text-xs text-amber-800">
                    Se detectaron {otherCompleted.length} reparación(es) completada(s) anteriores. Elegí la resolución final:
                  </p>
                </div>
              </div>
            )}

            <RadioGroup
              value={resolutionType ?? ""}
              onValueChange={(v) => setResolutionType(v as ResolutionType)}
              className="space-y-2"
            >
              <div className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all min-h-[64px] ${resolutionType === "return_to_customer" ? "border-green-500 bg-green-50" : "border-slate-200 bg-white hover:border-green-200"}`}>
                <RadioGroupItem value="return_to_customer" id="complete-opt-a" className="mt-1" />
                <Label htmlFor="complete-opt-a" className="cursor-pointer flex-1 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-green-900">
                    <Shield className="h-4 w-4" /> Opción A — Devolver al cliente
                  </div>
                  <p className="text-xs text-slate-600">
                    El equipo se devuelve al cliente. La unidad mantiene su estado actual.
                  </p>
                  {resolutionType === "return_to_customer" && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-green-700" />
                        <Label className="text-xs font-semibold">Días a extender:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={extendDays}
                          onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                          className="h-8 w-24"
                        />
                        <span className="text-xs text-muted-foreground">(default 30)</span>
                      </div>
                      {activeWarranty && newWarrantyEndDate ? (
                        <div className="text-xs text-slate-600 bg-white/60 p-2 rounded space-y-1">
                          <p><strong>Garantía actual:</strong> {activeWarranty.days} días, vence el{" "}
                            {formatLongDate(new Date(activeWarranty.endDate))}.
                          </p>
                          <p><strong>Con extensión de {extendDays} días:</strong> {activeWarranty.days + extendDays} días, vence el{" "}
                            <span className="text-green-700 font-semibold">{formatLongDate(newWarrantyEndDate)}</span>.
                          </p>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-700 bg-amber-100/60 p-2 rounded flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> No hay garantía activa para esta unidad.
                        </div>
                      )}
                    </div>
                  )}
                </Label>
              </div>

              <div className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all min-h-[64px] ${resolutionType === "return_to_inventory" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"}`}>
                <RadioGroupItem value="return_to_inventory" id="complete-opt-b" className="mt-1" />
                <Label htmlFor="complete-opt-b" className="cursor-pointer flex-1 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-blue-900">
                    <PackageOpen className="h-4 w-4" /> Opción B — Retornar al inventario de venta
                  </div>
                  <p className="text-xs text-slate-600">
                    La unidad regresa al inventario como Disponible para una nueva venta.
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !resolutionType}>
            {isPending ? "Finalizando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Repairs() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
      toast.success("Reparación finalizada");
      setIsCompleteOpen(false);
      setSelectedRepair(null);
      refetch();
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
      toast.error("Debes seleccionar una laptop válida");
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
  }) => {
    updateRepairMutation.mutate({
      id: selectedRepair.id,
      status: "completed",
      // El backend decide el estado final de la unidad a partir de resolutionType
      // (return_to_inventory -> available, return_to_customer -> mantiene estado actual).
      targetUnitStatus: payload.resolutionType === "return_to_inventory" ? "available" : "sold",
      laborCost: payload.laborCost,
      partsCost: payload.partsCost,
      notes: payload.notes || undefined,
      resolutionType: payload.resolutionType,
      extendWarrantyDays: payload.extendWarrantyDays,
      warrantyId: payload.warrantyId,
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
      ) : (
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
                                <span>M.O.: {formatCurrency(ot.laborCost / 100)}</span>
                                <span>Repuestos: {formatCurrency(ot.partsCost / 100)}</span>
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
