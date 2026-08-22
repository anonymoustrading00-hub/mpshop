/**
 * Módulo de Cotizaciones — lista, detalle, cambio de estado y conversión a venta
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import {
  FileText, Search, Eye, CheckCircle2, XCircle, ShoppingBag,
  Clock, RefreshCw, User, CalendarDays, Tag, Plus,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: "Pendiente",  color: "bg-amber-50 text-amber-700 border-amber-200",  icon: Clock },
  accepted: { label: "Aceptada",   color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rechazada",  color: "bg-red-50 text-red-700 border-red-200",        icon: XCircle },
};

function fmt(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

function daysLeft(validUntil: any): { label: string; urgent: boolean } {
  if (!validUntil) return { label: "Sin vencimiento", urgent: false };
  const diff = Math.ceil((new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `Vencida hace ${Math.abs(diff)}d`, urgent: true };
  if (diff === 0) return { label: "Vence hoy", urgent: true };
  if (diff <= 3) return { label: `Vence en ${diff}d`, urgent: true };
  return { label: `${diff} días restantes`, urgent: false };
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

function QuotationDetailDialog({
  quotationId,
  open,
  onClose,
  onRefresh,
}: { quotationId: number; open: boolean; onClose: () => void; onRefresh: () => void }) {
  const [, navigate] = useLocation();

  const { data, isLoading } = (trpc.quotations as any).getDetails.useQuery(
    { quotationId },
    { enabled: open && !!quotationId }
  );

  const updateStatus = (trpc.quotations as any).updateStatus.useMutation({
    onSuccess: (_: any, vars: any) => {
      toast.success(vars.status === "accepted" ? "Cotización aceptada" : "Cotización rechazada");
      onRefresh();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const quotation = data?.quotation;
  const items: any[] = data?.items || [];

  const handleConvertToSale = () => {
    // Navigate to Sales with pre-filled data (simple: just navigate and show toast)
    toast.info("Redirigiendo a Ventas con los datos de la cotización...");
    navigate("/sales");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Cotización {quotation?.quotationNumber}
          </DialogTitle>
          <DialogDescription>
            {quotation?.customerName || "Cliente no especificado"} · {fmt(quotation?.createdAt)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Cargando...</div>
        ) : !quotation ? (
          <div className="py-12 text-center text-muted-foreground">No encontrada</div>
        ) : (
          <div className="space-y-4">
            {/* Status + dates */}
            <div className="flex flex-wrap items-center gap-3">
              {(() => {
                const cfg = STATUS_CFG[quotation.status] || STATUS_CFG.pending;
                const Icon = cfg.icon;
                return (
                  <Badge variant="outline" className={`gap-1.5 font-bold px-3 py-1 ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </Badge>
                );
              })()}
              {quotation.validUntil && (() => {
                const { label, urgent } = daysLeft(quotation.validUntil);
                return (
                  <Badge variant="outline" className={`gap-1 text-xs ${urgent ? "border-red-300 text-red-700 bg-red-50" : "text-slate-500"}`}>
                    <CalendarDays className="h-3 w-3" />
                    {label}
                  </Badge>
                );
              })()}
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cliente</p>
                <p className="font-bold text-slate-700">{quotation.customerName || "Anónimo"}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Creada por</p>
                <p className="font-bold text-slate-700">{quotation.createdByName || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Válida hasta</p>
                <p className="font-bold text-slate-700">{fmt(quotation.validUntil)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fecha emisión</p>
                <p className="font-bold text-slate-700">{fmt(quotation.createdAt)}</p>
              </div>
            </div>

            {/* Items table */}
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-black">Equipo</TableHead>
                    <TableHead className="text-xs font-black text-center">Cant.</TableHead>
                    <TableHead className="text-xs font-black text-right">P. Unit.</TableHead>
                    <TableHead className="text-xs font-black text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">
                        <div className="font-semibold">{item.unitBrand} {item.unitModel}</div>
                        {item.unitCode && <div className="text-slate-400 font-mono text-[10px]">{item.unitCode}</div>}
                        {item.discountAmount > 0 && (
                          <div className="text-[10px] text-emerald-600">−{formatCurrency(item.discountAmount)} desc.</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold">{item.quantity}</TableCell>
                      <TableCell className="text-right text-xs font-bold">{formatCurrency(item.finalUnitPrice)}</TableCell>
                      <TableCell className="text-right text-sm font-black">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm border-t pt-3">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-semibold">{formatCurrency(quotation.subtotal)}</span>
              </div>
              {quotation.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Descuento</span>
                  <span className="font-semibold">−{formatCurrency(quotation.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-black text-slate-900 pt-1 border-t">
                <span>TOTAL</span>
                <span>{formatCurrency(quotation.total)}</span>
              </div>
            </div>

            {/* Notes */}
            {quotation.notes && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
                <span className="font-bold">Notas: </span>{quotation.notes}
              </div>
            )}
            {quotation.termsAndConditions && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                <span className="font-bold">Términos: </span>{quotation.termsAndConditions}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {quotation?.status === "pending" && (
            <>
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ quotationId, status: "rejected" })}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Rechazar
              </Button>
              <Button
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ quotationId, status: "accepted" })}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Aceptar
              </Button>
            </>
          )}
          {quotation?.status === "accepted" && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handleConvertToSale}
            >
              <ShoppingBag className="h-4 w-4" />
              Convertir a Venta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Quotations() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: quotations, isLoading, refetch } = (trpc.quotations as any).list.useQuery();

  const filtered = (quotations as any[] || []).filter((q: any) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        q.quotationNumber?.toLowerCase().includes(s) ||
        q.customerName?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const counts = {
    all: (quotations as any[] || []).length,
    pending: (quotations as any[] || []).filter((q: any) => q.status === "pending").length,
    accepted: (quotations as any[] || []).filter((q: any) => q.status === "accepted").length,
    rejected: (quotations as any[] || []).filter((q: any) => q.status === "rejected").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto mb-20 md:mb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Cotizaciones <span className="text-blue-600">/ Presupuestos</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Gestiona las cotizaciones enviadas a clientes y conviértelas en ventas.
          </p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => window.location.href = "/sales"}>
          <Plus className="h-4 w-4" /> Nueva desde Ventas
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["all", "pending", "accepted", "rejected"] as const).map((s) => {
          const cfg = s === "all"
            ? { label: "Total", color: "bg-slate-900 text-white", bar: "bg-slate-900" }
            : { ...STATUS_CFG[s], bar: "" };
          const count = counts[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                statusFilter === s
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-slate-100 bg-white hover:border-slate-300"
              }`}
            >
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {s === "all" ? "Todas" : STATUS_CFG[s].label}
              </p>
              <p className="text-3xl font-black text-slate-900">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nro. o cliente..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 pb-3">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            {filtered.length} cotizaci{filtered.length !== 1 ? "ones" : "ón"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Cargando cotizaciones...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <FileText className="h-12 w-12 mx-auto text-slate-200" />
              <p className="text-slate-500 font-medium">No hay cotizaciones</p>
              <p className="text-xs text-slate-400">Las cotizaciones se crean desde el módulo de Ventas</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60">
                      <TableHead className="font-black text-xs">Nro.</TableHead>
                      <TableHead className="font-black text-xs">Cliente</TableHead>
                      <TableHead className="font-black text-xs">Estado</TableHead>
                      <TableHead className="font-black text-xs">Vence</TableHead>
                      <TableHead className="font-black text-xs text-right">Total</TableHead>
                      <TableHead className="font-black text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((q: any) => {
                      const cfg = STATUS_CFG[q.status] || STATUS_CFG.pending;
                      const Icon = cfg.icon;
                      const expiry = daysLeft(q.validUntil);
                      return (
                        <TableRow key={q.id} className="hover:bg-slate-50/60 transition-colors">
                          <TableCell className="font-mono font-black text-sm">{q.quotationNumber}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-sm">{q.customerName || "Anónimo"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 text-[10px] font-bold ${cfg.color}`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium ${expiry.urgent ? "text-red-600 font-bold" : "text-slate-500"}`}>
                              {expiry.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-black text-slate-900">
                            {formatCurrency(q.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-8 text-xs"
                              onClick={() => setSelectedId(q.id)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-slate-100">
                {filtered.map((q: any) => {
                  const cfg = STATUS_CFG[q.status] || STATUS_CFG.pending;
                  const Icon = cfg.icon;
                  const expiry = daysLeft(q.validUntil);
                  return (
                    <div key={q.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono font-black text-slate-800">{q.quotationNumber}</p>
                          <p className="text-sm text-slate-600 flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {q.customerName || "Anónimo"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg text-slate-900">{formatCurrency(q.total)}</p>
                          <Badge variant="outline" className={`gap-1 text-[10px] font-bold ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                      {expiry.urgent && (
                        <p className="text-xs font-bold text-red-600">{expiry.label}</p>
                      )}
                      <Button size="sm" className="w-full gap-2 h-9" onClick={() => setSelectedId(q.id)}>
                        <Eye className="h-3.5 w-3.5" /> Ver detalles
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {selectedId && (
        <QuotationDetailDialog
          quotationId={selectedId}
          open={!!selectedId}
          onClose={() => setSelectedId(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}
