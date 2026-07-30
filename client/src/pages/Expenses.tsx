import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, DollarSign, CreditCard, Clock, CheckCircle2, AlertTriangle, Trash2, Edit, Printer, Download, X, Receipt } from "lucide-react";
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

const EXPENSE_CATEGORIES = [
  { value: "facebook_ads", label: "Facebook Ads", color: "bg-blue-100 text-blue-800" },
  { value: "google_ads", label: "Google Ads", color: "bg-yellow-100 text-yellow-800" },
  { value: "electricity", label: "Luz / Electricidad", color: "bg-amber-100 text-amber-800" },
  { value: "water", label: "Agua", color: "bg-cyan-100 text-cyan-800" },
  { value: "internet", label: "Internet", color: "bg-indigo-100 text-indigo-800" },
  { value: "telephone", label: "Teléfono", color: "bg-purple-100 text-purple-800" },
  { value: "rent", label: "Alquiler", color: "bg-pink-100 text-pink-800" },
  { value: "salaries", label: "Sueldos / Salarios", color: "bg-green-100 text-green-800" },
  { value: "maintenance", label: "Mantenimiento", color: "bg-orange-100 text-orange-800" },
  { value: "supplies", label: "Insumos / Oficina", color: "bg-teal-100 text-teal-800" },
  { value: "taxes", label: "Impuestos", color: "bg-red-100 text-red-800" },
  { value: "insurance", label: "Seguros", color: "bg-slate-100 text-slate-800" },
  { value: "bank_fees", label: "Comisiones Bancarias", color: "bg-gray-100 text-gray-800" },
  { value: "other", label: "Otros", color: "bg-muted text-muted-foreground" },
];

function getCategoryLabel(category: string) {
  return EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
}

function getCategoryColor(category: string) {
  return EXPENSE_CATEGORIES.find(c => c.value === category)?.color || "bg-muted text-muted-foreground";
}

