import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { kpiSnapshots, sales, saleItems, units, operationalExpenses, financialTransactions } from "../../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getLocalDateKey } from "../_core/date_utils";

/**
 * 🔴 CRÍTICO #4: Router de KPIs Agregados
 * 
 * Propósito: Almacenar snapshots diarios de métricas clave para dashboards rápidos.
 * 
 * Métricas Soportadas:
 * - daily_revenue: Ingresos totales del día
 * - daily_cogs: Costo de ventas del día
 * - daily_gross_profit: Utilidad bruta del día
 * - daily_sales_count: Número de ventas
 * - daily_units_sold: Unidades vendidas
 * - daily_expenses: Gastos operacionales
 * - daily_cash_difference: Diferencia en cierres de caja
 */

export const kpisRouter = router({
  /**
   * Agregar métrica diaria (manual o automático desde cron)
   */
  aggregateDailyMetrics: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
        branchId: z.number().optional(),
        force: z.boolean().optional(), // Si true, sobreescribe métricas existentes
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Base de datos no disponible (modo mock no soporta KPI snapshots)",
        });
      }

      const targetBranchId = input.branchId || 1;
      const targetDate = input.date;

      // Verificar si ya existen métricas para esta fecha
      const existing = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(kpiSnapshots)
        .where(and(eq(kpiSnapshots.date, targetDate), eq(kpiSnapshots.branchId, targetBranchId)));

      if (existing[0]?.count > 0 && !input.force) {
        return {
          success: false,
          message: `Ya existen métricas para ${targetDate}. Usa force:true para sobreescribir.`,
        };
      }

      // Si force=true, eliminar métricas existentes
      if (input.force && existing[0]?.count > 0) {
        await db
          .delete(kpiSnapshots)
          .where(and(eq(kpiSnapshots.date, targetDate), eq(kpiSnapshots.branchId, targetBranchId)));
      }

      // 1. Calcular ingresos del día (ventas completadas)
      const revenueResult = await db
        .select({
          total: sql<number>`COALESCE(SUM(${sales.total}), 0)`,
          count: sql<number>`COUNT(${sales.id})`,
        })
        .from(sales)
        .where(
          and(
            sql`DATE(${sales.createdAt}) = ${targetDate}`,
            eq(sales.status, "completed"),
            eq(sales.branchId, targetBranchId)
          )
        );

      const dailyRevenue = revenueResult[0]?.total || 0;
      const dailySalesCount = revenueResult[0]?.count || 0;

      // 2. Calcular unidades vendidas
      const unitsSoldResult = await db
        .select({
          count: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)`,
        })
        .from(saleItems)
        .leftJoin(sales, eq(saleItems.saleId, sales.id))
        .where(
          and(
            sql`DATE(${sales.createdAt}) = ${targetDate}`,
            eq(sales.status, "completed"),
            eq(sales.branchId, targetBranchId)
          )
        );

      const dailyUnitsSold = unitsSoldResult[0]?.count || 0;

      // 3. Calcular COGS del día (gastos de categoría "cogs")
      const cogsResult = await db
        .select({
          total: sql<number>`COALESCE(SUM(${operationalExpenses.amount}), 0)`,
        })
        .from(operationalExpenses)
        .where(
          and(
            sql`DATE(${operationalExpenses.expenseDate}) = ${targetDate}`,
            eq(operationalExpenses.category, "cogs"),
            eq(operationalExpenses.branchId, targetBranchId)
          )
        );

      const dailyCogs = cogsResult[0]?.total || 0;

      // 4. Calcular utilidad bruta
      const dailyGrossProfit = dailyRevenue - dailyCogs;

      // 5. Calcular gastos operacionales (excluyendo COGS)
      const expensesResult = await db
        .select({
          total: sql<number>`COALESCE(SUM(${operationalExpenses.amount}), 0)`,
        })
        .from(operationalExpenses)
        .where(
          and(
            sql`DATE(${operationalExpenses.expenseDate}) = ${targetDate}`,
            sql`${operationalExpenses.category} != 'cogs'`,
            eq(operationalExpenses.branchId, targetBranchId)
          )
        );

      const dailyExpenses = expensesResult[0]?.total || 0;

      // 6. Insertar todas las métricas
      const metricsToInsert: Array<{
        date: string;
        branchId: number;
        metricName: string;
        metricValue: number;
        metricMetadata?: string;
      }> = [
        {
          date: targetDate,
          branchId: targetBranchId,
          metricName: "daily_revenue",
          metricValue: dailyRevenue,
        },
        {
          date: targetDate,
          branchId: targetBranchId,
          metricName: "daily_cogs",
          metricValue: dailyCogs,
        },
        {
          date: targetDate,
          branchId: targetBranchId,
          metricName: "daily_gross_profit",
          metricValue: dailyGrossProfit,
        },
        {
          date: targetDate,
          branchId: targetBranchId,
          metricName: "daily_sales_count",
          metricValue: dailySalesCount,
        },
        {
          date: targetDate,
          branchId: targetBranchId,
          metricName: "daily_units_sold",
          metricValue: dailyUnitsSold,
        },
        {
          date: targetDate,
          branchId: targetBranchId,
          metricName: "daily_expenses",
          metricValue: dailyExpenses,
        },
      ];

      for (const metric of metricsToInsert) {
        await db.insert(kpiSnapshots).values(metric);
      }

      return {
        success: true,
        message: `Métricas agregadas para ${targetDate}`,
        metrics: {
          revenue: dailyRevenue,
          cogs: dailyCogs,
          grossProfit: dailyGrossProfit,
          salesCount: dailySalesCount,
          unitsSold: dailyUnitsSold,
          expenses: dailyExpenses,
        },
      };
    }),

  /**
   * Obtener métricas de un rango de fechas
   */
  getMetrics: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.number().optional(),
        metrics: z.array(z.string()).optional(), // Filtrar métricas específicas
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

      const conditions = [
        gte(kpiSnapshots.date, input.startDate),
        lte(kpiSnapshots.date, input.endDate),
        eq(kpiSnapshots.branchId, targetBranchId),
      ];

      if (input.metrics && input.metrics.length > 0) {
        conditions.push(sql`${kpiSnapshots.metricName} IN (${sql.join(input.metrics.map(m => sql`${m}`), sql`, `)})`);
      }

      const results = await db
        .select()
        .from(kpiSnapshots)
        .where(and(...conditions))
        .orderBy(kpiSnapshots.date, kpiSnapshots.metricName);

      return {
        items: results,
        total: results.length,
      };
    }),

  /**
   * Obtener resumen rápido (últimos 30 días)
   */
  getSummary: protectedProcedure
    .input(
      z.object({
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
      const endDate = getLocalDateKey(new Date()) || new Date().toISOString().split("T")[0];
      const startDate = getLocalDateKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) || 
                       new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const results = await db
        .select({
          metricName: kpiSnapshots.metricName,
          total: sql<number>`SUM(${kpiSnapshots.metricValue})`,
          avg: sql<number>`AVG(${kpiSnapshots.metricValue})`,
          days: sql<number>`COUNT(DISTINCT ${kpiSnapshots.date})`,
        })
        .from(kpiSnapshots)
        .where(
          and(
            gte(kpiSnapshots.date, startDate),
            lte(kpiSnapshots.date, endDate),
            eq(kpiSnapshots.branchId, targetBranchId)
          )
        )
        .groupBy(kpiSnapshots.metricName);

      const summary: Record<string, { total: number; avg: number; days: number }> = {};
      for (const row of results) {
        summary[row.metricName] = {
          total: row.total || 0,
          avg: row.avg || 0,
          days: row.days || 0,
        };
      }

      return {
        period: { startDate, endDate },
        branchId: targetBranchId,
        summary,
      };
    }),
});
