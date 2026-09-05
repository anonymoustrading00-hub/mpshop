import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface BusinessKpiCardProps {
  label: string;
  value: number | string;
  valueType?: "currency" | "percentage" | "number" | "text";
  subtitle?: string;
  trend?: number; // Comparación % vs mes anterior
  icon: React.ElementType;
  accent?: "emerald" | "blue" | "amber" | "red" | "purple" | "slate";
}

const ACCENT_COLORS: Record<string, { bg: string; icon: string; text: string }> = {
  emerald: { bg: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600", text: "text-emerald-600" },
  blue: { bg: "bg-blue-500", icon: "bg-blue-50 text-blue-600", text: "text-blue-600" },
  amber: { bg: "bg-amber-500", icon: "bg-amber-50 text-amber-700", text: "text-amber-700" },
  red: { bg: "bg-red-500", icon: "bg-red-50 text-red-600", text: "text-red-600" },
  purple: { bg: "bg-violet-500", icon: "bg-violet-50 text-violet-600", text: "text-violet-600" },
  slate: { bg: "bg-slate-700", icon: "bg-slate-100 text-slate-600", text: "text-slate-600" },
};

export function BusinessKpiCard({
  label,
  value,
  valueType = "currency",
  subtitle,
  trend,
  icon: Icon,
  accent = "blue",
}: BusinessKpiCardProps) {
  const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.blue;

  const formatValue = () => {
    if (valueType === "currency") return formatCurrency(Number(value));
    if (valueType === "percentage") return `${Number(value).toFixed(1)}%`;
    if (valueType === "number") return Number(value).toLocaleString("es-BO");
    return String(value);
  };

  return (
    <Card className="relative overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow rounded-2xl bg-white">
      <div className={`absolute top-0 left-0 w-full h-1 ${colors.bg}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${colors.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend !== undefined && trend !== 0 && (
            <div className={`flex items-center gap-1 text-[10px] font-bold ${trend > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {trend > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black tracking-tight ${colors.text}`}>{formatValue()}</p>
        {subtitle && <p className="text-xs text-slate-500 font-medium mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
