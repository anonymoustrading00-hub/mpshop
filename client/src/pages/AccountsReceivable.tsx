import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DollarSign, AlertTriangle, Clock, CheckCircle2, TrendingDown,
  Search, MessageCircle, FileText, CreditCard, RefreshCw,
  Banknote, QrCode, ArrowLeftRight
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
      return <Badge className="bg-red-100 text-red-700 border-0 animate-pulse">⚠ En Mora</Badge>;
    case "partially_paid":
      return <Badge className="bg-amber-100 text-amber-700 border-0">½ Parcial</Badge>;
    default:
      return <Badge className="bg-blue-100 text-blue-700 border-0">• Pendiente</Badge>;
  }
}

function generateWhatsAppMessage(ar: any) {
  const balance = (ar.balance / 100).toFixed(2);
  const dueDate = formatDate(ar.dueDate);
  const phone = ar.customerPhone?.replace(/\D/g, "") || "";
  const message = encodeURIComponent(
    `Estimado(a) ${ar.customerName}, le recordamos que tiene una deuda pendiente de Bs. ${balance} (Factura: ${ar.saleNumber}) con fecha límite ${dueDate}. Por favor comuníquese para coordinar el pago. Gracias.`
  );
  return `https://wa.me/${phone}?text=${message}`;
}

function generateCreditPDF(ar: any) {
  const content = `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Comprobante de Venta a Crédito - ${ar.saleNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #222; }
      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
      .title { font-size: 22px; font-weight: bold; }
      .subtitle { font-size: 14px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th { background: #f3f4f6; text-align: left; padding: 8px 12px; font-size: 13px; }
      td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
      .total-row td { font-weight: bold; font-size: 16px; background: #f9fafb; }
      .pagare { margin-top: 40px; border: 2px solid #374151; border-radius: 8px; padding: 24px; background: #fafafa; }
      .pagare-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 16px; letter-spacing: 2px; }
      .firma { margin-top: 48px; border-top: 1px solid #333; width: 280px; text-align: center; font-size: 12px; padding-top: 8px; }
      .alert { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #991b1b; }
    </style></head><body>
    <div class="header">
      <div class="title">COMPROBANTE DE VENTA A CRÉDITO</div>
      <div class="subtitle">Documento N° ${ar.saleNumber} | Fecha: ${new Date().toLocaleDateString("es-BO")}</div>
    </div>
    <table>
      <tr><th>DATOS DEL CLIENTE</th><th></th></tr>
      <tr><td>Nombre Completo</td><td><b>${ar.customerName}</b></td></tr>
      <tr><td>NIT / CI</td><td>${ar.customerTaxId || "—"}</td></tr>
      <tr><td>Teléfono</td><td>${ar.customerPhone || "—"}</td></tr>
      <tr><td>Referencia Factura</td><td>${ar.saleNumber}</td></tr>
      <tr><th colspan="2">DETALLE DE LA DEUDA</th></tr>
      <tr><td>Monto Total</td><td><b>${formatCurrency(ar.totalAmount)}</b></td></tr>
      <tr><td>Monto Abonado</td><td>${formatCurrency(ar.paidAmount)}</td></tr>
      <tr class="total-row"><td>SALDO PENDIENTE</td><td><b style="color:#dc2626;">${formatCurrency(ar.balance)}</b></td></tr>
      <tr><td>Fecha Límite de Pago</td><td><b>${formatDate(ar.dueDate)}</b></td></tr>
    </table>
    <div class="alert">⚠ Aviso: El incumplimiento en la fecha de pago generará la suspensión inmediata del crédito para futuras compras.</div>
    <div class="pagare">
      <div class="pagare-title">— PAGARÉ / COMPROMISO DE PAGO —</div>
      <p>Yo, <b>${ar.customerName}</b>, con NIT/CI <b>${ar.customerTaxId || "___________"}</b>, declaro haber recibido a mi entera satisfacción los productos correspondientes a la factura <b>${ar.saleNumber}</b> y me comprometo a cancelar el saldo pendiente de <b>${formatCurrency(ar.balance)}</b> a más tardar el día <b>${formatDate(ar.dueDate)}</b>.</p>
      <p>En caso de incumplimiento, acepto las consecuencias comerciales establecidas por la empresa, incluyendo el bloqueo de futuras compras a crédito.</p>
      <br/><br/>
      <div style="display:flex; justify-content:space-between;">
        <div class="firma">Firma del Cliente<br/><small>${ar.customerName}</small></div>
        <div class="firma">Firma Empresa<br/><small>Sello y Autorización</small></div>
      </div>
    </div>
    </body></html>
  `;
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(content);
    win.document.close();
    win.print();
  }
}

