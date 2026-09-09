/**
 * 🟡 MEDIO #4: Notificaciones automáticas de cuentas vencidas
 *
 * Genera alertas para:
 *   - CXC (cuentas por cobrar) vencidas o próximas a vencer
 *   - CXP (cuentas por pagar) vencidas o próximas a vencer
 *   - Productos con purchasePrice = 0 (afecta rentabilidad)
 *   - Cajas de vendedor con diferencias significativas (>Bs.10)
 *   - Gastos operacionales pendientes de pago
 *
 * Cada notificación tiene: tipo, severidad, título, mensaje, acción sugerida y referencia.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  accountsReceivable,
  accountsPayable,
  operationalExpenses,
  sellerCashRegisters,
  units,
  customers,
  suppliers,
  users,
} from "../../drizzle/schema";
import { eq, and, sql, gte, lte, ne } from "drizzle-orm";
import { getLocalDateKey } from "../_core/date_utils";

export type NotificationSeverity = "critical" | "warning" | "info";

export interface AppNotification {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  amount?: number;           // Monto afectado en centavos
  dueDate?: string;          // Fecha de vencimiento relevante
  referenceId?: number;      // ID del registro afectado
  referenceType?: string;    // Tipo del registro (cxc, cxp, unit, etc.)
  actionLabel?: string;      // Texto del botón de acción
  actionUrl?: string;        // Ruta a la que navegar
  createdAt: string;
}

export const notificationsRouter = router({
  /**
   * Obtener todas las alertas activas del sistema.
   * Admin ve todo; vendedor solo ve sus propias alertas de caja.
   */
  getAll: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        // Modo mock: retornar demo
        return { notifications: [], unreadCount: 0, criticalCount: 0, warningCount: 0, infoCount: 0 };
      }

      const bid    = input?.branchId ?? 1;
      const today  = getLocalDateKey(new Date()) ?? new Date().toISOString().split("T")[0];

      try {
      const in7    = new Date(); in7.setDate(in7.getDate() + 7);
      const in7Str = in7.toISOString().split("T")[0];
      const isAdmin = ctx.user?.role === "admin";

      const notifications: AppNotification[] = [];

      if (isAdmin) {
        // ── 1. CXC VENCIDAS ────────────────────────────────────────────────
        const overdueReceivable = await db
          .select({
            id: accountsReceivable.id,
            dueDate: accountsReceivable.dueDate,
            balance: accountsReceivable.balance,
            customerName: customers.name,
          })
          .from(accountsReceivable)
          .leftJoin(customers, eq(accountsReceivable.customerId, customers.id))
          .where(and(
            sql`${accountsReceivable.status} IN ('unpaid','partially_paid','overdue')`,
            sql`${accountsReceivable.dueDate} < ${today}`,
          ));

        for (const cxc of overdueReceivable) {
          const daysOverdue = Math.floor((Date.now() - new Date(cxc.dueDate + "T12:00:00").getTime()) / 86400000);
          notifications.push({
            id: `cxc-overdue-${cxc.id}`,
            type: "cxc_overdue",
            severity: daysOverdue > 30 ? "critical" : "warning",
            title: "CXC Vencida — Cobro Pendiente",
            message: `${cxc.customerName ?? "Cliente"}: Bs.${((cxc.balance ?? 0) / 100).toFixed(2)} venció el ${cxc.dueDate} (${daysOverdue} días de atraso)`,
            amount: cxc.balance ?? 0,
            dueDate: cxc.dueDate ?? undefined,
            referenceId: cxc.id,
            referenceType: "cxc",
            actionLabel: "Ver CXC",
            actionUrl: "/admin/cuentas-cobrar",
            createdAt: new Date().toISOString(),
          });
        }

        // ── 2. CXC PRÓXIMAS A VENCER (7 días) ─────────────────────────────
        const soonReceivable = await db
          .select({
            id: accountsReceivable.id,
            dueDate: accountsReceivable.dueDate,
            balance: accountsReceivable.balance,
            customerName: customers.name,
          })
          .from(accountsReceivable)
          .leftJoin(customers, eq(accountsReceivable.customerId, customers.id))
          .where(and(
            sql`${accountsReceivable.status} IN ('unpaid','partially_paid')`,
            sql`${accountsReceivable.dueDate} >= ${today}`,
            sql`${accountsReceivable.dueDate} <= ${in7Str}`,
          ));

        for (const cxc of soonReceivable) {
          const daysLeft = Math.ceil((new Date(cxc.dueDate + "T12:00:00").getTime() - Date.now()) / 86400000);
          notifications.push({
            id: `cxc-soon-${cxc.id}`,
            type: "cxc_due_soon",
            severity: "info",
            title: "CXC por Vencer",
            message: `${cxc.customerName ?? "Cliente"}: Bs.${((cxc.balance ?? 0) / 100).toFixed(2)} vence en ${daysLeft} día(s) (${cxc.dueDate})`,
            amount: cxc.balance ?? 0,
            dueDate: cxc.dueDate ?? undefined,
            referenceId: cxc.id,
            referenceType: "cxc",
            actionLabel: "Ver CXC",
            actionUrl: "/admin/cuentas-cobrar",
            createdAt: new Date().toISOString(),
          });
        }

        // ── 3. CXP VENCIDAS ────────────────────────────────────────────────
        const overduePayable = await db
          .select({
            id: accountsPayable.id,
            dueDate: accountsPayable.dueDate,
            balance: accountsPayable.balance,
            supplierName: suppliers.name,
          })
          .from(accountsPayable)
          .leftJoin(suppliers, eq(accountsPayable.supplierId, suppliers.id))
          .where(and(
            sql`${accountsPayable.status} IN ('unpaid','partially_paid','overdue')`,
            sql`${accountsPayable.dueDate} < ${today}`,
          ));

        for (const cxp of overduePayable) {
          const daysOverdue = Math.floor((Date.now() - new Date(cxp.dueDate + "T12:00:00").getTime()) / 86400000);
          notifications.push({
            id: `cxp-overdue-${cxp.id}`,
            type: "cxp_overdue",
            severity: daysOverdue > 30 ? "critical" : "warning",
            title: "CXP Vencida — Pago Pendiente",
            message: `${cxp.supplierName ?? "Proveedor"}: Bs.${((cxp.balance ?? 0) / 100).toFixed(2)} venció el ${cxp.dueDate} (${daysOverdue} días de atraso)`,
            amount: cxp.balance ?? 0,
            dueDate: cxp.dueDate ?? undefined,
            referenceId: cxp.id,
            referenceType: "cxp",
            actionLabel: "Ver CXP",
            actionUrl: "/admin/cuentas-pagar",
            createdAt: new Date().toISOString(),
          });
        }

        // ── 4. CXP PRÓXIMAS A VENCER (7 días) ─────────────────────────────
        const soonPayable = await db
          .select({
            id: accountsPayable.id,
            dueDate: accountsPayable.dueDate,
            balance: accountsPayable.balance,
            supplierName: suppliers.name,
          })
          .from(accountsPayable)
          .leftJoin(suppliers, eq(accountsPayable.supplierId, suppliers.id))
          .where(and(
            sql`${accountsPayable.status} IN ('unpaid','partially_paid')`,
            sql`${accountsPayable.dueDate} >= ${today}`,
            sql`${accountsPayable.dueDate} <= ${in7Str}`,
          ));

        for (const cxp of soonPayable) {
          const daysLeft = Math.ceil((new Date(cxp.dueDate + "T12:00:00").getTime() - Date.now()) / 86400000);
          notifications.push({
            id: `cxp-soon-${cxp.id}`,
            type: "cxp_due_soon",
            severity: "info",
            title: "CXP por Vencer",
            message: `${cxp.supplierName ?? "Proveedor"}: Bs.${((cxp.balance ?? 0) / 100).toFixed(2)} vence en ${daysLeft} día(s) (${cxp.dueDate})`,
            amount: cxp.balance ?? 0,
            dueDate: cxp.dueDate ?? undefined,
            referenceId: cxp.id,
            referenceType: "cxp",
            actionLabel: "Ver CXP",
            actionUrl: "/admin/cuentas-pagar",
            createdAt: new Date().toISOString(),
          });
        }

        // ── 5. CAJAS CON DIFERENCIAS SIGNIFICATIVAS (>Bs.10) ──────────────
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const diffThreshold = 1000; // Bs.10 en centavos

        const diffCajas = await db
          .select({
            id: sellerCashRegisters.id,
            date: sellerCashRegisters.date,
            sellerId: sellerCashRegisters.sellerId,
            differenceCash: sellerCashRegisters.differenceCash,
            differenceQr: sellerCashRegisters.differenceQr,
            differenceTransfer: sellerCashRegisters.differenceTransfer,
            closingStatus: sellerCashRegisters.closingStatus,
            sellerName: users.name,
          })
          .from(sellerCashRegisters)
          .leftJoin(users, eq(sellerCashRegisters.sellerId, users.id))
          .where(and(
            eq(sellerCashRegisters.branchId, bid),
            sql`${sellerCashRegisters.date} >= ${threeDaysAgo.toISOString().split("T")[0]}`,
            sql`(ABS(${sellerCashRegisters.differenceCash}) > ${diffThreshold} OR ABS(${sellerCashRegisters.differenceQr}) > ${diffThreshold} OR ABS(${sellerCashRegisters.differenceTransfer}) > ${diffThreshold})`,
          ));

        for (const caja of diffCajas) {
          const maxDiff = Math.max(
            Math.abs(caja.differenceCash ?? 0),
            Math.abs(caja.differenceQr ?? 0),
            Math.abs(caja.differenceTransfer ?? 0),
          );
          notifications.push({
            id: `caja-diff-${caja.id}`,
            type: "cash_register_difference",
            severity: maxDiff > 5000 ? "critical" : "warning",
            title: "Diferencia en Caja de Vendedor",
            message: `${caja.sellerName ?? `Vendedor #${caja.sellerId}`} (${caja.date}): diferencia máxima de Bs.${(maxDiff / 100).toFixed(2)}`,
            amount: maxDiff,
            referenceId: caja.id,
            referenceType: "seller_cash",
            actionLabel: "Ver Caja",
            actionUrl: "/admin/cajas-vendedores",
            createdAt: new Date().toISOString(),
          });
        }

        // ── 6. GASTOS OPERACIONALES PENDIENTES ────────────────────────────
        const pendingOps = await db
          .select({
            id: operationalExpenses.id,
            amount: operationalExpenses.amount,
            category: operationalExpenses.category,
            description: operationalExpenses.description,
            dueDate: operationalExpenses.dueDate,
          })
          .from(operationalExpenses)
          .where(and(
            eq(operationalExpenses.status, "pending"),
            eq(operationalExpenses.isAutomatic, 0),
            eq(operationalExpenses.branchId, bid),
          ));

        if (pendingOps.length > 0) {
          const totalPending = pendingOps.reduce((s: number, o: any) => s + (o.amount ?? 0), 0);
          notifications.push({
            id: `pending-expenses-${bid}`,
            type: "pending_expenses",
            severity: pendingOps.length > 5 ? "warning" : "info",
            title: "Gastos Operacionales Pendientes",
            message: `${pendingOps.length} gasto(s) pendiente(s) de pago por Bs.${(totalPending / 100).toFixed(2)} en total`,
            amount: totalPending,
            referenceType: "expenses",
            actionLabel: "Ver Gastos",
            actionUrl: "/admin/gastos",
            createdAt: new Date().toISOString(),
          });
        }

        // ── 7. PRODUCTOS SIN PRECIO DE COMPRA ─────────────────────────────
        const unpricedCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(units)
          .where(and(
            ne(units.status, "sold"),
            sql`(${units.purchasePrice} IS NULL OR ${units.purchasePrice} = 0)`,
            sql`${units.type} IN ('laptop','tablet','phone','monitor')`,
          ));

        const nUnpriced = unpricedCount[0]?.count ?? 0;
        if (nUnpriced > 0) {
          notifications.push({
            id: `units-no-cost-${bid}`,
            type: "units_without_cost",
            severity: "warning",
            title: "Productos sin Costo de Adquisición",
            message: `${nUnpriced} producto(s) único(s) sin purchasePrice — rentabilidad incorrecta al venderlos`,
            referenceType: "units",
            actionLabel: "Ver Inventario",
            actionUrl: "/admin/inventario",
            createdAt: new Date().toISOString(),
          });
        }
      }

      // ── Vendedor: solo ve alertas de su propia caja ────────────────────────
      if (!isAdmin) {
        const myCajas = await db
          .select({
            id: sellerCashRegisters.id,
            date: sellerCashRegisters.date,
            differenceCash: sellerCashRegisters.differenceCash,
            differenceQr: sellerCashRegisters.differenceQr,
            differenceTransfer: sellerCashRegisters.differenceTransfer,
            closingStatus: sellerCashRegisters.closingStatus,
          })
          .from(sellerCashRegisters)
          .where(and(
            eq(sellerCashRegisters.sellerId, ctx.user!.id),
            sql`${sellerCashRegisters.closingStatus} = 'rejected'`,
          ));

        for (const caja of myCajas) {
          notifications.push({
            id: `my-caja-rejected-${caja.id}`,
            type: "cash_register_rejected",
            severity: "warning",
            title: "Cierre de Caja Rechazado",
            message: `Tu cierre de caja del ${caja.date} fue rechazado por el administrador`,
            referenceId: caja.id,
            referenceType: "seller_cash",
            actionLabel: "Ver Caja",
            actionUrl: "/vendedor/caja",
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Ordenar: críticas primero, luego warnings, luego info
      const severityOrder: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 };
      notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      const critical = notifications.filter((n) => n.severity === "critical").length;
      const warning  = notifications.filter((n) => n.severity === "warning").length;

      return {
        notifications,
        unreadCount: notifications.length,
        criticalCount: critical,
        warningCount: warning,
        infoCount: notifications.length - critical - warning,
      };
      } catch (err: any) {
        console.error('[notifications.getAll] Error:', err?.message);
        return { notifications: [], unreadCount: 0, criticalCount: 0, warningCount: 0, infoCount: 0 };
      }
    }),

  /**
   * Actualizar masivamente los status overdue de CXC y CXP.
   * Útil para ejecutar al inicio del día.
   */
  markOverdue: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return { updated: 0 };

    const today = getLocalDateKey(new Date()) ?? new Date().toISOString().split("T")[0];

    const cxcRes = await db
      .update(accountsReceivable)
      .set({ status: "overdue" })
      .where(and(
        sql`${accountsReceivable.dueDate} < ${today}`,
        sql`${accountsReceivable.status} IN ('unpaid','partially_paid')`,
      ));

    const cxpRes = await db
      .update(accountsPayable)
      .set({ status: "overdue" })
      .where(and(
        sql`${accountsPayable.dueDate} < ${today}`,
        sql`${accountsPayable.status} IN ('unpaid','partially_paid')`,
      ));

    const cxcCount = (cxcRes as any)?.[0]?.affectedRows ?? 0;
    const cxpCount = (cxpRes as any)?.[0]?.affectedRows ?? 0;

    return {
      updated: cxcCount + cxpCount,
      cxcMarked: cxcCount,
      cxpMarked: cxpCount,
      message: `${cxcCount} CXC y ${cxpCount} CXP marcadas como OVERDUE`,
    };
  }),
});
