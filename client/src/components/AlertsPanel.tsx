/**
 * AlertsPanel — Panel de alertas operativas en el Home del admin
 * Muestra: equipos en taller +7d, garantías por vencer, devoluciones pendientes,
 * equipos en diagnóstico +3d
 */
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle, Wrench, Shield, RefreshCw, Activity,
  ChevronRight, BellRing,
} from "lucide-react";

const TYPE_CFG: Record<string, { icon: any; label: string; href: string; color: string }> = {
  stuck_repair:     { icon: Wrench,    label: "En Taller",     href: "/repairs",    color: "text-orange-600 bg-orange-50 border-orange-200" },
  warranty_expiring:{ icon: Shield,    label: "Garantía",      href: "/warranties", color: "text-blue-600 bg-blue-50 border-blue-200" },
  pending_return:   { icon: RefreshCw, label: "Devolución",    href: "/returns",    color: "text-purple-600 bg-purple-50 border-purple-200" },
  stuck_diagnosis:  { icon: Activity,  label: "Diagnóstico",   href: "/units",      color: "text-amber-600 bg-amber-50 border-amber-200" },
};

export function AlertsPanel() {
  const { data, isLoading } = (trpc.stats as any).getAlerts.useQuery(undefined, {
    refetchInterval: 60_000, // Refresca cada minuto
  });

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm rounded-[2rem] bg-white">
        <CardContent className="p-6">
          <div className="h-4 w-40 bg-slate-200 animate-pulse rounded-full mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const total: number = data?.total ?? 0;
  const high: number = data?.high ?? 0;
  const alerts: any[] = data?.alerts ?? [];

  if (total === 0) {
    return (
      <Card className="border-none shadow-sm rounded-[2rem] bg-white">
        <CardContent className="p-6 flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50">
            <BellRing className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-black text-slate-800">Sin alertas operativas</p>
            <p className="text-xs text-slate-400">Todo está bajo control</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[2rem] bg-white overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between ${high > 0 ? "bg-red-50 border-b border-red-100" : "bg-amber-50 border-b border-amber-100"}`}>
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-xl ${high > 0 ? "bg-red-100" : "bg-amber-100"}`}>
            <AlertTriangle className={`h-4 w-4 ${high > 0 ? "text-red-600" : "text-amber-600"}`} />
          </div>
          <div>
            <p className={`text-sm font-black ${high > 0 ? "text-red-800" : "text-amber-800"}`}>
              {total} alerta{total !== 1 ? "s" : ""} operativa{total !== 1 ? "s" : ""}
            </p>
            {high > 0 && (
              <p className="text-[10px] text-red-600 font-bold">{high} requieren atención inmediata</p>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={`font-black text-xs ${high > 0 ? "border-red-300 text-red-700 bg-red-100" : "border-amber-300 text-amber-700 bg-amber-100"}`}
        >
          {total}
        </Badge>
      </div>

      {/* Alert list */}
      <CardContent className="p-0">
        <div className="divide-y divide-slate-50">
          {alerts.slice(0, 6).map((alert: any, i: number) => {
            const cfg = TYPE_CFG[alert.type] || TYPE_CFG.stuck_repair;
            const Icon = cfg.icon;
            const isHigh = alert.severity === "high";

            return (
              <Link key={i} href={cfg.href}>
                <div className={`flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${isHigh ? "bg-red-50/30" : ""}`}>
                  <div className={`p-1.5 rounded-xl shrink-0 border ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold border rounded-full px-1.5 py-0.5 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {isHigh && (
                        <span className="text-[10px] font-black text-red-600">⚠ Urgente</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                </div>
              </Link>
            );
          })}

          {alerts.length > 6 && (
            <div className="px-5 py-3 text-center">
              <p className="text-xs text-slate-400 font-medium">
                +{alerts.length - 6} alertas más — revisa los módulos correspondientes
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
