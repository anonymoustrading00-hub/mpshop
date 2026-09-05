import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wallet, Package,
  RefreshCw, Calendar, PieChart, Wrench, Clock, Award, BarChart3, Activity,
  Filter, ArrowUpRight, ArrowDownRight, CreditCard, ShieldAlert, CheckCircle2,
  CalendarDays, ChevronRight, Layers, Receipt, Briefcase, FileSpreadsheet
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

const PRESETS = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "this_week", label: "Esta Semana" },
  { id: "current_month", label: "Mes Actual" },
  { id: "last_month", label: "Mes Anterior" },
  { id: "last_3_months", label: "Últimos 3 Meses" },
  { id: "this_year", label: "Este Año" },
  { id: "all_time", label: "Histórico Total" },
  { id: "custom", label: "Personalizado" },
];

export default function DashboardKPIs() {
  const { user } = useAuth();
  const [rangePreset, setRangePreset] = useState("current_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const queryParams = {
    rangePreset,
    startDate: rangePreset === "custom" && customStart ? customStart : undefined,
    endDate: rangePreset === "custom" && customEnd ? customEnd : undefined,
  };

  const { data, isLoading, refetch, isFetching } = trpc.dashboard.getBusinessDashboard.useQuery(
    queryParams,
    { enabled: !!user, refetchInterval: 5 * 60 * 1000 }
  );

  return (
    <div className="min-h-screen bg-slate-900/5 dark:bg-slate-950 pb-20">
      {/* ═══ HEADER EJECUTIVO CORPORATIVO ═══ */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border-b border-slate-800 shadow-xl">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 p-0.5 shadow-lg shadow-indigo-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <BarChart3 className="h-7 w-7 text-indigo-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                    CFO Intelligence
                  </span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs text-slate-400 font-medium">Cuadre Automático Activo</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  Dashboard de Rentabilidad & Flujo
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                  Auditoría integral en tiempo real: Ventas, Compras, Margen Bruto, OPEX y Cuentas por Pagar/Cobrar
                </p>
              </div>
            </div>

            {/* Selector de Acciones Rápidas & Botón Refrescar */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${isFetching ? "animate-spin" : ""}`} />
                <span>{isFetching ? "Calculando..." : "Actualizar Datos"}</span>
              </button>
            </div>
          </div>

          {/* ═══ BARRA DE FILTRO POR RANGO DE FECHAS Y PRESETS ═══ */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none">
              <CalendarDays className="h-4 w-4 text-slate-400 shrink-0 mr-1" />
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setRangePreset(preset.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    rangePreset === preset.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-500"
                      : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Inputs de rango personalizado */}
            <div className="flex items-center gap-2 bg-slate-800/60 p-1.5 rounded-xl border border-slate-700/70 shrink-0">
              <span className="text-[11px] font-bold text-slate-400 px-2">Desde:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setRangePreset("custom");
                }}
                className="bg-slate-900 text-white text-xs px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
              />
              <span className="text-[11px] font-bold text-slate-400 px-1">Hasta:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setRangePreset("custom");
                }}
                className="bg-slate-900 text-white text-xs px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>

          {/* Rótulo de Período Activo */}
          {data?.period && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-indigo-300 bg-indigo-950/50 w-fit px-3 py-1 rounded-lg border border-indigo-800/50">
              <Clock className="h-3.5 w-3.5 text-indigo-400" />
              <span>Período Auditado: <strong className="text-white">{data.period.label}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CONTENIDO DEL DASHBOARD ═══ */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div key={i} className="h-32 bg-white rounded-2xl shadow-sm border border-slate-200 animate-pulse" />
              ))}
            </div>
            <div className="h-80 bg-white rounded-2xl shadow-sm border border-slate-200 animate-pulse" />
          </div>
        ) : !data ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <Activity className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-700">Sin datos disponibles en este rango</p>
            <p className="text-xs text-slate-500 mt-1">Modifique los filtros o seleccione otro período para auditar</p>
          </div>
        ) : (
          <>
            {/* ═══ SECCIÓN 1: KPIs MAESTROS DE RENTABILIDAD & FLUJO ═══ */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-indigo-600" />
                  Estado de Resultados del Período ({data.period?.label})
                </h2>
                <span className="text-[11px] font-bold text-slate-400">Valores en Bolivianos (Bs.)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* 1. Facturación / Ventas */}
                <BusinessKpiCard
                  label="Ventas Totales"
                  value={data.kpis.totalRevenue}
                  valueType="currency"
                  subtitle={`${data.kpis.salesCount} ventas cerradas`}
                  icon={DollarSign}
                  accent="emerald"
                  trend={data.kpis.previousMonthComparison}
                />

                {/* 2. COGS Real */}
                <BusinessKpiCard
                  label="Costo Mercadería (COGS)"
                  value={data.kpis.totalCOGS}
                  valueType="currency"
                  subtitle="Costo de compra + reparaciones"
                  icon={Package}
                  accent="red"
                />

                {/* 3. Ganancia Bruta */}
                <BusinessKpiCard
                  label="Ganancia Bruta"
                  value={data.kpis.grossProfit}
                  valueType="currency"
                  subtitle={`Margen bruto: ${data.kpis.grossMarginPct.toFixed(1)}%`}
                  icon={TrendingUp}
                  accent="blue"
                />

                {/* 4. Gastos Operativos (OPEX) */}
                <BusinessKpiCard
                  label="Gastos OPEX"
                  value={data.kpis.operationalExpenses}
                  valueType="currency"
                  subtitle="Excluye compras de mercadería"
                  icon={Wallet}
                  accent="amber"
                />

                {/* 5. Ganancia Neta */}
                <BusinessKpiCard
                  label="Ganancia Neta"
                  value={data.kpis.netProfit}
                  valueType="currency"
                  subtitle={`Margen neto: ${data.kpis.netMarginPct.toFixed(1)}%`}
                  icon={Award}
                  accent={data.kpis.netProfit >= 0 ? "emerald" : "red"}
                />
              </div>
            </div>

            {/* ═══ SECCIÓN 2: BALANCES DE CAPITAL, COMPRAS Y CRÉDITOS ═══ */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-600" />
                  Posición Financiera, Compras & Cuentas Pendientes
                </h2>
                <span className="text-[11px] font-bold text-slate-400">Cuadre exacto con Módulo Compras y CXP</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* Compras en el Período */}
                <BusinessKpiCard
                  label="Compras del Período"
                  value={data.kpis.totalPurchases}
                  valueType="currency"
                  subtitle={`${data.kpis.purchasesCount} órdenes de compra`}
                  icon={ShoppingCart}
                  accent="blue"
                />

                {/* Capital en Inventario Activo */}
                <BusinessKpiCard
                  label="Capital en Stock"
                  value={data.kpis.inventoryValue}
                  valueType="currency"
                  subtitle="Equipos disponibles/en taller"
                  icon={Package}
                  accent="purple"
                />

                {/* Cuentas por Pagar (CXP) */}
                <BusinessKpiCard
                  label="Deuda Proveedores (CXP)"
                  value={data.kpis.totalAP}
                  valueType="currency"
                  subtitle="Saldo pendiente a pagar"
                  icon={CreditCard}
                  accent={data.kpis.totalAP > 0 ? "amber" : "slate"}
                />

                {/* Cuentas por Cobrar (CXC) */}
                <BusinessKpiCard
                  label="Créditos Clientes (CXC)"
                  value={data.kpis.totalAR}
                  valueType="currency"
                  subtitle="Saldo pendiente por cobrar"
                  icon={ArrowDownRight}
                  accent="emerald"
                />

                {/* Ticket Promedio de Venta */}
                <BusinessKpiCard
                  label="Ticket Promedio"
                  value={data.kpis.averageTicket}
                  valueType="currency"
                  subtitle="Por transacción efectuada"
                  icon={Activity}
                  accent="slate"
                />
              </div>
            </div>

            {/* ═══ SECCIÓN 3: GRÁFICAS EJECUTIVAS: CASCADA Y FLUJOS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cascada de Resultados */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Layers className="h-5 w-5 text-indigo-600" />
                      Cascada Financiera del Período
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Desglose contable: Facturación → COGS → Margen Bruto → OPEX → Margen Neto
                    </p>
                  </div>
                </div>
                <WaterfallChart data={data.waterfall} />
              </div>

              {/* Rentabilidad por Flujo de Negocio */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-emerald-600" />
                      Rentabilidad por Flujo de Negocio
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Comparativa de márgenes entre Usado Directo, Reparado e Inventario Nuevo
                    </p>
                  </div>
                </div>
                <FlowComparisonChart data={data.flowSummary} />
              </div>
            </div>

            {/* ═══ SECCIÓN 4: EVOLUCIÓN TEMPORAL ADAPTATIVA ═══ */}
            <Card className="border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-indigo-600" />
                      Evolución Temporal de Ingresos vs. Ganancia
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Distribución progresiva según el período filtrado ({data.period?.label})
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-blue-600">
                      <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Facturación
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Ganancia
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {data.weeklySales && data.weeklySales.length > 0 ? (
                  <LineResponsive width="100%" height={320}>
                    <AreaChart data={data.weeklySales} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} dy={10} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(v) => `${(v / 100).toLocaleString("es-BO")} Bs`}
                      />
                      <LineTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          borderRadius: 12,
                          border: "none",
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fill="url(#colorRevenue)"
                        name="Ingresos"
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#colorProfit)"
                        name="Ganancia"
                      />
                    </AreaChart>
                  </LineResponsive>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs font-medium">
                    No se registraron ventas en los intervalos de este período
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ SECCIÓN 5: PIPELINE OPERATIVO & GASTOS DETALLADOS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline Operativo de Equipos */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Package className="h-5 w-5 text-indigo-600" />
                      Pipeline Operativo de Equipos
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Embudo desde adquisición hasta venta final</p>
                  </div>
                </div>
                <EquipmentFlowDiagram data={data.equipmentFlow} />
              </div>

              {/* Distribución de Gastos Operativos */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-amber-600" />
                      Desglose de Gastos Operativos (OPEX)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Costos directos e indirectos operativos en el período</p>
                  </div>
                </div>

                {Object.keys(data.expensesByCategory).length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs font-medium">
                    No hay gastos operativos registrados en este período
                  </div>
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
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {Object.keys(data.expensesByCategory).map((cat, index) => (
                            <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[cat] || "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: number) => formatCurrency(val * 100)} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      </RechartsPie>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {Object.entries(data.expensesByCategory).map(([cat, val]) => (
                        <div
                          key={cat}
                          className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100"
                        >
                          <span className="text-xs font-bold text-slate-600">{EXPENSE_LABELS[cat] || cat}</span>
                          <span className="text-xs font-black text-slate-900">{formatCurrency(Number(val))}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ═══ SECCIÓN 6: CENTRO TÉCNICO Y ROTACIÓN ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Taller de Reparaciones */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-cyan-600" />
                      Centro Técnico & Taller
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Eficiencia y tiempos de reparación</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
                    <p className="text-[11px] font-bold text-amber-700 uppercase">En Reparación</p>
                    <p className="text-2xl font-black text-amber-900 mt-0.5">{data.repairStatus.inProgress}</p>
                    <p className="text-[10px] text-amber-600 font-medium">Equipos activos en banco</p>
                  </div>
                  <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <p className="text-[11px] font-bold text-emerald-700 uppercase">Completadas</p>
                    <p className="text-2xl font-black text-emerald-900 mt-0.5">{data.repairStatus.completed}</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Finalizadas en período</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-800">Tiempo Promedio por Reparación</p>
                    <p className="text-[11px] text-blue-600">Desde ingreso hasta test final</p>
                  </div>
                  <span className="text-2xl font-black text-blue-900">{data.repairStatus.avgDays} días</span>
                </div>
              </div>

              {/* Rotación de Inventario */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-indigo-600" />
                      Rotación de Inventario por Flujo
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Velocidad media de venta de los equipos</p>
                  </div>
                </div>

                <div className="p-5 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl text-white text-center mb-4 shadow-md shadow-indigo-500/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-100">Promedio General</p>
                  <p className="text-4xl font-black text-white my-1">{data.rotation.avgDays}</p>
                  <p className="text-xs text-indigo-200 font-medium">Días desde compra hasta venta</p>
                </div>

                <div className="space-y-2">
                  {data.rotation.byFlow.map((flow: any) => (
                    <div
                      key={flow.flow}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <span className="text-xs font-bold text-slate-700">
                        {flow.flow === "usado_directo"
                          ? "Usado Directo"
                          : flow.flow === "reparado"
                          ? "Reparado"
                          : "Inventario Nuevo"}
                      </span>
                      <span className="text-sm font-black text-slate-900">{flow.avgDays} días promedio</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ SECCIÓN 7: TOP PRODUCTOS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Vendidos */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Award className="h-5 w-5 text-emerald-600" />
                    Top Más Vendidos (Por Volumen)
                  </h3>
                </div>
                {data.topProducts.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">Sin ventas registradas en el período</div>
                ) : (
                  <div className="space-y-2">
                    {data.topProducts.map((p: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{p.name}</p>
                            <p className="text-[11px] text-slate-400">{p.sales} unidades vendidas</p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-emerald-600">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Rentables */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Top Más Rentables (Por Ganancia Neta)
                  </h3>
                </div>
                {data.topProfitable.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">Sin ventas registradas en el período</div>
                ) : (
                  <div className="space-y-2">
                    {data.topProfitable.map((p: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{p.name}</p>
                            <p className="text-[11px] text-slate-400">{p.sales} unidades vendidas</p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-indigo-600">{formatCurrency(p.profit)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ SECCIÓN 8: ALERTAS DE GESTIÓN CORPORATIVA ═══ */}
            {data.alerts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Alertas Automáticas del Negocio
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {data.alerts.map((alert: any, idx: number) => (
                    <AlertCard key={idx} type={alert.type} title={alert.title} description={alert.description} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

