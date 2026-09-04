import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Wrench, CheckCircle, ShoppingCart } from "lucide-react";

interface EquipmentFlowDiagramProps {
  data: {
    purchased: number;
    inRepair: number;
    available: number;
    sold: number;
  };
}

export function EquipmentFlowDiagram({ data }: EquipmentFlowDiagramProps) {
  const stages = [
    { label: "Comprados", value: data.purchased, icon: Package, color: "bg-blue-100 text-blue-600" },
    { label: "En Reparación", value: data.inRepair, icon: Wrench, color: "bg-amber-100 text-amber-600" },
    { label: "Disponibles", value: data.available, icon: CheckCircle, color: "bg-emerald-100 text-emerald-600" },
    { label: "Vendidos", value: data.sold, icon: ShoppingCart, color: "bg-violet-100 text-violet-600" },
  ];

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <Card className="border-none shadow-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-black flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          Flujo de Equipos
        </CardTitle>
        <p className="text-xs text-slate-500">Embudo operativo: compra → reparación → disponible → venta</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const widthPercent = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;

          return (
            <div key={stage.label}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${stage.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{stage.label}</span>
                </div>
                <span className="text-lg font-black text-slate-900">{stage.value}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stage.color.replace("text-", "bg-").replace("100", "500")}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              {index < stages.length - 1 && (
                <div className="flex justify-center my-2">
                  <div className="text-slate-300">↓</div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
