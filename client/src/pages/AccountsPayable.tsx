import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DollarSign, AlertTriangle, Clock, CheckCircle2,
  Search, Banknote, RefreshCw, TrendingUp, Eye,
  Printer, Package, QrCode, ArrowLeftRight, Calendar
} from "lucide-react";

function formatCurrency(cents: number) {
  return `Bs. ${(cents / 100).toFixed(2)}`;
}

function formatDate(d: any) {
  if (!d) return "—";
  try {
    const str = typeof d === "string" ? d : new Date(d).toISOString();
    const dateOnly = str.split("T")[0];
    const parts = dateOnly.split("-");
    if (parts.length === 3) {
      const [y, m, day] = parts;
      return `${day}/${m}/${y}`;
    }
    return str;
  } catch {
    return "—";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-100 text-emerald-700 border-0">✓ Pagado</Badge>;
    case "overdue":
      return <Badge className="bg-red-100 text-red-700 border-0 animate-pulse">⚠ Vencido</Badge>;
    case "partially_paid":
      return <Badge className="bg-amber-100 text-amber-700 border-0">½ Parcial</Badge>;
    default:
      return <Badge className="bg-orange-100 text-orange-700 border-0">• Pendiente</Badge>;
  }
}

function PaymentMethodIcon({ method }: { method: string }) {
  if (method === "qr") return <QrCode className="h-3.5 w-3.5 text-violet-500" />;
  if (method === "transfer") return <ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />;
  return <Banknote className="h-3.5 w-3.5 text-emerald-500" />;
}

