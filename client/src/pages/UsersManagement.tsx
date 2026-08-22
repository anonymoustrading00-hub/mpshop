import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import {
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert, Key, Search,
  CheckCircle2, XCircle, Edit3, Trash2, Store, Lock, Eye, EyeOff,
  ShoppingBag, BookOpen, Tag, Package, ShoppingCart, BarChart3,
  LayoutDashboard, TrendingUp, DollarSign, CreditCard, Landmark,
  Receipt, Truck, RefreshCw, Sliders, CheckSquare, Square, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Mapeo de iconos para cada módulo
const MODULE_ICONS: Record<string, React.ElementType> = {
  sales: ShoppingBag,
  catalog: BookOpen,
  units: Tag,
  repairs: Package,
  warranties: Tag,
  returns: Package,
  orders: ShoppingCart,
  "generate-codes": Tag,
  customers: Users,
  suppliers: Users,
  purchases: ShoppingCart,
  "dashboard-kpis": BarChart3,
  reports: BarChart3,
  dashboard: LayoutDashboard,
  analytics: TrendingUp,
  rentabilidad: TrendingUp,
  finance: DollarSign,
  "repartidor-finance": DollarSign,
  "delivery-load": Package,
  "accounts-receivable": CreditCard,
  "accounts-payable": Landmark,
  expenses: Receipt,
  branches: Store,
  users: Users,
  "delivery-persons": Truck,
};

const ROLE_INFO: Record<string, { label: string; color: string; badge: string }> = {
  admin: { label: "Administrador", color: "bg-indigo-50 text-indigo-700 border-indigo-200", badge: "bg-indigo-600 text-white" },
  seller: { label: "Vendedor", color: "bg-emerald-50 text-emerald-700 border-emerald-200", badge: "bg-emerald-600 text-white" },
  technician: { label: "Técnico Taller", color: "bg-amber-50 text-amber-700 border-amber-200", badge: "bg-amber-600 text-white" },
  cashier: { label: "Cajero / Finanzas", color: "bg-blue-50 text-blue-700 border-blue-200", badge: "bg-blue-600 text-white" },
  user: { label: "Repartidor", color: "bg-purple-50 text-purple-700 border-purple-200", badge: "bg-purple-600 text-white" },
};

interface UserFormData {
  id?: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  password?: string;
  role: "admin" | "seller" | "technician" | "cashier" | "user";
  status: "active" | "inactive";
  allowedModules: string[];
  specialPermissions: {
    canViewPurchaseCost: boolean;
    canApplyDiscounts: boolean;
    canViewFinancialReports: boolean;
    canManageInventory: boolean;
    canDeleteRecords: boolean;
  };
  assignedBranchIds: (number | string)[];
  hasGlobalBranchAccess: boolean;
}

const DEFAULT_FORM_DATA: UserFormData = {
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  role: "seller",
  status: "active",
  allowedModules: ["sales", "catalog", "units", "warranties", "returns", "orders", "customers"],
  specialPermissions: {
    canViewPurchaseCost: false,
    canApplyDiscounts: true,
    canViewFinancialReports: false,
    canManageInventory: false,
    canDeleteRecords: false,
  },
  assignedBranchIds: ["all"],
  hasGlobalBranchAccess: true,
};

export default function UsersManagement() {
  const { user: currentUser } = useAuth();
  const { branches } = useBranch();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserFormData | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [showPassword, setShowPassword] = useState(false);

  // Queries y mutations tRPC
  const usersQuery = (trpc.users as any).list.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const roleTemplatesQuery = (trpc.users as any).getRoleTemplates.useQuery();

  const createMutation = (trpc.users as any).create.useMutation({
    onSuccess: () => {
      toast.success("Usuario creado exitosamente");
      setIsCreateOpen(false);
      usersQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear el usuario");
    },
  });

  const updateMutation = (trpc.users as any).update.useMutation({
    onSuccess: () => {
      toast.success("Usuario actualizado correctamente");
      setEditingUser(null);
      usersQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar el usuario");
    },
  });

  const toggleStatusMutation = (trpc.users as any).toggleStatus.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message);
      usersQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al cambiar estado");
    },
  });

  const deleteMutation = (trpc.users as any).delete.useMutation({
    onSuccess: () => {
      toast.success("Usuario eliminado");
      setDeleteTargetId(null);
      usersQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al eliminar usuario");
    },
  });

  const allModules = roleTemplatesQuery.data?.modules || [];
  const roleTemplates = roleTemplatesQuery.data?.templates || {};

  const operativeModules = useMemo(() => {
    return allModules.filter((m: any) => m.category === "operativo");
  }, [allModules]);

  const managementModules = useMemo(() => {
    return allModules.filter((m: any) => m.category === "gestion");
  }, [allModules]);

  // Form State
  const [formData, setFormData] = useState<UserFormData>(DEFAULT_FORM_DATA);

  const handleOpenCreate = () => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      allowedModules: roleTemplates.seller?.allowedModules || ["sales", "catalog", "units", "warranties", "returns", "orders", "customers"],
      specialPermissions: roleTemplates.seller?.specialPermissions || {
        canViewPurchaseCost: false,
        canApplyDiscounts: true,
        canViewFinancialReports: false,
        canManageInventory: false,
        canDeleteRecords: false,
      },
    });
    setActiveTab("general");
    setShowPassword(false);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    const isGlobal = user.assignedBranchIds?.includes("all") || user.assignedBranchIds?.length === 0;
    setFormData({
      id: user.id,
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      phone: user.phone || "",
      password: "", // Opcional al editar
      role: user.role || "seller",
      status: user.status || "active",
      allowedModules: Array.isArray(user.allowedModules) ? user.allowedModules : [],
      specialPermissions: user.specialPermissions || {
        canViewPurchaseCost: false,
        canApplyDiscounts: false,
        canViewFinancialReports: false,
        canManageInventory: false,
        canDeleteRecords: false,
      },
      assignedBranchIds: Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : ["all"],
      hasGlobalBranchAccess: isGlobal,
    });
    setActiveTab("general");
    setShowPassword(false);
    setEditingUser(formData);
  };

  const applyRoleTemplate = (roleKey: string) => {
    const template = roleTemplates[roleKey];
    if (!template) return;

    setFormData(prev => ({
      ...prev,
      role: roleKey as any,
      allowedModules: [...template.allowedModules],
      specialPermissions: { ...template.specialPermissions },
    }));

    toast.info(`Plantilla de ${template.name} aplicada`);
  };

  const handleToggleModule = (moduleKey: string) => {
    setFormData(prev => {
      const exists = prev.allowedModules.includes(moduleKey);
      const updated = exists
        ? prev.allowedModules.filter(k => k !== moduleKey)
        : [...prev.allowedModules, moduleKey];
      return { ...prev, allowedModules: updated };
    });
  };

  const handleToggleAllModulesInCategory = (category: "operativo" | "gestion", enable: boolean) => {
    const modulesToToggle = (category === "operativo" ? operativeModules : managementModules).map((m: any) => m.key);
    setFormData(prev => {
      let current = new Set(prev.allowedModules);
      modulesToToggle.forEach((k: string) => {
        if (enable) current.add(k);
        else current.delete(k);
      });
      return { ...prev, allowedModules: Array.from(current) };
    });
  };

  const handleToggleBranch = (branchId: number) => {
    setFormData(prev => {
      let branches = prev.assignedBranchIds.filter(b => b !== "all") as number[];
      if (branches.includes(branchId)) {
        branches = branches.filter(b => b !== branchId);
      } else {
        branches = [...branches, branchId];
      }
      return {
        ...prev,
        assignedBranchIds: branches.length === 0 ? ["all"] : branches,
        hasGlobalBranchAccess: branches.length === 0,
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre completo es requerido");
      return;
    }
    if (!formData.username.trim()) {
      toast.error("El nombre de usuario es requerido");
      return;
    }

    if (!formData.id && (!formData.password || formData.password.length < 6)) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      username: formData.username.trim().toLowerCase(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      role: formData.role,
      status: formData.status,
      allowedModules: formData.allowedModules,
      specialPermissions: formData.specialPermissions,
      assignedBranchIds: formData.hasGlobalBranchAccess ? ["all"] : formData.assignedBranchIds,
    };

    if (formData.id) {
      updateMutation.mutate({
        id: formData.id,
        ...payload,
        password: formData.password && formData.password.trim().length >= 6 ? formData.password : undefined,
      });
    } else {
      createMutation.mutate({
        ...payload,
        password: formData.password || "123456",
      });
    }
  };

  // Filtrado de usuarios
  const usersList = usersQuery.data || [];
  const filteredUsers = useMemo(() => {
    return usersList.filter((u: any) => {
      const matchSearch =
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [usersList, searchTerm, roleFilter, statusFilter]);

  // Contadores
  const stats = useMemo(() => {
    const total = usersList.length;
    const active = usersList.filter((u: any) => u.status === "active").length;
    const admins = usersList.filter((u: any) => u.role === "admin").length;
    const sellers = usersList.filter((u: any) => u.role === "seller").length;
    const technicians = usersList.filter((u: any) => u.role === "technician").length;
    return { total, active, admins, sellers, technicians };
  }, [usersList]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto mb-20 md:mb-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Gestión de <span className="text-indigo-600">Usuarios & Permisos</span>
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                Asignación granular de módulos, control de acceso por sucursal y permisos de negocio
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => usersQuery.refetch()}
            className="h-10 rounded-xl gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${usersQuery.isFetching ? "animate-spin text-indigo-600" : ""}`} />
            Actualizar
          </Button>

          <Button
            onClick={handleOpenCreate}
            className="h-10 rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm shadow-indigo-200"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Resumen de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Usuarios</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-100 shadow-sm bg-emerald-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Activos</p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{stats.active}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-indigo-100 shadow-sm bg-indigo-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Administradores</p>
              <p className="text-2xl font-black text-indigo-700 mt-0.5">{stats.admins}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-amber-100 shadow-sm bg-amber-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Ventas / Taller</p>
              <p className="text-2xl font-black text-amber-700 mt-0.5">{stats.sellers + stats.technicians}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, usuario o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 rounded-xl border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-10 rounded-xl w-full md:w-44 border-slate-200">
                <SelectValue placeholder="Filtrar por Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Roles</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="seller">Vendedor</SelectItem>
                <SelectItem value="technician">Técnico</SelectItem>
                <SelectItem value="cashier">Cajero / Finanzas</SelectItem>
                <SelectItem value="user">Repartidor</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-xl w-full md:w-36 border-slate-200">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuarios */}
      <div className="space-y-3">
        {usersQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-300 p-12 text-center bg-slate-50/50">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No se encontraron usuarios</h3>
            <p className="text-sm text-slate-500 mt-1">
              {searchTerm || roleFilter !== "all" || statusFilter !== "all"
                ? "Prueba cambiando los filtros de búsqueda"
                : "Comienza creando el primer usuario en el sistema"}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredUsers.map((user: any) => {
              const roleMeta = ROLE_INFO[user.role] || { label: user.role, color: "bg-slate-100 text-slate-700", badge: "bg-slate-700 text-white" };
              const isCurrentUser = currentUser?.id === user.id;
              const moduleCount = user.role === "admin" ? allModules.length : (user.allowedModules?.length || 0);

              return (
                <Card
                  key={user.id}
                  className={`rounded-2xl border transition-all duration-200 hover:shadow-md bg-white ${
                    user.status === "inactive" ? "opacity-60 bg-slate-50/50 border-slate-200" : "border-slate-200/80"
                  }`}
                >
                  <CardContent className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* User Profile Info */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-sm">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            user.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-slate-900 text-base leading-snug truncate">
                            {user.name}
                          </h3>
                          {isCurrentUser && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              Tú (Sesión actual)
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${roleMeta.color}`}>
                            {roleMeta.label}
                          </Badge>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              user.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {user.status === "active" ? "Activo" : "Inactivo"}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                          <span className="font-mono text-slate-600 font-semibold">@{user.username}</span>
                          {user.email && <span>📧 {user.email}</span>}
                          {user.phone && <span>📱 {user.phone}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Permissions & Branches Tags */}
                    <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                      
                      {/* Modulos asignados */}
                      <div className="flex flex-col items-start lg:items-end">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Módulos</span>
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 mt-0.5">
                          {user.role === "admin" ? "Todos (22)" : `${moduleCount} de ${allModules.length}`}
                        </span>
                      </div>

                      {/* Sucursales asignadas */}
                      <div className="flex flex-col items-start lg:items-end">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Sucursal</span>
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 mt-0.5">
                          {user.assignedBranchIds?.includes("all") || user.assignedBranchIds?.length === 0
                            ? "Global (Todas)"
                            : `${user.assignedBranchIds?.length} asignada(s)`}
                        </span>
                      </div>

                      {/* Permisos especiales */}
                      <div className="hidden sm:flex items-center gap-1">
                        {user.specialPermissions?.canViewPurchaseCost && (
                          <span title="Ver Costos de Compra" className="p-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs">
                            💰 Costos
                          </span>
                        )}
                        {user.specialPermissions?.canApplyDiscounts && (
                          <span title="Aplicar Descuentos" className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-200 text-xs">
                            🏷️ Descuentos
                          </span>
                        )}
                        {user.specialPermissions?.canViewFinancialReports && (
                          <span title="Ver Finanzas" className="p-1 rounded-md bg-purple-50 text-purple-600 border border-purple-200 text-xs">
                            📊 Finanzas
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(user)}
                          className="h-9 px-3 rounded-xl hover:bg-slate-100 text-slate-700 font-bold gap-1.5"
                        >
                          <Edit3 className="h-4 w-4 text-indigo-600" />
                          <span className="hidden sm:inline">Editar</span>
                        </Button>

                        {!isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              toggleStatusMutation.mutate({
                                id: user.id,
                                status: user.status === "active" ? "inactive" : "active",
                              });
                            }}
                            className={`h-9 px-2.5 rounded-xl font-bold ${
                              user.status === "active"
                                ? "text-amber-600 hover:bg-amber-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={user.status === "active" ? "Desactivar usuario" : "Activar usuario"}
                          >
                            {user.status === "active" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </Button>
                        )}

                        {!isCurrentUser && user.id !== 999 && user.id !== 1000 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTargetId(user.id)}
                            className="h-9 px-2.5 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Dialog: Crear / Editar Usuario con Pestañas */}
      <Dialog
        open={isCreateOpen || editingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingUser(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              {formData.id ? "Editar Usuario & Permisos" : "Crear Nuevo Usuario"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configura los accesos, módulos y permisos especiales asignados a este usuario
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-4 w-full h-11 rounded-2xl bg-slate-100 p-1">
                <TabsTrigger value="general" className="rounded-xl text-xs font-bold data-[state=active]:bg-white">
                  👤 Datos
                </TabsTrigger>
                <TabsTrigger value="role" className="rounded-xl text-xs font-bold data-[state=active]:bg-white">
                  🛡️ Rol & Plantilla
                </TabsTrigger>
                <TabsTrigger value="modules" className="rounded-xl text-xs font-bold data-[state=active]:bg-white">
                  📦 Módulos ({formData.allowedModules.length})
                </TabsTrigger>
                <TabsTrigger value="permissions" className="rounded-xl text-xs font-bold data-[state=active]:bg-white">
                  ⚙️ Sucursal & Extras
                </TabsTrigger>
              </TabsList>

              {/* ─── TAB 1: DATOS GENERALES ─── */}
              <TabsContent value="general" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Nombre Completo *</Label>
                    <Input
                      placeholder="Ej. Carlos Mendoza"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Nombre de Usuario (Login) *</Label>
                    <Input
                      placeholder="Ej. cmendoza"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      disabled={!!formData.id} // No cambiar username de usuarios existentes
                      required
                      className="rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Correo Electrónico</Label>
                    <Input
                      type="email"
                      placeholder="carlos@empresa.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Teléfono / WhatsApp</Label>
                    <Input
                      placeholder="+591 70000000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-bold text-slate-700">
                      {formData.id ? "Nueva Contraseña (dejar en blanco para mantener la actual)" : "Contraseña de Acceso *"}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={formData.id ? "•••••••• (sin cambios)" : "Mínimo 6 caracteres"}
                        value={formData.password || ""}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={!formData.id}
                        className="rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2 flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <Label className="text-xs font-bold text-slate-800">Estado de la Cuenta</Label>
                      <p className="text-[11px] text-slate-500">Un usuario inactivo no podrá iniciar sesión en el sistema</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${formData.status === "active" ? "text-emerald-600" : "text-slate-400"}`}>
                        {formData.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                      <Switch
                        checked={formData.status === "active"}
                        onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? "active" : "inactive" })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── TAB 2: ROL & PLANTILLAS ─── */}
              <TabsContent value="role" className="space-y-4 pt-3">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Perfil / Rol Principal</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(val) => applyRoleTemplate(val)}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 font-semibold">
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">👑 Administrador (Acceso Total)</SelectItem>
                        <SelectItem value="seller">🛒 Vendedor (Ventas, Catálogo, Clientes)</SelectItem>
                        <SelectItem value="technician">🔧 Técnico de Taller (Reparaciones, Garantías)</SelectItem>
                        <SelectItem value="cashier">💵 Cajero / Finanzas (Caja, Gastos, Cobros)</SelectItem>
                        <SelectItem value="user">🚚 Repartidor (Entregas y Carga de ruta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tarjetas informativas de cada rol */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {Object.entries(roleTemplates).map(([key, tpl]: [string, any]) => {
                      const isSelected = formData.role === key;
                      return (
                        <div
                          key={key}
                          onClick={() => applyRoleTemplate(key)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-500/20"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm text-slate-900">{tpl.name}</span>
                            {isSelected && <Badge className="bg-indigo-600 text-white text-[10px]">Seleccionado</Badge>}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tpl.description}</p>
                          <div className="mt-2 text-[11px] font-semibold text-slate-600">
                            📦 {tpl.allowedModules?.length || 0} módulos incluidos
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* ─── TAB 3: ASIGNACIÓN DE MÓDULOS (22 MÓDULOS) ─── */}
              <TabsContent value="modules" className="space-y-5 pt-3">
                
                {/* Categoría: Operativo */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                        ⚡ Módulos Operativos ({operativeModules.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAllModulesInCategory("operativo", true)}
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                      >
                        Marcar todos
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllModulesInCategory("operativo", false)}
                        className="text-[11px] font-bold text-slate-500 hover:underline"
                      >
                        Desmarcar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {operativeModules.map((mod: any) => {
                      const Icon = MODULE_ICONS[mod.key] || Tag;
                      const isChecked = formData.allowedModules.includes(mod.key);

                      return (
                        <div
                          key={mod.key}
                          onClick={() => handleToggleModule(mod.key)}
                          className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                            isChecked
                              ? "bg-indigo-50/50 border-indigo-200 text-indigo-950 font-semibold"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg mt-0.5 ${isChecked ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">{mod.label}</span>
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-300 shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight truncate mt-0.5">{mod.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Categoría: Gestión & Análisis */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                        📊 Módulos de Gestión & Análisis ({managementModules.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAllModulesInCategory("gestion", true)}
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                      >
                        Marcar todos
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllModulesInCategory("gestion", false)}
                        className="text-[11px] font-bold text-slate-500 hover:underline"
                      >
                        Desmarcar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {managementModules.map((mod: any) => {
                      const Icon = MODULE_ICONS[mod.key] || BarChart3;
                      const isChecked = formData.allowedModules.includes(mod.key);

                      return (
                        <div
                          key={mod.key}
                          onClick={() => handleToggleModule(mod.key)}
                          className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                            isChecked
                              ? "bg-indigo-50/50 border-indigo-200 text-indigo-950 font-semibold"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg mt-0.5 ${isChecked ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">{mod.label}</span>
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-300 shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight truncate mt-0.5">{mod.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </TabsContent>

              {/* ─── TAB 4: SUCURSALES & PERMISOS ESPECIALES ─── */}
              <TabsContent value="permissions" className="space-y-5 pt-3">
                
                {/* Asignación de Sucursales */}
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Store className="h-4 w-4 text-indigo-600" />
                        Acceso a Sucursales
                      </h4>
                      <p className="text-[11px] text-slate-500">Determina en qué sucursales puede operar o ver inventario este usuario</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold text-slate-700">Acceso Global</Label>
                      <Switch
                        checked={formData.hasGlobalBranchAccess}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            hasGlobalBranchAccess: checked,
                            assignedBranchIds: checked ? ["all"] : (branches[0] ? [branches[0].id] : []),
                          });
                        }}
                      />
                    </div>
                  </div>

                  {!formData.hasGlobalBranchAccess && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      {branches.map(branch => {
                        const isChecked = formData.assignedBranchIds.includes(branch.id);
                        return (
                          <div
                            key={branch.id}
                            onClick={() => handleToggleBranch(branch.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-white border-indigo-300 text-indigo-900 font-bold shadow-sm"
                                : "bg-slate-100/60 border-slate-200 text-slate-500 hover:bg-white"
                            }`}
                          >
                            <span className="text-xs">{branch.name}</span>
                            {isChecked ? <CheckCircle2 className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-slate-300" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Permisos Especiales de Negocio */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-indigo-600" />
                    Permisos Especiales de Negocio
                  </h4>

                  <div className="space-y-2.5">
                    {/* Permiso: Ver Costo de Compra */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
                      <div>
                        <p className="text-xs font-bold text-slate-900">💰 Ver Precios de Costo / Compra</p>
                        <p className="text-[11px] text-slate-500">Permite ver márgenes y costos de adquisición en el catálogo y ventas</p>
                      </div>
                      <Switch
                        checked={formData.specialPermissions.canViewPurchaseCost}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            specialPermissions: { ...formData.specialPermissions, canViewPurchaseCost: checked },
                          })
                        }
                      />
                    </div>

                    {/* Permiso: Aplicar Descuentos */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
                      <div>
                        <p className="text-xs font-bold text-slate-900">🏷️ Aplicar Descuentos y Precios Mayoristas</p>
                        <p className="text-[11px] text-slate-500">Permite alternar entre los 3 tipos de precios en el punto de venta</p>
                      </div>
                      <Switch
                        checked={formData.specialPermissions.canApplyDiscounts}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            specialPermissions: { ...formData.specialPermissions, canApplyDiscounts: checked },
                          })
                        }
                      />
                    </div>

                    {/* Permiso: Ver Finanzas */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
                      <div>
                        <p className="text-xs font-bold text-slate-900">📊 Ver Reportes Financieros & P&L</p>
                        <p className="text-[11px] text-slate-500">Permite ver montos consolidados de ingresos, gastos y rentabilidad</p>
                      </div>
                      <Switch
                        checked={formData.specialPermissions.canViewFinancialReports}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            specialPermissions: { ...formData.specialPermissions, canViewFinancialReports: checked },
                          })
                        }
                      />
                    </div>

                    {/* Permiso: Gestionar Inventario */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
                      <div>
                        <p className="text-xs font-bold text-slate-900">📦 Modificar Inventario & Series</p>
                        <p className="text-[11px] text-slate-500">Permite registrar equipos, cambiar series y alterar estados</p>
                      </div>
                      <Switch
                        checked={formData.specialPermissions.canManageInventory}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            specialPermissions: { ...formData.specialPermissions, canManageInventory: checked },
                          })
                        }
                      />
                    </div>

                    {/* Permiso: Anular / Eliminar */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
                      <div>
                        <p className="text-xs font-bold text-slate-900">🗑️ Anular / Eliminar Registros</p>
                        <p className="text-[11px] text-slate-500">Permite cancelar pedidos o anular ventas registradas</p>
                      </div>
                      <Switch
                        checked={formData.specialPermissions.canDeleteRecords}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            specialPermissions: { ...formData.specialPermissions, canDeleteRecords: checked },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingUser(null);
                }}
                className="rounded-xl"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shadow-sm"
              >
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : (formData.id ? "Guardar Cambios" : "Crear Usuario")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Eliminar Usuario */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="rounded-3xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              ¿Eliminar este usuario?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              Esta acción no se puede deshacer. El usuario ya no podrá acceder al sistema y sus datos de sesión serán revocados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTargetId) deleteMutation.mutate({ id: deleteTargetId });
              }}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              Sí, Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
