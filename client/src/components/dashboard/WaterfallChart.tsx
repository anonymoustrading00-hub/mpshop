import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { formatCurrency } from "@/lib/currency";
import { TrendingDown, TrendingUp } from "lucide-react";

interface WaterfallChartProps {
  data: Array<{ name: string; value: number }>;
}

export function WaterfallChart({ data }: WaterfallChartProps) {
  // Calcular valores acumulados para el waterfall
  const chartData = data.map((item, index) => {
    const previousSum = index === 0 ? 0 : data.slice(0, index).reduce((sum, d) => sum + d.value, 0);
    const isNegative = item.value < 0;
    
    return {
      name: item.name,
      value: item.value,
      start: isNegative ? previousSum + item.value : previousSum,
      end: previousSum + item.value,
      fill: item.name.includes("Neta") || item.name.includes("Bruta") 
        ? "#3b82f6" 
        : isNegative 
          ? "#ef4444" 
          : "#10b981",
    };
  });

  return (
    <Card className="border-none shadow-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-black flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-xl">
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          Cascada Financiera
        </CardTitle>
        <p className="text-xs text-slate-500">Ingresos → Costo Mercadería → Ganancia Bruta → Gastos → Ganancia Neta</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} angle={-15} textAnchor="end" height={80} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${(v / 100).toFixed(0)} Bs`} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={2} />
            <Bar dataKey="end" stackId="a" fill="#3b82f6">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
