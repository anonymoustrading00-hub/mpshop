/**
 * Dashboard — 6 KPIs prioritarios en tiempo real
 * Solo lectura, sin filtros, carga rápida.
 */
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Clock, Package, Wallet,
  CreditCard, RotateCcw, AlertTriangle, QrCode, Landmark,
  RefreshCw, BarChart3,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── helpers ─────────────────────────────────────────────────────

function pct(n: number): string {
  return `${n >= 0 ? "" : ""}${n.toFixed(1)}%`;
}

function colorClass(val: number, goodAbove = 0): string {
  return val >= goodAbove ? "text-emerald-600" : "text-red-600";
}

// ─── KPI Card ─────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: "emerald" | "blue" | "amber" | "red" | "purple" | "slate";
  trend?: { dir: "up" | "down"; neutral?: boolean };
  linkTo?: string;
}

const ACCENT: Record<string, string> = {
  emerald: "bg-emerald-500",
  blue:    "bg-blue-500",
  amber:   "bg-amber-500",
  red:     "bg-red-500",
  purple:  "bg-violet-500",
  slate:   "bg-slate-700",
};
const ACCENT_ICON: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue:    "bg-blue-50 text-blue-600",
  amber:   "bg-amber-50 text-amber-700",
  red:     "bg-red-50 text-red-600",
  purple:  "bg-violet-50 text-violet-600",
  slate:   "bg-slate-100 text-slate-600",
};

function KpiCard({ label, value, sub, icon: Icon, accent, trend, linkTo }: KpiProps) {
  const card = (
    <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.05)] rounded-[2rem] bg-white hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition-all">
      <div className={`absolute top-0 left-0 w-full h-1.5 ${ACCENT[accent]}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-2xl ${ACCENT_ICON[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend && !trend.neutral && (
            <div className={`flex items-center gap-1 text-[10px] font-black ${trend.dir === "up" ? "text-emerald-600" : "text-red-500"}`}>
              {trend.dir === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            </div>
          )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-2xl font-black text-slate-900 tracking-tighter">{value}</p>
        {sub && <p className="text-xs text-slate-500 font-medium mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
  if (linkTo) return <Link href={linkTo}><div className="cursor-pointer">{card}</div></Link>;
  return card;
}

// ─── Balance mini-card ────────────────────────────────────────────

function BalanceCard({ label, amount, color, icon: Icon }: { label: string; amount: number; color: string; icon: React.ElementType }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${color}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <span className={`text-sm font-black tabular-nums ${amount >= 0 ? "" : "text-red-600"}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export default function DashboardKPIs() {
  const { user } = useAuth();
  const { data, isLoading, refetch, isFetching } = (trpc.dashboard as any).getKPIs.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 5 * 60 * 1000 } // refresca cada 5 min
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto mb-20 md:mb-10">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Dashboard <span className="text-blue-600">KPIs</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data?.periodLabel ?? "Mes actual"} · Actualizado automáticamente
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all ${isFetching ? "opacity-60" : ""}`}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-[2rem]" />
          ))}
        </div>
      ) : !data ? (
        <div className="py-20 text-center text-slate-400">Sin datos disponibles</div>
      ) : (
        <>
          {/* 6 KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

            {/* KPI 1 — Margen bruto promedio */}
            <KpiCard
              label="Margen Bruto Promedio"
              value={formatCurrency(data.avgGrossMarginCents)}
              sub={`Por equipo vendido · ${data.salesThisMonth} ventas`}
              icon={TrendingUp}
              accent="emerald"
              linkTo="/rentabilidad"
            />

            {/* KPI 2 — Días promedio en inventario */}
            <KpiCard
              label="Días Prom. en Inventario"
              value={`${data.avgInventoryDays} días`}
              sub="Tiempo compra → venta este mes"
              icon={Clock}
              accent={data.avgInventoryDays <= 30 ? "blue" : data.avgInventoryDays <= 60 ? "amber" : "red"}
            />

            {/* KPI 3 — Tasa de devolución */}
            <KpiCard
              label="Tasa de Devolución"
              value={pct(data.returnRatePct)}
              sub={`${data.returnsThisMonth} devoluciones / ${data.salesThisMonth} ventas`}
              icon={RotateCcw}
              accent={data.returnRatePct < 5 ? "emerald" : data.returnRatePct < 15 ? "amber" : "red"}
              linkTo="/returns"
            />

            {/* KPI 4 — Aging inventario */}
            <KpiCard
              label="Aging Inventario (+30 días)"
              value={`${data.agingCount} equipos`}
              sub="Activos sin vender hace más de 30 días"
              icon={AlertTriangle}
              accent={data.agingCount === 0 ? "emerald" : data.agingCount <= 5 ? "amber" : "red"}
              linkTo="/units"
            />

            {/* KPI 5 — Saldo consolidado (ocupa 1 slot, con desglose debajo) */}
            <KpiCard
              label="Saldo Consolidado Cajas"
              value={formatCurrency(data.balances.total)}
              sub="Efectivo + QR + Banco"
              icon={Wallet}
              accent={data.balances.total >= 0 ? "blue" : "red"}
              linkTo="/finance"
            />

            {/* KPI 6 — CXC pendientes */}
            <KpiCard
              label="Cuentas por Cobrar"
              value={formatCurrency(data.cxcPendingCents)}
              sub="Pendientes de cobro"
              icon={CreditCard}
              accent={data.cxcPendingCents === 0 ? "emerald" : "amber"}
              linkTo="/accounts-receivable"
            />
          </div>

          {/* Desglose de cajas */}
          <div className="bg-white rounded-[2rem] border-none shadow-[0_8px_30px_rgb(0,0,0,0.05)] p-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-slate-100 rounded-xl">
                <BarChart3 className="h-4 w-4 text-slate-600" />
              </div>
              <span className="font-black text-slate-800 text-sm uppercase tracking-wide">Desglose de Cajas</span>
            </div>
            <BalanceCard label="Caja Efectivo" amount={data.balances.cash}    color="border-emerald-100 bg-emerald-50/50 text-emerald-700" icon={Wallet} />
            <BalanceCard label="Caja QR"        amount={data.balances.qr}      color="border-blue-100 bg-blue-50/50 text-blue-700"          icon={QrCode} />
            <BalanceCard label="Cuenta Bancaria" amount={data.balances.transfer} color="border-violet-100 bg-violet-50/50 text-violet-700"   icon={Landmark} />
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-wider">Total</span>
              </div>
              <span className={`text-sm font-black tabular-nums ${data.balances.total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(data.balances.total)}
              </span>
            </div>
          </div>

          {/* Links de acción */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/rentabilidad", label: "Ver P&L", icon: TrendingUp },
              { href: "/analytics",    label: "Análisis", icon: BarChart3 },
              { href: "/reports",      label: "Reportes", icon: Package },
              { href: "/expenses",     label: "Gastos",   icon: CreditCard },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <div className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer">
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
