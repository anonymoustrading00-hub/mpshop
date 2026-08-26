import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign, CheckCircle2, AlertTriangle, Trash2, Edit, Printer, X, Receipt, Wrench, ShieldAlert, BarChart3, Bot, Lock, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranch } from "@/contexts/BranchContext";

function getLocalDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
}

// ─────────────────────────────────────────────
// Catálogo de categorías con tipo y colores
// ─────────────────────────────────────────────
export const ALL_CATEGORIES = [
  // Costos Directos (automáticos)
  { value: "cogs",                      label: "Costo Mercadería (COGS)",  costType: "direct_cost",        color: "bg-violet-100 text-violet-800",  auto: true  },
  // Costos de Reparación (automáticos)
  { value: "repair_cost",               label: "Costo Reparación",          costType: "repair_cost",         color: "bg-orange-100 text-orange-800",  auto: true  },
  // Costos de Garantía (automáticos)
  { value: "warranty_repair_cost",      label: "Garantía – Reparación",     costType: "warranty_cost",       color: "bg-red-100 text-red-800",        auto: true  },
  { value: "warranty_replacement_cost", label: "Garantía – Reemplazo",      costType: "warranty_cost",       color: "bg-red-100 text-red-800",        auto: true  },
  // Gastos Operativos (manuales)
  { value: "rent",         label: "Alquiler",               costType: "operational_expense", color: "bg-pink-100 text-pink-800",      auto: false },
  { value: "electricity",  label: "Luz / Electricidad",     costType: "operational_expense", color: "bg-amber-100 text-amber-800",    auto: false },
  { value: "water",        label: "Agua",                   costType: "operational_expense", color: "bg-cyan-100 text-cyan-800",      auto: false },
  { value: "internet",     label: "Internet",               costType: "operational_expense", color: "bg-indigo-100 text-indigo-800",  auto: false },
  { value: "telephone",    label: "Teléfono",               costType: "operational_expense", color: "bg-purple-100 text-purple-800",  auto: false },
  { value: "maintenance",  label: "Mantenimiento",          costType: "operational_expense", color: "bg-orange-100 text-orange-800",  auto: false },
  { value: "supplies",     label: "Insumos / Oficina",      costType: "operational_expense", color: "bg-teal-100 text-teal-800",      auto: false },
  { value: "taxes",        label: "Impuestos",              costType: "operational_expense", color: "bg-red-100 text-red-800",        auto: false },
  { value: "insurance",    label: "Seguros",                costType: "operational_expense", color: "bg-slate-100 text-slate-800",    auto: false },
  { value: "bank_fees",    label: "Comisiones Bancarias",   costType: "operational_expense", color: "bg-gray-100 text-gray-800",      auto: false },
  { value: "facebook_ads", label: "Facebook Ads",           costType: "operational_expense", color: "bg-blue-100 text-blue-800",      auto: false },
  { value: "google_ads",   label: "Google Ads",             costType: "operational_expense", color: "bg-yellow-100 text-yellow-800",  auto: false },
  // Gastos Administrativos (manuales)
  { value: "salaries",     label: "Sueldos / Salarios",     costType: "admin_expense",       color: "bg-green-100 text-green-800",    auto: false },
  { value: "other",        label: "Otros",                  costType: "admin_expense",       color: "bg-muted text-muted-foreground", auto: false },
] as const;

// Solo categorías editables manualmente
export const MANUAL_CATEGORIES = ALL_CATEGORIES.filter(c => !c.auto);

export function getCategoryMeta(value: string) {
  return ALL_CATEGORIES.find(c => c.value === value) ?? {
    value, label: value, costType: "operational_expense", color: "bg-muted text-muted-foreground", auto: false
  };
}