export default function Expenses() {
  const { activeBranchId, setActiveBranchId, branches } = useBranch();
  const { user } = useAuth();
  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery();
  const { data: totals } = trpc.expenses.totals.useQuery();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredExpenses = (expenses as any[])?.filter((e: any) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    return true;
  });

  // Bloqueo de seguridad: Si tiene un cierre pendiente
  const { data: closureStatus } = trpc.finance.hasPendingClosure.useQuery();
  const { data: openingStatus } = trpc.finance.hasActiveOpening.useQuery();
  const isLockedByPending = closureStatus && closureStatus.hasPending;

  if (isLockedByPending) {
    return (
      <div className="page-shell flex items-center justify-center pt-20">
        <Card className="max-w-md w-full border-t-4 border-t-blue-500 shadow-xl">
          <CardHeader className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">
              Gastos Inhabilitados
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium text-base">
              Para poder registrar gastos, primero debes solicitar la habilitación de tu caja en administración.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <p className="text-sm text-slate-500 mb-6">
              Una vez el administrador apruebe tu cierre anterior, podrás volver a registrar gastos.
            </p>
            <Link href={user?.role === "admin" ? "/finance" : "/repartidor/finance"}>
              <Button className="w-full h-11 font-bold">
                Ver estado de mi caja
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-6xl mx-auto mb-20 md:mb-0">
      <div className="flex justify-between items-center no-print">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gastos <span className="text-orange-600">Operativos</span></h1>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sucursal:</span>
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(Number(e.target.value))}
                className="bg-transparent text-sm font-extrabold text-blue-600 outline-none cursor-pointer"
              >
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.isMainWarehouse ? '🏢 ' : '🏪 '}{b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1.5">Control de gastos generales del negocio.</p>
        </div>
        <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" /> Nuevo Gasto
        </Button>
      </div>

      {/* Tarjetas de Resumen */}
      {/* Tarjetas de Resumen Premium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-white group transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-50 rounded-2xl text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="border-red-100 text-red-600 bg-red-50 text-[10px] font-black uppercase tracking-widest px-2">Pendientes</Badge>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto por Pagar</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency((totals?.totalPending || 0) * 100)}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">{totals?.countPending || 0} gastos sin pagar</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-white group transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="border-emerald-100 text-emerald-600 bg-emerald-50 text-[10px] font-black uppercase tracking-widest px-2">Pagados</Badge>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pagado</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency((totals?.totalPaid || 0) * 100)}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">{totals?.countPaid || 0} gastos registrados</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-slate-900 group transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/10 rounded-2xl text-white">
                <Receipt className="h-6 w-6" />
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Histórico</p>
            <p className="text-2xl font-black text-white tracking-tighter">{formatCurrency((totals?.total || 0) * 100)}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">Acumulado total de gastos</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] bg-white group transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                <Clock className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="border-blue-100 text-blue-600 bg-blue-50 text-[10px] font-black uppercase tracking-widest px-2">Este Mes</Badge>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gasto Mensual</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">
               {formatCurrency(((expenses as any[])?.filter((e: any) => {
                const expenseDate = new Date(e.createdAt);
                const now = new Date();
                return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
              }).reduce((sum: number, e: any) => sum + e.amount, 0) || 0))}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">Periodo actual</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Gastos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Lista de Gastos</CardTitle>
              <CardDescription>Historial de todos los gastos operativos.</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="paid">Pagados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredExpenses?.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No hay gastos registrados</p>
              <p className="text-sm">Haz clic en "Nuevo Gasto" para comenzar</p>
            </div>
          ) : (
            <>
              {/* Vista tabla — solo en escritorio */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses?.map((expense: any) => (
                      <ExpenseRow
                        key={expense.id}
                        expense={expense}
                        onEdit={expense.status === "pending" ? () => setEditingExpense(expense) : undefined}
                        onRefresh={refetch}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Vista cards — solo en móvil */}
              <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                {filteredExpenses?.map((expense: any) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    onEdit={expense.status === "pending" ? () => setEditingExpense(expense) : undefined}
                    onRefresh={refetch}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para Agregar Gasto */}
      {showAddDialog && (
        <ExpenseDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={refetch}
        />
      )}

      {/* Diálogo para Editar Gasto */}
      {editingExpense && (
        <ExpenseDialog
          open={!!editingExpense}
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSave={refetch}
        />
      )}
    </div>
  );
}

function ExpenseRow({ expense, onEdit, onRefresh }: { expense: any; onEdit: (() => void) | undefined; onRefresh: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const utils = trpc.useUtils();
  const markPaidMutation = trpc.expenses.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Gasto marcado como pagado");
      onRefresh();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Gasto eliminado");
      onRefresh();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleMarkAsPaid = () => {
    markPaidMutation.mutate({ id: expense.id });
  };

  const handleDelete = () => {
    if (confirm("¿Estás seguro de eliminar este gasto?")) {
      deleteMutation.mutate({ id: expense.id });
    }
  };

  return (
    <>
      <TableRow className={expense.status === "pending" ? "bg-amber-50/50" : ""}>
        <TableCell className="font-medium">
          <div>{new Date(expense.createdAt).toLocaleDateString("es-BO")}</div>
          {expense.expenseDate && expense.expenseDate !== expense.createdAt && (
            <div className="text-xs text-muted-foreground">
              Exp: {new Date(expense.expenseDate).toLocaleDateString("es-BO")}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="font-medium">{expense.description}</div>
          {expense.supplierName && (
            <div className="text-xs text-muted-foreground">{expense.supplierName}</div>
          )}
        </TableCell>
        <TableCell>
          <Badge className={getCategoryColor(expense.category)}>
            {getCategoryLabel(expense.category)}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="capitalize">
            {expense.paymentMethod === "cash" ? "Efectivo" : expense.paymentMethod === "qr" ? "QR" : "Transferencia"}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-mono font-bold">
          {formatCurrency(expense.amount)}
        </TableCell>
        <TableCell className="text-center">
          {expense.status === "pending" ? (
            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
              <Clock className="h-3 w-3 mr-1" /> Pendiente
            </Badge>
          ) : (
            <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Pagado
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-8 px-3 gap-1.5 text-xs" onClick={() => setShowDetail(true)}>
              <Receipt className="h-3.5 w-3.5" />
              Ver
            </Button>
            {expense.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 gap-1.5 text-xs text-green-700 border-green-200 hover:bg-green-50"
                onClick={handleMarkAsPaid}
                disabled={markPaidMutation.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Pagar
              </Button>
            )}
            {expense.status === "pending" && onEdit && (
              <Button size="sm" variant="outline" className="h-8 px-3 gap-1.5 text-xs" onClick={onEdit}>
                <Edit className="h-3.5 w-3.5" />
                Editar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {showDetail && (
        <ExpenseDetailDialog expense={expense} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}

function ExpenseCard({ expense, onEdit, onRefresh }: { expense: any; onEdit: (() => void) | undefined; onRefresh: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const utils = trpc.useUtils();
  const markPaidMutation = trpc.expenses.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Gasto marcado como pagado");
      onRefresh();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Gasto eliminado");
      onRefresh();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  return (
    <>
      <div className={`p-4 flex flex-col gap-3 ${expense.status === "pending" ? "bg-amber-50/40" : ""}`}>
        {/* Header: descripción + monto */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm leading-snug truncate">{expense.description}</p>
            {expense.supplierName && (
              <p className="text-xs text-slate-500 truncate">{expense.supplierName}</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">{new Date(expense.createdAt).toLocaleDateString("es-BO")}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-black text-slate-900 text-base">{formatCurrency(expense.amount)}</p>
            {expense.status === "pending" ? (
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px] mt-0.5">
                <Clock className="h-2.5 w-2.5 mr-1" /> Pendiente
              </Badge>
            ) : (
              <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-[10px] mt-0.5">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Pagado
              </Badge>
            )}
          </div>
        </div>

        {/* Badges: categoría y método */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${getCategoryColor(expense.category)} text-[10px]`}>
            {getCategoryLabel(expense.category)}
          </Badge>
          <Badge variant="outline" className="text-[10px] capitalize">
            {expense.paymentMethod === "cash" ? "Efectivo" : expense.paymentMethod === "qr" ? "QR" : "Transferencia"}
          </Badge>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-9 px-3 gap-1.5 text-xs flex-1" onClick={() => setShowDetail(true)}>
            <Receipt className="h-3.5 w-3.5" />
            Ver detalle
          </Button>
          {expense.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3 gap-1.5 text-xs flex-1 text-green-700 border-green-200 hover:bg-green-50"
              onClick={() => markPaidMutation.mutate({ id: expense.id })}
              disabled={markPaidMutation.isPending}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Marcar Pagado
            </Button>
          )}
          {expense.status === "pending" && onEdit && (
            <Button size="sm" variant="outline" className="h-9 px-3 gap-1.5 text-xs flex-1" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 gap-1.5 text-xs flex-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => {
              if (confirm("¿Estás seguro de eliminar este gasto?")) {
                deleteMutation.mutate({ id: expense.id });
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      </div>
      {showDetail && (
        <ExpenseDetailDialog expense={expense} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}

function ExpenseDetailDialog({ expense, onClose }: { expense: any; onClose: () => void }) {
  return (
    <Dialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle del Gasto</DialogTitle>
          <DialogDescription>Gasto operativo #{expense.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Descripción</p>
              <p className="font-medium">{expense.description}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Categoría</p>
              <Badge className={getCategoryColor(expense.category)}>{getCategoryLabel(expense.category)}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Monto</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(expense.amount)}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Método de Pago</p>
              <p className="font-medium capitalize">
                {expense.paymentMethod === "cash" ? "Efectivo" : expense.paymentMethod === "qr" ? "QR" : "Transferencia"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Fecha del Gasto</p>
              <p className="font-medium">{new Date(expense.expenseDate || expense.createdAt).toLocaleDateString("es-BO")}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Estado</p>
              <Badge variant={expense.status === "paid" ? "default" : "outline"} className={expense.status === "pending" ? "border-amber-300 text-amber-700" : "bg-green-100 text-green-800"}>
                {expense.status === "paid" ? "Pagado" : "Pendiente"}
              </Badge>
            </div>
          </div>

          {expense.supplierName && (
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Proveedor</p>
              <p className="font-medium">{expense.supplierName}</p>
            </div>
          )}

          {expense.invoiceNumber && (
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Nro. Factura</p>
              <p className="font-medium">{expense.invoiceNumber}</p>
            </div>
          )}

          {expense.notes && (
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Notas</p>
              <p className="text-sm">{expense.notes}</p>
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Creado: {new Date(expense.createdAt).toLocaleString("es-BO")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExpenseDialogProps {
  open: boolean;
  expense?: any;
  onClose: () => void;
  onSave: () => void;
}

function ExpenseDialog({ open, expense, onClose, onSave }: ExpenseDialogProps) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    description: "",
    category: "other" as string,
    amount: "",
    paymentMethod: "cash" as string,
    expenseDate: getLocalDateInputValue(),
    dueDate: "",
    status: "pending" as string,
    supplierName: "",
    invoiceNumber: "",
    notes: "",
  });

  useEffect(() => {
    if (expense) {
      setForm({
        description: expense.description || "",
        category: expense.category || "other",
        amount: expense.amount ? (expense.amount / 100).toString() : "",
        paymentMethod: expense.paymentMethod || "cash",
        expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split("T")[0] : getLocalDateInputValue(),
        dueDate: expense.dueDate ? new Date(expense.dueDate).toISOString().split("T")[0] : "",
        status: expense.status || "pending",
        supplierName: expense.supplierName || "",
        invoiceNumber: expense.invoiceNumber || "",
        notes: expense.notes || "",
      });
    } else {
      setForm({
        description: "",
        category: "other",
        amount: "",
        paymentMethod: "cash",
        expenseDate: getLocalDateInputValue(),
        dueDate: "",
        status: "pending",
        supplierName: "",
        invoiceNumber: "",
        notes: "",
      });
    }
  }, [expense, open]);

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("Gasto registrado exitosamente");
      onSave();
      onClose();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("Gasto actualizado exitosamente");
      onSave();
      onClose();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.description.trim()) {
      toast.error("La descripción es requerida");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    const data: any = {
      description: form.description,
      category: form.category as any,
      amount: Math.round(amount * 100),
      paymentMethod: form.paymentMethod as any,
      expenseDate: form.expenseDate,
      dueDate: form.dueDate || undefined,
      supplierName: form.supplierName || undefined,
      invoiceNumber: form.invoiceNumber || undefined,
      notes: form.notes || undefined,
    };

    // Solo enviar status al crear, nunca al editar un gasto ya pagado
    if (!expense || expense.status !== "paid") {
      data.status = form.status as any;
    }

    if (expense) {
      updateMutation.mutate({ id: expense.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar Gasto" : "Nuevo Gasto Operativo"}</DialogTitle>
          <DialogDescription>
            {expense ? "Modifica los datos del gasto" : "Registra un nuevo gasto operativo del negocio"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Input
              id="description"
              placeholder="Ej: Pago de publicidad Facebook"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoría *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto (Bs) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de Pago *</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="qr">QR</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              {expense?.status === "paid" ? (
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Pagado
                </Badge>
              ) : (
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expenseDate">Fecha del Gasto</Label>
              <Input
                id="expenseDate"
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierName">Proveedor / Empresa</Label>
            <Input
              id="supplierName"
              placeholder="Ej: ENEL, Telefónica, etc."
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Número de Factura / Comprobante</Label>
            <Input
              id="invoiceNumber"
              placeholder="Ej: 001-002-0034567"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas / Observaciones</Label>
            <Input
              id="notes"
              placeholder="Notas adicionales..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? "Guardando..." : expense ? "Actualizar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
