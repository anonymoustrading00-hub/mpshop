/**
 * 🟡 MEDIO #3: Flujo de caja proyectado (Cash Flow Forecast)
 *
 * Proyecta ingresos y egresos esperados para los próximos 30/60/90 días basándose en:
 *   - CXC pendientes de cobro (con dueDate)
 *   - CXP pendientes de pago (con dueDate)
 *   - Gastos operacionales pendientes (con dueDate)
 *   - Promedio histórico de ventas (últimos N días) como ingreso proyectado
 *
 * El resultado es un calendario semanal/mensual de entradas y salidas.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  accountsReceivable,
  accountsPayable,
  operationalExpenses,
  sales,
  customers,
  suppliers,
} from "../../drizzle/schema";
import { eq, and, sql, gte, lte, ne } from "drizzle-orm";
import { getLocalDateKey } from "../_core/date_utils";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Agrupa items por semana (ISO week YYYY-Www) */
function weekKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const cashflowRouter = router({
  /**
   * Obtener el flujo de caja proyectado para los próximos días.
   */
  getForecast: protectedProcedure
    .input(
      z.object({
        horizonDays: z.enum(["30", "60", "90"]).default("30"),
        branchId: z.number().optional(),
        includeHistoricalAverage: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "BD no disponible" });

      const bid     = input.branchId ?? 1;
      const horizon = parseInt(input.horizonDays);
      const today   = new Date();
      const todayStr = getLocalDateKey(today) ?? toDateStr(today);
      const endDate  = addDays(today, horizon);
      const endStr   = toDateStr(endDate);

      const fallbackDate = todayStr;

      try {

      // ── 1. CXC con dueDate dentro del horizonte ────────────────────────────
      const cxcRows = await db
        .select({
          id: accountsReceivable.id,
          dueDate: accountsReceivable.dueDate,
          balance: accountsReceivable.balance,
          status: accountsReceivable.status,
          customerName: customers.name,
        })
        .from(accountsReceivable)
        .leftJoin(customers, eq(accountsReceivable.customerId, customers.id))
        .where(and(
          sql`${accountsReceivable.status} IN ('unpaid','partially_paid','overdue')`,
          sql`${accountsReceivable.dueDate} <= ${endStr}`,
        ));

      // ── 2. CXP con dueDate dentro del horizonte ────────────────────────────
      const cxpRows = await db
        .select({
          id: accountsPayable.id,
          dueDate: accountsPayable.dueDate,
          balance: accountsPayable.balance,
          status: accountsPayable.status,
          supplierName: suppliers.name,
        })
        .from(accountsPayable)
        .leftJoin(suppliers, eq(accountsPayable.supplierId, suppliers.id))
        .where(and(
          sql`${accountsPayable.status} IN ('unpaid','partially_paid','overdue')`,
          sql`${accountsPayable.dueDate} <= ${endStr}`,
        ));

      // ── 3. Gastos operacionales pendientes con dueDate ────────────────────
      const opRows = await db
        .select({
          id: operationalExpenses.id,
          dueDate: operationalExpenses.dueDate,
          amount: operationalExpenses.amount,
          category: operationalExpenses.category,
          description: operationalExpenses.description,
        })
        .from(operationalExpenses)
        .where(and(
          eq(operationalExpenses.status, "pending"),
          eq(operationalExpenses.isAutomatic, 0),
          eq(operationalExpenses.branchId, bid),
          sql`${operationalExpenses.dueDate} IS NOT NULL`,
          sql`${operationalExpenses.dueDate} <= ${endStr + "T23:59:59"}`,
        ));

      // ── 4. Promedio histórico de ventas diarias (últimos 30 días) ─────────
      let avgDailySales = 0;
      if (input.includeHistoricalAverage) {
        const histStart = addDays(today, -30);
        const histResult = await db
          .select({ total: sql<number>`COALESCE(SUM(${sales.total}), 0)` })
          .from(sales)
          .where(and(
            eq(sales.status, "completed"),
            eq(sales.branchId, bid),
            gte(sales.createdAt, histStart),
            lte(sales.createdAt, today),
            ne(sales.paymentMethod, "credit"),
          ));
        avgDailySales = Math.round((histResult[0]?.total ?? 0) / 30);
      }

      // ── 5. Construir línea de tiempo diaria ────────────────────────────────
      type DayEntry = {
        date: string;
        week: string;
        inflows: { type: string; label: string; amount: number; ref?: number }[];
        outflows: { type: string; label: string; amount: number; ref?: number }[];
        netDay: number;
        runningBalance: number;
      };

      const timeline: DayEntry[] = [];
      let runningBalance = 0;

      for (let d = 0; d <= horizon; d++) {
        const dayDate = addDays(today, d);
        const dayStr  = toDateStr(dayDate);

        const inflows: DayEntry["inflows"]  = [];
        const outflows: DayEntry["outflows"] = [];

        // Ingresos proyectados por ventas promedio (solo días laborales mon-sat)
        const dayOfWeek = dayDate.getDay(); // 0=dom, 6=sab
        if (input.includeHistoricalAverage && dayOfWeek !== 0 && d > 0) {
          inflows.push({ type: "projected_sales", label: "Ventas proyectadas (promedio)", amount: avgDailySales });
        }

        // CXC que vencen este día
        for (const cxc of cxcRows) {
          if (cxc.dueDate === dayStr) {
            inflows.push({
              type: "cxc",
              label: `Cobro CXC${cxc.customerName ? ` — ${cxc.customerName}` : ""}`,
              amount: cxc.balance ?? 0,
              ref: cxc.id,
            });
          }
        }
        // CXC vencidas (overdue) las ponemos en el día de hoy
        if (d === 0) {
          for (const cxc of cxcRows) {
            if ((cxc.status === "overdue" || (cxc.dueDate && cxc.dueDate < todayStr)) && cxc.dueDate !== dayStr) {
              inflows.push({
                type: "cxc_overdue",
                label: `Cobro VENCIDO${cxc.customerName ? ` — ${cxc.customerName}` : ""} (venció ${cxc.dueDate})`,
                amount: cxc.balance ?? 0,
                ref: cxc.id,
              });
            }
          }
        }

        // CXP que vencen este día
        for (const cxp of cxpRows) {
          if (cxp.dueDate === dayStr) {
            outflows.push({
              type: "cxp",
              label: `Pago a proveedor${cxp.supplierName ? ` — ${cxp.supplierName}` : ""}`,
              amount: cxp.balance ?? 0,
              ref: cxp.id,
            });
          }
        }
        // CXP vencidas en el día de hoy
        if (d === 0) {
          for (const cxp of cxpRows) {
            if ((cxp.status === "overdue" || (cxp.dueDate && cxp.dueDate < todayStr)) && cxp.dueDate !== dayStr) {
              outflows.push({
                type: "cxp_overdue",
                label: `Pago VENCIDO${cxp.supplierName ? ` — ${cxp.supplierName}` : ""} (venció ${cxp.dueDate})`,
                amount: cxp.balance ?? 0,
                ref: cxp.id,
              });
            }
          }
        }

        // Gastos operacionales con vencimiento este día
        for (const op of opRows) {
          if (!op.dueDate) continue;
          const opDayStr = new Date(op.dueDate).toISOString().split("T")[0];
          if (opDayStr === dayStr) {
            outflows.push({
              type: "expense",
              label: `Gasto: ${op.description}`,
              amount: op.amount ?? 0,
              ref: op.id,
            });
          }
        }

        const totalIn  = inflows.reduce((s, i) => s + i.amount, 0);
        const totalOut = outflows.reduce((s, o) => s + o.amount, 0);
        const netDay   = totalIn - totalOut;
        runningBalance += netDay;

        if (inflows.length > 0 || outflows.length > 0 || d === 0) {
          timeline.push({ date: dayStr, week: weekKey(dayStr), inflows, outflows, netDay, runningBalance });
        }
      }

      // ── 6. Resumen por semana ──────────────────────────────────────────────
      const weekSummary: Record<string, { totalIn: number; totalOut: number; net: number }> = {};
      for (const day of timeline) {
        if (!weekSummary[day.week]) weekSummary[day.week] = { totalIn: 0, totalOut: 0, net: 0 };
        weekSummary[day.week].totalIn  += day.inflows.reduce((s, i) => s + i.amount, 0);
        weekSummary[day.week].totalOut += day.outflows.reduce((s, o) => s + o.amount, 0);
        weekSummary[day.week].net      += day.netDay;
      }

      // ── 7. KPIs resumen ────────────────────────────────────────────────────
      const criticalDays = timeline.filter((d) => d.runningBalance < 0).map((d) => d.date);
      const totalIn  = timeline.reduce((s, d) => s + d.inflows.reduce((x: number, i: any)  => x + i.amount, 0), 0);
      const totalOut = timeline.reduce((s, d) => s + d.outflows.reduce((x: number, o: any) => x + o.amount, 0), 0);

      return {
        horizon: input.horizonDays,
        period: { startDate: todayStr, endDate: endStr },
        kpis: {
          totalProjectedInflows:  totalIn,
          totalProjectedOutflows: totalOut,
          netCashflow: totalIn - totalOut,
          lowestProjectedBalance: Math.min(...timeline.map((d) => d.runningBalance), 0),
          criticalDaysCount: criticalDays.length,
          avgDailySalesUsed: avgDailySales,
          pendingCxcTotal: cxcRows.reduce((s: number, r: any) => s + (r.balance ?? 0), 0),
          pendingCxpTotal: cxpRows.reduce((s: number, r: any) => s + (r.balance ?? 0), 0),
        },
        timeline,
        weekSummary,
        criticalDays,
        warnings: [
          ...(criticalDays.length > 0
            ? [`⚠️ ${criticalDays.length} día(s) con saldo proyectado negativo`] : []),
          ...(cxpRows.filter((r: any) => r.status === "overdue").length > 0
            ? [`🔴 ${cxpRows.filter((r: any) => r.status === "overdue").length} CXP vencidas sin pagar`] : []),
          ...(cxcRows.filter((r: any) => r.status === "overdue").length > 0
            ? [`🟡 ${cxcRows.filter((r: any) => r.status === "overdue").length} CXC vencidas sin cobrar`] : []),
        ],
      };
      } catch (err: any) {
        console.error('[cashflow.getForecast] Error:', err?.message);
        return {
          horizon: input.horizonDays,
          period: { startDate: fallbackDate, endDate: fallbackDate },
          kpis: { totalProjectedInflows: 0, totalProjectedOutflows: 0, netCashflow: 0,
                  lowestProjectedBalance: 0, criticalDaysCount: 0, avgDailySalesUsed: 0,
                  pendingCxcTotal: 0, pendingCxpTotal: 0 },
          timeline: [], weekSummary: {}, criticalDays: [],
          warnings: [`Error al calcular proyección: ${err?.message}`],
        };
      }
    }),
});
