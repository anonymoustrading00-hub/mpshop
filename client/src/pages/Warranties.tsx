import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Receipt,
  Cpu,
  HardDrive,
  Activity,
  Battery,
  Calendar,
  Sparkles,
  Wrench,
  Grid,
  List,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export default function Warranties() {
  const [, setLocation] = useLocation();
  const { activeBranchId } = useBranch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expiring_soon" | "expired" | "claimed">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // RMA Dialog state
  const [isRmaOpen, setIsRmaOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState<any>(null);
  const [rmaReason, setRmaReason] = useState("");
  const [rmaResolution, setRmaResolution] = useState("");
  const [reenterRepair, setReenterRepair] = useState(true);

  const { data: warrantiesData, isLoading, refetch } = trpc.warranties.list.useQuery({
    branchId: activeBranchId || undefined,
  });

  const createReturnMutation = trpc.returns.create.useMutation({
    onSuccess: () => {
      toast.success("✅ Devolución / RMA registrada exitosamente");
      setIsRmaOpen(false);
      setSelectedWarranty(null);
      setRmaReason("");
      setRmaResolution("");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const allItems = warrantiesData?.items || [];

  // Metrics
  const stats = useMemo(() => {
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let claimed = 0;

    allItems.forEach((w: any) => {
      if (w.status === "cancelled") return;
      if (w.status === "claimed") {
        claimed++;
      } else if (w.isExpired) {
        expired++;
      } else {
        active++;
        if (w.daysLeft <= 5) {
          expiringSoon++;
        }
      }
    });

    const activeList = allItems.filter((w: any) => w.status !== "cancelled");
    return { total: activeList.length, active, expiringSoon, expired, claimed };
  }, [allItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return allItems.filter((w: any) => {
      if (w.status === "cancelled") return false;
      // Filter by status tab
      if (statusFilter === "active" && (w.status !== "active" || w.isExpired)) return false;
      if (statusFilter === "expiring_soon" && (w.status !== "active" || w.isExpired || w.daysLeft > 5)) return false;
      if (statusFilter === "expired" && (w.status === "claimed" || !w.isExpired)) return false;
      if (statusFilter === "claimed" && w.status !== "claimed") return false;

      // Filter by search
      if (search.trim()) {
        const s = search.toLowerCase().trim();
        const match =
          w.unitCode?.toLowerCase().includes(s) ||
          w.unitBrand?.toLowerCase().includes(s) ||
          w.unitModel?.toLowerCase().includes(s) ||
          w.customerName?.toLowerCase().includes(s) ||
          w.customerPhone?.toLowerCase().includes(s) ||
          w.saleNumber?.toLowerCase().includes(s);
        if (!match) return false;
      }

      return true;
    });
  }, [allItems, statusFilter, search]);

  const handleOpenRma = (w: any) => {
    setSelectedWarranty(w);
    setRmaReason("");
    setRmaResolution("");
    setIsRmaOpen(true);
  };

  const handleGoToCancelSale = () => {
    if (!selectedWarranty) return;
    setIsRmaOpen(false);
    if (selectedWarranty.saleId) {
      toast.info(`Abriendo módulo de Ventas para anular la venta #${selectedWarranty.saleNumber || selectedWarranty.saleId}...`);
      setLocation(`/sales?anular=${selectedWarranty.saleId}`);
    } else {
      toast.info("Abriendo módulo de Ventas...");
      setLocation(`/sales?search=${encodeURIComponent(selectedWarranty.saleNumber || selectedWarranty.unitCode || "")}`);
    }
  };

  const handleSubmitRmaToRepair = () => {
    if (!selectedWarranty) return;
    if (!rmaReason.trim()) {
      toast.error("Por favor ingresa el motivo de la falla antes de enviar a taller");
      return;
    }

    createReturnMutation.mutate({
      unitId: selectedWarranty.unitId,
      warrantyId: selectedWarranty.id,
      reason: rmaReason.trim(),
      resolution: "Ingreso a taller técnico para reparación en garantía",
      reenteredRepair: true,
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Gestión de Garantías y Cobertura
          </h1>
          <p className="text-sm text-muted-foreground">
            Control de garantías activas con contador de días restantes y atención de devoluciones (RMA).
          </p>
        </div>

        <a href="/returns">
          <Button variant="outline" className="gap-2 border-primary/30 hover:bg-primary/5">
            <RefreshCw className="h-4 w-4 text-primary" /> Historial de Devoluciones (RMA)
          </Button>
        </a>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase">Activas</p>
              <p className="text-2xl font-black text-emerald-800">{stats.active}</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase">Por Vencer (≤ 5 días)</p>
              <p className="text-2xl font-black text-amber-800">{stats.expiringSoon}</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Vencidas</p>
              <p className="text-2xl font-black text-slate-700">{stats.expired}</p>
            </div>
            <div className="p-2.5 bg-slate-500/10 rounded-xl">
              <XCircle className="h-6 w-6 text-slate-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-700 uppercase">Reclamadas / RMA</p>
              <p className="text-2xl font-black text-purple-800">{stats.claimed}</p>
            </div>
            <div className="p-2.5 bg-purple-500/10 rounded-xl">
              <RefreshCw className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buscador y Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código de equipo, marca/modelo, cliente, teléfono o # de venta..."
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 bg-muted/40 p-1 rounded-xl border">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "ghost"}
            onClick={() => setStatusFilter("all")}
            className="text-xs"
          >
            Todas ({stats.total})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "ghost"}
            onClick={() => setStatusFilter("active")}
            className="text-xs text-emerald-700"
          >
            Activas ({stats.active})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "expiring_soon" ? "default" : "ghost"}
            onClick={() => setStatusFilter("expiring_soon")}
            className="text-xs text-amber-700"
          >
            Por Vencer ({stats.expiringSoon})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "expired" ? "default" : "ghost"}
            onClick={() => setStatusFilter("expired")}
            className="text-xs text-slate-600"
          >
            Vencidas ({stats.expired})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "claimed" ? "default" : "ghost"}
            onClick={() => setStatusFilter("claimed")}
            className="text-xs text-purple-700"
          >
            Devueltas ({stats.claimed})
          </Button>
          {/* Toggle vista */}
          <div className="ml-auto flex rounded-md border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"}`}
              title="Vista tarjetas"
            >
              <Grid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tarjetas</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"}`}
              title="Vista lista"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Garantías */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando coberturas de garantía...</div>
      ) : filteredItems.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent>
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
            <h3 className="text-lg font-semibold">No se encontraron garantías</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Las garantías se generan automáticamente al completar una venta en el módulo de ventas.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        /* ── VISTA LISTA ──────────────────────────────────────── */
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Código / Equipo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Cliente / Venta</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Specs</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Fechas / Días</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Tiempo Restante</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Estado</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((w: any) => {
                const specs = w.unitSpecs || {};
                const batteryLabel =
                  w.unitBatteryHealth === "plugged_only" || w.unitBatteryHealth === "bad_plugged_only"
                    ? "Solo conectada"
                    : w.unitBatteryHealth === "good"
                    ? "100%"
                    : w.unitBatteryHealth === "fair"
                    ? "70%"
                    : /^\d+$/.test(w.unitBatteryHealth || "")
                    ? `${w.unitBatteryHealth}%`
                    : (w.unitBatteryHealth || "N/D");
                return (
                  <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary border-primary/30 font-bold mb-1">
                        {w.unitCode}
                      </Badge>
                      <p className="font-semibold text-slate-800 text-xs">{w.unitBrand} {w.unitModel}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 flex items-center gap-1 text-xs">
                        <User className="h-3 w-3 text-primary shrink-0" /> {w.customerName}
                      </p>
                      {w.customerPhone && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-emerald-500" /> {w.customerPhone}
                        </p>
                      )}
                      {w.saleNumber && (
                        <p className="text-[11px] text-slate-400 font-mono">#{w.saleNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      <p className="flex items-center gap-1"><Cpu className="h-3 w-3 text-blue-400" /> {specs.cpu || "N/D"}</p>
                      <p className="flex items-center gap-1"><HardDrive className="h-3 w-3 text-indigo-400" /> {specs.ram || "N/D"} | {specs.storage || "N/D"}</p>
                      <p className="flex items-center gap-1"><Battery className="h-3 w-3 text-amber-400" /> {batteryLabel}</p>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                      <p>Inicio: {new Date(w.startDate).toLocaleDateString("es-BO")}</p>
                      <p>Vence: {new Date(w.endDate).toLocaleDateString("es-BO")}</p>
                      <p className="font-semibold text-slate-700">{w.days} días totales</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {w.isClaimed ? (
                        <span className="text-slate-500 font-medium">Devolución definitiva</span>
                      ) : w.isPaused ? (
                        <span className="text-amber-700 font-bold">En taller</span>
                      ) : w.isExpired ? (
                        <span className="text-red-600 font-bold">VENCIDA</span>
                      ) : (
                        <span className={w.daysLeft <= 5 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                          {w.daysLeft}d {w.hoursLeft}h
                        </span>
                      )}
                      {/* mini progress bar */}
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full ${w.isClaimed ? "bg-purple-400" : w.isExpired ? "bg-red-400" : w.daysLeft <= 5 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${100 - w.progressPercent}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {w.isClaimed ? (
                        <Badge variant="secondary" className="text-[10px]">RMA cerrado</Badge>
                      ) : w.isExpired ? (
                        <Badge variant="secondary" className="text-[10px] bg-slate-200 text-slate-600">Vencida</Badge>
                      ) : w.daysLeft <= 5 ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 animate-pulse">Por vencer</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">Activa</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={w.isClaimed || w.isExpired}
                        onClick={() => handleOpenRma(w)}
                        className="h-7 px-2 text-[10px] gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 font-bold"
                      >
                        <RefreshCw className="h-3 w-3" /> RMA
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── VISTA TARJETAS ──────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((w: any) => {
            const specs = w.unitSpecs || {};

            return (
              <Card key={w.id} className="hover:shadow-lg transition-all border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden">
                <div>
                  {/* Card Header */}
                  <CardHeader className="pb-3 bg-slate-50/60 dark:bg-slate-900/40 border-b">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant="outline" className="font-mono text-xs mb-1 bg-background text-primary border-primary/30 font-bold">
                          {w.unitCode}
                        </Badge>
                        <CardTitle className="text-base font-bold text-foreground">
                          {w.unitBrand} {w.unitModel}
                        </CardTitle>
                      </div>

                      {/* Status Badge */}
                      {w.isClaimed ? (
                        <Badge variant="outline" className="bg-slate-200 text-slate-700 border-slate-300 font-bold gap-1 shrink-0">
                          <XCircle className="h-3 w-3" /> Devolución Definitiva
                        </Badge>
                      ) : w.isExpired ? (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-bold gap-1 shrink-0">
                          <XCircle className="h-3 w-3" /> Vencida
                        </Badge>
                      ) : w.daysLeft <= 5 ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold gap-1 shrink-0 animate-pulse">
                          <Clock className="h-3 w-3 text-amber-600" /> Por Vencer ({w.daysLeft}d)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold gap-1 shrink-0">
                          <CheckCircle className="h-3 w-3 text-emerald-600" /> Cobertura Activa
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3 text-sm">
                    {/* Cliente y Venta */}
                    <div className="bg-muted/30 p-2.5 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold text-foreground">
                          <User className="h-3.5 w-3.5 text-primary" /> {w.customerName}
                        </span>
                        {w.saleNumber && (
                          <span className="font-mono font-semibold text-muted-foreground flex items-center gap-1">
                            <Receipt className="h-3 w-3" /> #{w.saleNumber}
                          </span>
                        )}
                      </div>
                      {w.customerPhone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3 w-3 text-emerald-600" /> {w.customerPhone}
                        </div>
                      )}
                    </div>

                    {/* Ficha técnica rápida */}
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border">
                      <div className="flex items-center gap-1">
                        <Cpu className="h-3 w-3 text-blue-500 shrink-0" /> {specs.cpu || "CPU N/D"}
                      </div>
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3 text-indigo-500 shrink-0" /> {specs.ram || "RAM N/D"} | {specs.storage || "SSD N/D"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3 text-green-500 shrink-0" /> Estado: {w.unitCondition ? `${w.unitCondition}/10` : "N/D"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Battery className="h-3 w-3 text-amber-500 shrink-0" /> Bat: {w.unitBatteryHealth === "plugged_only" || w.unitBatteryHealth === "bad_plugged_only" ? "Solo conectada" : w.unitBatteryHealth === "good" ? "100%" : w.unitBatteryHealth === "fair" ? "70%" : /^\d+$/.test(w.unitBatteryHealth || "") ? `${w.unitBatteryHealth}%` : (w.unitBatteryHealth || "N/D")}
                      </div>
                    </div>

                    {/* Fechas de inicio y fin */}
                    <div className="flex justify-between items-center text-xs border-t pt-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" /> Cobertura Total:
                      </span>
                      <span className="font-bold text-foreground">{w.days} Días</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                      <span>Inicio: {new Date(w.startDate).toLocaleDateString("es-BO")}</span>
                      <span>Vence: {new Date(w.endDate).toLocaleDateString("es-BO")}</span>
                    </div>

                    {/* ⏱️ CONTADOR REGRESIVO Y BARRA DE PROGRESO */}
                    <div className="space-y-1.5 border-t pt-2.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Clock className="h-3.5 w-3.5 text-primary" /> Tiempo Restante:
                        </span>
                        {w.isClaimed ? (
                          <span className="text-slate-600">Devolución definitiva</span>
                        ) : w.isPaused ? (
                          <span className="text-amber-700 font-black">Pausada — en taller</span>
                        ) : w.isExpired ? (
                          <span className="text-red-600 font-black">VENCIDA</span>
                        ) : (
                          <span className={w.daysLeft <= 5 ? "text-amber-700 font-black" : "text-emerald-700 font-black"}>
                            {w.daysLeft}d {w.hoursLeft}h restantes
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border">
                        <div
                          className={`h-full transition-all ${
                            w.isClaimed
                              ? "bg-purple-500"
                              : w.isExpired
                              ? "bg-red-500"
                              : w.daysLeft <= 5
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${w.progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                        <span>{w.progressPercent}% consumido</span>
                        <span>{100 - w.progressPercent}% disponible</span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 pt-0 border-t mt-2 space-y-1.5">
                  {w.hasPreviousReturns && !w.isClaimed && (
                    <div className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-md px-2 py-1 flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3" />
                      {w.previousReturnsCount > 1
                        ? `${w.previousReturnsCount} devoluciones previas — la garantía sigue vigente`
                        : "1 devolución previa — la garantía sigue vigente"}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant={w.isClaimed ? "ghost" : "outline"}
                    disabled={w.isClaimed || w.isExpired}
                    onClick={() => handleOpenRma(w)}
                    className="w-full gap-2 text-xs font-bold border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {w.isClaimed
                      ? "Devolución Definitiva (RMA cerrado)"
                      : w.isExpired
                      ? "Garantía Vencida"
                      : w.hasPreviousReturns
                      ? "Procesar Nueva Devolución (RMA)"
                      : "Procesar Devolución (RMA)"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Procesar Devolución / RMA por Garantía */}
      <Dialog open={isRmaOpen} onOpenChange={setIsRmaOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-purple-800 text-lg font-bold">
              <RefreshCw className="h-5 w-5 text-purple-600" />
              Procesar Devolución / RMA por Garantía
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Selecciona la acción requerida ante el reclamo del cliente.
            </DialogDescription>
          </DialogHeader>

          {selectedWarranty && (
            <div className="space-y-4 py-2 text-sm">
              {/* Ficha informativa del equipo y venta */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded">
                    #{selectedWarranty.unitCode}
                  </span>
                  {(selectedWarranty.unitSalePrice || selectedWarranty.saleTotal) ? (
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatCurrency(selectedWarranty.unitSalePrice || selectedWarranty.saleTotal)}
                    </span>
                  ) : null}
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedWarranty.unitBrand} {selectedWarranty.unitModel}
                </div>
                <div className="text-slate-600 flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/60">
                  <div>Cliente: <strong className="text-slate-800">{selectedWarranty.customerName}</strong></div>
                  {selectedWarranty.saleNumber && (
                    <div>Venta: <strong className="text-slate-800 font-mono">#{selectedWarranty.saleNumber}</strong></div>
                  )}
                  {selectedWarranty.customerPhone && (
                    <div>Tel: <span className="text-slate-700">{selectedWarranty.customerPhone}</span></div>
                  )}
                </div>
              </div>

              {/* Motivo de la falla */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Motivo de la Devolución / Falla Reportada:
                </label>
                <Textarea
                  value={rmaReason}
                  onChange={(e) => setRmaReason(e.target.value)}
                  placeholder="Ej: Falla en teclado, la pantalla parpadea, cliente solicita devolución..."
                  className="text-xs min-h-[65px] bg-white"
                />
              </div>

              {/* Las 2 opciones de resolución comercial */}
              <div className="space-y-3 pt-1">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Selecciona la resolución para el cliente:
                </div>

                {/* Opción 1: Devolver al Cliente (Anular Venta / Reembolso) */}
                <div
                  onClick={handleGoToCancelSale}
                  className="p-4 rounded-xl border-2 border-red-200 bg-red-50/50 hover:bg-red-50 hover:border-red-400 cursor-pointer transition-all flex items-start gap-3 group shadow-sm"
                >
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0 text-red-600 mt-0.5 group-hover:bg-red-200 transition-colors">
                    <XCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-red-900">
                        1. Devolver al Cliente (Anular Venta / Reembolso)
                      </h4>
                      <ArrowRight className="h-4 w-4 text-red-400 group-hover:text-red-700 group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                    <p className="text-xs text-red-800/80 mt-1 leading-relaxed">
                      Dirige al módulo de <strong>Ventas</strong> para anular la venta y registrar el egreso de dinero al cliente en caja.
                    </p>
                    <div className="mt-2 text-[11px] text-red-700 bg-white/80 p-2 rounded-lg border border-red-200">
                      💡 <em>¿El cliente prefiere cambiar por otro equipo?</em> Es el mismo proceso: se anula la venta original y se genera una <strong>Venta Nueva</strong> con el nuevo equipo que elija en el catálogo.
                    </div>
                  </div>
                </div>

                {/* Opción 2: Ingresar a Taller Técnico */}
                <div
                  onClick={handleSubmitRmaToRepair}
                  className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-all flex items-start gap-3 group shadow-sm"
                >
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 mt-0.5 group-hover:bg-blue-200 transition-colors">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-blue-900">
                        2. Ingresar a Taller Técnico (Reparación en Garantía)
                      </h4>
                      {createReturnMutation.isPending ? (
                        <span className="text-xs text-blue-600 font-bold">Ingresando...</span>
                      ) : (
                        <ArrowRight className="h-4 w-4 text-blue-400 group-hover:text-blue-700 group-hover:translate-x-1 transition-all shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-blue-800/80 mt-1 leading-relaxed">
                      El equipo ingresa a revisión y reparación técnica. <strong>No hay ningún movimiento de dinero</strong> en caja y la garantía se pausa automáticamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setIsRmaOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