export default function AccountsReceivable() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedAR, setSelectedAR] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");

  const { data: arList = [], refetch, isLoading } = trpc.credit.listReceivable.useQuery();
  const { data: globalBalances } = (trpc.finance as any).getGlobalBalances.useQuery();
  const registerPaymentMutation = trpc.credit.registerPayment.useMutation({
    onSuccess: () => {
      toast.success("El pago ha sido aplicado correctamente.");
      setSelectedAR(null);
      setPayAmount("");
      setPayNotes("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const filtered = (arList as any[]).filter((ar) => {
    const matchSearch = !search ||
      ar.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      ar.saleNumber?.toLowerCase().includes(search.toLowerCase()) ||
      ar.customerTaxId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || ar.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPending = (arList as any[]).filter(a => a.status !== "paid").reduce((s, a) => s + (a.balance || 0), 0);
  const totalOverdue = (arList as any[]).filter(a => a.status === "overdue").reduce((s, a) => s + (a.balance || 0), 0);
  const totalPaid = (arList as any[]).filter(a => a.status === "paid").reduce((s, a) => s + (a.totalAmount || 0), 0);
  const countActive = (arList as any[]).filter(a => a.status !== "paid").length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          Cuentas por <span className="text-blue-600">Cobrar</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">Gestión de ventas a crédito y seguimiento de deudas de clientes</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Por Cobrar</p>
                <p className="text-xl font-black text-slate-900">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">En Mora</p>
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
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cobrado</p>
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
          <Input placeholder="Buscar cliente, factura o NIT..." className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="unpaid">Pendiente</SelectItem>
            <SelectItem value="partially_paid">Parcialmente Pagado</SelectItem>
            <SelectItem value="overdue">En Mora 🔴</SelectItem>
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
                <th className="text-left px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Factura</th>
                <th className="text-right px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Total</th>
                <th className="text-right px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Abonado</th>
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
                    <TrendingDown className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-semibold">No hay cuentas por cobrar</p>
                    <p className="text-slate-300 text-sm">Las ventas a crédito aparecerán aquí</p>
                  </td>
                </tr>
              )}
              {filtered.map((ar: any) => (
                <tr key={ar.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900 text-sm">{ar.customerName}</p>
                    <p className="text-xs text-slate-400">{ar.customerTaxId ? `NIT: ${ar.customerTaxId}` : ""} {ar.customerPhone ? `· ${ar.customerPhone}` : ""}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-sm text-blue-600 font-bold">{ar.saleNumber}</span>
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900 text-sm">{formatCurrency(ar.totalAmount)}</td>
                  <td className="px-5 py-4 text-right text-emerald-600 font-semibold text-sm">{formatCurrency(ar.paidAmount)}</td>
                  <td className="px-5 py-4 text-right">
                    <span className={`font-black text-base ${ar.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatCurrency(ar.balance)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-sm text-slate-500 font-semibold">{formatDate(ar.dueDate)}</td>
                  <td className="px-5 py-4 text-center">{getStatusBadge(ar.status)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-1">
                      {ar.status !== "paid" && (
                        <Button size="sm" onClick={() => setSelectedAR(ar)} className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs gap-1">
                          <CreditCard className="h-3.5 w-3.5" /> Abonar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => generateCreditPDF(ar)} className="h-8 px-3 rounded-lg text-xs gap-1">
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </Button>
                      {ar.customerPhone && ar.status !== "paid" && (
                        <Button size="sm" variant="outline" asChild className="h-8 px-3 rounded-lg text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50">
                          <a href={generateWhatsAppMessage(ar)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-3.5 w-3.5" /> WA
                          </a>
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

      {/* Payment Dialog */}
      <Dialog open={!!selectedAR} onOpenChange={(v) => { if (!v) setSelectedAR(null); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Registrar Abono</DialogTitle>
          </DialogHeader>
          {selectedAR && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                <p className="text-sm font-bold text-slate-700">👤 {selectedAR.customerName}</p>
                <p className="text-xs text-slate-500">Factura: <span className="font-bold">{selectedAR.saleNumber}</span></p>
                <p className="text-xs text-slate-500">Saldo total: <span className="font-black text-red-600">{formatCurrency(selectedAR.balance)}</span></p>
                <p className="text-xs text-slate-500">Vence: <span className="font-semibold">{formatDate(selectedAR.dueDate)}</span></p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Monto a Abonar (Bs.)</Label>
                <Input
                  type="number"
                  min="0.01"
                  max={(selectedAR.balance / 100).toFixed(2)}
                  step="0.01"
                  placeholder={`Máx: ${formatCurrency(selectedAR.balance)}`}
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
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {icon}
                      {label}
                      {balance !== undefined && (
                        <span className={`text-[10px] font-black mt-0.5 ${
                          payMethod === val ? "text-blue-700" : color
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
                <Textarea placeholder="Referencia, observaciones..." value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="rounded-xl" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedAR(null)} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={() => {
                if (!selectedAR || !payAmount || parseFloat(payAmount) <= 0) return;
                registerPaymentMutation.mutate({
                  type: "receivable",
                  accountsReceivableId: selectedAR.id,
                  amount: Math.round(parseFloat(payAmount) * 100),
                  paymentMethod: payMethod as "cash" | "qr" | "transfer",
                  notes: payNotes || undefined,
                });
              }}
              disabled={registerPaymentMutation.isPending || !payAmount}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {registerPaymentMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar Abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
