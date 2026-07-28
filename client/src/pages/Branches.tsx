import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Store, Plus, MapPin, Edit, Power, PowerOff, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

export default function Branches() {
  const { data: branches = [], isLoading, refetch } = trpc.branches.list.useQuery();
  const utils = trpc.useUtils();

  const createBranch = trpc.branches.create.useMutation({
    onSuccess: () => {
      toast.success("Sucursal creada exitosamente");
      setOpen(false);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Error al crear sucursal");
    }
  });

  const updateBranch = trpc.branches.update.useMutation({
    onSuccess: () => {
      toast.success("Sucursal actualizada exitosamente");
      setEditOpen(false);
      refetch();
      utils.branches.list.invalidate(); // Re-fetch globally
    },
    onError: (err) => {
      toast.error(err.message || "Error al actualizar sucursal");
    }
  });

  const deleteBranch = trpc.branches.delete.useMutation({
    onSuccess: () => {
      toast.success("Sucursal eliminada exitosamente");
      refetch();
      utils.branches.list.invalidate(); // Re-fetch globally
    },
    onError: (err) => {
      toast.error(err.message || "Error al eliminar sucursal");
    }
  });

  const handleDelete = (id: number) => {
    deleteBranch.mutate({ id });
  };

  const { activeBranchId } = useBranch();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    isWarehouse: false,
    isActive: true,
  });

  const openEditModal = (branch: any) => {
    setEditingId(branch.id);
    setFormData({
      name: branch.name || "",
      address: branch.address || "",
      phone: branch.phone || "",
      isWarehouse: branch.isMainWarehouse === 1,
      isActive: branch.status === "active",
    });
    setEditOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: "", address: "", phone: "", isWarehouse: false, isActive: true });
    setEditingId(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("El nombre es requerido");
      return;
    }
    createBranch.mutate({
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      isMainWarehouse: formData.isWarehouse ? 1 : 0,
      status: formData.isActive ? "active" : "inactive",
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (!formData.name) {
      toast.error("El nombre es requerido");
      return;
    }
    updateBranch.mutate({
      id: editingId,
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      isMainWarehouse: formData.isWarehouse ? 1 : 0,
      status: formData.isActive ? "active" : "inactive",
    });
  };

  const toggleStatus = (id: number, currentStatus: string) => {
    setEditingId(id);
    updateBranch.mutate({
      id,
      status: currentStatus === "active" ? "inactive" : "active",
    });
  };

  if (isLoading) {
    return <div className="p-6">Cargando sucursales...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            Gestión de <span className="text-blue-600">Sucursales</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Administra los puntos de venta y bodegas de la empresa.
          </p>
        </div>

        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (val) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Sucursal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Sucursal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Sucursal</Label>
                <Input
                  id="name"
                  placeholder="Ej: Sucursal Norte"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección (Opcional)</Label>
                <Input
                  id="address"
                  placeholder="Dirección física"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono (Opcional)</Label>
                <Input
                  id="phone"
                  placeholder="Número de contacto"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="isWarehouse"
                  checked={formData.isWarehouse}
                  onCheckedChange={(checked) => setFormData({ ...formData, isWarehouse: checked === true })}
                />
                <Label htmlFor="isWarehouse" className="cursor-pointer">
                  Es una bodega principal (almacén central)
                </Label>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createBranch.isPending}>
                  {createBranch.isPending ? "Guardando..." : "Guardar Sucursal"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Edición */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Sucursal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre de la Sucursal</Label>
                <Input
                  id="edit-name"
                  placeholder="Ej: Sucursal Norte"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Dirección (Opcional)</Label>
                <Input
                  id="edit-address"
                  placeholder="Dirección física"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Teléfono (Opcional)</Label>
                <Input
                  id="edit-phone"
                  placeholder="Número de contacto"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="edit-isWarehouse"
                  checked={formData.isWarehouse}
                  onCheckedChange={(checked) => setFormData({ ...formData, isWarehouse: checked === true })}
                />
                <Label htmlFor="edit-isWarehouse" className="cursor-pointer">
                  Es una bodega principal (almacén central)
                </Label>
              </div>

              <div className="flex justify-end pt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateBranch.isPending}>
                  {updateBranch.isPending ? "Guardando..." : "Actualizar Sucursal"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
            {branches.map((branch) => (
              <TableRow key={branch.id} className={activeBranchId === branch.id ? "bg-blue-50/50" : ""}>
                <TableCell className="font-medium text-slate-500">#{branch.id}</TableCell>
                <TableCell>
                  <div className="font-semibold text-slate-900">
                    {branch.name}
                    {activeBranchId === branch.id && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        Actual
                      </span>
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
                    <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                      Bodega Principal
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      Punto de Venta
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {branch.status === "active" ? (
                    <span className="text-green-600 font-medium text-sm">Activo</span>
                  ) : (
                    <span className="text-slate-400 font-medium text-sm">Inactivo</span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => openEditModal(branch)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button 
                    variant={branch.status === "active" ? "destructive" : "default"} 
                    size="sm"
                    className="h-8 gap-1 w-28"
                    onClick={() => toggleStatus(branch.id, branch.status)}
                    disabled={updateBranch.isPending && editingId === branch.id}
                  >
                    {branch.status === "active" ? (
                      <>
                        <PowerOff className="h-3.5 w-3.5" />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5" />
                        Activar
                      </>
                    )}
                  </Button>
                  
                  {activeBranchId !== branch.id ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro de eliminar esta sucursal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará permanentemente la sucursal "{branch.name}".
                            No podrás recuperarla y podría afectar el historial si hay órdenes asociadas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(branch.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 gap-1 text-slate-300 cursor-not-allowed"
                      disabled
                      title="No puedes eliminar la sucursal activa actual"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            
            {branches.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                  No hay sucursales registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
