import { createContext, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { BranchSwitchDialog } from "@/components/BranchSwitchDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type BranchContextType = {
  activeBranchId: number;
  setActiveBranchId: (id: number) => void;
  branches: any[];
  isLoading: boolean;
};

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [activeBranchId, setActiveBranchIdState] = useState<number>(1);
  const [pendingBranchId, setPendingBranchId] = useState<number | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { user } = useAuth();
  
  // Solo cargar sucursales cuando el usuario esté autenticado
  const { data: branches = [], isLoading } = trpc.branches.list.useQuery(undefined, {
    enabled: !!user, // Solo ejecutar query si hay usuario
  });

  // Efecto para inicializar la sucursal activa cuando el usuario carga
  useEffect(() => {
    if (!user) return;

    console.log("[BranchContext] 🔍 User changed:", {
      userId: user?.id,
      username: user?.username,
      assignedBranchIds: user?.assignedBranchIds,
      isArray: Array.isArray(user?.assignedBranchIds),
    });

    const stored = localStorage.getItem("x-branch-id");
    const storedId = stored ? parseInt(stored, 10) : null;
    console.log("[BranchContext] 📦 Stored branch ID:", storedId);
    
    // Si el usuario es super admin (999 o 1000), permitir cualquier sucursal
    if (user.id === 999 || user.id === 1000) {
      console.log("[BranchContext] 👑 Super admin detected, using stored or default branch");
      if (storedId) {
        setActiveBranchIdState(storedId);
      }
      return;
    }

    // Obtener sucursales asignadas al usuario
    const assignedBranches = Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : ["all"];
    console.log("[BranchContext] ✅ Assigned branches:", assignedBranches);
    
    // Si el usuario tiene acceso global, permitir cualquier sucursal
    if (assignedBranches.includes("all")) {
      console.log("[BranchContext] 🌍 User has global access");
      if (storedId) {
        setActiveBranchIdState(storedId);
      }
      return;
    }

    // Usuario con restricción de sucursales
    const allowedIds = assignedBranches
      .map((id: any) => typeof id === "string" ? parseInt(id, 10) : id)
      .filter((id: any) => !isNaN(id));
    
    console.log("[BranchContext] 🔒 User is restricted to branches:", allowedIds);

    if (allowedIds.length === 0) {
      console.warn("[BranchContext] ⚠️ User has no allowed branches!");
      return;
    }

    // Si hay una sucursal guardada, verificar si está permitida
    if (storedId && allowedIds.includes(storedId)) {
      console.log("[BranchContext] ✅ Stored branch IS allowed, using it:", storedId);
      setActiveBranchIdState(storedId);
      return;
    }

    // Si no hay sucursal guardada o no está permitida, usar la primera permitida
    const defaultBranchId = allowedIds[0];
    console.log("[BranchContext] 🎯 Setting default branch:", defaultBranchId);
    setActiveBranchIdState(defaultBranchId);
    localStorage.setItem("x-branch-id", defaultBranchId.toString());
    
    // Si el ID almacenado cambió, recargar la página para aplicar el nuevo contexto
    if (storedId !== defaultBranchId) {
      console.log("[BranchContext] 🔄 Branch changed, reloading page...");
      setTimeout(() => window.location.reload(), 100);
    }
  }, [user]);

  const setActiveBranchId = (id: number) => {
    // Validar que el usuario tenga permiso para acceder a esta sucursal
    if (user && user.id !== 999 && user.id !== 1000) { // No validar para super admin
      const assignedBranches = Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : ["all"];
      
      // Si el usuario no tiene acceso a todas las sucursales
      if (!assignedBranches.includes("all")) {
        const allowedIds = assignedBranches
          .map((branchId: any) => typeof branchId === "string" ? parseInt(branchId, 10) : branchId)
          .filter((branchId: any) => !isNaN(branchId));
        
        // Si intenta acceder a una sucursal no permitida
        if (!allowedIds.includes(id)) {
          // Si el usuario ya es admin de su sucursal, no pedir autorización adicional
          // Solo mostrar error
          toast.error("No tienes permiso para acceder a esta sucursal");
          return;
        }
      }
    }

    // Si el usuario ya es admin (de cualquier tipo), permitir cambio directo
    if (user?.role === "admin") {
      performBranchSwitch(id);
      return;
    }

    // Si no es admin, solicitar autorización
    setPendingBranchId(id);
    setShowAuthDialog(true);
  };

  const performBranchSwitch = (id: number) => {
    setActiveBranchIdState(id);
    localStorage.setItem("x-branch-id", id.toString());
    // Recargar la ventana para refrescar todos los queries con el nuevo header
    window.location.reload();
  };

  const handleAuthConfirm = () => {
    if (pendingBranchId !== null) {
      performBranchSwitch(pendingBranchId);
      setPendingBranchId(null);
    }
  };

  const targetBranch = branches.find((b: any) => b.id === pendingBranchId) || null;

  // Filtrar sucursales visibles según permisos del usuario
  const visibleBranches = user && user.id !== 999 && user.id !== 1000 
    ? branches.filter((branch: any) => {
        const assignedBranches = Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : ["all"];
        if (assignedBranches.includes("all")) return true;
        
        const allowedIds = assignedBranches
          .map((id: any) => typeof id === "string" ? parseInt(id, 10) : id)
          .filter((id: any) => !isNaN(id));
        
        return allowedIds.includes(branch.id);
      })
    : branches;

  console.log("[BranchContext] 📋 All branches:", branches.map((b: any) => ({ id: b.id, name: b.name })));
  console.log("[BranchContext] 👁️ Visible branches:", visibleBranches.map((b: any) => ({ id: b.id, name: b.name })));
  console.log("[BranchContext] 🎯 Active branch ID:", activeBranchId);

  return (
    <BranchContext.Provider
      value={{ activeBranchId, setActiveBranchId, branches: visibleBranches, isLoading }}
    >
      {children}
      <BranchSwitchDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        targetBranch={targetBranch}
        onConfirm={handleAuthConfirm}
      />
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
