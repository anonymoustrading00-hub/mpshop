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

  return {
    req: opts.req,
    res: opts.res,
    user,
    branchId,
  };
}
