import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Clock3,
  Eye,
  PackagePlus,
  PencilLine,
  RotateCcw,
  ShoppingCart,
  Truck,
  User,
  FileSpreadsheet,
} from "lucide-react";
import { exportKardexToExcel } from "@/lib/kardex-export";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProductHistoryDialogProps {
  productId: number;
  productName: string;
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getEventBadge(eventType: string) {
  switch (eventType) {
    case "created":
      return <Badge className="bg-blue-600 text-white hover:bg-blue-600">Creado</Badge>;
    case "purchase":
      return <Badge className="bg-sky-600 text-white hover:bg-sky-600">Compra</Badge>;
    case "sale":
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Venta</Badge>;
    case "sale_cancellation":
      return <Badge variant="secondary">Reposicion</Badge>;
    case "order_reservation":
      return <Badge className="bg-orange-500 text-white hover:bg-orange-500">Pedido</Badge>;
    case "order_cancellation":
      return <Badge variant="destructive">Pedido cancelado</Badge>;
    case "order_delivery":
      return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Entregado</Badge>;
    case "deactivated":
      return <Badge variant="destructive">Baja</Badge>;
    case "reactivated":
      return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Reactivado</Badge>;
    case "updated":
      return <Badge variant="outline">Actualizacion</Badge>;
    case "inventory_entry":
      return <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">Entrada</Badge>;
    case "inventory_exit":
      return <Badge variant="secondary">Salida</Badge>;
    default:
      return <Badge variant="outline">Ajuste</Badge>;
  }
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "created":
      return <PackagePlus className="h-4 w-4 text-blue-600" />;
    case "purchase":
      return <Truck className="h-4 w-4 text-sky-600" />;
    case "sale":
      return <ShoppingCart className="h-4 w-4 text-emerald-600" />;
    case "sale_cancellation":
      return <RotateCcw className="h-4 w-4 text-slate-600" />;
    case "order_reservation":
      return <Truck className="h-4 w-4 text-orange-500" />;
    case "order_cancellation":
      return <Ban className="h-4 w-4 text-red-600" />;
    case "order_delivery":
      return <Eye className="h-4 w-4 text-amber-600" />;
    case "deactivated":
      return <Ban className="h-4 w-4 text-red-600" />;
    case "reactivated":
      return <RotateCcw className="h-4 w-4 text-amber-600" />;
    case "updated":
      return <PencilLine className="h-4 w-4 text-slate-600" />;
    case "inventory_entry":
      return <ArrowUp className="h-4 w-4 text-cyan-600" />;
    case "inventory_exit":
      return <ArrowDown className="h-4 w-4 text-slate-600" />;
    default:
      return <Clock3 className="h-4 w-4 text-slate-600" />;
  }
}

function getQuantityLabel(event: any) {
  if (!event.quantity) {
    return "Sin cambio de cantidad";
  }

  if (event.eventType === "sale" || event.eventType === "inventory_exit") {
    return `-${event.quantity} unidades`;
  }

  if (
    event.eventType === "purchase" ||
    event.eventType === "sale_cancellation" ||
    event.eventType === "inventory_entry"
  ) {
    return `+${event.quantity} unidades`;
  }

  if (event.eventType === "order_reservation") {
    return `-${event.quantity} en pedido`;
  }

  if (event.eventType === "order_cancellation") {
    return `+${event.quantity} repuesto`;
  }

  if (event.eventType === "order_delivery") {
    return `${event.quantity} entregados`;
  }

  return `${event.quantity} unidades`;
}

