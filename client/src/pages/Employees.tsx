import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Users, Pencil, UserX, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "repartidor",     label: "Repartidor" },
  { value: "ventas",         label: "Ventas" },
  { value: "almacen",        label: "Almacén" },
  { value: "tecnico",        label: "Técnico" },
  { value: "administracion", label: "Administración" },
  { value: "otro",           label: "Otro" },
];

const ROLE_COLOR: Record<string, string> = {
  repartidor:     "bg-blue-50 text-blue-700 border-blue-200",
  ventas:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  almacen:        "bg-amber-50 text-amber-700 border-amber-200",
  tecnico:        "bg-orange-50 text-orange-700 border-orange-200",
  administracion: "bg-violet-50 text-violet-700 border-violet-200",
  otro:           "bg-slate-50 text-slate-600 border-slate-200",
};

// ─── Formulario de empleado ───────────────────────────────────────────────────

interface Deduction { name: string; amount: number; }

interface EmployeeFormProps {
  open: boolean;
  employee?: any;
  onClose: () => void;
  onSave: () => void;
}

function EmployeeForm({ open, employee, onClose, onSave }: EmployeeFormProps) {
  const isEdit = !!employee;
  const utils = trpc.useUtils();

  const [form, setForm] = useState(() => ({
    fullName:  employee?.fullName  || "",
    ci:        employee?.ci        || "",
    role:      employee?.role      || "otro",
    phone:     employee?.phone     || "",
    address:   employee?.address   || "",
    startDate: employee?.startDate || "",
    birthDate: employee?.birthDate || "",
    baseSalary: employee?.baseSalary ? String(employee.baseSalary / 100) : "",
    notes:     employee?.notes     || "",
    status:    employee?.status    || "active",
  }));

  const [deductions, setDeductions] = useState<Deduction[]>(
    employee?.fixedDeductions || []
  );

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const createMut = (trpc as any).employees.create.useMutation({
    onSuccess: () => { toast.success("Empleado registrado"); onSave(); onClose(); (utils as any).employees.list.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = (trpc as any).employees.update.useMutation({
    onSuccess: () => { toast.success("Empleado actualizado"); onSave(); onClose(); (utils as any).employees.list.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.fullName.trim()) { toast.error("El nombre es requerido"); return; }
    const payload = {
      ...form,
      baseSalary: form.baseSalary ? Math.round(parseFloat(form.baseSalary) * 100) : 0,
      fixedDeductions: deductions,
    };
    if (isEdit) updateMut.mutate({ id: employee.id, ...payload });
    else createMut.mutate(payload as any);
  };

  const addDeduction = () => setDeductions(d => [...d, { name: "", amount: 0 }]);
  const removeDeduction = (i: number) => setDeductions(d => d.filter((_, idx) => idx !== i));
  const updateDeduction = (i: number, k: keyof Deduction, v: any) =>
    setDeductions(d => d.map((x, idx) => idx === i ? { ...x, [k]: k === "amount" ? Number(v) : v } : x));

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isEdit ? "Editar Empleado" : "Nuevo Empleado"}
          </DialogTitle>
          <DialogDescription>Datos del empleado del negocio</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Datos básicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-bold">Nombre completo *</Label>
              <Input value={form.fullName} onChange={e => f("fullName", e.target.value)} placeholder="Juan Pérez López" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">CI</Label>
              <Input value={form.ci} onChange={e => f("ci", e.target.value)} placeholder="1234567 LP" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">Teléfono</Label>
              <Input value={form.phone} onChange={e => f("phone", e.target.value)} placeholder="7XXXXXXX" />
            </div>
          </div>

          {/* Rol y sueldo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Rol *</Label>
              <Select value={form.role} onValueChange={v => f("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">Sueldo Base (Bs)</Label>
              <Input type="number" step="0.01" value={form.baseSalary} onChange={e => f("baseSalary", e.target.value)} placeholder="2500.00" />
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Fecha de Ingreso</Label>
              <Input type="date" value={form.startDate} onChange={e => f("startDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">Fecha de Nacimiento</Label>
              <Input type="date" value={form.birthDate} onChange={e => f("birthDate", e.target.value)} />
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-1">
            <Label className="text-xs font-bold">Dirección</Label>
            <Input value={form.address} onChange={e => f("address", e.target.value)} placeholder="El Alto, Ciudad Satélite..." />
          </div>

          {/* Estado (solo en edición) */}
          {isEdit && (
            <div className="space-y-1">
              <Label className="text-xs font-bold">Estado</Label>
              <Select value={form.status} onValueChange={v => f("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Descuentos fijos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">Descuentos Fijos Mensuales</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDeduction} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Agregar
              </Button>
            </div>
            {deductions.length === 0 && (
              <p className="text-xs text-slate-400 italic">Sin descuentos fijos registrados.</p>
            )}
            {deductions.map((d, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Descripción (AFP, Seguro...)"
                  value={d.name}
                  onChange={e => updateDeduction(i, "name", e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Bs."
                  value={d.amount / 100 || ""}
                  onChange={e => updateDeduction(i, "amount", Math.round(parseFloat(e.target.value || "0") * 100))}
                  className="w-24 h-8 text-xs"
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeDeduction(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            ))}
            {deductions.length > 0 && (
              <p className="text-xs text-slate-500 text-right">
                Total descuentos: <strong>{formatCurrency(deductions.reduce((s, d) => s + d.amount, 0))}</strong> ·
                Neto: <strong className="text-emerald-700">{formatCurrency(
                  (form.baseSalary ? Math.round(parseFloat(form.baseSalary) * 100) : 0) -
                  deductions.reduce((s, d) => s + d.amount, 0)
                )}</strong>
              </p>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label className="text-xs font-bold">Notas</Label>
            <Textarea value={form.notes} onChange={e => f("notes", e.target.value)} placeholder="Observaciones..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Guardando..." : isEdit ? "Actualizar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"inactive">("active");
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<any>(null);

  const { data: employees, isLoading, refetch } = (trpc as any).employees.list.useQuery({
    search: search || undefined,
    role:   roleFilter !== "all" ? roleFilter : undefined,
    status: statusFilter,
  });

  const deactivateMut = (trpc as any).employees.deactivate.useMutation({
    onSuccess: () => { toast.success("Empleado desactivado"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const activeCount   = (employees as any[])?.filter((e: any) => e.status === "active").length ?? 0;
  const totalSalary   = (employees as any[])?.filter((e: any) => e.status === "active")
    .reduce((s: number, e: any) => s + (e.baseSalary || 0), 0) ?? 0;

  if (user?.role !== "admin") return <div className="p-8 text-center text-muted-foreground">Acceso restringido.</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto mb-20 md:mb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Empleados
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gestión del personal del negocio</p>
        </div>
        <Button className="gap-2 bg-slate-900 hover:bg-slate-800" onClick={() => { setEditEmployee(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Nuevo Empleado
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Activos",        value: String(activeCount),           color: "border-t-emerald-500" },
          { label: "Total Planilla", value: formatCurrency(totalSalary),   color: "border-t-blue-500" },
          ...ROLE_OPTIONS.slice(0,2).map(r => ({
            label: r.label,
            value: String((employees as any[])?.filter((e:any) => e.role===r.value && e.status==="active").length ?? 0),
            color: "border-t-slate-400",
          })),
        ].map((k, i) => (
          <Card key={i} className={`border-none shadow-sm rounded-2xl bg-white relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-1.5 ${k.color ? k.color.replace("border-t-","bg-") : "bg-slate-400"}`} />
            <CardContent className="p-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{k.label}</p>
              <p className="text-2xl font-black text-slate-900">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o CI..." className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 pb-3">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-600" />
            {(employees as any[])?.length ?? 0} empleado{(employees as any[])?.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Cargando empleados...</div>
          ) : !(employees as any[])?.length ? (
            <div className="py-16 text-center space-y-2">
              <Users className="h-12 w-12 mx-auto text-slate-200" />
              <p className="text-slate-500 font-medium">Sin empleados registrados</p>
              <Button variant="outline" onClick={() => setShowForm(true)}>Agregar el primero</Button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60">
                      <TableHead className="font-black text-xs">Nombre</TableHead>
                      <TableHead className="font-black text-xs">CI</TableHead>
                      <TableHead className="font-black text-xs">Rol</TableHead>
                      <TableHead className="font-black text-xs">Teléfono</TableHead>
                      <TableHead className="font-black text-xs text-right">Sueldo Base</TableHead>
                      <TableHead className="font-black text-xs text-right">Neto</TableHead>
                      <TableHead className="font-black text-xs">Ingreso</TableHead>
                      <TableHead className="font-black text-xs text-center">Estado</TableHead>
                      <TableHead className="font-black text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(employees as any[]).map((emp: any) => {
                      const totalDed = (emp.fixedDeductions || []).reduce((s: number, d: any) => s + d.amount, 0);
                      const neto = (emp.baseSalary || 0) - totalDed;
                      return (
                        <TableRow key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                          <TableCell className="font-semibold text-slate-800">{emp.fullName}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">{emp.ci || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-bold ${ROLE_COLOR[emp.role] || ""}`}>
                              {emp.roleLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{emp.phone || "—"}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{formatCurrency(emp.baseSalary || 0)}</TableCell>
                          <TableCell className={`text-right text-sm font-black ${neto >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {formatCurrency(neto)}
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">{emp.startDate || "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={emp.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]" : "text-slate-400 text-[10px]"}>
                              {emp.status === "active" ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                                onClick={() => { setEditEmployee(emp); setShowForm(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {emp.status === "active" && (
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => { if (confirm(`¿Desactivar a ${emp.fullName}?`)) deactivateMut.mutate({ id: emp.id }); }}>
                                  <UserX className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-slate-100">
                {(employees as any[]).map((emp: any) => {
                  const totalDed = (emp.fixedDeductions || []).reduce((s: number, d: any) => s + d.amount, 0);
                  return (
                    <div key={emp.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-slate-900">{emp.fullName}</p>
                          <p className="text-xs text-slate-400 font-mono">{emp.ci || "Sin CI"}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-bold ${ROLE_COLOR[emp.role] || ""}`}>
                          {emp.roleLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-black">Sueldo Base</p>
                          <p className="font-bold text-slate-800">{formatCurrency(emp.baseSalary || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 uppercase font-black">Neto</p>
                          <p className="font-black text-emerald-700">{formatCurrency((emp.baseSalary || 0) - totalDed)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 gap-1 h-8 text-xs"
                          onClick={() => { setEditEmployee(emp); setShowForm(true); }}>
                          <Pencil className="h-3 w-3" /> Editar
                        </Button>
                        {emp.status === "active" && (
                          <Button size="sm" variant="outline" className="flex-1 gap-1 h-8 text-xs text-red-600 border-red-200"
                            onClick={() => { if (confirm(`¿Desactivar?`)) deactivateMut.mutate({ id: emp.id }); }}>
                            <UserX className="h-3 w-3" /> Desactivar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Formulario */}
      {showForm && (
        <EmployeeForm
          open={showForm}
          employee={editEmployee}
          onClose={() => { setShowForm(false); setEditEmployee(null); }}
          onSave={refetch}
        />
      )}
    </div>
  );
}
