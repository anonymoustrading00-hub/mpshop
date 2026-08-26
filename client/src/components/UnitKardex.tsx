/**
 * UnitKardex — Historia completa de una unidad (equipo)
 *
 * Muestra en un modal o panel todo el ciclo de vida del equipo:
 *  • Datos del equipo + RMA permanente + código de barras
 *  • Compra original
 *  • Órdenes de Trabajo (OTs) en taller
 *  • Ventas
 *  • Garantías
 *  • Devoluciones
 *  • Timeline de eventos (unitEvents)
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
  QrCode, Wrench, ShoppingBag, Shield, Package, Clock, DollarSign,
  CheckCircle2, AlertTriangle, RotateCcw, X, Printer, Laptop,
  Smartphone, Tablet, Monitor, Plug, Box, ExternalLink, Play, Video,
  FileText, Share2,
} from "lucide-react";
import { CommercialSheetModal } from "@/components/CommercialSheetModal";
import { WorkOrderModal } from "@/components/WorkOrderModal";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(d: any): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + date.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: any): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  in_diagnosis: "En Diagnóstico",
  in_repair: "En Taller",
  available: "Disponible",
  sold: "Vendida",
  returned: "Devuelta (RMA)",
};

const STATUS_COLOR: Record<string, string> = {
  in_diagnosis: "border-amber-300 text-amber-700 bg-amber-50",
  in_repair: "border-red-300 text-red-700 bg-red-50",
  available: "border-green-300 text-green-700 bg-green-50",
  sold: "border-slate-300 text-slate-600 bg-slate-50",
  returned: "border-purple-300 text-purple-700 bg-purple-50",
};

const TYPE_ICON: Record<string, any> = {
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  monitor: Monitor,
  charger: Plug,
  accessory: Box,
  other: Box,
};

function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="p-1.5 rounded-lg bg-slate-100">
        <Icon className="h-4 w-4 text-slate-600" />
      </div>
      <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide">{title}</h3>
      {count !== undefined && (
        <Badge variant="outline" className="text-[10px] ml-auto">{count}</Badge>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface UnitKardexProps {
  unitId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnitKardex({ unitId, open, onOpenChange }: UnitKardexProps) {
  const [isCommercialSheetOpen, setIsCommercialSheetOpen] = useState(false);
  const [isWorkOrderOpen, setIsWorkOrderOpen] = useState(false);
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);

  const { data: unit, isLoading } = trpc.units.getById.useQuery(
    { id: unitId! },
    { enabled: open && !!unitId }
  );

  const TypeIcon = TYPE_ICON[(unit as any)?.type || "other"] || Box;
  const repairHistory: any[] = (unit as any)?.repairHistory || [];
  const warrantyHistory: any[] = (unit as any)?.warrantyHistory || [];
  const returnHistory: any[] = (unit as any)?.returnHistory || [];
  const saleHistory: any[] = (unit as any)?.saleHistory || [];
  const purchaseRecord: any = (unit as any)?.purchaseRecord || null;
  const events: any[] = (unit as any)?.events || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !w-full !max-w-none !h-full
        sm:!inset-auto sm:!top-[50%] sm:!left-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%]
        sm:!h-[95vh] sm:!max-w-4xl flex flex-col p-0 overflow-hidden rounded-none sm:rounded-[1.5rem]
        border-none sm:border bg-white">

        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-2xl bg-white/10 shrink-0">
                <TypeIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black tracking-tight truncate">
                    {(unit as any)?.brand} {(unit as any)?.model}
                  </h2>
                  {(unit as any)?.status && (
                    <Badge variant="outline" className={`text-[10px] font-black border ${STATUS_COLOR[(unit as any).status] || ""}`}>
                      {STATUS_LABEL[(unit as any).status] || (unit as any).status}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {/* Código de barras físico */}
                  <div className="flex items-center gap-1">
                    <QrCode className="h-3 w-3 text-slate-400" />
                    <span className="text-xs font-mono text-slate-300">{(unit as any)?.code || "—"}</span>
                  </div>
                  {/* RMA permanente */}
                  {(unit as any)?.rmaNumber && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">RMA:</span>
                      <span className="text-xs font-mono font-black text-emerald-400">{(unit as any).rmaNumber}</span>
                    </div>
                  )}
                  {/* Serial */}
                  {(unit as any)?.serialNumber && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">S/N:</span>
                      <span className="text-xs font-mono text-slate-300">{(unit as any).serialNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(repairHistory.length > 0 || (unit as any)?.status === "in_repair" || (unit as any)?.status === "in_diagnosis") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/10 gap-1.5 h-8 text-xs font-bold bg-amber-600/30 hover:bg-amber-600/50"
                  onClick={() => {
                    setSelectedRepairId(null);
                    setIsWorkOrderOpen(true);
                  }}
                >
                  <Wrench className="h-3.5 w-3.5 text-amber-300" /> Orden de Trabajo
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10 gap-1.5 h-8 text-xs font-bold bg-blue-600/30 hover:bg-blue-600/50"
                onClick={() => setIsCommercialSheetOpen(true)}
              >
                <FileText className="h-3.5 w-3.5 text-blue-300" /> Ficha Comercial
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 gap-1.5 h-8 text-xs" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/30">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-slate-900 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando Kardex...</p>
            </div>
          ) : !unit ? (
            <div className="py-20 text-center text-slate-400">Unidad no encontrada</div>
          ) : (
            <>
              {/* ── 1. Datos del Equipo ─────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <SectionHeader icon={TypeIcon} title="Datos del Equipo" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <Field label="Tipo" value={(unit as any).type?.toUpperCase()} />
                  <Field label="Marca" value={(unit as any).brand} />
                  <Field label="Modelo" value={(unit as any).model} />
                  {(unit as any).serialNumber && (
                    <Field label="Serial / IMEI" value={(unit as any).serialNumber} mono />
                  )}
                  {(unit as any).condition && (
                    <Field label="Condición Estética" value={`${(unit as any).condition}/10`} />
                  )}
                  {(unit as any).batteryHealth && (unit as any).batteryHealth !== "n_a" && (
                    <Field label="Estado Batería" value={
                      ({
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
                      } as Record<string, string>)[(unit as any).batteryHealth] || `${(unit as any).batteryHealth}%`
                    } />
                  )}
                  {/* ── Fechas de control de tiempos ──────────────────────── */}
                  {(() => {
                    // Fecha de compra: purchaseDate (campo de la unidad) →
                    // orderDate del purchaseRecord → createdAt de la unidad
                    const u = unit as any;
                    const compraDate =
                      u.purchaseDate ||
                      purchaseRecord?.orderDate ||
                      u.createdAt;

                    // Fecha de ingreso al sistema (evento "created")
                    const eventsArr: any[] = u.events || [];
                    const createdEvent = eventsArr.find((e: any) => e.eventType === "created");

                    // Fecha disponible: último evento donde el equipo quedó en "available"
                    const availableEvent = [...eventsArr]
                      .filter((e: any) => e.toStatus === "available")
                      .sort((a: any, b: any) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )[0];

                    // Si está disponible actualmente y nunca hubo evento available,
                    // el status actual es available (quizá fue directo sin pasar por taller)
                    const isCurrentlyAvailable = u.status === "available";

                    // Días en inventario desde la compra hasta hoy o hasta que se vendió
                    const vendidoEvent = [...eventsArr]
                      .filter((e: any) => e.toStatus === "sold")
                      .sort((a: any, b: any) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )[0];

                    const refStart = compraDate ? new Date(
                      typeof compraDate === "string" && compraDate.length === 10
                        ? compraDate + "T12:00:00" // fuerza mediodía para evitar offset UTC
                        : compraDate
                    ) : null;
                    const refEnd = vendidoEvent
                      ? new Date(vendidoEvent.createdAt)
                      : new Date();

                    const diasInventario = refStart
                      ? Math.max(0, Math.floor((refEnd.getTime() - refStart.getTime()) / 86400000))
                      : null;

                    return (
                      <>
                        {compraDate && (
                          <Field
                            label="📅 Fecha de Compra"
                            value={fmtDate(
                              typeof compraDate === "string" && compraDate.length === 10
                                ? compraDate + "T12:00:00"
                                : compraDate
                            )}
                          />
                        )}
                        {(availableEvent || isCurrentlyAvailable) && (
                          <Field
                            label="✅ Fecha Disponible"
                            value={fmtDate(
                              availableEvent?.createdAt ||
                              createdEvent?.createdAt ||
                              (unit as any).createdAt
                            )}
                          />
                        )}
                        {vendidoEvent && (
                          <Field
                            label="🛒 Fecha de Venta"
                            value={fmtDate(vendidoEvent.createdAt)}
                          />
                        )}
                        {diasInventario !== null && (
                          <div className="col-span-2 sm:col-span-3">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                              diasInventario <= 7
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : diasInventario <= 30
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-red-50 text-red-700 border border-red-100"
                            }`}>
                              <span className="text-base">⏱</span>
                              <span>
                                {u.status === "sold"
                                  ? `Estuvo ${diasInventario} días en inventario antes de venderse`
                                  : `${diasInventario} días en inventario desde la compra`}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {/* Precios */}
                  {(unit as any).purchasePrice > 0 && (
                    <Field label="Precio de Compra" value={formatCurrency((unit as any).purchasePrice)} />
                  )}
                  {(unit as any).salePrice > 0 && (
                    <Field label="Precio de Venta" value={formatCurrency((unit as any).salePrice)} />
                  )}
                  {(unit as any).discountPrice > 0 && (
                    <Field label="Precio Descuento" value={formatCurrency((unit as any).discountPrice)} />
                  )}
                  {(unit as any).wholesalePrice > 0 && (
                    <Field label="Precio Mayor" value={formatCurrency((unit as any).wholesalePrice)} />
                  )}
                  {/* Ganancia estimada */}
                  {(unit as any).purchasePrice > 0 && (unit as any).salePrice > 0 && (
                    <div className="col-span-2 sm:col-span-3 mt-1">
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div>
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Ganancia Estimada</p>
                          <p className="text-base font-black text-emerald-700">
                            {formatCurrency((unit as any).salePrice - (unit as any).purchasePrice)}
                          </p>
                        </div>
                        <div className={`ml-auto px-2.5 py-1 rounded-full text-[10px] font-black ${
                          (((unit as any).salePrice - (unit as any).purchasePrice) / (unit as any).purchasePrice) >= 0.15
                            ? "bg-emerald-100 text-emerald-700"
                            : (((unit as any).salePrice - (unit as any).purchasePrice) / (unit as any).purchasePrice) >= 0.05
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {((((unit as any).salePrice - (unit as any).purchasePrice) / (unit as any).purchasePrice) * 100).toFixed(1)}% margen
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Enlace al Video de TikTok ── */}
                {(unit as any).tiktokUrl && (
                  <div className="mt-3">
                    <a
                      href={(unit as any).tiktokUrl.startsWith("http") ? (unit as any).tiktokUrl : `https://${(unit as any).tiktokUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-black hover:from-black hover:to-slate-900 text-white transition-all shadow-sm border border-slate-700/60 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-pink-500/20 text-pink-400 rounded-lg border border-pink-500/30 flex items-center justify-center font-bold text-xs">
                          🎵
                        </div>
                        <div>
                          <p className="font-black text-xs text-white group-hover:text-pink-300 transition-colors flex items-center gap-1.5">
                            Video Demostrativo en TikTok
                            <span className="text-[9px] bg-pink-500 text-white px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                              Ver Video
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md">{(unit as any).tiktokUrl}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-pink-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                        <span>Reproducir</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                    </a>
                  </div>
                )}

                {(unit as any).damageNotes && (
                  <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <span className="font-bold">Notas daño: </span>{(unit as any).damageNotes}
                  </div>
                )}
              </section>

              {/* ── 2. Compra Original ──────────────────────────────── */}
              {purchaseRecord && (
                <section className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <SectionHeader icon={DollarSign} title="Compra Original" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <Field label="Nro. Compra" value={purchaseRecord.purchaseNumber} mono />
                    <Field label="Fecha de Compra" value={fmtDate(purchaseRecord.orderDate)} />
                    <Field label="Monto Pagado" value={formatCurrency(purchaseRecord.totalAmount)} />
                    <Field label="Método de Pago" value={
                      purchaseRecord.paymentMethod === "cash" ? "Efectivo"
                      : purchaseRecord.paymentMethod === "qr" ? "QR"
                      : "Transferencia"
                    } />
                    <Field label="Estado" value={purchaseRecord.status === "received" ? "Recibida" : purchaseRecord.status} />
                  </div>
                </section>
              )}

              {/* ── 3. Órdenes de Trabajo ───────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <SectionHeader icon={Wrench} title="Órdenes de Trabajo" count={repairHistory.length} />
                {repairHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin órdenes de trabajo registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {repairHistory.map((r: any, i: number) => (
                      <div key={r.id} className="border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] text-slate-400 font-black uppercase">#{i + 1}</span>
                            <Badge variant="outline" className="font-mono text-[10px] border-blue-300 text-blue-700 bg-blue-50">
                              {r.otNumber || r.rmaNumber || `OT-${r.id}`}
                            </Badge>
                            <Badge
                              variant={r.status === "completed" ? "default" : r.status === "in_progress" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {r.status === "in_progress" ? "En Proceso" : r.status === "completed" ? "Completado" : "Cancelado"}
                            </Badge>
                            {r.resolutionType && (
                              <Badge variant="outline" className="text-[10px]">
                                {r.resolutionType === "return_to_customer" ? "→ Devuelto al cliente" : "→ Volvió a inventario"}
                              </Badge>
                            )}
                          </div>
                          <span className="text-slate-400">{fmtDate(r.startDate)}{r.endDate ? ` → ${fmtDate(r.endDate)}` : " (en curso)"}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {r.technicianName && <Field label="Técnico" value={r.technicianName} />}
                          {(r.laborCost !== null || r.partsCost !== null) && (
                            <Field label="Costo total" value={formatCurrency(((r.laborCost || 0) + (r.partsCost || 0)))} />
                          )}
                        </div>
                        {r.notes && <p className="italic text-slate-500 line-clamp-2">{r.notes}</p>}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 h-7 text-[11px] font-bold border-blue-200 text-blue-700 bg-white hover:bg-blue-50 mt-1"
                          onClick={() => {
                            setSelectedRepairId(r.id);
                            setIsWorkOrderOpen(true);
                          }}
                        >
                          <Printer className="h-3.5 w-3.5 text-blue-600" />
                          Imprimir Orden de Trabajo ({r.otNumber || `OT-${r.id}`})
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── 4. Ventas ───────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <SectionHeader icon={ShoppingBag} title="Ventas" count={saleHistory.length} />
                {saleHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin ventas registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {saleHistory.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between text-xs border border-slate-200 rounded-xl px-3 py-2 gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">{s.saleNumber || `#${s.saleId}`}</Badge>
                          {s.customerName && <span className="text-slate-600">{s.customerName}</span>}
                          {s.saleStatus === "cancelled" && <Badge variant="destructive" className="text-[10px]">Anulada</Badge>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-700">{formatCurrency(s.finalUnitPrice)}</span>
                          <span className="text-slate-400">{fmtDate(s.saleDate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── 5. Garantías ────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <SectionHeader icon={Shield} title="Garantías" count={warrantyHistory.length} />
                {warrantyHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin garantías registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {warrantyHistory.map((w: any) => {
                      const now = new Date();
                      const end = new Date(w.endDate);
                      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      const isActive = w.status === "active" && daysLeft > 0;
                      return (
                        <div key={w.id} className={`flex items-center justify-between text-xs border rounded-xl px-3 py-2 gap-2 flex-wrap ${isActive ? "border-green-200 bg-green-50" : "border-slate-200"}`}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${isActive ? "border-green-400 text-green-700" : "text-slate-500"}`}>
                              {isActive ? "Activa" : w.status === "claimed" ? "Usada" : "Vencida"}
                            </Badge>
                            <span className="text-slate-600">{w.days} días</span>
                          </div>
                          <div className="text-slate-400 text-right">
                            <div>{fmtDate(w.startDate)} → {fmtDate(w.endDate)}</div>
                            {isActive && <div className="text-green-600 font-bold">{daysLeft} días restantes</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── 6. Devoluciones ─────────────────────────────────── */}
              {returnHistory.length > 0 && (
                <section className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <SectionHeader icon={RotateCcw} title="Devoluciones (RMA)" count={returnHistory.length} />
                  <div className="space-y-2">
                    {returnHistory.map((r: any) => (
                      <div key={r.id} className="text-xs border border-red-100 bg-red-50/40 rounded-xl px-3 py-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                            {r.reenteredRepair ? "→ Ingresó a taller" : "→ Devolución directa"}
                          </Badge>
                          <span className="text-slate-400">{fmtDate(r.returnDate)}</span>
                        </div>
                        <p className="text-slate-600"><span className="font-bold">Motivo: </span>{r.reason}</p>
                        {r.resolution && <p className="text-slate-500 italic">{r.resolution}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── 7. Timeline de Eventos ──────────────────────────── */}
              <section className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <SectionHeader icon={Clock} title="Timeline de Eventos" count={events.length} />
                {events.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin eventos registrados.</p>
                ) : (
                  <div className="relative pl-4 space-y-0">
                    {/* vertical line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                    {events.map((ev: any) => {
                      // Colores y emojis por tipo de evento
                      const isPositive = ["created", "sold", "repair_completed_return_to_customer", "repair_completed_return_to_inventory"].includes(ev.eventType);
                      const isNegative = ["return_rma", "repair_start"].includes(ev.eventType);
                      const dotColor = isPositive ? "border-emerald-400 bg-emerald-50" : isNegative ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-white";

                      // Etiqueta legible del evento
                      const evLabel = EVENT_LABEL[ev.eventType] || ev.eventType;

                      // Descripción del cambio de estado
                      const statusChange = ev.fromStatus && ev.toStatus
                        ? `${STATUS_LABEL[ev.fromStatus] || ev.fromStatus} → ${STATUS_LABEL[ev.toStatus] || ev.toStatus}`
                        : ev.toStatus
                        ? `→ ${STATUS_LABEL[ev.toStatus] || ev.toStatus}`
                        : null;

                      return (
                        <div key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                          <div className={`absolute -left-1 top-1 h-3.5 w-3.5 rounded-full border-2 ${dotColor} z-10`} />
                          <div className="ml-5 text-xs flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-black text-slate-800">{evLabel}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">{fmt(ev.createdAt)}</span>
                            </div>
                            {statusChange && (
                              <p className="text-[11px] font-semibold mt-0.5">
                                <span className="text-slate-400">Estado: </span>
                                <span className="text-slate-700">{statusChange}</span>
                              </p>
                            )}
                            {ev.notes && (
                              <p className="text-slate-500 mt-0.5 italic leading-relaxed">{ev.notes}</p>
                            )}
                            {ev.userName && (
                              <p className="text-[10px] text-slate-300 mt-0.5">por {ev.userName}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar Kardex
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Ficha Comercial */}
    <CommercialSheetModal
      unitId={unitId}
      open={isCommercialSheetOpen}
      onOpenChange={setIsCommercialSheetOpen}
    />

    {/* Modal Orden de Trabajo (OT) */}
    <WorkOrderModal
      repairId={selectedRepairId}
      unitId={unitId}
      open={isWorkOrderOpen}
      onOpenChange={setIsWorkOrderOpen}
    />
  </>
  );
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function Field({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  created: "📦 Registrado en el sistema",
  status_change: "🔄 Cambio de estado",
  repair_start: "🔧 Ingresó a Taller",
  repair_completed_return_to_customer: "✅ Taller completo → Devuelto al cliente",
  repair_completed_return_to_inventory: "✅ Taller completo → Retornado a inventario",
  repair_cancelled: "❌ Reparación cancelada",
  sold: "🛒 Vendido",
  return_rma: "↩️ Devolución registrada (RMA)",
};
