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
  const { data: branches = [], isLoading } = trpc.branches.list.useQuery();
  const { user } = useAuth();

  useEffect(() => {
    console.log("[BranchContext] 🔍 User changed:", {
      userId: user?.id,
      username: user?.username,
      assignedBranchIds: user?.assignedBranchIds,
      isArray: Array.isArray(user?.assignedBranchIds),
    });

    const stored = localStorage.getItem("x-branch-id");
    if (stored) {
      const storedId = parseInt(stored, 10);
      console.log("[BranchContext] 📦 Found stored branch:", storedId);
      
      // Validar que el usuario tenga acceso a la sucursal guardada
      if (user && user.id !== 999 && user.id !== 1000) { // No validar para super admin
        const assignedBranches = Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : ["all"];
        console.log("[BranchContext] ✅ Assigned branches:", assignedBranches);
        
        // Si el usuario no tiene acceso a todas las sucursales
        if (!assignedBranches.includes("all")) {
          const allowedIds = assignedBranches
            .map((id: any) => typeof id === "string" ? parseInt(id, 10) : id)
            .filter((id: any) => !isNaN(id));
          
          console.log("[BranchContext] 🔒 User is restricted to:", allowedIds);
          
          // Si la sucursal guardada no está permitida, usar la primera permitida
          if (!allowedIds.includes(storedId)) {
            console.log("[BranchContext] ⚠️ Stored branch NOT allowed. Forcing to:", allowedIds[0]);
            if (allowedIds.length > 0) {
              setActiveBranchIdState(allowedIds[0]);
              localStorage.setItem("x-branch-id", allowedIds[0].toString());
              return;
            }
          } else {
            console.log("[BranchContext] ✅ Stored branch IS allowed");
          }
        } else {
          console.log("[BranchContext] 🌍 User has global access");
        }
      }
      
      setActiveBranchIdState(storedId);
    } else if (user && user.id !== 999 && user.id !== 1000) {
      console.log("[BranchContext] 📦 No stored branch, checking restrictions...");
      // Si no hay sucursal guardada y el usuario tiene restricciones
      const assignedBranches = Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : ["all"];
      if (!assignedBranches.includes("all")) {
        const allowedIds = assignedBranches
          .map((id: any) => typeof id === "string" ? parseInt(id, 10) : id)
          .filter((id: any) => !isNaN(id));
        
        console.log("[BranchContext] 🔒 Forcing user to first allowed branch:", allowedIds[0]);
        if (allowedIds.length > 0) {
          setActiveBranchIdState(allowedIds[0]);
          localStorage.setItem("x-branch-id", allowedIds[0].toString());
        }
      }
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
