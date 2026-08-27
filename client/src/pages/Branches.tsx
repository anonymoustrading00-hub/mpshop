import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Store, Plus, MapPin, Edit, Power, PowerOff, Trash2,
  ArrowRightLeft, Search, CheckCircle2, FileText, Printer,
  Building2, PackageCheck, Clock, X, Package,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

// ─── Tipo de equipo seleccionable para traspaso ───────────────────────────────
type TransferUnit = {
  id: number;
  code: string;
  brand: string;
  model: string;
  serialNumber?: string;
  specs?: any;
  status: string;
};

// ─── Genera la Nota de Traspaso en HTML para imprimir ────────────────────────
function printTransferNote(data: {
  transferNumber: string;
  sourceBranchName: string;
  sourceBranchAddress?: string;
  destBranchName: string;
  destBranchAddress?: string;
  userName: string;
  date: string;
  items: TransferUnit[];
  notes?: string;
  companyName?: string;
  companyLogo?: string;
}) {
  const { transferNumber, sourceBranchName, sourceBranchAddress, destBranchName,
    destBranchAddress, userName, date, items, notes, companyName, companyLogo } = data;

  const rows = items.map((item, i) => {
    const specs = typeof item.specs === "string" ? JSON.parse(item.specs || "{}") : (item.specs || {});
    const specStr = [specs.cpu, specs.ram, specs.storage].filter(Boolean).join(" / ") || "—";
    return `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 12px;color:#64748b;font-size:13px">${i + 1}</td>
        <td style="padding:10px 12px;font-weight:700;font-size:13px;color:#1e40af">${item.code}</td>
        <td style="padding:10px 12px;font-size:13px">${item.brand} ${item.model}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569">${item.serialNumber || "—"}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569">${specStr}</td>
      </tr>`;
  }).join("");

  const logoHtml = companyLogo
    ? `<img src="${companyLogo}" style="height:50px;object-fit:contain;margin-bottom:4px" />`
    : `<div style="font-size:22px;font-weight:900;letter-spacing:-0.5px">${companyName || "MP Shop"}</div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Nota de Traspaso ${transferNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:#fff;padding:36px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2.5px solid #1e293b}
    .doc-type{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-top:4px}
    .badge{background:#1e40af;color:#fff;padding:8px 20px;border-radius:10px;font-size:20px;font-weight:900;letter-spacing:1px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
    .info-box{background:#f8fafc;border-radius:10px;padding:14px 18px;border:1px solid #e2e8f0}
    .info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:6px}
    .info-value{font-size:15px;font-weight:700;color:#1e293b}
    .info-sub{font-size:12px;color:#64748b;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
    thead tr{background:#1e293b;color:#fff}
    thead th{padding:11px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
    .total-row{background:#eff6ff;font-weight:700}
    .notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:20px}
    .notes-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#92400e;margin-bottom:4px}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:48px}
    .sig-line{border-top:1.5px solid #cbd5e1;padding-top:10px;text-align:center;font-size:12px;color:#64748b}
    .footer{margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="header">
    <div>${logoHtml}<div class="doc-type">Nota de Traspaso de Inventario entre Sucursales</div></div>
    <div class="badge">${transferNumber}</div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">📤 Sucursal Origen (Sale de)</div>
      <div class="info-value">${sourceBranchName}</div>
      ${sourceBranchAddress ? `<div class="info-sub">${sourceBranchAddress}</div>` : ""}
    </div>
    <div class="info-box">
      <div class="info-label">📥 Sucursal Destino (Llega a)</div>
      <div class="info-value">${destBranchName}</div>
      ${destBranchAddress ? `<div class="info-sub">${destBranchAddress}</div>` : ""}
    </div>
    <div class="info-box">
      <div class="info-label">📅 Fecha y Hora</div>
      <div class="info-value">${date}</div>
    </div>
    <div class="info-box">
      <div class="info-label">👤 Responsable</div>
      <div class="info-value">${userName}</div>
    </div>
  </div>
  ${notes ? `<div class="notes-box"><div class="notes-label">📝 Observaciones</div><p style="font-size:14px;color:#78350f">${notes}</p></div>` : ""}
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Código</th>
        <th>Marca / Modelo</th>
        <th>S/N (Serie)</th>
        <th>Especificaciones</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="4" style="padding:12px;font-size:13px">TOTAL EQUIPOS TRASPASADOS</td>
        <td style="padding:12px;text-align:right;font-size:15px">${items.length}</td>
      </tr>
    </tbody>
  </table>
  <div class="signatures">
    <div><div class="sig-line">Entregué Conforme<br/><strong>${sourceBranchName}</strong></div></div>
    <div><div class="sig-line">Recibí Conforme<br/><strong>${destBranchName}</strong></div></div>
  </div>
  <div class="footer">${companyName || "MP Shop"} · ${date} · ${transferNumber}</div>
  </body></html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) { alert("Permite ventanas emergentes para imprimir la nota"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ─── Modal para crear un nuevo traspaso ──────────────────────────────────────
function NewTransferModal({ branches, onSuccess }: { branches: any[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [destBranchId, setDestBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<TransferUnit[]>([]);
  const [notes, setNotes] = useState("");

  const { data: companyData } = (trpc.settings as any).getCompanyConfig?.useQuery?.() ?? { data: null };

  const { data: unitsData } = trpc.units.list.useQuery(
    {
      branchId: sourceBranchId ? Number(sourceBranchId) : undefined,
      search: search || undefined,
      status: "available",
      limit: 100,
    },
    { enabled: !!sourceBranchId }
  );

  const availableUnits: any[] = useMemo(() => {
    const items = (unitsData as any)?.items || [];
    const selectedIds = new Set(selectedUnits.map((u) => u.id));
    return items.filter((u: any) => !selectedIds.has(u.id));
  }, [unitsData, selectedUnits]);

  const createTransfer = (trpc.transfers as any).create.useMutation({
    onSuccess: (data: any) => {
      toast.success(`✅ Traspaso ${data.transferNumber} realizado exitosamente`);
      const srcBranch = branches.find((b) => b.id === Number(sourceBranchId));
      const dstBranch = branches.find((b) => b.id === Number(destBranchId));
      printTransferNote({
        transferNumber: data.transferNumber,
        sourceBranchName: data.sourceBranchName,
        sourceBranchAddress: srcBranch?.address,
        destBranchName: data.destBranchName,
        destBranchAddress: dstBranch?.address,
        userName: "Administrador",
        date: new Date().toLocaleString("es-BO", { dateStyle: "full", timeStyle: "short" }),
        items: selectedUnits,
        notes: notes || undefined,
        companyName: companyData?.name,
        companyLogo: companyData?.logo,
      });
      setOpen(false);
      setSourceBranchId("");
      setDestBranchId("");
      setSelectedUnits([]);
      setNotes("");
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message || "Error al realizar el traspaso"),
  });

  const handleSelect = (unit: any) => {
    setSelectedUnits((prev) => [...prev, {
      id: unit.id,
      code: unit.code,
      brand: unit.brand,
      model: unit.model,
      serialNumber: unit.serialNumber,
      specs: unit.specs,
      status: unit.status,
    }]);
  };

  const handleRemove = (id: number) => {
    setSelectedUnits((prev) => prev.filter((u) => u.id !== id));
  };

  const handleSubmit = () => {
    if (!sourceBranchId || !destBranchId) {
      toast.error("Selecciona sucursal de origen y destino");
      return;
    }
    if (selectedUnits.length === 0) {
      toast.error("Selecciona al menos un equipo para traspasar");
      return;
    }
    createTransfer.mutate({
      sourceBranchId: Number(sourceBranchId),
      destinationBranchId: Number(destBranchId),
      unitIds: selectedUnits.map((u) => u.id),
      notes: notes || undefined,
    });
  };

  const destBranches = branches.filter((b) => b.id !== Number(sourceBranchId) && b.status === "active");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
          <ArrowRightLeft className="h-4 w-4" />
          Nuevo Traspaso de Equipos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <ArrowRightLeft className="h-5 w-5" />
            Crear Traspaso entre Sucursales
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Sucursales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sucursal Origen <span className="text-red-500">*</span></Label>
              <Select value={sourceBranchId} onValueChange={(v) => { setSourceBranchId(v); setSelectedUnits([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar origen..." />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b.status === "active").map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sucursal Destino <span className="text-red-500">*</span></Label>
              <Select value={destBranchId} onValueChange={setDestBranchId} disabled={!sourceBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar destino..." />
                </SelectTrigger>
                <SelectContent>
                  {destBranches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Búsqueda de equipos */}
          {sourceBranchId && (
            <div className="space-y-3">
              <Label>Equipos Disponibles en Origen</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por código, marca o modelo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {availableUnits.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    {search ? "Sin resultados" : "No hay equipos disponibles en esta sucursal"}
                  </div>
                ) : (
                  availableUnits.map((unit: any) => (
                    <div key={unit.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => handleSelect(unit)}>
                      <div>
                        <span className="font-mono text-xs font-bold text-blue-700 mr-2">{unit.code}</span>
                        <span className="text-sm font-medium">{unit.brand} {unit.model}</span>
                        {unit.serialNumber && <span className="text-xs text-slate-400 ml-2">S/N: {unit.serialNumber}</span>}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs">+ Agregar</Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Equipos seleccionados */}
          {selectedUnits.length > 0 && (
            <div className="space-y-2">
              <Label className="text-green-700">✅ Equipos Seleccionados ({selectedUnits.length})</Label>
              <div className="border rounded-lg divide-y max-h-36 overflow-y-auto">
                {selectedUnits.map((unit) => (
                  <div key={unit.id} className="flex items-center justify-between px-4 py-2 bg-green-50/50">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-700 mr-2">{unit.code}</span>
                      <span className="text-sm">{unit.brand} {unit.model}</span>
                      {unit.serialNumber && <span className="text-xs text-slate-400 ml-2">S/N: {unit.serialNumber}</span>}
                    </div>
                    <button onClick={() => handleRemove(unit.id)} className="text-red-400 hover:text-red-600 p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Observaciones (Opcional)</Label>
            <Textarea
              placeholder="Motivo del traspaso, instrucciones especiales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createTransfer.isPending || selectedUnits.length === 0}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {createTransfer.isPending ? "Procesando..." : `Traspasar ${selectedUnits.length} Equipo${selectedUnits.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Branches() {
  const { data: branches = [], isLoading, refetch } = trpc.branches.list.useQuery();
  const utils = trpc.useUtils();
  const { activeBranchId } = useBranch();
  const [activeTab, setActiveTab] = useState<"branches" | "transfers">("branches");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewTransferId, setViewTransferId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "", phone: "", isWarehouse: false, isActive: true });

  // Transfer history
  const { data: transfersData, refetch: refetchTransfers } = (trpc.transfers as any).list.useQuery({
    limit: 100,
  });
  const transfers: any[] = transfersData?.items || [];

  const { data: companyData } = (trpc.settings as any).getCompanyConfig?.useQuery?.() ?? { data: null };

  // Branch detail for printing note
  const { data: selectedTransferData } = (trpc.transfers as any).getById.useQuery(
    { id: viewTransferId ?? 0 },
    { enabled: !!viewTransferId }
  );

  const createBranch = trpc.branches.create.useMutation({
    onSuccess: () => { toast.success("Sucursal creada exitosamente"); setOpen(false); refetch(); },
    onError: (err) => toast.error(err.message || "Error al crear sucursal"),
  });

  const updateBranch = trpc.branches.update.useMutation({
    onSuccess: () => { toast.success("Sucursal actualizada"); setEditOpen(false); refetch(); utils.branches.list.invalidate(); },
    onError: (err) => toast.error(err.message || "Error al actualizar sucursal"),
  });

  const deleteBranch = trpc.branches.delete.useMutation({
    onSuccess: () => { toast.success("Sucursal eliminada"); refetch(); utils.branches.list.invalidate(); },
    onError: (err) => toast.error(err.message || "Error al eliminar sucursal"),
  });

  const openEditModal = (branch: any) => {
    setEditingId(branch.id);
    setFormData({ name: branch.name || "", address: branch.address || "", phone: branch.phone || "", isWarehouse: branch.isMainWarehouse === 1, isActive: branch.status === "active" });
    setEditOpen(true);
  };

  const resetForm = () => { setFormData({ name: "", address: "", phone: "", isWarehouse: false, isActive: true }); setEditingId(null); };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { toast.error("El nombre es requerido"); return; }
    createBranch.mutate({ name: formData.name, address: formData.address, phone: formData.phone, isMainWarehouse: formData.isWarehouse ? 1 : 0, status: formData.isActive ? "active" : "inactive" });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !formData.name) { toast.error("El nombre es requerido"); return; }
    updateBranch.mutate({ id: editingId, name: formData.name, address: formData.address, phone: formData.phone, isMainWarehouse: formData.isWarehouse ? 1 : 0, status: formData.isActive ? "active" : "inactive" });
  };

  const toggleStatus = (id: number, currentStatus: string) => {
    setEditingId(id);
    updateBranch.mutate({ id, status: currentStatus === "active" ? "inactive" : "active" });
  };

  const handlePrintNote = (transfer: any) => {
    const srcBranch = (branches as any[]).find((b) => b.id === transfer.sourceBranchId);
    const dstBranch = (branches as any[]).find((b) => b.id === transfer.destinationBranchId);
    if (!selectedTransferData || selectedTransferData.transfer.id !== transfer.id) {
      toast.info("Cargando detalles del traspaso...");
      setViewTransferId(transfer.id);
      return;
    }
    printTransferNote({
      transferNumber: transfer.transferNumber,
      sourceBranchName: transfer.sourceBranchName,
      sourceBranchAddress: srcBranch?.address,
      destBranchName: transfer.destinationBranchName,
      destBranchAddress: dstBranch?.address,
      userName: transfer.userName,
      date: new Date(transfer.createdAt).toLocaleString("es-BO", { dateStyle: "full", timeStyle: "short" }),
      items: selectedTransferData.items.map((item: any) => ({
        id: item.unitId,
        code: item.unitCode || "—",
        brand: item.brand || "—",
        model: item.model || "—",
        serialNumber: item.serialNumber,
        specs: item.specs,
        status: item.status || "—",
      })),
      notes: transfer.notes || undefined,
      companyName: companyData?.name,
      companyLogo: companyData?.logo,
    });
  };

  if (isLoading) return <div className="p-6">Cargando sucursales...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            Sucursales y <span className="text-blue-600">Traspasos</span>
          </h1>
          <p className="text-slate-500 mt-1">Administra tus puntos de venta y transfiere equipos entre sucursales.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("branches")}
          className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === "branches" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          <Building2 className="h-4 w-4 inline mr-2" />
          Sucursales ({(branches as any[]).length})
        </button>
        <button
          onClick={() => setActiveTab("transfers")}
          className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === "transfers" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          <ArrowRightLeft className="h-4 w-4 inline mr-2" />
          Traspasos ({transfers.length})
        </button>
      </div>

      {/* ── TAB: SUCURSALES ─────────────────────────────────────────────── */}
      {activeTab === "branches" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (val) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />Nueva Sucursal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Crear Nueva Sucursal</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nombre de la Sucursal</Label>
                    <Input placeholder="Ej: Sucursal Norte" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección (Opcional)</Label>
                    <Input placeholder="Dirección física" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono (Opcional)</Label>
                    <Input placeholder="Número de contacto" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox id="isWarehouse" checked={formData.isWarehouse} onCheckedChange={(c) => setFormData({ ...formData, isWarehouse: c === true })} />
                    <Label htmlFor="isWarehouse" className="cursor-pointer">Es una bodega principal (almacén central)</Label>
                  </div>
                  <p className="text-xs text-slate-500 bg-blue-50 rounded-lg p-3 border border-blue-100">
                    💡 La nueva sucursal tendrá acceso a todas las funciones del sistema y comenzará con inventario en cero. Podrás traspasar equipos desde otras sucursales.
                  </p>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={createBranch.isPending}>{createBranch.isPending ? "Guardando..." : "Guardar Sucursal"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit modal */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Editar Sucursal</DialogTitle></DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nombre de la Sucursal</Label>
                  <Input placeholder="Ej: Sucursal Norte" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Dirección (Opcional)</Label>
                  <Input placeholder="Dirección física" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono (Opcional)</Label>
                  <Input placeholder="Número de contacto" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="edit-isWarehouse" checked={formData.isWarehouse} onCheckedChange={(c) => setFormData({ ...formData, isWarehouse: c === true })} />
                  <Label htmlFor="edit-isWarehouse" className="cursor-pointer">Es una bodega principal</Label>
                </div>
                <div className="flex justify-end pt-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={updateBranch.isPending}>{updateBranch.isPending ? "Guardando..." : "Actualizar Sucursal"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(branches as any[]).map((branch: any) => (
                  <TableRow key={branch.id} className={activeBranchId === branch.id ? "bg-blue-50/50" : ""}>
                    <TableCell className="font-medium text-slate-500">#{branch.id}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">
                        {branch.name}
                        {activeBranchId === branch.id && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Actual</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-slate-500 text-sm gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {branch.address || <span className="italic">Sin dirección</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {branch.isMainWarehouse === 1 ? (
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">Bodega Principal</span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Punto de Venta</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {branch.status === "active"
                        ? <span className="text-green-600 font-medium text-sm">Activo</span>
                        : <span className="text-slate-400 font-medium text-sm">Inactivo</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => openEditModal(branch)}>
                        <Edit className="h-3.5 w-3.5" />Editar
                      </Button>
                      <Button
                        variant={branch.status === "active" ? "destructive" : "default"}
                        size="sm"
                        className="h-8 gap-1 w-28"
                        onClick={() => toggleStatus(branch.id, branch.status)}
                        disabled={updateBranch.isPending && editingId === branch.id}
                      >
                        {branch.status === "active" ? <><PowerOff className="h-3.5 w-3.5" />Desactivar</> : <><Power className="h-3.5 w-3.5" />Activar</>}
                      </Button>
                      {activeBranchId !== branch.id ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />Eliminar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar sucursal "{branch.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Esta acción es irreversible y puede afectar el historial si hay órdenes asociadas.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteBranch.mutate({ id: branch.id })} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-slate-300 cursor-not-allowed" disabled title="No puedes eliminar la sucursal activa">
                          <Trash2 className="h-3.5 w-3.5" />Eliminar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(branches as any[]).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">No hay sucursales registradas</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── TAB: TRASPASOS ───────────────────────────────────────────────── */}
      {activeTab === "transfers" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <NewTransferModal branches={branches as any[]} onSuccess={() => { refetch(); refetchTransfers(); }} />
          </div>

          {transfers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <ArrowRightLeft className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">Sin traspasos registrados</h3>
              <p className="text-sm text-slate-400">Usa el botón "Nuevo Traspaso" para transferir equipos entre sucursales.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Nº Traspaso</TableHead>
                    <TableHead>Origen → Destino</TableHead>
                    <TableHead>Equipos</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <span className="font-mono font-bold text-blue-700 text-sm">{t.transferNumber}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-700">{t.sourceBranchName}</span>
                          <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700">{t.destinationBranchName}</span>
                        </div>
                        {t.notes && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{t.notes}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Package className="h-3 w-3" />
                          {t.itemsCount} equipo{t.itemsCount !== 1 ? "s" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{t.userName}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(t.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        {t.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                            <CheckCircle2 className="h-3 w-3" />Completado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            <Clock className="h-3 w-3" />{t.status}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                          onClick={() => {
                            setViewTransferId(t.id);
                            setTimeout(() => handlePrintNote(t), 300);
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Nota de Traspaso
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
