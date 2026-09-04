/**
 * Dashboard de Rentabilidad Completo — 10 Secciones
 * Análisis por flujo de negocio: usado directo, reparado, inventario nuevo
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, DollarSign, ShoppingCart, Wallet, Package,
  RefreshCw, Calendar, PieChart, Wrench, Clock, Award,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { BusinessKpiCard } from "@/components/dashboard/BusinessKpiCard";
import { WaterfallChart } from "@/components/dashboard/WaterfallChart";
import { FlowComparisonChart } from "@/components/dashboard/FlowComparisonChart";
import { EquipmentFlowDiagram } from "@/components/dashboard/EquipmentFlowDiagram";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as LineTooltip, ResponsiveContainer as LineResponsive } from "recharts";

const EXPENSE_COLORS: Record<string, string> = {
  repairs: "#3b82f6",
  labor: "#8b5cf6",
  rent: "#ef4444",
  transport: "#f59e0b",
  marketing: "#10b981",
  services: "#06b6d4",
  other: "#64748b",
};

const EXPENSE_LABELS: Record<string, string> = {
  repairs: "Repuestos",
  labor: "Mano de Obra",
  rent: "Alquiler",
  transport: "Transporte",
  marketing: "Marketing",
  services: "Servicios",
  other: "Otros",
};

export default function DashboardKPIs() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState("current_month"); // Decorativo por ahora
  
  const { data, isLoading, refetch, isFetching } = trpc.dashboard.getBusinessDashboard.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 5 * 60 * 1000 }
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1800px] mx-auto mb-20 md:mb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Dashboard de <span className="text-emerald-600">Rentabilidad</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Análisis completo por flujo de negocio · MP Shop
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600"
          >
            <option value="current_month">Mes actual</option>
            <option value="last_month">Mes anterior</option>
            <option value="last_3_months">Últimos 3 meses</option>
          </select>
          <button
            onClick={() => refetch()}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all ${isFetching ? "opacity-60" : ""}`}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : !data ? (
        <div className="py-20 text-center text-slate-400">Sin datos disponibles</div>
      ) : (
        <>
          {/* ═══ SECCIÓN 1: KPIs PRINCIPALES ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <BusinessKpiCard
              label="Ingresos Totales"
              value={data.kpis.totalRevenue}
              valueType="currency"
              subtitle="Ventas del período"
              icon={DollarSign}
              accent="emerald"
              trend={data.kpis.previousMonthComparison}
            />
            <BusinessKpiCard
              label="Costo Mercadería"
              value={data.kpis.totalCOGS}
              valueType="currency"
              subtitle="Compra + Reparaciones"
              icon={Package}
              accent="red"
            />
            <BusinessKpiCard
              label="Ganancia Bruta"
              value={data.kpis.grossProfit}
              valueType="currency"
              subtitle="Ingresos - COGS"
              icon={TrendingUp}
              accent="blue"
            />
            <BusinessKpiCard
              label="Gastos Operativos"
              value={data.kpis.operationalExpenses}
              valueType="currency"
              subtitle="Alquiler, transporte, etc."
              icon={Wallet}
              accent="amber"
            />
            <BusinessKpiCard
              label="Ganancia Neta"
              value={data.kpis.netProfit}
              valueType="currency"
              subtitle="Después de gastos"
              icon={Award}
              accent={data.kpis.netProfit >= 0 ? "emerald" : "red"}
            />
            <BusinessKpiCard
              label="Margen Neto"
              value={data.kpis.netMarginPct}
              valueType="percentage"
              subtitle="% de ingresos"
              icon={TrendingUp}
              accent={data.kpis.netMarginPct >= 15 ? "emerald" : data.kpis.netMarginPct >= 5 ? "amber" : "red"}
            />
            <BusinessKpiCard
              label="Capital en Inventario"
              value={data.kpis.inventoryValue}
              valueType="currency"
              subtitle="Equipos sin vender"
              icon={ShoppingCart}
              accent="purple"
            />
          </div>

          {/* ═══ SECCIÓN 2 & 3: CASCADA + RENTABILIDAD POR FLUJO ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WaterfallChart data={data.waterfall} />
            <FlowComparisonChart data={data.flowSummary} />
          </div>

          {/* ═══ SECCIÓN 4 & 5: FLUJO DE EQUIPOS + GASTOS POR CATEGORÍA ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EquipmentFlowDiagram data={data.equipmentFlow} />
            
            {/* Gastos por categoría */}
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <PieChart className="h-4 w-4 text-amber-600" />
                  </div>
                  Gastos Operativos por Categoría
                </CardTitle>
                <p className="text-xs text-slate-500">Desglose de gastos del período</p>
              </CardHeader>
              <CardContent>
                {Object.keys(data.expensesByCategory).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Sin gastos registrados</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <RechartsPie>
                        <Pie
                          data={Object.entries(data.expensesByCategory).map(([cat, val]) => ({
                            name: EXPENSE_LABELS[cat] || cat,
                            value: Number(val) / 100,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {Object.keys(data.expensesByCategory).map((cat, index) => (
                            <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[cat] || "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: number) => formatCurrency(val * 100)} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                      </RechartsPie>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {Object.entries(data.expensesByCategory).map(([cat, val]) => (
                        <div key={cat} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                          <span className="text-xs font-bold text-slate-600">{EXPENSE_LABELS[cat] || cat}</span>
                          <span className="text-xs font-black text-slate-900">{formatCurrency(Number(val))}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ SECCIÓN 6 & 7: ESTADO REPARACIONES + ROTACIÓN ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Estado de reparaciones */}
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <div className="p-2 bg-violet-100 rounded-xl">
                    <Wrench className="h-4 w-4 text-violet-600" />
                  </div>
                  Estado de Reparaciones
                </CardTitle>
                <p className="text-xs text-slate-500">Taller y tiempos de reparación</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-amber-50 rounded-xl text-center border border-amber-100">
                    <p className="text-xs font-bold text-amber-600 uppercase">En Progreso</p>
                    <p className="text-3xl font-black text-amber-900">{data.repairStatus.inProgress}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-600 uppercase">Completadas</p>
                    <p className="text-3xl font-black text-emerald-900">{data.repairStatus.completed}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl text-center border border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase">Tiempo Promedio</p>
                    <p className="text-2xl font-black text-blue-900">{data.repairStatus.avgDays} días</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl text-center border border-red-100">
                    <p className="text-xs font-bold text-red-600 uppercase">Reparaciones en Pérdida</p>
                    <p className="text-2xl font-black text-red-900">{data.repairStatus.lossRepairs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rotación de inventario */}
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  Rotación de Inventario
                </CardTitle>
                <p className="text-xs text-slate-500">Días promedio compra → venta</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 text-center">
                  <p className="text-xs font-bold text-blue-600 uppercase mb-1">Promedio General</p>
                  <p className="text-5xl font-black text-blue-900">{data.rotation.avgDays}</p>
                  <p className="text-xs text-blue-700 mt-1">días en inventario</p>
                </div>
                <div className="space-y-2">
                  {data.rotation.byFlow.map((flow) => (
                    <div key={flow.flow} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="text-sm font-bold text-slate-700">
                        {flow.flow === "usado_directo" ? "Usado Directo" : flow.flow === "reparado" ? "Reparado" : "Inventario Nuevo"}
                      </span>
                      <span className="text-lg font-black text-slate-900">{flow.avgDays} días</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ SECCIÓN 8: TOP PRODUCTOS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top vendidos */}
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <Award className="h-4 w-4 text-emerald-600" />
                  </div>
                  Top 5 Más Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Sin ventas registradas</div>
                ) : (
                  <div className="space-y-2">
                    {data.topProducts.map((product: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                            <p className="text-xs text-slate-500">{product.sales} ventas</p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-slate-900">{formatCurrency(product.revenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top rentables */}
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  Top 5 Más Rentables
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.topProfitable.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Sin ventas registradas</div>
                ) : (
                  <div className="space-y-2">
                    {data.topProfitable.map((product: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                            <p className="text-xs text-slate-500">{product.sales} ventas</p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-emerald-600">{formatCurrency(product.profit)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ SECCIÓN 9: ALERTAS AUTOMÁTICAS ═══ */}
          {data.alerts.length > 0 && (
            <div>
              <h2 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
                Alertas Automáticas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.alerts.map((alert: any, index: number) => (
                  <AlertCard key={index} type={alert.type} title={alert.title} description={alert.description} />
                ))}
              </div>
            </div>
          )}

          {/* ═══ SECCIÓN 10: VENTAS POR PERÍODO ═══ */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-black flex items-center gap-2">
                <div className="p-2 bg-violet-100 rounded-xl">
                  <Calendar className="h-4 w-4 text-violet-600" />
                </div>
                Ventas por Período (Últimas 8 Semanas)
              </CardTitle>
              <p className="text-xs text-slate-500">Evolución de ingresos y ganancia neta</p>
            </CardHeader>
            <CardContent>
              <LineResponsive width="100%" height={300}>
                <LineChart data={data.weeklySales} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${(v / 100).toFixed(0)} Bs`} />
                  <LineTooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} name="Ingresos (Bs)" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} name="Ganancia (Bs)" dot={{ r: 4 }} />
                </LineChart>
              </LineResponsive>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
