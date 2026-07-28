import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, EyeOff, Package, Trash, WalletCards, Printer, User } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

function BoxStatusIndicatorSmall({ personId, openings }: { personId: number, openings: any[] }) {
  const activeOpening = openings?.find(o => o.responsibleUserId === personId && o.status === "open");

  if (activeOpening) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Abierta</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300"></span>
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Cerrada</span>
      </div>
    );
  }
}

export default function DeliveryPersons() {
  const { data: deliveryPersons, refetch } = trpc.users.listDeliveryPersons.useQuery();
  const { data: cashOpenings } = trpc.finance.getCashOpenings.useQuery();
  
  const activeOpenings = (cashOpenings as any[]) || [];
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "user",
  });

  // Estado para gestión de carga extra
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [newLoadData, setNewLoadData] = useState({
    productId: "",
    quantity: 1,
    type: "sale" as "sale" | "sample",
    notes: "",
  });

  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);

  const { data: products } = trpc.inventory.getProductsWithStock.useQuery();
  const { data: currentExtraLoad, refetch: refetchExtraLoad } = trpc.orders.getExtraLoad.useQuery(
    { deliveryPersonId: selectedPerson?.id, date: selectedDate },
    { enabled: !!selectedPerson }
  );

  const { data: deliverySheet, isLoading: isLoadingSheet } = trpc.orders.getDeliverySheet.useQuery(
    { deliveryPersonId: selectedPerson?.id, date: selectedDate },
    { enabled: sheetDialogOpen && !!selectedPerson }
  );

  const assignLoadMutation = trpc.orders.assignExtraLoad.useMutation({
    onSuccess: () => {
      toast.success("Carga asignada correctamente");
      setNewLoadData({ productId: "", quantity: 1, type: "sale", notes: "" });
      refetchExtraLoad();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateLoadStatusMutation = trpc.orders.updateExtraLoadStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      refetchExtraLoad();
    },
    onError: (err) => toast.error(err.message),
  });

  const openCashMutation = trpc.finance.openCashRegister.useMutation({
    onSuccess: () => {
      toast.success("Caja aperturada correctamente con Bs. 0.00");
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.users.createDeliveryPerson.useMutation({
    onSuccess: () => {
      toast.success("Repartidor creado exitosamente");
      setFormData({ username: "", password: "", name: "", email: "", role: "user" });
      setIsOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear repartidor");
    },
  });

  const updateMutation = trpc.users.updateDeliveryPerson.useMutation({
    onSuccess: () => {
      toast.success("Repartidor actualizado exitosamente");
      setFormData({ username: "", password: "", name: "", email: "", role: "user" });
      setEditingId(null);
      setIsOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar repartidor");
    },
  });

  const deleteMutation = trpc.users.deleteDeliveryPerson.useMutation({
    onSuccess: () => {
      toast.success("Repartidor eliminado exitosamente");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar repartidor");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: formData.name,
        email: formData.email || undefined,
        password: formData.password || undefined,
      });
    } else {
      if (!formData.username.trim()) {
        toast.error("El usuario es requerido");
        return;
      }
      if (!formData.password.trim()) {
        toast.error("La contraseña es requerida");
        return;
      }

      createMutation.mutate({
        username: formData.username,
        password: formData.password,
        name: formData.name,
        email: formData.email || undefined,
      });
    }
  };

  const handleEdit = (person: any) => {
    setEditingId(person.id);
    setFormData({
      username: person.username || "",
      password: "",
      name: person.name || "",
      email: person.email || "",
      role: person.role || "user",
    });
    setIsOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este repartidor?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({ username: "", password: "", name: "", email: "", role: "user" });
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestión de <span className="text-violet-600">Repartidores</span></h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Repartidor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Repartidor" : "Crear Nuevo Repartidor"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Nombre de usuario"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    disabled={editingId !== null}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Nombre del repartidor"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              {editingId ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva Contraseña (opcional)</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Dejar en blanco para no cambiar"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Contraseña"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Rol de Usuario</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Repartidor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {editingId ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!deliveryPersons || deliveryPersons.length === 0 ? (
          <Card className="col-span-full border-dashed border-2 bg-slate-50/50">
            <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
              <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Plus className="h-8 w-8 text-slate-300" />
              </div>
              <p className="font-medium">No hay repartidores registrados</p>
              <p className="text-xs">Comienza agregando uno nuevo arriba.</p>
            </CardContent>
          </Card>
        ) : (
          deliveryPersons.map((person) => (
            <Card key={person.id} className="group overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-[2rem] bg-white/80 backdrop-blur-sm">
              <div className={`h-2 w-full ${person.role === 'admin' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner ${person.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <User className="h-7 w-7" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-black tracking-tight text-slate-800">
                        {person.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md">
                          {person.role === "admin" ? "Administrador" : "Repartidor"}
                        </Badge>
                        <span className="text-xs text-slate-400 font-medium italic">@{person.username}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Caja</p>
                    <BoxStatusIndicatorSmall personId={person.id} openings={activeOpenings} />
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Acceso</p>
                    <p className="text-xs font-bold text-slate-600 truncate">
                      {person.lastSignedIn ? new Date(person.lastSignedIn).toLocaleDateString('es-ES') : 'Nunca'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-2 rounded-xl border-emerald-100 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 font-bold transition-all"
                    onClick={() => {
                      setSelectedPerson(person);
                      setSheetDialogOpen(true);
                    }}
                  >
                    <Package className="h-4 w-4" />
                    Carga
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-2 rounded-xl border-slate-100 text-slate-600 hover:bg-slate-50 font-bold transition-all"
                    onClick={() => {
                      setSelectedPerson(person);
                      setLoadDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Extra
                  </Button>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1 gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200 font-bold transition-all"
                    onClick={() => {
                      const today = new Date().toISOString().split("T")[0];
                      openCashMutation.mutate({
                        openingAmount: 0,
                        paymentMethod: "cash",
                        openingDate: today,
                        responsibleUserId: person.id,
                        notes: "Apertura rápida desde lista de repartidores",
                      });
                    }}
                    disabled={openCashMutation.isPending}
                  >
                    <WalletCards className="h-4 w-4 text-blue-400" />
                    Abrir Caja
                  </Button>
                  
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all"
                      onClick={() => handleEdit(person)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"
                      onClick={() => handleDelete(person.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Diálogo de Gestión de Carga Extra */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gestión de Carga: {selectedPerson?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>Fecha de Carga</Label>
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              </div>
            </div>

            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Asignar Nuevo Item Extra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Producto</Label>
                    <Select 
                      value={newLoadData.productId} 
                      onValueChange={(val) => setNewLoadData({...newLoadData, productId: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.name} (Stock: {p.stock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input 
                      type="number" 
                      value={newLoadData.quantity} 
                      onChange={(e) => setNewLoadData({...newLoadData, quantity: parseInt(e.target.value) || 1})} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Propósito</Label>
                    <Select 
                      value={newLoadData.type} 
                      onValueChange={(val: any) => setNewLoadData({...newLoadData, type: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Venta Directa (Ruta)</SelectItem>
                        <SelectItem value="sample">Degustación / Muestra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Input 
                      placeholder="Ej: Para evento en Zona Sur" 
                      value={newLoadData.notes}
                      onChange={(e) => setNewLoadData({...newLoadData, notes: e.target.value})}
                    />
                  </div>
                </div>
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700" 
                  disabled={!newLoadData.productId || assignLoadMutation.isPending}
                  onClick={() => {
                    assignLoadMutation.mutate({
                      deliveryPersonId: selectedPerson.id,
                      productId: parseInt(newLoadData.productId),
                      quantity: newLoadData.quantity,
                      type: newLoadData.type,
                      date: selectedDate,
                      notes: newLoadData.notes,
                    });
                  }}
                >
                  Confirmar Asignación
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-bold text-sm">Carga Extra Asignada ({selectedDate})</h3>
              {!currentExtraLoad || currentExtraLoad.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No hay carga extra para esta fecha</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {currentExtraLoad.map((item: any) => (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.type === 'sale' ? 'Venta Libre' : 'Degustación'} • Cant: {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          item.status === 'loaded' ? 'outline' : 
                          item.status === 'returned' ? 'secondary' : 'default'
                        }>
                          {item.status === 'loaded' ? 'En Camión' : 
                           item.status === 'sold' ? 'Vendido' : 
                           item.status === 'used' ? 'Entregado' : 'Devuelto'}
                        </Badge>
                        {item.status === 'loaded' && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-red-500"
                            onClick={() => updateLoadStatusMutation.mutate({ id: item.id, status: 'returned' })}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de Hoja de Reparto / Carga Completa */}
      <Dialog open={sheetDialogOpen} onOpenChange={setSheetDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                Carga de Reparto: {selectedPerson?.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Consolidado de pedidos y carga extra asignada.</p>
            </div>
            <div className="flex items-center gap-2">
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                className="w-36 h-9"
              />
              <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </DialogHeader>

          {isLoadingSheet ? (
            <div className="py-12 text-center text-muted-foreground">Cargando hoja de reparto...</div>
          ) : !deliverySheet || deliverySheet.entries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground italic">
              No hay pedidos ni carga extra para esta fecha.
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Resumen Consolidado de Productos */}
              <div>
                <h3 className="font-bold text-sm mb-3 px-1 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Productos a Cargar (Resumen)
                </h3>
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Cant. Pedidos</TableHead>
                        <TableHead className="text-center">Cant. Extra</TableHead>
                        <TableHead className="text-right">Total a Llevar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const productMap = new Map<number, { name: string, orderQty: number, extraQty: number }>();
                        
                        // Sumar productos de pedidos
                        deliverySheet.entries.forEach((entry: any) => {
                          entry.items.forEach((item: any) => {
                            const prev = productMap.get(item.productId) || { name: item.productName, orderQty: 0, extraQty: 0 };
                            prev.orderQty += item.quantity;
                            productMap.set(item.productId, prev);
                          });
                        });
                        
                        // Sumar productos de carga extra
                        currentExtraLoad?.forEach((item: any) => {
                          const prev = productMap.get(item.productId) || { name: item.productName, orderQty: 0, extraQty: 0 };
                          prev.extraQty += item.quantity;
                          productMap.set(item.productId, prev);
                        });

                        return Array.from(productMap.entries()).map(([id, data]) => (
                          <TableRow key={id}>
                            <TableCell className="font-medium">{data.name}</TableCell>
                            <TableCell className="text-center">{data.orderQty}</TableCell>
                            <TableCell className="text-center">{data.extraQty}</TableCell>
                            <TableCell className="text-right font-black text-emerald-700 text-lg">
                              {data.orderQty + data.extraQty}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Detalle de Pedidos */}
              <div>
                <h3 className="font-bold text-sm mb-3 px-1 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Detalle de Entregas ({deliverySheet.entries.length})
                </h3>
                <div className="space-y-3">
                  {deliverySheet.entries.map((entry: any) => (
                    <div key={entry.order.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-slate-900">Pedido #{entry.order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{entry.customer?.name} • {entry.order.zone}</p>
                        </div>
                        <Badge variant="outline" className="bg-white">{entry.order.status}</Badge>
                      </div>
                      <div className="text-xs text-slate-600">
                        {entry.items.map((item: any) => (
                          <span key={item.id} className="mr-3 bg-white px-2 py-1 rounded border border-slate-100 inline-block mb-1">
                            {item.productName} x{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carga Extra */}
              {currentExtraLoad && currentExtraLoad.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm mb-3 px-1 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    Carga Extra / Muestras
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentExtraLoad.map((item: any) => (
                      <div key={item.id} className="p-3 rounded-xl border border-amber-100 bg-amber-50/30 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-xs">{item.productName}</p>
                          <p className="text-[10px] text-amber-700 uppercase font-bold">
                            {item.type === 'sale' ? 'Venta' : 'Muestra'} • Cant: {item.quantity}
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
