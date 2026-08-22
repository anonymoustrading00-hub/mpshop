/**
 * Módulo de Rentabilidad — Estado de Resultados real del negocio
 * Análisis multidimensional por rango de fechas, sucursal, método de pago y marcas.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/currency";
import { useBranch } from "@/contexts/BranchContext";
import {
  TrendingUp, TrendingDown, DollarSign, Package, Wrench,
  ShieldAlert, Receipt, BarChart3, ArrowDown, Boxes,
  CircleDollarSign, ShoppingCart, Percent, Calendar, Filter,
  RotateCcw, Sparkles, Laptop, Search, CreditCard, PieChart as PieIcon,
  Layers, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, LineChart, Line, CartesianGrid, AreaChart, Area,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => formatCurrency(n || 0);
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n || 0).toFixed(1)}%`;

const CATEGORY_LABELS: Record<string, string> = {
  rent: "Alquiler",
  salaries: "Sueldos",
  electricity: "Luz / Energía",
  water: "Agua",
  internet: "Internet",
  telephone: "Teléfono",
  facebook_ads: "Facebook Ads",
  google_ads: "Google Ads",
  maintenance: "Mantenimiento",
  supplies: "Insumos Oficina",
  workshop_supplies: "Insumos Taller",
  logistics: "Combustible / Viáticos",
  marketing: "Publicidad & Marketing",
  utilities: "Servicios Básicos",
  taxes: "Impuestos",
  insurance: "Seguros",
  bank_fees: "Comisiones Bancarias",
  other: "Otros",
};

const PIE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#3b82f6", "#06b6d4", "#84cc16", "#ef4444"];

const PERIOD_PRESETS = [
  { id: "today", label: "Hoy" },
  { id: "week", label: "Últimos 7 días" },
  { id: "month", label: "Este Mes" },
  { id: "last_month", label: "Mes Anterior" },
  { id: "quarter", label: "Trimestre" },
  { id: "year", label: "Este Año" },
  { id: "all", label: "Histórico Completo" },
  { id: "custom", label: "Personalizado" },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PLRow({
  label, value, indent = 0, bold = false, accent, sub,
}: {
  label: string; value: number; indent?: number; bold?: boolean;
  accent?: "green" | "red" | "blue" | "slate" | "amber" | "violet"; sub?: string;
}) {
  const colorMap = {
    green: "text-emerald-700 font-bold",
    red: "text-red-600 font-bold",
    blue: "text-blue-700 font-bold",
    violet: "text-violet-700 font-bold",
    amber: "text-amber-700 font-bold",
    slate: "text-slate-800",
  };
  const color = accent ? colorMap[accent] : value >= 0 ? "text-slate-800" : "text-red-600";

  return (
    <div className={`flex items-center justify-between py-2.5 ${indent > 0 ? "border-dashed" : "border-solid"} border-b border-slate-100 last:border-0`}
      style={{ paddingLeft: indent * 16 }}>
      <div>
        <span className={`text-sm ${bold ? "font-black" : "font-medium"} text-slate-700`}>{label}</span>
        {sub && <p className="text-[11px] text-slate-400 font-medium">{sub}</p>}
      </div>
      <span className={`text-sm tabular-nums ${bold ? "font-black text-base" : "font-semibold"} ${color}`}>
        {value >= 0 ? "" : "−"}{fmt(Math.abs(value))}
      </span>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, accent, pctValue, isNegativeGood = false,
}: {
  label: string; value: number; sub: string;
  icon: any; accent: string; pctValue?: number; isNegativeGood?: boolean;
}) {
  const accentMap: Record<string, { bar: string; icon: string; text: string; bg: string }> = {
    green:  { bar: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600", text: "text-emerald-700", bg: "" },
    red:    { bar: "bg-red-500",     icon: "bg-red-50 text-red-600",         text: "text-red-600",     bg: "" },
    blue:   { bar: "bg-blue-500",    icon: "bg-blue-50 text-blue-600",       text: "text-blue-700",    bg: "" },
    violet: { bar: "bg-violet-500",  icon: "bg-violet-50 text-violet-600",   text: "text-violet-700",  bg: "" },
    amber:  { bar: "bg-amber-500",   icon: "bg-amber-50 text-amber-600",     text: "text-amber-700",   bg: "" },
    slate:  { bar: "bg-slate-700",   icon: "bg-slate-100 text-slate-600",    text: "text-slate-800",   bg: "bg-slate-900" },
  };
  const cfg = accentMap[accent] || accentMap.blue;

  return (
    <Card className={`relative overflow-hidden border border-slate-200/80 shadow-sm rounded-2xl ${cfg.bg || "bg-white"}`}>
      <div className={`absolute top-0 left-0 w-full h-1.5 ${cfg.bar}`} />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className={`p-2.5 rounded-xl ${cfg.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          {pctValue !== undefined && (
            <Badge variant="outline" className={`text-[11px] font-black ${
              (pctValue >= 0 && !isNegativeGood) || (pctValue < 0 && isNegativeGood)
                ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                : "border-red-200 text-red-700 bg-red-50"
            }`}>
              {pct(pctValue)}
            </Badge>
          )}
        </div>
        <p className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${accent === "slate" ? "text-slate-400" : "text-slate-500"}`}>
          {label}
        </p>
        <p className={`text-2xl font-black tracking-tight ${accent === "slate" ? "text-white" : cfg.text}`}>
          {fmt(value)}
        </p>
        <p className={`text-xs font-medium mt-1 ${accent === "slate" ? "text-slate-400" : "text-slate-500"}`}>
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Profitability() {
  const { branches } = useBranch();
  
  // Estados de Filtros
  const [period, setPeriod] = useState<"today" | "week" | "month" | "last_month" | "quarter" | "year" | "all" | "custom">("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [branchId, setBranchId] = useState<string>("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [priceTypeFilter, setPriceTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const queryFilters = {
    period,
    from: period === "custom" && fromDate ? fromDate : undefined,
    to: period === "custom" && toDate ? toDate : undefined,
    branchId: branchId !== "all" ? Number(branchId) : undefined,
    paymentMethod: paymentMethod !== "all" ? (paymentMethod as any) : undefined,
    brand: brandFilter !== "all" ? brandFilter : undefined,
    priceType: priceTypeFilter !== "all" ? priceTypeFilter : undefined,
  };

  const { data, isLoading, refetch } = (trpc.stats as any).getProfitability.useQuery(queryFilters);

  const resetFilters = () => {
    setPeriod("month");
    setFromDate("");
    setToDate("");
    setBranchId("all");
    setPaymentMethod("all");
    setBrandFilter("all");
    setPriceTypeFilter("all");
    setSearchQuery("");
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-80 bg-slate-200 animate-pulse rounded-xl" />
        <div className="h-24 bg-slate-100 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)}
        </div>
        <div className="h-96 bg-slate-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const {
    period: periodInfo,
    totalIngresos, totalCOGS, margenBruto, margenBrutoPct,
    totalRepairCost, totalWarrantyCost, utilidadOperativa,
    totalOpExpenses, utilidadNeta, utilidadNetaPct,
    unitsSoldInPeriod, avgTicket,
    expensesByCategory, timelineData, brandRanking, methodStats, soldUnitsDetail,
    inventoryValue, inventoryPotentialRevenue, inventoryPotentialMargin, availableUnitsCount,
  } = data;

  // Waterfall data
  const waterfallData = [
    { name: "1. Ingresos",       value: totalIngresos,        fill: "#10b981" },
    { name: "2. (−) COGS",        value: -totalCOGS,           fill: "#6366f1" },
    { name: "3. = Margen Bruto", value: margenBruto,          fill: margenBruto >= 0 ? "#3b82f6" : "#ef4444" },
    { name: "4. (−) Taller",      value: -totalRepairCost,     fill: "#f59e0b" },
    { name: "5. (−) Garantías",   value: -totalWarrantyCost,   fill: "#f97316" },
    { name: "6. (−) Gastos Op.",  value: -totalOpExpenses,     fill: "#8b5cf6" },
    { name: "7. = Utilidad Neta",value: utilidadNeta,         fill: utilidadNeta >= 0 ? "#059669" : "#dc2626" },
  ];

  // Op Expenses Bar Chart
  const opExpData = Object.entries(expensesByCategory as Record<string,number> || {})
    .map(([k, v]) => ({ name: CATEGORY_LABELS[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);

  // Payment method pie
  const methodPieData = [
    { name: "Efectivo", value: methodStats?.cash || 0, fill: "#10b981" },
    { name: "QR Simple", value: methodStats?.qr || 0, fill: "#6366f1" },
    { name: "Transferencia", value: methodStats?.transfer || 0, fill: "#3b82f6" },
  ].filter(m => m.value > 0);

  // Filtrado de la tabla de detalle
  const filteredSoldUnits = (soldUnitsDetail as any[] || []).filter((u: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.code || "").toLowerCase().includes(q) ||
      (u.brand || "").toLowerCase().includes(q) ||
      (u.model || "").toLowerCase().includes(q) ||
      (u.customerName || "").toLowerCase().includes(q) ||
      (u.saleCode || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto mb-20 md:mb-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Rentabilidad</span>
              <span className="text-emerald-600">Real</span>
            </h1>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold px-3 py-1 text-xs">
              {periodInfo?.label || "Período activo"}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Estado de resultados real: ingresos efectivos menos adquisición (COGS), reparaciones, garantías y gastos operativos.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={resetFilters}
          className="self-start md:self-auto gap-1.5 font-bold text-slate-600 hover:text-slate-900 border-slate-300"
        >
          <RotateCcw className="h-4 w-4" />
          Restablecer Filtros
        </Button>
      </div>

      {/* ─── BARRA DE FILTROS AVANZADOS ────────────────────────────────────────── */}
      <Card className="border border-slate-200/90 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-600" />
              Filtros de Análisis Financiero
            </CardTitle>
            <span className="text-xs font-semibold text-slate-500">
              Analizando: <strong className="text-slate-800">{periodInfo?.label}</strong>
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Fila 1: Presets rápidos de fecha */}
          <div>
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Rango de Período Rápido:
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant={period === p.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod(p.id)}
                  className={`text-xs font-bold h-8 rounded-lg px-3 ${
                    period === p.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Fila 2: Selectores de filtros multidimensionales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 border-t border-slate-100">
            {/* Fechas personalizadas */}
            {period === "custom" && (
              <>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-500">Fecha Desde:</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-500">Fecha Hasta:</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </>
            )}

            {/* Sucursal */}
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-500">Sucursal:</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Sucursales</SelectItem>
                  {(branches || []).map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Método de Pago */}
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-500">Método de Pago:</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Métodos</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="qr">QR Simple</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Marca de Equipo */}
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-500">Marca de Equipo:</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Marcas</SelectItem>
                  <SelectItem value="dell">Dell</SelectItem>
                  <SelectItem value="hp">HP</SelectItem>
                  <SelectItem value="lenovo">Lenovo</SelectItem>
                  <SelectItem value="apple">Apple</SelectItem>
                  <SelectItem value="asus">Asus</SelectItem>
                  <SelectItem value="acer">Acer</SelectItem>
                  <SelectItem value="msi">MSI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Precio / Venta */}
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-500">Tipo de Precio:</Label>
              <Select value={priceTypeFilter} onValueChange={setPriceTypeFilter}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Precios</SelectItem>
                  <SelectItem value="salePrice">Precio Unitario Normal</SelectItem>
                  <SelectItem value="discountPrice">Precio con Descuento</SelectItem>
                  <SelectItem value="wholesalePrice">Precio por Mayor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 4 KPIS PRINCIPALES ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos por Ventas"
          value={totalIngresos}
          sub={`${unitsSoldInPeriod} equipos vendidos`}
          icon={ShoppingCart}
          accent="green"
        />
        <KpiCard
          label="Margen Bruto"
          value={margenBruto}
          sub="Ingresos − Costo Compra (COGS)"
          icon={CircleDollarSign}
          accent="blue"
          pctValue={margenBrutoPct}
        />
        <KpiCard
          label="Utilidad Neta Real"
          value={utilidadNeta}
          sub="Ganancia final tras todos los costos"
          icon={TrendingUp}
          accent={utilidadNeta >= 0 ? "green" : "red"}
          pctValue={utilidadNetaPct}
        />
        <KpiCard
          label="Ticket Promedio"
          value={avgTicket}
          sub="Promedio cobrado por equipo"
          icon={DollarSign}
          accent="violet"
        />
      </div>

      {/* ─── PESTAÑAS DE ANÁLISIS EN PROFUNDIDAD ───────────────────────────────── */}
      <Tabs defaultValue="waterfall" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex-wrap gap-1">
          <TabsTrigger value="waterfall" className="rounded-lg font-bold text-xs py-2 px-3">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Estado de Resultados (P&amp;L)
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-lg font-bold text-xs py-2 px-3">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Evolución en el Tiempo
          </TabsTrigger>
          <TabsTrigger value="brands" className="rounded-lg font-bold text-xs py-2 px-3">
            <Laptop className="h-3.5 w-3.5 mr-1.5" />
            Rentabilidad por Marca
          </TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-lg font-bold text-xs py-2 px-3">
            <Receipt className="h-3.5 w-3.5 mr-1.5" />
            Gastos &amp; Métodos de Pago
          </TabsTrigger>
          <TabsTrigger value="units" className="rounded-lg font-bold text-xs py-2 px-3">
            <Package className="h-3.5 w-3.5 mr-1.5" />
            Detalle de Equipos Vendidos ({unitsSoldInPeriod})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: P&L ESTADO DE RESULTADOS ── */}
        <TabsContent value="waterfall" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Tabla P&L */}
            <Card className="lg:col-span-6 border border-slate-200/90 shadow-sm rounded-2xl bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800 font-black text-base">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><BarChart3 className="h-4 w-4" /></div>
                  Estado de Resultados Consolidado
                </CardTitle>
                <CardDescription>Cifras netas del período: {periodInfo?.label}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="space-y-0.5">
                  <PLRow label="1. Ingresos por Ventas" value={totalIngresos} bold accent="green"
                    sub={`${unitsSoldInPeriod} unidades vendidas en este período`} />
                  <PLRow label="(−) Costo de Adquisición (COGS)" value={-totalCOGS} indent={1}
                    sub="Costo de compra original de los equipos vendidos" />
                  <PLRow label="= MARGEN BRUTO" value={margenBruto} bold
                    accent={margenBruto >= 0 ? "blue" : "red"}
                    sub={`${margenBrutoPct.toFixed(1)}% de rentabilidad sobre ventas`} />
                  <div className="py-1" />
                  <PLRow label="(−) Costos de Reparación en Taller" value={-totalRepairCost} indent={1}
                    sub="Repuestos y mano de obra aplicados a los equipos" />
                  <PLRow label="(−) Costos de Garantía y Devoluciones" value={-totalWarrantyCost} indent={1}
                    sub="Atenciones de garantía y reposiciones cubiertas" />
                  <PLRow label="= UTILIDAD OPERATIVA" value={utilidadOperativa} bold
                    accent={utilidadOperativa >= 0 ? "violet" : "red"}
                    sub="Resultado directo de la operación comercial y técnica" />
                  <div className="py-1" />
                  <PLRow label="(−) Gastos Operativos del Negocio" value={-totalOpExpenses} indent={1}
                    sub="Alquiler, sueldos, servicios básicos, marketing" />
                  <div className="my-2 border-t-2 border-slate-800" />
                  <PLRow label="= UTILIDAD NETA REAL" value={utilidadNeta} bold
                    accent={utilidadNeta >= 0 ? "green" : "red"}
                    sub={`${utilidadNetaPct.toFixed(1)}% de margen neto real en mano`} />
                </div>
              </CardContent>
            </Card>

            {/* Gráfico Cascada P&L */}
            <Card className="lg:col-span-6 border border-slate-200/90 shadow-sm rounded-2xl bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-800 font-black text-base">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp className="h-4 w-4" /></div>
                  Flujo del P&amp;L (Cascada de Dinero)
                </CardTitle>
                <CardDescription>De ingresos brutos a utilidad neta final</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 10, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.abs(v).toLocaleString()}`} />
                    <Tooltip
                      formatter={(val: number) => [`Bs. ${Math.abs(val).toLocaleString("es-BO", { minimumFractionDigits: 2 })}`, "Monto"]}
                      labelStyle={{ fontWeight: 700 }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {waterfallData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 2: EVOLUCIÓN EN EL TIEMPO ── */}
        <TabsContent value="timeline" className="space-y-6 mt-0">
          <Card className="border border-slate-200/90 shadow-sm rounded-2xl bg-white">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Evolución Temporal: Ingresos vs Costos vs Utilidad
              </CardTitle>
              <CardDescription>Comportamiento diario/periódico en el rango seleccionado</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {(!timelineData || timelineData.length === 0) ? (
                <div className="py-16 text-center text-slate-400">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-sm">No hay transacciones registradas en este período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorUtilidad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `Bs. ${v.toLocaleString()}`} />
                    <Tooltip formatter={(v: number) => [`Bs. ${Number(v).toLocaleString("es-BO")}`, ""]} />
                    <Legend />
                    <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" fillOpacity={1} fill="url(#colorIngresos)" strokeWidth={2} />
                    <Area type="monotone" dataKey="cogs" name="Costo Compra (COGS)" stroke="#6366f1" fillOpacity={0.1} fill="#6366f1" strokeWidth={2} />
                    <Area type="monotone" dataKey="utilidadNeta" name="Utilidad Neta" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUtilidad)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: RENTABILIDAD POR MARCA ── */}
        <TabsContent value="brands" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gráfico de barras por marca */}
            <Card className="lg:col-span-7 border border-slate-200/90 shadow-sm rounded-2xl bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-blue-600" />
                  Margen Bruto Obtenido por Marca
                </CardTitle>
                <CardDescription>Marcas que más ganancia neta aportaron al negocio</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                {(!brandRanking || brandRanking.length === 0) ? (
                  <div className="py-12 text-center text-slate-400">Sin ventas de marcas en el período</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={brandRanking} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `Bs. ${v.toLocaleString()}`} />
                      <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fontWeight: 700 }} width={70} />
                      <Tooltip formatter={(v: number) => [`Bs. ${Number(v).toLocaleString("es-BO")}`, "Margen"]} />
                      <Bar dataKey="margenBruto" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                        {brandRanking.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Tabla Ranking de marcas */}
            <Card className="lg:col-span-5 border border-slate-200/90 shadow-sm rounded-2xl bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-black text-slate-800">Ranking Detallado</CardTitle>
                <CardDescription>Volumen, inversión y % de retorno</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 space-y-3">
                {(brandRanking || []).map((b: any, idx: number) => (
                  <div key={b.brand} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-slate-900 text-white font-black text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <p className="font-black text-slate-800 text-sm">{b.brand}</p>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {b.count} {b.count === 1 ? "unidad" : "unidades"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Ingresos: {fmt(b.ingresos)} | Costo: {fmt(b.cogs)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-700 text-sm">+{fmt(b.margenBruto)}</p>
                      <p className="text-[11px] font-bold text-slate-400">+{b.margenBrutoPct}% ROI</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 4: GASTOS & MÉTODOS DE PAGO ── */}
        <TabsContent value="expenses" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gastos operativos */}
            <Card className="lg:col-span-7 border border-slate-200/90 shadow-sm rounded-2xl bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-violet-600" />
                  Gastos Operativos del Período
                </CardTitle>
                <CardDescription>Desglose por categoría: {periodInfo?.label}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                {opExpData.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">Sin gastos operativos registrados</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={opExpData} layout="vertical" margin={{ left: 10, right: 16 }}>
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toLocaleString()}`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} width={120} />
                        <Tooltip formatter={(v: number) => [`Bs. ${Number(v).toLocaleString("es-BO")}`, ""]} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 border-t pt-3 flex justify-between items-center text-sm font-black">
                      <span className="text-slate-700">TOTAL GASTOS OPERATIVOS:</span>
                      <span className="text-violet-700 text-base">{fmt(totalOpExpenses)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Métodos de Pago */}
            <Card className="lg:col-span-5 border border-slate-200/90 shadow-sm rounded-2xl bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  Distribución de Cobros por Método
                </CardTitle>
                <CardDescription>¿Cómo pagaron los clientes en este período?</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                {methodPieData.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">Sin cobros en el período</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={methodPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={4}>
                          {methodPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`Bs. ${Number(v).toLocaleString("es-BO")}`, ""]} />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-3 pt-3 border-t">
                      {methodPieData.map(m => (
                        <div key={m.name} className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-600">{m.name}</span>
                          <span className="font-black text-slate-800">{fmt(m.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 5: DETALLE DE EQUIPOS VENDIDOS ── */}
        <TabsContent value="units" className="space-y-4 mt-0">
          <Card className="border border-slate-200/90 shadow-sm rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-black text-slate-800">
                    Equipos Vendidos en el Período
                  </CardTitle>
                  <CardDescription>
                    Costo de compra, precio de venta, gastos de taller y ganancia neta por equipo
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar código, marca, cliente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSoldUnits.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-sm">No se encontraron equipos vendidos con los filtros aplicados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Código / Equipo</th>
                        <th className="py-3 px-4">Cliente / Venta</th>
                        <th className="py-3 px-4 text-right">Precio Compra</th>
                        <th className="py-3 px-4 text-right">Precio Venta</th>
                        <th className="py-3 px-4 text-right">Costo Taller</th>
                        <th className="py-3 px-4 text-right">Margen Neto</th>
                        <th className="py-3 px-4 text-right">% Margen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSoldUnits.map((u: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-black text-slate-800">{u.code}</p>
                            <p className="text-[11px] text-slate-500">{u.brand} {u.model}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-700">{u.customerName}</p>
                            <p className="text-[10px] text-slate-400">{u.saleCode} • {u.paymentMethod?.toUpperCase()}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-600">
                            {fmt(u.purchasePrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {fmt(u.salePrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-amber-700">
                            {u.repairCost > 0 ? `−${fmt(u.repairCost)}` : "—"}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                            +{fmt(u.grossMargin)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Badge variant="outline" className={`font-bold text-[10px] ${
                              u.grossMarginPct >= 20 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              +{u.grossMarginPct}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── RESUMEN FINAL DE INVENTARIO DISPONIBLE EN STOCK ────────────────────── */}
      <Card className="border-none shadow-sm rounded-2xl bg-slate-900 text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 text-emerald-400">
                <Boxes className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-lg text-white">Potencial en Inventario Disponible</h3>
                <p className="text-xs text-slate-400">¿Cuánto dinero y ganancia hay actualmente en stock listo para vender?</p>
              </div>
            </div>
            <Badge className="bg-white/10 text-white border-white/20 px-3 py-1 font-bold text-xs self-start md:self-auto">
              {availableUnitsCount} Laptops Disponibles
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costo Invertido en Stock</p>
              <p className="text-2xl font-black text-white">{fmt(inventoryValue)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Capital inmovilizado en compras</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Ventas Proyectadas</p>
              <p className="text-2xl font-black text-emerald-400">{fmt(inventoryPotentialRevenue)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Ingreso bruto si se vende todo el stock</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Ganancia Neta en Espera</p>
              <p className="text-2xl font-black text-blue-400">{fmt(inventoryPotentialMargin)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Utilidad bruta proyectada a capturar</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