// --- Modal de Detalle de Compra a Crédito ---
function APDetailDialog({ ap, open, onOpenChange, onPay }: any) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: items, isLoading } = (trpc.purchases as any).getItems.useQuery(
    { purchaseId: ap?.purchaseId },
    { enabled: !!ap?.purchaseId }
  );

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "", "height=800,width=900");
    if (!win) return;
    win.document.write(`<html><head><title>Comprobante de Compra a Crédito</title>
    <style>
      body { font-family: 'Arial', sans-serif; padding: 30px; color: #1e293b; }
      .header { border-bottom: 3px solid #ea580c; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
      .title { font-size: 22px; font-weight: 900; color: #ea580c; }
      .badge { background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #fcd34d; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 12px; }
      .label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.08em; }
      .value { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      thead { background: #1e293b; color: white; }
      th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
      td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
      tr:hover td { background: #f8fafc; }
      .total-row { background: #ea580c; color: white; font-size: 16px; font-weight: 900; }
      .total-row td { padding: 14px 12px; }
      .footer { margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 14px; text-align: center; font-size: 11px; color: #94a3b8; }
    </style></head><body>`);
    win.document.write(printRef.current.innerHTML);
    win.document.write(`</body></html>`);
    win.document.close();
    win.print();
  };

  if (!ap) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[2rem] p-0 bg-white border-0 shadow-2xl overflow-hidden">
        {/* Header del modal */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-7 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-100 mb-1">Comprobante de Compra a Crédito</p>
              <h2 className="text-2xl font-black font-mono">{ap.purchaseNumber}</h2>
            </div>
            <div className="text-right">
              {getStatusBadge(ap.status)}
              <p className="text-3xl font-black mt-2">{formatCurrency(ap.totalAmount)}</p>
              <p className="text-xs text-orange-200 font-semibold">Total de la compra</p>
            </div>
          </div>
        </div>

        {/* Cuerpo oculto para imprimir */}
        <div ref={printRef} className="hidden">
          <div className="header">
            <div>
              <div className="title">Comprobante de Compra a Crédito</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginTop: 4 }}>Sistema de Control de Pedidos</div>
            </div>
            <div className="badge">CRÉDITO</div>
          </div>
          <div className="grid2">
            <div><div className="label">Proveedor</div><div className="value">{ap.supplierName || "Sin Proveedor"}</div></div>
            <div><div className="label">N° Compra</div><div className="value">{ap.purchaseNumber}</div></div>
            <div><div className="label">Fecha de Compra</div><div className="value">{formatDate(ap.createdAt)}</div></div>
            <div><div className="label">Fecha de Vencimiento</div><div className="value" style={{ color: "#dc2626" }}>{formatDate(ap.dueDate)}</div></div>
            <div><div className="label">Monto Total</div><div className="value">{formatCurrency(ap.totalAmount)}</div></div>
            <div><div className="label">Saldo Pendiente</div><div className="value" style={{ color: "#ea580c" }}>{formatCurrency(ap.balance)}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th style={{ textAlign: "right" }}>P. Unit.</th>
                <th style={{ textAlign: "right" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((item: any) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(item.price)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(item.quantity * item.price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={3}>TOTAL COMPRA A CRÉDITO</td>
                <td style={{ textAlign: "right" }}>{formatCurrency(ap.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="footer">
            Compra registrada como CRÉDITO · Vence el {formatDate(ap.dueDate)} · Generado el {new Date().toLocaleString("es-BO")}
          </div>
        </div>

        {/* Cuerpo visible del modal */}
        <div className="p-6 space-y-5">
          {/* Info de la compra */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl text-sm border border-slate-100">
            <div>
              <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Proveedor</p>
              <p className="font-bold text-slate-800">{ap.supplierName || "Sin Proveedor"}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">N° Compra</p>
              <p className="font-mono font-bold text-orange-600">{ap.purchaseNumber}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Fecha Compra</p>
              <p className="font-bold text-slate-800">{formatDate(ap.createdAt)}</p>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-500 uppercase text-[10px] font-black tracking-wider">Vence</p>
                <p className="font-black text-red-600 text-base">{formatDate(ap.dueDate)}</p>
              </div>
            </div>
            <div>
              <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Total</p>
              <p className="font-black text-slate-900 text-base">{formatCurrency(ap.totalAmount)}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Saldo Pendiente</p>
              <p className={`font-black text-base ${ap.balance > 0 ? "text-orange-600" : "text-emerald-600"}`}>{formatCurrency(ap.balance)}</p>
            </div>
          </div>

          {/* Tabla de productos */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Productos Comprados</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-xs uppercase">Producto</th>
                  <th className="px-4 py-3 text-center font-black text-xs uppercase">Cant.</th>
                  <th className="px-4 py-3 text-right font-black text-xs uppercase">P. Unit.</th>
                  <th className="px-4 py-3 text-right font-black text-xs uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Cargando productos...</td></tr>
                ) : (items && items.length > 0) ? items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{item.productName}</p>
                      {item.productCode && <p className="text-[10px] text-slate-400">{item.productCode}</p>}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">{formatCurrency(item.quantity * item.price)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic">No hay detalle de productos disponible.</td></tr>
                )}
              </tbody>
            </table>
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Compra a Crédito</span>
              <span className="text-2xl font-black font-mono">{formatCurrency(ap.totalAmount)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4 gap-3 flex flex-row">
          <Button variant="outline" onClick={handlePrint} className="rounded-xl gap-2 border-slate-200">
            <Printer className="h-4 w-4" /> Imprimir Comprobante
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cerrar</Button>
          {ap.status !== "paid" && (
            <Button
              onClick={() => { onOpenChange(false); onPay(ap); }}
              className="rounded-xl bg-orange-600 hover:bg-orange-700 gap-2"
            >
              <Banknote className="h-4 w-4" /> Pagar Ahora
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountsPayable() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedAP, setSelectedAP] = useState<any>(null);
  const [detailAP, setDetailAP] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");

  const { data: apList = [], refetch, isLoading } = trpc.credit.listPayable.useQuery();
  const { data: globalBalances } = (trpc.finance as any).getGlobalBalances.useQuery();
  const registerPaymentMutation = trpc.credit.registerPayment.useMutation({
    onSuccess: () => {
      toast.success("El pago al proveedor fue aplicado correctamente.");
      setSelectedAP(null);
      setPayAmount("");
      setPayNotes("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const filtered = (apList as any[]).filter((ap) => {
    const matchSearch = !search ||
      ap.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      ap.purchaseNumber?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || ap.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPending = (apList as any[]).filter(a => a.status !== "paid").reduce((s, a) => s + (a.balance || 0), 0);
  const totalOverdue = (apList as any[]).filter(a => a.status === "overdue").reduce((s, a) => s + (a.balance || 0), 0);
  const totalPaid = (apList as any[]).filter(a => a.status === "paid").reduce((s, a) => s + (a.totalAmount || 0), 0);
  const countActive = (apList as any[]).filter(a => a.status !== "paid").length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
          Cuentas por <span className="text-orange-600">Pagar</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">Gestión de obligaciones con proveedores a crédito</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-xl"><DollarSign className="h-5 w-5 text-orange-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Por Pagar</p>
                <p className="text-xl font-black text-orange-600">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vencido</p>
                <p className="text-xl font-black text-red-600">{formatCurrency(totalOverdue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pagado</p>
                <p className="text-xl font-black text-emerald-600">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl"><Clock className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Activas</p>
                <p className="text-xl font-black text-slate-900">{countActive} cuentas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar proveedor o compra..." className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="unpaid">Pendiente</SelectItem>
            <SelectItem value="partially_paid">Parcialmente Pagado</SelectItem>
            <SelectItem value="overdue">Vencido 🔴</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()} className="rounded-xl gap-2">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Proveedor</th>
                <th className="text-left px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Compra</th>
                <th className="text-right px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Total</th>
                <th className="text-right px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Pagado</th>
                <th className="text-right px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Saldo</th>
                <th className="text-center px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Vence</th>
                <th className="text-center px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Estado</th>
                <th className="text-center px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">Cargando...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <TrendingUp className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-semibold">Sin cuentas por pagar</p>
                    <p className="text-slate-300 text-sm">Las compras a crédito con proveedores aparecerán aquí</p>
                  </td>
                </tr>
              )}
              {filtered.map((ap: any) => (
                <tr key={ap.id} className="group border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900 text-sm">{ap.supplierName}</p>
                    <p className="text-xs text-slate-400">{ap.supplierPhone || ""}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-sm text-orange-600 font-bold">{ap.purchaseNumber}</span>
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900 text-sm">{formatCurrency(ap.totalAmount)}</td>
                  <td className="px-5 py-4 text-right text-emerald-600 font-semibold text-sm">{formatCurrency(ap.paidAmount)}</td>
                  <td className="px-5 py-4 text-right">
                    <span className={`font-black text-base ${ap.balance > 0 ? "text-orange-600" : "text-emerald-600"}`}>
                      {formatCurrency(ap.balance)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-sm text-slate-500 font-semibold">{formatDate(ap.dueDate)}</td>
                  <td className="px-5 py-4 text-center">{getStatusBadge(ap.status)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailAP(ap)}
                        className="h-8 px-2.5 rounded-lg border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-xs gap-1"
                        title="Ver Detalle"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detalle
                      </Button>
                      {ap.status !== "paid" && (
                        <Button
                          size="sm"
                          onClick={() => setSelectedAP(ap)}
                          className="h-8 px-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-xs gap-1 text-white"
                        >
                          <Banknote className="h-3.5 w-3.5" /> Pagar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Dialog */}
      <APDetailDialog
        ap={detailAP}
        open={!!detailAP}
        onOpenChange={(v: boolean) => { if (!v) setDetailAP(null); }}
        onPay={(ap: any) => setSelectedAP(ap)}
      />

      {/* Payment Dialog */}
      <Dialog open={!!selectedAP} onOpenChange={(v) => { if (!v) setSelectedAP(null); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Registrar Pago a Proveedor</DialogTitle>
          </DialogHeader>
          {selectedAP && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                <p className="text-sm font-bold text-slate-700">🏭 {selectedAP.supplierName}</p>
                <p className="text-xs text-slate-500">Compra: <span className="font-bold">{selectedAP.purchaseNumber}</span></p>
                <p className="text-xs text-slate-500">Saldo: <span className="font-black text-orange-600">{formatCurrency(selectedAP.balance)}</span></p>
                <p className="text-xs text-slate-500">Vence: <span className="font-semibold text-red-600">{formatDate(selectedAP.dueDate)}</span></p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Monto a Pagar (Bs.)</Label>
                <Input
                  type="number"
                  min="0.01"
                  max={(selectedAP.balance / 100).toFixed(2)}
                  step="0.01"
                  placeholder={`Máx: ${formatCurrency(selectedAP.balance)}`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="rounded-xl text-lg font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Método de Pago</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "cash", label: "Efectivo", icon: <Banknote className="h-4 w-4" />, balance: globalBalances?.cash, color: "text-emerald-600" },
                    { val: "qr", label: "QR", icon: <QrCode className="h-4 w-4" />, balance: globalBalances?.qr, color: "text-violet-600" },
                    { val: "transfer", label: "Transferencia", icon: <ArrowLeftRight className="h-4 w-4" />, balance: globalBalances?.transfer, color: "text-blue-600" },
                  ].map(({ val, label, icon, balance, color }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPayMethod(val)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 font-bold text-xs transition-all ${
                        payMethod === val
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {icon}
                      {label}
                      {balance !== undefined && (
                        <span className={`text-[10px] font-black mt-0.5 ${
                          payMethod === val ? "text-orange-600" : color
                        }`}>
                          {formatCurrency(balance)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Notas (Opcional)</Label>
                <Textarea placeholder="Referencia de pago, observaciones..." value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="rounded-xl" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedAP(null)} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={() => {
                if (!selectedAP || !payAmount || parseFloat(payAmount) <= 0) return;
                registerPaymentMutation.mutate({
                  type: "payable",
                  accountsPayableId: selectedAP.id,
                  amount: Math.round(parseFloat(payAmount) * 100),
                  paymentMethod: payMethod as "cash" | "qr" | "transfer",
                  notes: payNotes || undefined,
                });
              }}
              disabled={registerPaymentMutation.isPending || !payAmount}
              className="rounded-xl bg-orange-600 hover:bg-orange-700 gap-2"
            >
              {registerPaymentMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
