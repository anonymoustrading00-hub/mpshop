/**
 * Dashboard de Rentabilidad Ejecutivo — Diseño Corporativo Profesional
 * Análisis por flujo de negocio: usado directo, reparado, inventario nuevo
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wallet, Package,
  RefreshCw, Calendar, PieChart, Wrench, Clock, Award, BarChart3, Activity,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { BusinessKpiCard } from "@/components/dashboard/BusinessKpiCard";
import { WaterfallChart } from "@/components/dashboard/WaterfallChart";
import { FlowComparisonChart } from "@/components/dashboard/FlowComparisonChart";
import { EquipmentFlowDiagram } from "@/components/dashboard/EquipmentFlowDiagram";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as LineTooltip, ResponsiveContainer as LineResponsive, Area, AreaChart } from "recharts";

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
  const [dateRange, setDateRange] = useState("current_month");
  
  const { data, isLoading, refetch, isFetching } = trpc.dashboard.getBusinessDashboard.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 5 * 60 * 1000 }
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      {/* Hero Header Corporativo */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <BarChart3 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Dashboard Ejecutivo
                  </h1>
                  <p className="text-sm text-slate-300 font-medium">
                    Análisis de Rentabilidad · MP Shop
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="current_month" className="text-slate-900">Mes actual</option>
                <option value="last_month" className="text-slate-900">Mes anterior</option>
                <option value="last_3_months" className="text-slate-900">Últimos 3 meses</option>
              </select>
              
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-6 space-y-6 mb-20 md:mb-10">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-32 bg-white/50 animate-pulse rounded-2xl shadow-sm" />
            ))}
          </div>
        ) : !data ? (
          <div className="py-20 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <Activity className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">Sin datos disponibles</p>
          </div>
        ) : (
          <>
            {/* ═══ KPIs PRINCIPALES - Diseño Corporativo ═══ */}
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

            {/* ═══ ANÁLISIS FINANCIERO - 2 Columnas ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cascada Financiera - Card Mejorado */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500 rounded-xl">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Cascada Financiera</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Flujo de ingresos a ganancia neta</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <WaterfallChart data={data.waterfall} />
                </CardContent>
              </Card>

              {/* Rentabilidad por Flujo - Card Mejorado */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-green-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500 rounded-xl">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Rentabilidad por Flujo</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Comparativa de márgenes por negocio</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <FlowComparisonChart data={data.flowSummary} />
                </CardContent>
              </Card>
            </div>

            {/* ═══ OPERACIONES - 2 Columnas ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Flujo de Equipos - Card Mejorado */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-500 rounded-xl">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Pipeline de Equipos</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Embudo de proceso operativo</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <EquipmentFlowDiagram data={data.equipmentFlow} />
                </CardContent>
              </Card>
              
              {/* Gastos Operativos - Card Mejorado */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500 rounded-xl">
                      <PieChart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Gastos Operativos</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Distribución por categoría</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {Object.keys(data.expensesByCategory).length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">Sin gastos registrados</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <RechartsPie>
                          <Pie
                            data={Object.entries(data.expensesByCategory).map(([cat, val]) => ({
                              name: EXPENSE_LABELS[cat] || cat,
                              value: Number(val) / 100,
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={2}
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
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {Object.entries(data.expensesByCategory).map(([cat, val]) => (
                          <div key={cat} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
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

            {/* ═══ MÉTRICAS DE GESTIÓN - 2 Columnas ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Estado de Reparaciones - Card Mejorado */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-cyan-50 to-blue-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500 rounded-xl">
                      <Wrench className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Centro de Reparaciones</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Métricas del taller técnico</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                      <p className="text-xs font-bold text-amber-700 uppercase mb-1">En Progreso</p>
                      <p className="text-3xl font-black text-amber-900">{data.repairStatus.inProgress}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Completadas</p>
                      <p className="text-3xl font-black text-emerald-900">{data.repairStatus.completed}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                      <p className="text-xs font-bold text-blue-700 uppercase mb-1">Tiempo Promedio</p>
                      <p className="text-2xl font-black text-blue-900">{data.repairStatus.avgDays} días</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                      <p className="text-xs font-bold text-red-700 uppercase mb-1">Pérdidas</p>
                      <p className="text-2xl font-black text-red-900">{data.repairStatus.lossRepairs}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rotación de Inventario - Card Mejorado */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500 rounded-xl">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Rotación de Inventario</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Velocidad de venta por flujo</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-center">
                    <p className="text-xs font-bold text-blue-100 uppercase mb-2">Promedio General</p>
                    <p className="text-5xl font-black text-white mb-1">{data.rotation.avgDays}</p>
                    <p className="text-xs text-blue-100 font-medium">días en inventario</p>
                  </div>
                  <div className="space-y-2">
                    {data.rotation.byFlow.map((flow) => (
                      <div key={flow.flow} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
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

            {/* ═══ TOP PRODUCTOS - 2 Columnas ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Vendidos */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500 rounded-xl">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Top 5 Más Vendidos</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Por volumen de ventas</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {data.topProducts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">Sin ventas registradas</div>
                  ) : (
                    <div className="space-y-2">
                      {data.topProducts.map((product: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl hover:shadow-md transition-all border border-slate-100">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white font-black text-sm shadow-md">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                              <p className="text-xs text-slate-500">{product.sales} ventas</p>
                            </div>
                          </div>
                          <p className="text-sm font-black text-emerald-600">{formatCurrency(product.revenue)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Rentables */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500 rounded-xl">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">Top 5 Más Rentables</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Por ganancia generada</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {data.topProfitable.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">Sin ventas registradas</div>
                  ) : (
                    <div className="space-y-2">
                      {data.topProfitable.map((product: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl hover:shadow-md transition-all border border-slate-100">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-sm shadow-md">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                              <p className="text-xs text-slate-500">{product.sales} ventas</p>
                            </div>
                          </div>
                          <p className="text-sm font-black text-blue-600">{formatCurrency(product.profit)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ═══ ALERTAS AUTOMÁTICAS ═══ */}
            {data.alerts.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-amber-500 rounded-xl">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Alertas del Sistema</h2>
                    <p className="text-xs text-slate-500">Notificaciones automáticas de gestión</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.alerts.map((alert: any, index: number) => (
                    <AlertCard key={index} type={alert.type} title={alert.title} description={alert.description} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ EVOLUCIÓN DE VENTAS ═══ */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500 rounded-xl">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">Evolución de Ventas</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Tendencia de ingresos y ganancia (últimas 8 semanas)</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <LineResponsive width="100%" height={320}>
                  <AreaChart data={data.weeklySales} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${(v / 100).toFixed(0)} Bs`} />
                    <LineTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="url(#colorRevenue)" name="Ingresos (Bs)" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="url(#colorProfit)" name="Ganancia (Bs)" />
                  </AreaChart>
                </LineResponsive>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
