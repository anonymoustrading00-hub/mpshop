import { createContext, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { BranchSwitchDialog } from "@/components/BranchSwitchDialog";
import { useAuth } from "@/_core/hooks/useAuth";

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
    const stored = localStorage.getItem("x-branch-id");
    if (stored) {
      setActiveBranchIdState(parseInt(stored, 10));
    }
  }, []);

  const setActiveBranchId = (id: number) => {
    // Si el usuario ya es admin, permitir cambio directo
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

  return (
    <BranchContext.Provider
      value={{ activeBranchId, setActiveBranchId, branches, isLoading }}
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
