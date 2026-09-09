import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Bell, TrendingUp, TrendingDown, RefreshCw, CheckCircle,
  Download, Calendar, DollarSign, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";

/**
 * 🟡 MEDIOS #1, #3, #4: Panel de Control Financiero Unificado
 *  - Tab 1: Notificaciones (CXC/CXP vencidas, cajas con diferencias)
 *  - Tab 2: Flujo de Caja Proyectado (30/60/90 días)
 *  - Tab 3: Reconciliación Automática
 */
export default function FinancialControl() {
  const [horizon, setHorizon] = useState<"30" | "60" | "90">("30");
  const [reconcileStart, setReconcileStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [reconcileEnd, setReconcileEnd] = useState(() => new Date().toISOString().split("T")[0]);

  // ── Notificaciones ────────────────────────────────────────────────────────
  const { data: notifData, refetch: refetchNotifs, isLoading: loadingNotifs } =
    trpc.notifications.getAll.useQuery({});

  const markOverdueMut = trpc.notifications.markOverdue.useMutation({
    onSuccess: (res) => {
      toast(res.message);
      refetchNotifs();
    },
  });

  // ── Flujo de caja ─────────────────────────────────────────────────────────
  const { data: cashflow, isLoading: loadingCF } =
    trpc.cashflow.getForecast.useQuery({ horizonDays: horizon });

  // ── Reconciliación ────────────────────────────────────────────────────────
  const { data: reconcileData, refetch: refetchReconcile, isLoading: loadingReconcile } =
    trpc.reconciliation.analyzeInconsistencies.useQuery({
      startDate: reconcileStart,
      endDate: reconcileEnd,
    });

  const applyFixesMut = trpc.reconciliation.applyFixes.useMutation({
    onSuccess: (res) => {
      const msg = res.fixed > 0 ? `✅ ${res.fixed} correcciones aplicadas` : "Sin cambios";
      toast(msg);
      refetchReconcile();
    },
  });

  const fmt = (cents: number) =>
    `Bs. ${(cents / 100).toLocaleString("es-BO", { minimumFractionDigits: 2 })}`;

  const severityColor: Record<string, string> = {
    critical: "bg-red-100 border-red-300 text-red-800",
    warning:  "bg-amber-50 border-amber-300 text-amber-800",
    info:     "bg-blue-50 border-blue-200 text-blue-800",
  };
  const severityBadge: Record<string, "destructive" | "secondary" | "outline"> = {
    critical: "destructive",
    warning:  "secondary",
    info:     "outline",
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Control Financiero</h1>
          <p className="text-muted-foreground">Alertas, flujo de caja y reconciliación automática</p>
        </div>
        {notifData && (
          <div className="flex gap-2 items-center">
            {(notifData.criticalCount ?? 0) > 0 && (
              <Badge variant="destructive" className="text-sm">
                🔴 {notifData.criticalCount} crítica(s)
              </Badge>
            )}
            {(notifData.warningCount ?? 0) > 0 && (
              <Badge variant="secondary" className="text-sm">
                ⚠️ {notifData.warningCount} advertencia(s)
              </Badge>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="notifications">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="notifications" className="relative">
            <Bell className="h-4 w-4 mr-2" />
            Notificaciones
            {(notifData?.criticalCount ?? 0) > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5">
                {notifData?.criticalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cashflow">
            <TrendingUp className="h-4 w-4 mr-2" />
            Flujo de Caja
          </TabsTrigger>
          <TabsTrigger value="reconciliation">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconciliación
          </TabsTrigger>
        </TabsList>

        {/* ── TAB NOTIFICACIONES ─────────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {notifData?.unreadCount ?? 0} alertas activas
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => markOverdueMut.mutate()}
              disabled={markOverdueMut.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar estados vencidos
            </Button>
          </div>

          {loadingNotifs && <p className="text-center text-muted-foreground py-8">Cargando alertas...</p>}

          {notifData?.notifications.length === 0 && !loadingNotifs && (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-green-700">¡Todo en orden!</p>
              <p className="text-muted-foreground">No hay alertas activas en este momento</p>
            </div>
          )}

          <div className="space-y-3">
            {notifData?.notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between p-4 rounded-lg border ${severityColor[n.severity]}`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{n.title}</p>
                      <Badge variant={severityBadge[n.severity]} className="text-xs">
                        {n.severity === "critical" ? "Crítico" : n.severity === "warning" ? "Advertencia" : "Info"}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{n.message}</p>
                    {n.amount && n.amount > 0 && (
                      <p className="text-sm font-medium mt-1">
                        Monto: {fmt(n.amount)}
                      </p>
                    )}
                  </div>
                </div>
                {n.actionUrl && (
                  <Button size="sm" variant="outline" asChild className="ml-4 shrink-0">
                    <a href={n.actionUrl}>{n.actionLabel ?? "Ver"}</a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── TAB FLUJO DE CAJA ──────────────────────────────────────────── */}
        <TabsContent value="cashflow" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Horizonte de proyección:</Label>
            <Select value={horizon} onValueChange={(v) => setHorizon(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="60">60 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingCF && <p className="text-center text-muted-foreground py-8">Calculando proyección...</p>}

          {cashflow && (
            <>
              {/* Warnings */}
              {cashflow.warnings.length > 0 && (
                <div className="space-y-2">
                  {cashflow.warnings.map((w, i) => (
                    <div key={i} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Proyectados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-green-600">
                      {fmt(cashflow.kpis.totalProjectedInflows)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Egresos Proyectados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-red-600">
                      {fmt(cashflow.kpis.totalProjectedOutflows)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Flujo Neto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl font-bold ${cashflow.kpis.netCashflow >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(cashflow.kpis.netCashflow)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Días Críticos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl font-bold ${cashflow.kpis.criticalDaysCount > 0 ? "text-red-600" : "text-green-600"}`}>
                      {cashflow.kpis.criticalDaysCount}
                    </p>
                    <p className="text-xs text-muted-foreground">saldo negativo proyectado</p>
                  </CardContent>
                </Card>
              </div>

              {/* CXC vs CXP pendientes */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                      <ArrowUpRight className="h-4 w-4" />
                      CXC Pendiente de Cobro
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-700">{fmt(cashflow.kpis.pendingCxcTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                      <ArrowDownRight className="h-4 w-4" />
                      CXP Pendiente de Pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-700">{fmt(cashflow.kpis.pendingCxpTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Resumen por semana */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumen Semanal</CardTitle>
                  <CardDescription>Flujo neto proyectado por semana</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(cashflow.weekSummary).slice(0, 12).map(([week, data]) => (
                      <div key={week} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-sm font-medium">{week}</span>
                        <div className="flex gap-6 text-sm">
                          <span className="text-green-600">+{fmt(data.totalIn)}</span>
                          <span className="text-red-600">-{fmt(data.totalOut)}</span>
                          <span className={`font-bold ${data.net >= 0 ? "text-green-700" : "text-red-700"}`}>
                            = {fmt(data.net)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── TAB RECONCILIACIÓN ─────────────────────────────────────────── */}
        <TabsContent value="reconciliation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Período de Análisis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Fecha Inicio</Label>
                  <Input type="date" value={reconcileStart} onChange={(e) => setReconcileStart(e.target.value)} />
                </div>
                <div>
                  <Label>Fecha Fin</Label>
                  <Input type="date" value={reconcileEnd} onChange={(e) => setReconcileEnd(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => refetchReconcile()} disabled={loadingReconcile} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Analizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {reconcileData && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Ventas sin transacción", value: reconcileData.summary.salesWithoutTransaction, color: "red" },
                  { label: "Cajas desajustadas", value: reconcileData.summary.cashRegisterDiscrepancies, color: "amber" },
                  { label: "CXC vencidas", value: reconcileData.summary.overdueReceivable, color: "orange" },
                  { label: "CXP vencidas", value: reconcileData.summary.overduePayable, color: "red" },
                ].map((item) => (
                  <Card key={item.label} className={item.value > 0 ? "border-amber-300" : "border-green-200"}>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{item.value}</p>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {reconcileData.summary.totalIssues === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-medium text-green-700">Todo reconciliado</p>
                  <p className="text-muted-foreground">No se encontraron inconsistencias en el período</p>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      applyFixesMut.mutate({
                        startDate: reconcileStart,
                        endDate: reconcileEnd,
                        fixSalesWithoutTx: true,
                        fixCashRegSales: true,
                        fixOverdueCxc: true,
                        fixOverdueCxp: true,
                      })
                    }
                    disabled={applyFixesMut.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {applyFixesMut.isPending ? "Aplicando..." : `Corregir ${reconcileData.summary.totalIssues} inconsistencias`}
                  </Button>
                </div>
              )}

              {/* Log de resultados */}
              {applyFixesMut.data && (
                <Card>
                  <CardHeader>
                    <CardTitle>Resultado de Correcciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {applyFixesMut.data.log.map((entry, i) => (
                        <p key={i} className="text-sm font-mono text-green-700">{entry}</p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
