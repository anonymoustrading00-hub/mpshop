import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sales, saleItems, units, operationalExpenses, financialTransactions, branches } from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

/**
 * 🔴 CRÍTICO #5: Router de Rentabilidad Completa
 * 
 * Calcula márgenes:
 * - Bruto: Revenue - COGS
 * - Operativo: Margen Bruto - Gastos Operacionales
 * - Neto: Margen Operativo - Otros Gastos
 * 
 * Con desglose por:
 * - Período (rango de fechas)
 * - Producto/Categoría/Marca
 * - Sucursal
 */

export const profitabilityRouter = router({
  /**
   * Obtener rentabilidad completa de un período
   */
  getCompleteProfitability: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Base de datos no disponible",
        });
      }

      const targetBranchId = input.branchId || 1;

      // 1. Ingresos totales (ventas completadas)
      const revenueResult = await db
        .select({
          revenue: sql<number>`COALESCE(SUM(${sales.total}), 0)`,
          salesCount: sql<number>`COUNT(${sales.id})`,
        })
        .from(sales)
        .where(
          and(
            sql`DATE(${sales.createdAt}) >= ${input.startDate}`,
            sql`DATE(${sales.createdAt}) <= ${input.endDate}`,
            eq(sales.status, "completed"),
            eq(sales.branchId, targetBranchId)
          )
        );

      const revenue = revenueResult[0]?.revenue || 0;
      const salesCount = revenueResult[0]?.salesCount || 0;

      // 2. COGS (Cost of Goods Sold) - categoría "cogs"
      const cogsResult = await db
        .select({
          cogs: sql<number>`COALESCE(SUM(${operationalExpenses.amount}), 0)`,
        })
        .from(operationalExpenses)
        .where(
          and(
            sql`DATE(${operationalExpenses.expenseDate}) >= ${input.startDate}`,
            sql`DATE(${operationalExpenses.expenseDate}) <= ${input.endDate}`,
            eq(operationalExpenses.category, "cogs"),
            eq(operationalExpenses.branchId, targetBranchId)
          )
        );

      const cogs = cogsResult[0]?.cogs || 0;

      // 3. Margen Bruto
      const grossProfit = revenue - cogs;
      const grossMarginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      // 4. Gastos Operacionales (excluyendo COGS)
      const operationalExpensesResult = await db
        .select({
          total: sql<number>`COALESCE(SUM(${operationalExpenses.amount}), 0)`,
          byCategory: sql<string>`JSON_OBJECTAGG(
            ${operationalExpenses.category}, 
            COALESCE(SUM(${operationalExpenses.amount}), 0)
          )`,
        })
        .from(operationalExpenses)
        .where(
          and(
            sql`DATE(${operationalExpenses.expenseDate}) >= ${input.startDate}`,
            sql`DATE(${operationalExpenses.expenseDate}) <= ${input.endDate}`,
            sql`${operationalExpenses.category} != 'cogs'`,
            eq(operationalExpenses.branchId, targetBranchId)
          )
        );

      const operationalExpensesTotal = operationalExpensesResult[0]?.total || 0;
      const expensesByCategory = operationalExpensesResult[0]?.byCategory 
        ? JSON.parse(operationalExpensesResult[0].byCategory) 
        : {};

      // 5. Margen Operativo
      const operatingProfit = grossProfit - operationalExpensesTotal;
      const operatingMarginPercent = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;

      // 6. Otros gastos (intereses, impuestos si se registraran)
      // Por ahora asumimos que están incluidos en operationalExpenses
      const netProfit = operatingProfit;
      const netMarginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return {
        period: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        branchId: targetBranchId,
        summary: {
          revenue,
          salesCount,
          cogs,
          grossProfit,
          grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
          operationalExpenses: operationalExpensesTotal,
          operatingProfit,
          operatingMarginPercent: Math.round(operatingMarginPercent * 100) / 100,
          netProfit,
          netMarginPercent: Math.round(netMarginPercent * 100) / 100,
        },
        breakdown: {
          expensesByCategory,
        },
      };
    }),

  /**
   * Rentabilidad por producto (Top 20 más vendidos)
   */
  getProductProfitability: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.number().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Base de datos no disponible",
        });
      }

      const targetBranchId = input.branchId || 1;

      // Obtener ventas por producto con COGS
      const results = await db
        .select({
          unitId: saleItems.unitId,
          brand: units.brand,
          model: units.model,
          type: units.type,
          salesCount: sql<number>`COUNT(DISTINCT ${sales.id})`,
          unitsSold: sql<number>`SUM(${saleItems.quantity})`,
          revenue: sql<number>`SUM(${saleItems.subtotal})`,
          avgPurchasePrice: sql<number>`AVG(${units.purchasePrice})`,
          totalCost: sql<number>`SUM(${units.purchasePrice} * ${saleItems.quantity})`,
        })
        .from(saleItems)
        .leftJoin(sales, eq(saleItems.saleId, sales.id))
        .leftJoin(units, eq(saleItems.unitId, units.id))
        .where(
          and(
            sql`DATE(${sales.createdAt}) >= ${input.startDate}`,
            sql`DATE(${sales.createdAt}) <= ${input.endDate}`,
            eq(sales.status, "completed"),
            eq(sales.branchId, targetBranchId)
          )
        )
        .groupBy(units.brand, units.model, units.type)
        .orderBy(desc(sql`SUM(${saleItems.subtotal})`))
        .limit(input.limit);

      const products = results.map((row) => {
        const revenue = row.revenue || 0;
        const totalCost = row.totalCost || 0;
        const grossProfit = revenue - totalCost;
        const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        return {
          brand: row.brand || "N/A",
          model: row.model || "N/A",
          type: row.type || "N/A",
          salesCount: row.salesCount || 0,
          unitsSold: row.unitsSold || 0,
          revenue,
          totalCost,
          grossProfit,
          marginPercent: Math.round(marginPercent * 100) / 100,
          avgRevenue: row.unitsSold > 0 ? Math.round(revenue / row.unitsSold) : 0,
        };
      });

      return {
        period: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        branchId: targetBranchId,
        products,
        total: products.length,
      };
    }),

  /**
   * Rentabilidad por categoría (tipo de producto)
   */
  getCategoryProfitability: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Base de datos no disponible",
        });
      }

      const targetBranchId = input.branchId || 1;

      const results = await db
        .select({
          category: units.type,
          salesCount: sql<number>`COUNT(DISTINCT ${sales.id})`,
          unitsSold: sql<number>`SUM(${saleItems.quantity})`,
          revenue: sql<number>`SUM(${saleItems.subtotal})`,
          totalCost: sql<number>`SUM(${units.purchasePrice} * ${saleItems.quantity})`,
        })
        .from(saleItems)
        .leftJoin(sales, eq(saleItems.saleId, sales.id))
        .leftJoin(units, eq(saleItems.unitId, units.id))
        .where(
          and(
            sql`DATE(${sales.createdAt}) >= ${input.startDate}`,
            sql`DATE(${sales.createdAt}) <= ${input.endDate}`,
            eq(sales.status, "completed"),
            eq(sales.branchId, targetBranchId)
          )
        )
        .groupBy(units.type)
        .orderBy(desc(sql`SUM(${saleItems.subtotal})`));

      const categories = results.map((row) => {
        const revenue = row.revenue || 0;
        const totalCost = row.totalCost || 0;
        const grossProfit = revenue - totalCost;
        const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        return {
          category: row.category || "N/A",
          salesCount: row.salesCount || 0,
          unitsSold: row.unitsSold || 0,
          revenue,
          totalCost,
          grossProfit,
          marginPercent: Math.round(marginPercent * 100) / 100,
        };
      });

      return {
        period: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        branchId: targetBranchId,
        categories,
        total: categories.length,
      };
    }),

  /**
   * Rentabilidad por marca
   */
  getBrandProfitability: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.number().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Base de datos no disponible",
        });
      }

      const targetBranchId = input.branchId || 1;

      const results = await db
        .select({
          brand: units.brand,
          salesCount: sql<number>`COUNT(DISTINCT ${sales.id})`,
          unitsSold: sql<number>`SUM(${saleItems.quantity})`,
          revenue: sql<number>`SUM(${saleItems.subtotal})`,
          totalCost: sql<number>`SUM(${units.purchasePrice} * ${saleItems.quantity})`,
        })
        .from(saleItems)
        .leftJoin(sales, eq(saleItems.saleId, sales.id))
        .leftJoin(units, eq(saleItems.unitId, units.id))
        .where(
          and(
            sql`DATE(${sales.createdAt}) >= ${input.startDate}`,
            sql`DATE(${sales.createdAt}) <= ${input.endDate}`,
            eq(sales.status, "completed"),
            eq(sales.branchId, targetBranchId)
          )
        )
        .groupBy(units.brand)
        .orderBy(desc(sql`SUM(${saleItems.subtotal})`))
        .limit(input.limit);

      const brands = results.map((row) => {
        const revenue = row.revenue || 0;
        const totalCost = row.totalCost || 0;
        const grossProfit = revenue - totalCost;
        const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        return {
          brand: row.brand || "N/A",
          salesCount: row.salesCount || 0,
          unitsSold: row.unitsSold || 0,
          revenue,
          totalCost,
          grossProfit,
          marginPercent: Math.round(marginPercent * 100) / 100,
        };
      });

      return {
        period: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        branchId: targetBranchId,
        brands,
        total: brands.length,
      };
    }),

  /**
   * Alertas de productos con margen bajo
   */
  getLowMarginProducts: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.number().optional(),
        marginThreshold: z.number().min(0).max(100).default(20), // % mínimo aceptable
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Base de datos no disponible",
        });
      }

      const targetBranchId = input.branchId || 1;

      const results = await db
        .select({
          brand: units.brand,
          model: units.model,
          type: units.type,
          unitsSold: sql<number>`SUM(${saleItems.quantity})`,
          revenue: sql<number>`SUM(${saleItems.subtotal})`,
          totalCost: sql<number>`SUM(${units.purchasePrice} * ${saleItems.quantity})`,
        })
        .from(saleItems)
        .leftJoin(sales, eq(saleItems.saleId, sales.id))
        .leftJoin(units, eq(saleItems.unitId, units.id))
        .where(
          and(
            sql`DATE(${sales.createdAt}) >= ${input.startDate}`,
            sql`DATE(${sales.createdAt}) <= ${input.endDate}`,
            eq(sales.status, "completed"),
            eq(sales.branchId, targetBranchId)
          )
        )
        .groupBy(units.brand, units.model, units.type);

      const lowMarginProducts = results
        .map((row) => {
          const revenue = row.revenue || 0;
          const totalCost = row.totalCost || 0;
          const grossProfit = revenue - totalCost;
          const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

          return {
            brand: row.brand || "N/A",
            model: row.model || "N/A",
            type: row.type || "N/A",
            unitsSold: row.unitsSold || 0,
            revenue,
            totalCost,
            grossProfit,
            marginPercent: Math.round(marginPercent * 100) / 100,
          };
        })
        .filter((product) => product.marginPercent < input.marginThreshold && product.marginPercent > 0)
        .sort((a, b) => a.marginPercent - b.marginPercent);

      return {
        period: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        branchId: targetBranchId,
        marginThreshold: input.marginThreshold,
        products: lowMarginProducts,
        total: lowMarginProducts.length,
      };
    }),
});
