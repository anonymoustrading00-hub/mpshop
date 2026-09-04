import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp } from "lucide-react";

interface FlowComparisonChartProps {
  data: Array<{
    flow: string;
    count: number;
    revenue: number;
    cogs: number;
    profit: number;
    marginPct: number;
  }>;
}

const FLOW_LABELS: Record<string, string> = {
  usado_directo: "Usado Directo",
  reparado: "Reparado",
  inventario_nuevo: "Inventario Nuevo",
};

export function FlowComparisonChart({ data }: FlowComparisonChartProps) {
  const chartData = data.map((d) => ({
    name: FLOW_LABELS[d.flow] || d.flow,
    "Ganancia (Bs)": d.profit / 100,
    "Margen %": d.marginPct,
    "Ventas": d.count,
  }));

  return (
    <Card className="border-none shadow-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-black flex items-center gap-2">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          Rentabilidad por Flujo de Negocio
        </CardTitle>
        <p className="text-xs text-slate-500">Comparación de margen y ganancia entre los 3 flujos operativos</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              formatter={(value: number, name: string) => {
                if (name === "Margen %") return [`${value.toFixed(1)}%`, name];
                if (name === "Ganancia (Bs)") return [formatCurrency(value * 100), name];
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
            <Bar yAxisId="left" dataKey="Ganancia (Bs)" fill="#10b981" radius={[8, 8, 0, 0]} />
            <Bar yAxisId="right" dataKey="Margen %" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="grid grid-cols-3 gap-3 mt-4">
          {data.map((d) => (
            <div key={d.flow} className="p-3 bg-slate-50 rounded-xl text-center">
              <p className="text-xs font-bold text-slate-500 uppercase">{FLOW_LABELS[d.flow] || d.flow}</p>
              <p className="text-lg font-black text-slate-900">{d.count}</p>
              <p className="text-[10px] text-slate-500">unidades vendidas</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
