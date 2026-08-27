import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAllPurchases, createPurchase, getPurchaseItems, getPurchaseById, updatePurchase, getAllUnits } from "../db";
import { TRPCError } from "@trpc/server";

export const purchasesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllPurchases(ctx.branchId);
  }),

  /**
   * Lista unificada de compras: combina compras tradicionales (COM-*)
   * con compras de unidades registradas desde RegisterUnit (COMP-UNIT-*).
   * Cada entrada incluye un campo `source` para distinguir el origen.
   */
  listAll: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const branchId = input?.branchId || ctx.branchId;

      const [traditional, units] = await Promise.all([
        getAllPurchases(branchId),
        getAllUnits(branchId),
      ]);

    // Compras tradicionales
    const tradRows = (traditional as any[]).map((p: any) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      supplierName: p.supplierName || "Sin proveedor",
      status: p.status,
      paymentStatus: p.paymentStatus,
      paymentMethod: p.paymentMethod,
      totalAmount: p.totalAmount,
      isCredit: p.isCredit,
      createdAt: p.createdAt,
      orderDate: p.orderDate,
      source: "purchase" as const,      // compra tradicional
      unitCode: null,
      unitBrand: null,
      unitModel: null,
      unitId: null,
    }));

    // Compras de unidades (tienen purchasePrice > 0 y purchaseId o purchaseNumber COMP-UNIT-*)
    const unitRows = (units as any[])
      .filter((u: any) => u.purchasePrice > 0)
      .map((u: any) => ({
        id: u.purchaseId ? `unit-${u.id}` : `unit-${u.id}`,
        purchaseNumber: u.purchaseId
          ? `COMP-UNIT-${String(u.purchaseId).padStart(6, "0")}`
          : `REG-${u.code}`,
        supplierName: "Registro Directo de Unidad",
        status: "received" as const,
        paymentStatus: "paid" as const,
        paymentMethod: "cash",
        totalAmount: u.purchasePrice,
        isCredit: 0,
        createdAt: u.createdAt,
        orderDate: u.purchaseDate || u.createdAt,
        source: "unit_purchase" as const, // compra de unidad
        unitCode: u.code,
        unitBrand: u.brand,
        unitModel: u.model,
        unitId: u.id,
      }));

    // Unir y ordenar por fecha desc, sin duplicar (si la unidad ya tiene purchaseId en tradRows, omitirla)
    const traditionalPurchaseIds = new Set(
      (traditional as any[]).map((p: any) => p.id)
    );

    const filteredUnitRows = unitRows.filter((u) => {
      // Si ya existe una compra tradicional para esta unidad (via purchaseId), no duplicar
      const unit = (units as any[]).find((x: any) => x.id === u.unitId);
      if (unit?.purchaseId && traditionalPurchaseIds.has(unit.purchaseId)) return false;
      return true;
    });

    const all = [...tradRows, ...filteredUnitRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return all;
  }),

  getItems: protectedProcedure
    .input(z.object({ purchaseId: z.number() }))
    .query(async ({ input }) => {
      return await getPurchaseItems(input.purchaseId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getPurchaseById(input.id);
    }),

  create: protectedProcedure
    .input(z.object({
      supplierId: z.number().optional().nullable(),
      purchaseNumber: z.string().min(1),
      orderDate: z.string().optional(),
      totalAmount: z.number(),
      status: z.enum(["pending", "received", "cancelled"]).default("pending"),
      paymentStatus: z.enum(["pending", "paid"]).default("pending"),
      paymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
      isCredit: z.number().default(0),
      dueDate: z.string().optional(),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        price: z.number(),
        expiryDate: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { items, ...purchaseData } = input;
      return await createPurchase({ ...purchaseData, branchId: ctx.branchId }, items, ctx.user!.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      supplierId: z.number().optional().nullable(),
      purchaseNumber: z.string().min(1),
      orderDate: z.string().optional(),
      totalAmount: z.number(),
      status: z.enum(["pending", "received", "cancelled"]).default("pending"),
      paymentStatus: z.enum(["pending", "paid"]).default("pending"),
      paymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
      isCredit: z.number().default(0),
      dueDate: z.string().optional(),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        price: z.number(),
        expiryDate: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { id, items, ...purchaseData } = input;
      return await updatePurchase(id, purchaseData, items, ctx.user!.id);
    }),
});