// Agrupación de tabs
const TABS = [
  { id: "all",                 label: "Todo",             icon: BarChart3,    filter: (_e: any) => true },
  { id: "direct_cost",         label: "Costos Directos",  icon: DollarSign,   filter: (e: any) => ["cogs"].includes(e.category) },
  { id: "repair_cost",         label: "Reparaciones",     icon: Wrench,       filter: (e: any) => ["repair_cost"].includes(e.category) },
  { id: "warranty_cost",       label: "Garantías",        icon: ShieldAlert,  filter: (e: any) => ["warranty_repair_cost","warranty_replacement_cost"].includes(e.category) },
  { id: "operational_expense", label: "Gastos Op.",       icon: Receipt,      filter: (e: any) => ["rent","electricity","water","internet","telephone","maintenance","supplies","taxes","insurance","bank_fees","facebook_ads","google_ads"].includes(e.category) },
  { id: "admin_expense",       label: "Gastos Admin",     icon: DollarSign,   filter: (e: any) => ["salaries","other"].includes(e.category) },
] as const;

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
const EXPENSE_PERIOD_PRESETS = [
  { id: "today", label: "Hoy" },
  { id: "week", label: "Últimos 7 días" },
  { id: "month", label: "Este Mes" },
  { id: "last_month", label: "Mes Anterior" },
  { id: "quarter", label: "Trimestre" },
  { id: "year", label: "Este Año" },
  { id: "all", label: "Histórico Completo" },
  { id: "custom", label: "Personalizado" },
] as const;