export function ProductHistoryDialog({
  productId,
  productName,
}: ProductHistoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = (trpc.inventory as any).getProductHistory.useQuery(
    { productId, startDate, endDate },
    { enabled: isOpen }
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 hover:bg-primary/5 transition-colors">
          <Eye className="h-4 w-4" />
          Historial
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-6xl !h-[92vh] sm:!h-[90vh] !w-[98vw] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <DialogHeader className="shrink-0 p-5 pb-3 border-b bg-muted/5">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight text-primary">Kardex de Inventario</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className="font-mono text-xs bg-background/50 backdrop-blur-sm px-2.5 py-0.5 border-primary/20 text-primary">
                  {productName}
                </Badge>
                <span className="hidden sm:inline text-xs text-muted-foreground font-medium italic">
                  — Auditoría profesional de movimientos de stock
                </span>
              </div>
            </div>

            {data && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all font-black"
                onClick={() => exportKardexToExcel(data)}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Descargar Excel</span>
                <span className="sm:hidden">Excel</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Cargando historial...
          </div>
        ) : !data ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No se pudo cargar el historial.
          </div>
        ) : (
          <div className="flex flex-col gap-5 overflow-hidden flex-1 min-h-0 p-5 pt-2">
            {/* Filtros de Fecha - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border bg-gradient-to-br from-muted/50 to-background shadow-sm shrink-0">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs uppercase font-black text-muted-foreground/80 flex items-center gap-2 px-1">
                  <Clock3 className="h-3.5 w-3.5 text-primary/60" /> Fecha de Inicio
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 text-sm rounded-xl border-muted-foreground/20 focus:ring-primary/20 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-xs uppercase font-black text-muted-foreground/80 flex items-center gap-2 px-1">
                  <Eye className="h-3.5 w-3.5 text-primary/60" /> Fecha de Fin
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 text-sm rounded-xl border-muted-foreground/20 focus:ring-primary/20 bg-background"
                  />
                  {(startDate || endDate) && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10 px-4 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border-red-100" 
                      onClick={() => { setStartDate(""); setEndDate(""); }}
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Dashboard de Resumen - Adaptable */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
              <div className="rounded-2xl border bg-background p-4 shadow-sm hover:shadow-md transition-all group">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Codigo</p>
                <p className="font-mono font-black text-lg text-primary truncate group-hover:text-primary/80 transition-colors">{data.product.code}</p>
              </div>
              <div className="rounded-2xl border bg-primary p-4 shadow-sm group">
                <p className="text-[10px] text-primary-foreground/70 font-bold uppercase tracking-wider mb-1">Stock Actual</p>
                <p className="font-black text-2xl text-primary-foreground">{data.stock?.quantity ?? 0}</p>
              </div>
              <div className="rounded-2xl border bg-sky-50 p-4 shadow-sm border-sky-100 group">
                <p className="text-[10px] text-sky-700 font-bold uppercase tracking-wider mb-1">Total Ingresos</p>
                <p className="font-black text-2xl text-sky-800 group-hover:scale-105 transition-transform origin-left">{data.summary.totalPurchasedUnits}</p>
              </div>
              <div className="rounded-2xl border bg-rose-50 p-4 shadow-sm border-rose-100 group">
                <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wider mb-1">Total Salidas</p>
                <p className="font-black text-2xl text-rose-800 group-hover:scale-105 transition-transform origin-left">{data.summary.totalSoldUnits}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm group">
                <p className="text-[10px] text-slate-600 font-black uppercase tracking-wider mb-1">Total Eventos</p>
                <p className="font-black text-2xl text-slate-800">{data.summary.totalEvents}</p>
              </div>
            </div>

            {/* Alerta si el Kardex no cuadra con el stock fisico */}
            {data.summary.finalBalance !== (data.stock?.quantity ?? 0) && (
              <div className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex items-start gap-3">
                <span className="text-amber-500 text-lg font-black shrink-0 mt-0.5">!</span>
                <div>
                  <p className="text-xs font-black text-amber-800 uppercase tracking-wide">Diferencia detectada en el Kardex</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    El calculo del Kardex arroja <strong>{data.summary.finalBalance}</strong> unidades, pero el Stock Fisico registrado es <strong>{data.stock?.quantity ?? 0}</strong>.
                    Esto indica que algunos movimientos no fueron registrados en el historial. El valor correcto es siempre el <strong>Stock Actual</strong>.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-muted/10 px-4 py-2 shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-bold text-sm text-slate-800">{data.product.name}</span>
              <span className="text-xs text-muted-foreground">Compra: <strong>{formatCurrency(data.product.price)}</strong></span>
              <span className="text-xs text-muted-foreground">Venta: <strong>{formatCurrency(data.product.salePrice)}</strong></span>
              <span className="text-xs text-muted-foreground">Total eventos: <strong>{data.summary.totalEvents}</strong></span>
            </div>

            {/* KARDEX TABLE - fixed layout so all columns always fit */}
            <div className="flex-1 min-h-0 overflow-auto rounded-xl border shadow-sm bg-white">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{width: '130px'}} />
                  <col style={{width: 'auto'}} />
                  <col style={{width: '90px'}} />
                  <col style={{width: '90px'}} />
                  <col style={{width: '90px'}} />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-slate-900 text-white">
                  <tr>
                    <th className="text-left text-xs font-black uppercase tracking-wider px-4 py-3 border-r border-slate-700">Fecha / Hora</th>
                    <th className="text-left text-xs font-black uppercase tracking-wider px-4 py-3 border-r border-slate-700">Concepto / Movimiento</th>
                    <th className="text-right text-xs font-black uppercase tracking-wider px-3 py-3 bg-emerald-800 border-r border-emerald-700">Entrada</th>
                    <th className="text-right text-xs font-black uppercase tracking-wider px-3 py-3 bg-red-900 border-r border-red-800">Salida</th>
                    <th className="text-right text-xs font-black uppercase tracking-wider px-3 py-3 bg-slate-700">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.timeline.map((event: any, idx: number) => (
                    <tr
                      key={event.id}
                      className={`border-b transition-colors hover:bg-slate-50 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className="px-4 py-3 align-top border-r border-slate-100 whitespace-nowrap">
                        <p className="text-xs font-bold text-slate-800 leading-tight">
                          {formatDateTime(event.createdAt).split(',')[0]}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {formatDateTime(event.createdAt).split(',')[1]}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top border-r border-slate-100 overflow-hidden">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="shrink-0">{getEventIcon(event.eventType)}</span>
                            <span className="font-bold text-xs text-slate-900 truncate">{event.title}</span>
                            <span className="shrink-0">{getEventBadge(event.eventType)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                            {event.description}
                          </p>
                          {(event.orderNumber || event.saleNumber || event.userName) && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {event.orderNumber && (
                                <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                  #{event.orderNumber}
                                  {event.orderStatus && (
                                    <span className={`ml-1 ${event.orderStatus === 'delivered' ? 'text-green-600' : 'text-orange-500'}`}>
                                      {event.orderStatus === 'delivered' ? 'OK' : '...'}
                                    </span>
                                  )}
                                </span>
                              )}
                              {event.saleNumber && (
                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                  #V:{event.saleNumber}
                                </span>
                              )}
                              {event.userName && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {event.userName.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right align-top bg-emerald-50/30 border-r border-emerald-100">
                        {event.entry > 0 && (
                          <span className="font-black text-sm text-emerald-700">+{event.entry}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right align-top bg-red-50/30 border-r border-red-100">
                        {event.exit > 0 && (
                          <span className="font-black text-sm text-red-700">-{event.exit}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right align-top bg-slate-50">
                        <span className={`font-black text-base ${
                          event.balance > 0 ? 'text-slate-900' :
                          event.balance < 0 ? 'text-red-700' :
                          'text-slate-400'
                        }`}>
                          {event.balance}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.timeline.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 opacity-40">
                  <Clock3 className="h-12 w-12 mb-3" />
                  <p className="text-sm font-black uppercase tracking-widest">Sin movimientos registrados</p>
                </div>
              )}
            </div>
            
            <div className="shrink-0 mt-2">
              <Button onClick={() => setIsOpen(false)} className="w-full">
                Cerrar historial
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
