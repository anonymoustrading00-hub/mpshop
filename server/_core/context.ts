import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  branchId: number;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let branchId = 1; // Default to main warehouse

  try {
    user = await sdk.authenticateRequest(opts.req);
    console.log("[Context] User authenticated:", user?.id, user?.username);
  } catch (error) {
    // Authentication is optional for public procedures.
    console.log("[Context] Authentication failed:", String(error));
    user = null;
  }

  const branchHeader = opts.req.headers["x-branch-id"];
  if (branchHeader && typeof branchHeader === "string") {
    const parsed = parseInt(branchHeader, 10);
    if (!isNaN(parsed)) {
      branchId = parsed;
    }
  }

  // Parsear assignedBranchIds si viene como string JSON
  if (user && typeof user.assignedBranchIds === "string") {
    try {
      user.assignedBranchIds = JSON.parse(user.assignedBranchIds);
    } catch {
      user.assignedBranchIds = ["all"];
    }
  }

  // Validar que el usuario tenga permiso para acceder a la sucursal solicitada
  if (user && user.id !== 999 && user.id !== 1000) { // Excluir super admin (id 999 y 1000)
    let assignedBranchIds: any[] = Array.isArray(user.assignedBranchIds) ? user.assignedBranchIds : ["all"];

    // Si el usuario NO tiene acceso a todas las sucursales
    if (!assignedBranchIds.includes("all")) {
      // Convertir a números para comparación
      const allowedBranches = assignedBranchIds.map((id: any) => 
        typeof id === "string" ? parseInt(id, 10) : id
      ).filter((id: any) => !isNaN(id));

      // Si la sucursal solicitada no está en la lista de permitidas
      if (!allowedBranches.includes(branchId)) {
        // Forzar al usuario a su primera sucursal asignada
        if (allowedBranches.length > 0) {
          branchId = allowedBranches[0];
          console.log(`[Context] User ${user.username} forced to branch ${branchId} (not authorized for ${branchHeader})`);
        }
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    branchId,
  };
}
