import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminMigration() {
  const [isRunning, setIsRunning] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  const statsQuery = trpc.adminMigration.getFungibleStats.useQuery();
  const unifyMutation = trpc.adminMigration.unifyFungibleCodes.useMutation();

  const handleRunMigration = async () => {
    if (!confirm("¿Estás seguro de ejecutar la migración?\n\nEsto actualizará los códigos de todos los productos fungibles con el mismo brand+model.")) {
      return;
    }

    setIsRunning(true);
    setMigrationResult(null);

    try {
      const result = await unifyMutation.mutateAsync();
      setMigrationResult(result);
      toast.success(result.message);
      statsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Error al ejecutar la migración");
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔧 Migración de Códigos</h1>
        <p className="text-muted-foreground">
          Unifica los códigos QR de productos fungibles (cargadores, baterías, accesorios)
        </p>
      </div>

      {/* Estadísticas */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Estadísticas
          </CardTitle>
          <CardDescription>
            Estado actual de los códigos en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : statsQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Total Fungibles</div>
                  <div className="text-2xl font-bold">{statsQuery.data.totalFungible}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Grupos con Códigos Múltiples</div>
                  <div className="text-2xl font-bold text-amber-600">{statsQuery.data.needsUnification}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Estado</div>
                  <div className="text-lg font-semibold">
                    {statsQuery.data.needsUnification > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Requiere Migración
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Códigos Unificados
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {statsQuery.data.groups && statsQuery.data.groups.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Grupos que necesitan unificación:</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {statsQuery.data.groups.map((group: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">
                            {group.brand} {group.model}
                          </div>
                          <Badge variant="secondary">{group.type}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {group.count} unidades con {group.codes.length} códigos diferentes
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 font-mono">
                          {group.codes.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => statsQuery.refetch()}
              variant="outline"
              size="sm"
              disabled={statsQuery.isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ejecutar Migración */}
      {statsQuery.data && statsQuery.data.needsUnification > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-amber-900">Ejecutar Migración</CardTitle>
            <CardDescription>
              Esta acción actualizará los códigos en la base de datos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>¿Qué hará esta migración?</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Identificará productos fungibles con el mismo brand+model</li>
                  <li>Extraerá el código base (ej: 4747-01 → 4747)</li>
                  <li>Asignará el mismo código base a todas las unidades del grupo</li>
                  <li>Los datos de inventario y ventas NO se modificarán</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleRunMigration}
              disabled={isRunning}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ejecutando Migración...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Ejecutar Migración Ahora
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resultados */}
      {migrationResult && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Migración Completada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Grupos Procesados</div>
                  <div className="text-2xl font-bold text-green-600">
                    {migrationResult.results.groupsProcessed}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Unidades Actualizadas</div>
                  <div className="text-2xl font-bold text-green-600">
                    {migrationResult.results.unitsUpdated}
                  </div>
                </div>
              </div>

              {migrationResult.results.details && migrationResult.results.details.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Detalles:</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {migrationResult.results.details.map((detail: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-3 bg-white">
                        <div className="font-medium">
                          {detail.brand} {detail.model} ({detail.type})
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {detail.count} unidades → código unificado: <code className="font-mono bg-slate-100 px-2 py-0.5 rounded">{detail.baseCode}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