export default function Expenses() {
  const { activeBranchId, setActiveBranchId, branches } = useBranch();
  const { user } = useAuth();

  // Estados de Filtros
  const [period, setPeriod] = useState<"today" | "week" | "month" | "last_month" | "quarter" | "year" | "all" | "custom">("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const queryFilters = {
    period,
    from: period === "custom" && fromDate ? fromDate : undefined,
    to: period === "custom" && toDate ? toDate : undefined,
    branchId: activeBranchId,
    costType: activeTab !== "all" ? activeTab : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    paymentMethod: paymentMethod !== "all" ? (paymentMethod as any) : undefined,
    search: searchQuery ? searchQuery : undefined,
  };

  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery(queryFilters);

  const tabDef = TABS.find(t => t.id === activeTab) ?? TABS[0];
  const filtered = (expenses as any[] | undefined)?.filter((e: any) => {
    if (!tabDef.filter(e)) return false;
    return true;
  }) ?? [];

  const { data: closureStatus } = trpc.finance.hasPendingClosure.useQuery();
  const isLockedByPending = closureStatus?.hasPending;

  const resetFilters = () => {
    setPeriod("month");
    setFromDate("");
    setToDate("");
    setActiveTab("all");
    setFilterStatus("all");
    setPaymentMethod("all");
    setSearchQuery("");
  };

  if (isLockedByPending) {
    return (
      <div className="page-shell flex items-center justify-center pt-20">
        <Card className="max-w-md w-full border-t-4 border-t-blue-500 shadow-xl">
          <CardHeader className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">Gastos Inhabilitados</CardTitle>
            <CardDescription className="text-slate-500 font-medium text-base">
              Para poder registrar gastos, solicita la habilitación de tu caja en administración.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <Link href={user?.role === "admin" ? "/finance" : "/repartidor/finance"}>
              <Button className="w-full h-11 font-bold">Ver estado de mi caja</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto mb-20 md:mb-10">
      {/* Header */}
      <div className="flex justify-between items-start no-print flex-wrap gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Gastos <span className="text-orange-600">&amp; Costos</span>
            </h1>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sucursal:</span>
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(Number(e.target.value))}
                className="bg-transparent text-sm font-extrabold text-blue-600 outline-none cursor-pointer"
              >
                {(branches as any[]).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.isMainWarehouse ? "🏢 " : "🏪 "}{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1.5">Control completo de gastos operativos y costos del negocio por rango de fechas.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={resetFilters} className="font-bold text-xs gap-1.5 h-10 border-slate-300">
            <RotateCcw className="h-3.5 w-3.5" /> Restablecer
          </Button>
          <Button className="gap-2 h-10 font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" /> Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* ─── FILTROS Y RANGO DE FECHAS ────────────────────────────────────────── */}
      <Card className="border border-slate-200/90 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div>
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Rango de Período Rápido:
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_PERIOD_PRESETS.map((p) => (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
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

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-500">Estado de Pago:</Label>
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Estados</SelectItem>
                  <SelectItem value="pending">Pendientes de Pago</SelectItem>
                  <SelectItem value="paid">Pagados</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] font-bold text-slate-500">Buscar por texto:</Label>
              <div className="relative">
                <Input
                  placeholder="Proveedor, factura, concepto, notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-3 no-print">
          <TabsList className="flex-wrap h-auto gap-1 bg-slate-100/60 p-1.5 rounded-2xl">
            {TABS.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm h-9 px-3 flex items-center gap-1.5">
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-9 font-bold text-xs" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Reporte
            </Button>
          </div>
        </div>

        {TABS.map(tab => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            <Card className="border border-slate-200/90 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base font-black text-slate-800">
                      <tab.icon className="h-4 w-4 text-orange-600" />
                      {tab.label}
                    </CardTitle>
                    <CardDescription>
                      {filtered.length} registro{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
                      {tab.id !== "all" && tab.id === activeTab && filtered.some((e: any) => e.isAutomatic)
                        ? " — incluye entradas generadas automáticamente por el sistema"
                        : ""}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <ExpenseList
                  expenses={filtered}
                  isLoading={isLoading}
                  onEdit={(e) => { if (!e.isAutomatic) setEditingExpense(e); }}
                  onRefresh={refetch}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {showAddDialog && (
        <ExpenseDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onSave={refetch} />
      )}
      {editingExpense && (
        <ExpenseDialog open={!!editingExpense} expense={editingExpense} onClose={() => setEditingExpense(null)} onSave={refetch} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Expense List (tabla + cards móvil)
// ─────────────────────────────────────────────
function ExpenseList({ expenses, isLoading, onEdit, onRefresh }: {
  expenses: any[]; isLoading: boolean; onEdit: (e: any) => void; onRefresh: () => void;
}) {
  if (isLoading) return (
    <div className="space-y-2 p-4">
      {[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
    </div>
  );
  if (!expenses.length) return (
    <div className="py-12 text-center text-muted-foreground">
      <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p className="font-medium">No hay registros en esta categoría</p>
    </div>
  );
  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo / Categoría</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e: any) => (
              <ExpenseRow key={e.id} expense={e} onEdit={onEdit} onRefresh={onRefresh} />
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col divide-y divide-slate-100">
        {expenses.map((e: any) => (
          <ExpenseCard key={e.id} expense={e} onEdit={onEdit} onRefresh={onRefresh} />
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Expense Row (desktop)
// ─────────────────────────────────────────────
function ExpenseRow({ expense, onEdit, onRefresh }: { expense: any; onEdit: (e: any) => void; onRefresh: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const utils = trpc.useUtils();
  const meta = getCategoryMeta(expense.category);

  const markPaid = trpc.expenses.markAsPaid.useMutation({
    onSuccess: () => { toast.success("Marcado como pagado"); onRefresh(); void utils.expenses.list.invalidate(); void utils.expenses.totals.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.expenses.delete.useMutation({
    onSuccess: () => { toast.success("Eliminado"); onRefresh(); void utils.expenses.list.invalidate(); void utils.expenses.totals.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <TableRow className={expense.status === "pending" ? "bg-amber-50/40" : ""}>
        <TableCell className="text-xs text-slate-500">{new Date(expense.createdAt).toLocaleDateString("es-BO")}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm leading-snug">{expense.description}</p>
            {expense.isAutomatic === 1 && (
              <span title="Generado automáticamente"><Bot className="h-3.5 w-3.5 text-slate-400 shrink-0" /></span>
            )}
          </div>
          {expense.supplierName && <p className="text-xs text-slate-400">{expense.supplierName}</p>}
        </TableCell>
        <TableCell>
          <Badge className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
          <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">
            {meta.costType === "direct_cost" ? "Costo Directo" : meta.costType === "repair_cost" ? "Costo Reparación" : meta.costType === "warranty_cost" ? "Costo Garantía" : meta.costType === "admin_expense" ? "Gasto Admin" : "Gasto Operativo"}
          </p>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs capitalize">
            {expense.paymentMethod === "cash" ? "Efectivo" : expense.paymentMethod === "qr" ? "QR" : "Transferencia"}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-mono font-bold">{formatCurrency(expense.amount)}</TableCell>
        <TableCell className="text-center">
          {expense.status === "pending"
            ? <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px]">Pendiente</Badge>
            : <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-[10px]">Pagado</Badge>}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setShowDetail(true)}>
              <Receipt className="h-3 w-3" />
            </Button>
            {expense.status === "pending" && expense.isAutomatic !== 1 && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-700 border-green-200" onClick={() => markPaid.mutate({ id: expense.id })} disabled={markPaid.isPending}>
                <CheckCircle2 className="h-3 w-3" />
              </Button>
            )}
            {expense.status === "pending" && expense.isAutomatic !== 1 && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onEdit(expense)}>
                <Edit className="h-3 w-3" />
              </Button>
            )}
            {expense.isAutomatic !== 1 && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600 border-red-200" onClick={() => { if (confirm("¿Eliminar?")) del.mutate({ id: expense.id }); }} disabled={del.isPending}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {showDetail && <ExpenseDetailDialog expense={expense} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ─────────────────────────────────────────────
// Expense Card (mobile)
// ─────────────────────────────────────────────
function ExpenseCard({ expense, onEdit, onRefresh }: { expense: any; onEdit: (e: any) => void; onRefresh: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const utils = trpc.useUtils();
  const meta = getCategoryMeta(expense.category);

  const markPaid = trpc.expenses.markAsPaid.useMutation({
    onSuccess: () => { toast.success("Marcado como pagado"); onRefresh(); void utils.expenses.list.invalidate(); void utils.expenses.totals.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.expenses.delete.useMutation({
    onSuccess: () => { toast.success("Eliminado"); onRefresh(); void utils.expenses.list.invalidate(); void utils.expenses.totals.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <div className={`p-4 flex flex-col gap-3 ${expense.status === "pending" ? "bg-amber-50/30" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="font-semibold text-sm leading-snug">{expense.description}</p>
              {expense.isAutomatic === 1 && <Bot className="h-3 w-3 text-slate-400 shrink-0" />}
            </div>
            <p className="text-xs text-slate-400">{new Date(expense.createdAt).toLocaleDateString("es-BO")}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-black text-base">{formatCurrency(expense.amount)}</p>
            {expense.status === "pending"
              ? <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px]">Pendiente</Badge>
              : <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-[10px]">Pagado</Badge>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
          <Badge variant="outline" className="text-[10px]">
            {expense.paymentMethod === "cash" ? "Efectivo" : expense.paymentMethod === "qr" ? "QR" : "Transferencia"}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 h-9 text-xs gap-1" onClick={() => setShowDetail(true)}>
            <Receipt className="h-3.5 w-3.5" /> Ver
          </Button>
          {expense.status === "pending" && expense.isAutomatic !== 1 && (
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs gap-1 text-green-700 border-green-200" onClick={() => markPaid.mutate({ id: expense.id })} disabled={markPaid.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Pagar
            </Button>
          )}
          {expense.status === "pending" && expense.isAutomatic !== 1 && (
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs gap-1" onClick={() => onEdit(expense)}>
              <Edit className="h-3.5 w-3.5" /> Editar
            </Button>
          )}
          {expense.isAutomatic !== 1 && (
            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs gap-1 text-red-600 border-red-200" onClick={() => { if (confirm("¿Eliminar?")) del.mutate({ id: expense.id }); }} disabled={del.isPending}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {showDetail && <ExpenseDetailDialog expense={expense} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ─────────────────────────────────────────────
// Detail Dialog
// ─────────────────────────────────────────────
function ExpenseDetailDialog({ expense, onClose }: { expense: any; onClose: () => void }) {
  const meta = getCategoryMeta(expense.category);
  return (
    <Dialog open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {expense.isAutomatic === 1 && <Bot className="h-4 w-4 text-slate-400" />}
            Detalle del {expense.isAutomatic === 1 ? "Costo" : "Gasto"}
          </DialogTitle>
          <DialogDescription>#{expense.id} · {meta.label}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {expense.isAutomatic === 1 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
              <Bot className="h-4 w-4 shrink-0" />
              <p>Este registro fue generado automáticamente por el sistema y no puede editarse.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Descripción</p><p className="font-medium">{expense.description}</p></div>
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Categoría</p><Badge className={meta.color}>{meta.label}</Badge></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Monto</p><p className="text-xl font-bold text-red-600">{formatCurrency(expense.amount)}</p></div>
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Método</p><p className="capitalize font-medium">{expense.paymentMethod === "cash" ? "Efectivo" : expense.paymentMethod === "qr" ? "QR" : "Transferencia"}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs font-bold text-muted-foreground uppercase">Fecha</p><p className="font-medium">{new Date(expense.expenseDate || expense.createdAt).toLocaleDateString("es-BO")}</p></div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Estado</p>
              <Badge variant={expense.status === "paid" ? "default" : "outline"} className={expense.status === "pending" ? "border-amber-300 text-amber-700" : "bg-green-100 text-green-800"}>
                {expense.status === "paid" ? "Pagado" : "Pendiente"}
              </Badge>
            </div>
          </div>
          {expense.referenceType && <div><p className="text-xs font-bold text-muted-foreground uppercase">Origen</p><p className="font-mono text-sm">{expense.referenceType} #{expense.referenceId}</p></div>}
          {expense.supplierName && <div><p className="text-xs font-bold text-muted-foreground uppercase">Proveedor</p><p className="font-medium">{expense.supplierName}</p></div>}
          {expense.notes && <div><p className="text-xs font-bold text-muted-foreground uppercase">Notas</p><p className="text-sm">{expense.notes}</p></div>}
          <div className="pt-2 border-t"><p className="text-xs text-muted-foreground">Creado: {new Date(expense.createdAt).toLocaleString("es-BO")}</p></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Add/Edit Dialog (solo categorías manuales)
// ─────────────────────────────────────────────
interface ExpenseDialogProps { open: boolean; expense?: any; onClose: () => void; onSave: () => void; }

function ExpenseDialog({ open, expense, onClose, onSave }: ExpenseDialogProps) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    description: "", category: "other" as string, amount: "",
    paymentMethod: "cash" as string, expenseDate: getLocalDateInputValue(),
    dueDate: "", status: "pending" as string, supplierName: "", invoiceNumber: "", notes: "",
  });

  useEffect(() => {
    if (expense) {
      setForm({
        description: expense.description ?? "",
        category: expense.category ?? "other",
        amount: expense.amount ? (expense.amount / 100).toString() : "",
        paymentMethod: expense.paymentMethod ?? "cash",
        expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split("T")[0] : getLocalDateInputValue(),
        dueDate: expense.dueDate ? new Date(expense.dueDate).toISOString().split("T")[0] : "",
        status: expense.status ?? "pending",
        supplierName: expense.supplierName ?? "",
        invoiceNumber: expense.invoiceNumber ?? "",
        notes: expense.notes ?? "",
      });
    } else {
      setForm({ description: "", category: "other", amount: "", paymentMethod: "cash", expenseDate: getLocalDateInputValue(), dueDate: "", status: "pending", supplierName: "", invoiceNumber: "", notes: "" });
    }
  }, [expense, open]);

  const createM = trpc.expenses.create.useMutation({
    onSuccess: () => { toast.success("Gasto registrado"); onSave(); onClose(); void utils.expenses.list.invalidate(); void utils.expenses.totals.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateM = trpc.expenses.update.useMutation({
    onSuccess: () => { toast.success("Gasto actualizado"); onSave(); onClose(); void utils.expenses.list.invalidate(); void utils.expenses.totals.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.description.trim()) { toast.error("La descripción es requerida"); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { toast.error("Ingresa un monto válido"); return; }
    const data: any = {
      description: form.description, category: form.category as any, amount: Math.round(amount * 100),
      paymentMethod: form.paymentMethod as any, expenseDate: form.expenseDate,
      dueDate: form.dueDate || undefined, supplierName: form.supplierName || undefined,
      invoiceNumber: form.invoiceNumber || undefined, notes: form.notes || undefined,
    };
    if (!expense || expense.status !== "paid") data.status = form.status as any;
    expense ? updateM.mutate({ id: expense.id, ...data }) : createM.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar Gasto" : "Nuevo Gasto"}</DialogTitle>
          <DialogDescription>{expense ? "Modifica los datos del gasto" : "Registra un gasto operativo o administrativo del negocio"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Input placeholder="Ej: Pago alquiler local" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sep_op" disabled className="text-[10px] font-black uppercase tracking-widest text-slate-400">— Gastos Operativos —</SelectItem>
                  {MANUAL_CATEGORIES.filter(c => c.costType === "operational_expense").map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                  <SelectItem value="__sep_adm" disabled className="text-[10px] font-black uppercase tracking-widest text-slate-400">— Gastos Administrativos —</SelectItem>
                  {MANUAL_CATEGORIES.filter(c => c.costType === "admin_expense").map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto (Bs) *</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Método de Pago *</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="qr">QR</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              {expense?.status === "paid" ? (
                <Badge variant="default" className="bg-green-100 text-green-800">Pagado</Badge>
              ) : (
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Fecha del Gasto</Label><Input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Fecha Vencimiento</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Proveedor / Empresa</Label><Input placeholder="Ej: ENEL, Telefónica" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></div>
          <div className="space-y-2"><Label>Nro. Factura / Comprobante</Label><Input placeholder="001-002-0034567" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} /></div>
          <div className="space-y-2"><Label>Notas</Label><Input placeholder="Observaciones adicionales..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createM.isPending || updateM.isPending}>
            {createM.isPending || updateM.isPending ? "Guardando..." : expense ? "Actualizar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
