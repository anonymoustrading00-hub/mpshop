import { createContext, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type BranchContextType = {
  activeBranchId: number;
  setActiveBranchId: (id: number) => void;
  branches: any[];
  isLoading: boolean;
};

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [activeBranchId, setActiveBranchIdState] = useState<number>(1);
  const { data: branches = [], isLoading } = trpc.branches.list.useQuery();

  useEffect(() => {
    const stored = localStorage.getItem("x-branch-id");
    if (stored) {
      setActiveBranchIdState(parseInt(stored, 10));
    }
  }, []);

  const setActiveBranchId = (id: number) => {
    setActiveBranchIdState(id);
    localStorage.setItem("x-branch-id", id.toString());
    // Recargar la ventana para refrescar todos los queries con el nuevo header
    window.location.reload();
  };

  return (
    <BranchContext.Provider
      value={{ activeBranchId, setActiveBranchId, branches, isLoading }}
    >
      {children}
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
