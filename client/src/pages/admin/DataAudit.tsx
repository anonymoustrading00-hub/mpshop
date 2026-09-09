import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function DataAudit() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dryRun, setDryRun] = useState(true);

  const { data: auditData, refetch, isLoading } = trpc.sellerCash.admin_auditHistoricalData.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const fixMutation = trpc.sellerCash.admin_fixHistoricalData.useMutation({
    onSuccess: (data) => {
      toast.success(data.dryRun ? "Simulación Completada" : "Corrección Completada", {
        description: data.message,
      });
      refetch();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">🔍 Auditoría de Datos Financieros</h1>
          <p className="text-slate-600 mt-1">
            Identifica y corrige inconsistencias en registros históricos de cajas
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isLoading}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros de Auditoría</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-bold text-slate-700">Fecha Inicio</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-bold text-slate-700">Fecha Fin</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button onClick={() => refetch()}>
            Aplicar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Resumen */}
      {auditData && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-10 h-10" />
                  <div>
                    <p className="text-sm opacity-90">Total de Cajas</p>
                    <p className="text-3xl font-black">{auditData.summary.totalBoxes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-10 h-10" />
                  <div>
                    <p className="text-sm opacity-90">Consistentes</p>
                    <p className="text-3xl font-black">{auditData.summary.consistentBoxes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500 to-red-700 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-10 h-10" />
                  <div>
                    <p className="text-sm opacity-90">Inconsistentes</p>
                    <p className="text-3xl font-black">{auditData.summary.inconsistentBoxes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-amber-700 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-10 h-10" />
                  <div>
                    <p className="text-sm opacity-90">% Inconsistente</p>
                    <p className="text-3xl font-black">{auditData.summary.percentageInconsistent}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Acciones de Corrección */}
          {auditData.summary.inconsistentBoxes > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Acciones de Corrección
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="dryRun"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="dryRun" className="text-sm font-bold">
                    Modo Simulación (no aplicar cambios reales)
                  </label>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => fixMutation.mutate({ 
                      dryRun,
                      startDate: startDate || undefined,
                      endDate: endDate || undefined,
                    })}
                    disabled={fixMutation.isPending}
                    className={dryRun ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"}
                  >
                    {fixMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                    {dryRun ? "🧪 Simular Corrección" : "⚠️ Aplicar Corrección"}
                  </Button>
                  {!dryRun && (
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Esta acción modificará los datos permanentemente
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Inconsistencias */}
          {auditData.inconsistencies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalles de Inconsistencias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-bold">Caja #</th>
                        <th className="text-left p-2 font-bold">Fecha</th>
                        <th className="text-left p-2 font-bold">Turno</th>
                        <th className="text-right p-2 font-bold">Registrado</th>
                        <th className="text-right p-2 font-bold">Real (DB)</th>
                        <th className="text-right p-2 font-bold">Diferencia</th>
                        <th className="text-center p-2 font-bold">Ventas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditData.inconsistencies.map((inc: any) => (
                        <tr key={inc.boxId} className="border-b hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold">#{inc.boxId}</td>
                          <td className="p-2">{inc.date}</td>
                          <td className="p-2">T{inc.turnNumber}</td>
                          <td className="p-2 text-right font-mono">
                            {formatCurrency(inc.registered.total)}
                          </td>
                          <td className="p-2 text-right font-mono text-emerald-700">
                            {formatCurrency(inc.real.total)}
                          </td>
                          <td className="p-2 text-right font-mono text-red-700 font-bold">
                            {formatCurrency(inc.differences.total)}
                          </td>
                          <td className="p-2 text-center">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">
                              {inc.salesCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {auditData.summary.inconsistentBoxes === 0 && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-2xl font-black text-emerald-700 mb-2">
                  ✅ Todos los Datos son Consistentes
                </h3>
                <p className="text-emerald-600">
                  No se encontraron inconsistencias en el rango de fechas seleccionado
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
