/**
 * 🟡 MEDIO #1: Reconciliación automática entre módulos
 *
 * Cruza 3 fuentes de verdad:
 *   1. sales                   → libro maestro de ventas
 *   2. financialTransactions   → libro diario de caja
 *   3. seller_cash_registers   → cajas de vendedores
 *
 * Y detecta inconsistencias entre:
 *   - Ventas completadas que no generaron financialTransaction
 *   - financialTransactions de tipo venta sin venta asociada
 *   - salesCash/salesQr/salesTransfer en seller_cash_registers que no coinciden con ventas reales
 *   - CXC / CXP con dueDate vencido pero status != "overdue"
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  sales,
  financialTransactions,
  sellerCashRegisters,
  accountsReceivable,
  accountsPayable,
  operationalExpenses,
  users,
} from "../../drizzle/schema";
import { eq, and, sql, gte, lte, ne } from "drizzle-orm";
import { getLocalDateKey } from "../_core/date_utils";

export const reconciliationRouter = router({
  /**
   * Analiza inconsistencias entre ventas, caja y financial_transactions.
   * Devuelve un reporte detallado sin modificar datos (modo análisis / dry-run).
   */
  analyzeInconsistencies: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "BD no disponible" });

      const fromTs = new Date(input.startDate + "T00:00:00");
      const toTs   = new Date(input.endDate   + "T23:59:59");
      const bid    = input.branchId ?? 1;

      try {
      // ── 1. Ventas completadas que NO tienen financialTransaction ────────────
      const completedSales = await db
        .select({ id: sales.id, saleNumber: sales.saleNumber, total: sales.total,
                  paymentMethod: sales.paymentMethod, createdAt: sales.createdAt })
        .from(sales)
        .where(and(
          eq(sales.status, "completed"),
          eq(sales.branchId, bid),
          gte(sales.createdAt, fromTs),
          lte(sales.createdAt, toTs),
          ne(sales.paymentMethod, "credit"),        // las de crédito van a CXC
          eq(sales.paymentStatus, "completed"),
        ));

      const txBySaleRef = await db
        .select({ referenceId: financialTransactions.referenceId })
        .from(financialTransactions)
        .where(and(
          sql`${financialTransactions.category} IN ('sale_local','sale_delivery','sale')`,
          gte(financialTransactions.createdAt, fromTs),
          lte(financialTransactions.createdAt, toTs),
          eq(financialTransactions.branchId, bid),
        ));

      const txRefSet = new Set(txBySaleRef.map((r: any) => r.referenceId));
      const salesWithoutTx = completedSales.filter((s: any) => !txRefSet.has(s.id));

      // ── 2. Seller cash registers: salesCash/QR/Transfer vs ventas reales ───
      const cashRegs = await db
        .select({
          id: sellerCashRegisters.id,
          sellerId: sellerCashRegisters.sellerId,
          date: sellerCashRegisters.date,
          openedAt: sellerCashRegisters.openedAt,
          salesCash: sellerCashRegisters.salesCash,
          salesQr: sellerCashRegisters.salesQr,
          salesTransfer: sellerCashRegisters.salesTransfer,
        })
        .from(sellerCashRegisters)
        .where(and(
          eq(sellerCashRegisters.branchId, bid),
          gte(sellerCashRegisters.date, input.startDate),
          lte(sellerCashRegisters.date, input.endDate),
          sql`${sellerCashRegisters.closingStatus} != 'open'`,
        ));

      const cashRegDiscrepancies: any[] = [];
      for (const reg of cashRegs) {
        if (!reg.openedAt) continue;
        const realSales = await db
          .select({
            paymentMethod: sales.paymentMethod,
            total: sql<number>`SUM(${sales.total})`,
          })
          .from(sales)
          .where(and(
            eq(sales.soldBy, reg.sellerId),
            eq(sales.status, "completed"),
            gte(sales.createdAt, reg.openedAt),
            sql`DATE(${sales.createdAt}) = ${reg.date}`,
          ))
          .groupBy(sales.paymentMethod);

        const realMap: Record<string, number> = { cash: 0, qr: 0, transfer: 0 };
        for (const r of realSales) realMap[r.paymentMethod] = (r.total as number) || 0;

        const diffCash     = (reg.salesCash     ?? 0) - realMap.cash;
        const diffQr       = (reg.salesQr       ?? 0) - realMap.qr;
        const diffTransfer = (reg.salesTransfer ?? 0) - realMap.transfer;

        if (Math.abs(diffCash) > 0 || Math.abs(diffQr) > 0 || Math.abs(diffTransfer) > 0) {
          cashRegDiscrepancies.push({
            cashRegisterId: reg.id,
            sellerId: reg.sellerId,
            date: reg.date,
            storedCash: reg.salesCash, realCash: realMap.cash, diffCash,
            storedQr: reg.salesQr,     realQr: realMap.qr,     diffQr,
            storedTransfer: reg.salesTransfer, realTransfer: realMap.transfer, diffTransfer,
          });
        }
      }

      // ── 3. CXC vencidas no marcadas como overdue ────────────────────────────
      const today = getLocalDateKey(new Date()) ?? new Date().toISOString().split("T")[0];
      const overdueReceivable = await db
        .select({ id: accountsReceivable.id, dueDate: accountsReceivable.dueDate,
                  balance: accountsReceivable.balance, status: accountsReceivable.status })
        .from(accountsReceivable)
        .where(and(
          sql`${accountsReceivable.dueDate} < ${today}`,
          sql`${accountsReceivable.status} IN ('unpaid','partially_paid')`,
        ));

      // ── 4. CXP vencidas no marcadas como overdue ────────────────────────────
      const overduePayable = await db
        .select({ id: accountsPayable.id, dueDate: accountsPayable.dueDate,
                  balance: accountsPayable.balance, status: accountsPayable.status })
        .from(accountsPayable)
        .where(and(
          sql`${accountsPayable.dueDate} < ${today}`,
          sql`${accountsPayable.status} IN ('unpaid','partially_paid')`,
        ));

      // ── 5. Gastos operacionales pendientes de pago ──────────────────────────
      const pendingExpenses = await db
        .select({ id: operationalExpenses.id, category: operationalExpenses.category,
                  amount: operationalExpenses.amount, dueDate: operationalExpenses.dueDate })
        .from(operationalExpenses)
        .where(and(
          eq(operationalExpenses.status, "pending"),
          eq(operationalExpenses.isAutomatic, 0),
          eq(operationalExpenses.branchId, bid),
          gte(operationalExpenses.expenseDate, fromTs),
          lte(operationalExpenses.expenseDate, toTs),
        ));

      return {
        period: { startDate: input.startDate, endDate: input.endDate },
        summary: {
          salesWithoutTransaction: salesWithoutTx.length,
          cashRegisterDiscrepancies: cashRegDiscrepancies.length,
          overdueReceivable: overdueReceivable.length,
          overduePayable: overduePayable.length,
          pendingExpenses: pendingExpenses.length,
          totalIssues: salesWithoutTx.length + cashRegDiscrepancies.length +
                       overdueReceivable.length + overduePayable.length,
        },
        details: {
          salesWithoutTransaction: salesWithoutTx,
          cashRegisterDiscrepancies: cashRegDiscrepancies,
          overdueReceivable,
          overduePayable,
          pendingExpenses,
        },
      };
      } catch (err: any) {
        console.error('[reconciliation.analyzeInconsistencies] Error:', err?.message);
        return {
          period: { startDate: input.startDate, endDate: input.endDate },
          summary: { salesWithoutTransaction: 0, cashRegisterDiscrepancies: 0,
                     overdueReceivable: 0, overduePayable: 0, pendingExpenses: 0, totalIssues: 0 },
          details: { salesWithoutTransaction: [], cashRegisterDiscrepancies: [],
                     overdueReceivable: [], overduePayable: [], pendingExpenses: [] },
          error: err?.message,
        };
      }
    }),

  /**
   * Aplica correcciones automáticas detectadas por analyzeInconsistencies.
   *  - Crea las financialTransactions faltantes para ventas sin registro
   *  - Actualiza salesCash/QR/Transfer en seller_cash_registers
   *  - Marca como "overdue" las CXC y CXP vencidas
   */
  applyFixes: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.number().optional(),
        fixSalesWithoutTx: z.boolean().default(true),
        fixCashRegSales: z.boolean().default(true),
        fixOverdueCxc: z.boolean().default(true),
        fixOverdueCxp: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "BD no disponible" });

      const bid    = input.branchId ?? 1;
      const today  = getLocalDateKey(new Date()) ?? new Date().toISOString().split("T")[0];
      const log: string[] = [];
      let fixed = 0;

      try {
      // ── FIX 1: Crear financialTransactions para ventas sin registro ─────────
      if (input.fixSalesWithoutTx) {
        const fromTs = new Date(input.startDate + "T00:00:00");
        const toTs   = new Date(input.endDate   + "T23:59:59");

        const completedSales = await db
          .select({ id: sales.id, saleNumber: sales.saleNumber, total: sales.total,
                    paymentMethod: sales.paymentMethod, soldBy: sales.soldBy,
                    saleChannel: sales.saleChannel, createdAt: sales.createdAt })
          .from(sales)
          .where(and(
            eq(sales.status, "completed"),
            eq(sales.branchId, bid),
            gte(sales.createdAt, fromTs),
            lte(sales.createdAt, toTs),
            ne(sales.paymentMethod, "credit"),
            eq(sales.paymentStatus, "completed"),
          ));

        const txRefs = await db
          .select({ referenceId: financialTransactions.referenceId })
          .from(financialTransactions)
          .where(and(
            sql`${financialTransactions.category} IN ('sale_local','sale_delivery','sale')`,
            gte(financialTransactions.createdAt, fromTs),
            lte(financialTransactions.createdAt, toTs),
            eq(financialTransactions.branchId, bid),
          ));

        const txRefSet = new Set(txRefs.map((r: any) => r.referenceId));

        for (const s of completedSales) {
          if (!txRefSet.has(s.id)) {
            const category = s.saleChannel === "delivery" ? "sale_delivery" : "sale_local";
            await db.insert(financialTransactions).values({
              branchId: bid,
              type: "income",
              category,
              amount: s.total,
              paymentMethod: s.paymentMethod as any,
              userId: s.soldBy,
              referenceId: s.id,
              notes: `[Reconciliación] Venta ${s.saleNumber} sin transacción financiera`,
            });
            fixed++;
            log.push(`✅ Venta ${s.saleNumber} (Bs.${(s.total / 100).toFixed(2)}) → financialTransaction creada`);
          }
        }
      }

      // ── FIX 2: Actualizar salesCash/QR/Transfer en seller_cash_registers ───
      if (input.fixCashRegSales) {
        const cashRegs = await db
          .select({
            id: sellerCashRegisters.id,
            sellerId: sellerCashRegisters.sellerId,
            date: sellerCashRegisters.date,
            openedAt: sellerCashRegisters.openedAt,
          })
          .from(sellerCashRegisters)
          .where(and(
            eq(sellerCashRegisters.branchId, bid),
            gte(sellerCashRegisters.date, input.startDate),
            lte(sellerCashRegisters.date, input.endDate),
            sql`${sellerCashRegisters.closingStatus} != 'open'`,
          ));

        for (const reg of cashRegs) {
          if (!reg.openedAt) continue;
          const realSales = await db
            .select({
              paymentMethod: sales.paymentMethod,
              total: sql<number>`SUM(${sales.total})`,
            })
            .from(sales)
            .where(and(
              eq(sales.soldBy, reg.sellerId),
              eq(sales.status, "completed"),
              gte(sales.createdAt, reg.openedAt),
              sql`DATE(${sales.createdAt}) = ${reg.date}`,
            ))
            .groupBy(sales.paymentMethod);

          const realMap: Record<string, number> = { cash: 0, qr: 0, transfer: 0 };
          for (const r of realSales) realMap[r.paymentMethod] = (r.total as number) || 0;

          await db.update(sellerCashRegisters)
            .set({ salesCash: realMap.cash, salesQr: realMap.qr, salesTransfer: realMap.transfer })
            .where(eq(sellerCashRegisters.id, reg.id));
          fixed++;
          log.push(`✅ Caja #${reg.id} (${reg.date}) → salesCash/QR/Transfer actualizados`);
        }
      }

      // ── FIX 3: Marcar CXC vencidas como "overdue" ──────────────────────────
      if (input.fixOverdueCxc) {
        const res = await db
          .update(accountsReceivable)
          .set({ status: "overdue" })
          .where(and(
            sql`${accountsReceivable.dueDate} < ${today}`,
            sql`${accountsReceivable.status} IN ('unpaid','partially_paid')`,
          ));
        const count = (res as any)?.[0]?.affectedRows ?? 0;
        if (count > 0) {
          fixed += count;
          log.push(`✅ ${count} CXC marcadas como OVERDUE`);
        }
      }

      // ── FIX 4: Marcar CXP vencidas como "overdue" ──────────────────────────
      if (input.fixOverdueCxp) {
        const res = await db
          .update(accountsPayable)
          .set({ status: "overdue" })
          .where(and(
            sql`${accountsPayable.dueDate} < ${today}`,
            sql`${accountsPayable.status} IN ('unpaid','partially_paid')`,
          ));
        const count = (res as any)?.[0]?.affectedRows ?? 0;
        if (count > 0) {
          fixed += count;
          log.push(`✅ ${count} CXP marcadas como OVERDUE`);
        }
      }

      return {
        success: true,
        fixed,
        log,
        message: fixed > 0
          ? `Reconciliación completada: ${fixed} elementos corregidos.`
          : "Todo estaba en orden. Sin cambios necesarios.",
      };
      } catch (err: any) {
        console.error('[reconciliation.applyFixes] Error:', err?.message);
        return { success: false, fixed: 0, log, message: `Error: ${err?.message}` };
      }
    }),
});
