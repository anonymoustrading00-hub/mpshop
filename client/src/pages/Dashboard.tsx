import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Package, Truck, TrendingUp, Eye } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/currency";
import { useMemo, useState } from "react";
import { RepurchaseSuggestions } from "@/components/RepurchaseSuggestions";

function getLocalDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.stats.getDashboardStats.useQuery(
    undefined,
    { enabled: user?.role === "admin" }
  );
  const { data: orders } = trpc.orders.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: customers } = trpc.customers.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const today = getLocalDateInputValue();
  const [tableDate, setTableDate] = useState(today);

  const todayOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o: any) =>
      !tableDate || !o.deliveryDate || o.deliveryDate === tableDate
    ).sort((a: any, b: any) => {
      const ta = a.deliveryTime || "99:99";
      const tb = b.deliveryTime || "99:99";
      return ta.localeCompare(tb);
    });
  }, [orders, tableDate]);

  const getCustomerName = (order: any) => {
    return (order as any).customerName || (customers as any[])?.find((c: any) => c.id === order.customerId)?.name || "—";
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending:    { label: "Pendiente",  className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      assigned:   { label: "Asignado",  className: "bg-blue-100 text-blue-800 border-blue-200" },
      in_transit: { label: "En Reparto", className: "bg-purple-100 text-purple-800 border-purple-200" },
      delivered:  { label: "Entregado", className: "bg-green-100 text-green-800 border-green-200" },
      cancelled:  { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-200" },
    };
    const s = map[status] || { label: status, className: "bg-gray-100 text-gray-700 border-gray-200" };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>{s.label}</span>;
  };

  const getPaymentBadge = (paymentStatus: string) => {
    if (paymentStatus === "completed") {
      return <span className="flex items-center gap-1.5 text-sm text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Pagado</span>;
    }
    return <span className="flex items-center gap-1.5 text-sm text-orange-500"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Pendiente</span>;
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Solo administradores pueden acceder al dashboard</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Cargando estadísticas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background p-4 md:p-6 pb-20 md:pb-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-8"><span className="text-blue-600">Dashboard</span></h1>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-t-4 border-t-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-yellow-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.pendingOrders || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Tránsito</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.inTransitOrders || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entregados</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.deliveredOrders || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Resumen Financiero Solicitado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-emerald-50/50 border-emerald-200 border-t-4 border-t-emerald-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Caja Efectivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-700">
                {formatCurrency((stats as any)?.revenueByMethod?.cash || 0)}
              </div>
              <p className="text-[10px] text-emerald-600 mt-1 italic">Ingresos recaudados en efectivo</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/50 border-blue-200 border-t-4 border-t-blue-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-blue-800 uppercase tracking-wider">Caja QR / Digital</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-blue-700">
                {formatCurrency((stats as any)?.revenueByMethod?.qr || 0)}
              </div>
              <p className="text-[10px] text-blue-600 mt-1 italic">Cobros por códigos QR</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-50/50 border-purple-200 border-t-4 border-t-purple-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-purple-800 uppercase tracking-wider">Cuenta Bancaria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-purple-700">
                {formatCurrency((stats as any)?.revenueByMethod?.transfer || 0)}
              </div>
              <p className="text-[10px] text-purple-600 mt-1 italic">Transferencias bancarias directas</p>
            </CardContent>
          </Card>
        </div>

        {/* Ingresos */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos Totales (Global)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(stats?.totalRevenue || 0)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Suma de todos los métodos de pago</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <RepurchaseSuggestions />
        </div>

        {/* Tabla de pedidos del día */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Pedidos del Día</CardTitle>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={tableDate}
                  onChange={(e) => setTableDate(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background"
                />
                {tableDate && (
                  <button
                    onClick={() => setTableDate("")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Ver todos
                  </button>
                )}
                <Link href="/orders">
                  <Button variant="outline" size="sm">Ver todos →</Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pedido #</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pago</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {todayOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                        No hay pedidos para la fecha seleccionada
                      </td>
                    </tr>
                  ) : (
                    todayOrders.map((order: any) => (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-sm">{order.orderNumber}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-sm">{getCustomerName(order)}</p>
                            {order.deliveryPersonName && (
                              <p className="text-xs text-muted-foreground mt-0.5">Rep: {order.deliveryPersonName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-4">
                          {getPaymentBadge(order.paymentStatus)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-sm">{formatCurrency(order.totalPrice)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Link href={`/order/${order.id}`}>
                            <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {todayOrders.length > 0 && (
              <div className="px-6 py-3 border-t bg-muted/20 flex justify-between items-center text-sm text-muted-foreground">
                <span>{todayOrders.length} pedido(s) encontrado(s)</span>
                <span className="font-semibold text-foreground">
                  Total: {formatCurrency(todayOrders.reduce((s: number, o: any) => s + o.totalPrice, 0))}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
