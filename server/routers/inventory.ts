import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { units, unitEvents, branches, users } from "../../drizzle/schema";
import { eq, and, sql, desc, count, like, or } from "drizzle-orm";
import { createProduct, getAllInventory, getAllProducts, getDb, getProductsWithStock, getSmartInventoryAlerts, updateInventory } from "../db";
import { TRPCError } from "@trpc/server";

export const inventoryRouter = router({
  listProducts: protectedProcedure.query(async () => {
    return await getAllProducts();
  }),

  // Lista productos del catálogo con stock agregado por sucursal.
  // Usado por el módulo de Pedidos para poblar el selector de productos.
  getProductsWithStock: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const items = await getProductsWithStock();
      const branchId = input?.branchId ?? ctx.branchId;
      // Si hay sucursal activa, filtrar/etiquetar pero mantenemos todos los productos visibles
      return (items as any[]).map((p: any) => ({ ...p, branchId }));
    }),

  createProduct: protectedProcedure
    .input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      category: z.string().optional(),
      price: z.number(),
      salePrice: z.number().optional(),
      wholesalePrice: z.number().optional(),
      discountPrice: z.number().optional(),
      imageUrl: z.string().optional(),
      status: z.string().optional(),
      unit: z.string().optional(),
      presentationQuantity: z.number().optional(),
      presentationUnit: z.string().optional(),
      presentationVolumeMl: z.number().optional(),
      presentationWeightGr: z.number().optional(),
      productionRole: z.string().optional(),
      storageLocation: z.string().optional(),
      supplierName: z.string().optional(),
      productionNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result: any = await createProduct(input);
      const productId = result?.insertId || result?.[0]?.insertId;
      return { success: true, productId, unitId: productId };
    }),

  listInventory: protectedProcedure.query(async ({ ctx }) => {
    const items = await getAllInventory(ctx.branchId);
    return (items as any[]).map((item: any) => ({
      ...item,
      isLowStock: Number(item.quantity || 0) <= Number(item.minStock || 0),
    }));
  }),

  updateQuantity: protectedProcedure
    .input(z.object({
      productId: z.number(),
      quantity: z.number(),
      minStock: z.number().optional(),
      expiryDate: z.string().optional().nullable(),
      batchNumber: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await updateInventory(
        input.productId,
        input.quantity,
        input.expiryDate,
        input.batchNumber,
        ctx.branchId
      );

      return { success: true };
    }),

  getLowStockProducts: protectedProcedure.query(async ({ ctx }) => {
    const items = await getAllInventory(ctx.branchId);
    return (items as any[]).filter((item: any) => Number(item.quantity || 0) <= Number(item.minStock || 0));
  }),

  getSmartAlerts: protectedProcedure.query(async () => {
    return await getSmartInventoryAlerts();
  }),

  // Obtener resumen de inventario por sucursal y estado
  getSummary: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { totalUnits: 0, byStatus: {}, byType: {} };

      const branchClause = input?.branchId ? eq(units.branchId, input.branchId) : undefined;

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(units)
        .where(branchClause);

      const statusCounts = await db
        .select({
          status: units.status,
          count: sql<number>`count(*)`,
        })
        .from(units)
        .where(branchClause)
        .groupBy(units.status);

      const typeCounts = await db
        .select({
          type: units.type,
          count: sql<number>`count(*)`,
        })
        .from(units)
        .where(branchClause)
        .groupBy(units.type);

      const byStatus: Record<string, number> = {};
      statusCounts.forEach((s: any) => {
        byStatus[s.status] = Number(s.count);
      });

      const byType: Record<string, number> = {};
      typeCounts.forEach((t: any) => {
        byType[t.type] = Number(t.count);
      });

      return {
        totalUnits: Number(totalResult[0]?.count || 0),
        byStatus,
        byType,
      };
    }),

  // Historial de movimientos / eventos por unidad
  getMovements: protectedProcedure
    .input(
      z.object({
        unitId: z.number().optional(),
        eventType: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [];
      if (input?.unitId) conditions.push(eq(unitEvents.unitId, input.unitId));
      if (input?.eventType) conditions.push(eq(unitEvents.eventType, input.eventType));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await db
        .select({
          id: unitEvents.id,
          unitId: unitEvents.unitId,
          unitCode: units.code,
          unitBrand: units.brand,
          unitModel: units.model,
          eventType: unitEvents.eventType,
          fromStatus: unitEvents.fromStatus,
          toStatus: unitEvents.toStatus,
          notes: unitEvents.notes,
          createdAt: unitEvents.createdAt,
          userName: users.name,
        })
        .from(unitEvents)
        .leftJoin(units, eq(unitEvents.unitId, units.id))
        .leftJoin(users, eq(unitEvents.userId, users.id))
        .where(whereClause)
        .orderBy(desc(unitEvents.id))
        .limit(input?.limit || 50)
        .offset(input?.offset || 0);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(unitEvents)
        .where(whereClause);

      return {
        items,
        total: Number(countResult[0]?.count || 0),
      };
    }),
});
