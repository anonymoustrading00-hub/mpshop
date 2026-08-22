/**
 * Dashboard Router — 6 KPIs prioritarios en tiempo real
 * Objetivo: responder <500ms. Todos los cálculos se hacen sobre los datos
 * en memoria (mock) o con queries agregadas simples (DB).
 *
 * KPIs:
 * 1. Margen bruto promedio del mes
 * 2. Días promedio en inventario (unidades vendidas este mes)
 * 3. Tasa de devolución por garantía (%)
 * 4. Aging de inventario (unidades activas con más de 30 días)
 * 5. Saldo consolidado de cajas (efectivo + QR + transferencia) con desglose
 * 6. Cuentas por cobrar pendientes
 */
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDb,
  MOCK_UNITS,
  MOCK_UNIT_EVENTS,
  MOCK_SALES,
  MOCK_SALE_ITEMS,
  MOCK_RETURNS,
  MOCK_FINANCIAL_TRANSACTIONS,
  MOCK_CASH_OPENINGS,
  MOCK_ACCOUNTS_RECEIVABLE,
  MOCK_REPAIRS,
  MOCK_OPERATIONAL_EXPENSES,
} from "../db";
import {
  units, saleItems, sales, returns, warranties,
  financialTransactions, cashOpenings,
  accountsReceivable, unitEvents, repairs, operationalExpenses,
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql, ne, inArray, lt } from "drizzle-orm";

// ─── helpers ────────────────────────────────────────────────────────────────

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function now(): Date { return new Date(); }

/** Calcula saldo de cada caja desde financialTransactions + cashOpenings */
function calcBalances(transactions: any[], openings: any[]) {
  const calc = (method: "cash" | "qr" | "transfer") => {
    const inc = transactions
      .filter((t: any) => t.type === "income" &&
        (t.paymentMethod === method || (method === "cash" && !t.paymentMethod)))
      .reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const exp = transactions
      .filter((t: any) => t.type === "expense" &&
        (t.paymentMethod === method || (method === "cash" && !t.paymentMethod)))
      .reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const opening = openings
      .filter((o: any) => o.paymentMethod === method || (method === "cash" && !o.paymentMethod))
      .reduce((s: number, o: any) => s + (o.openingAmount || 0), 0);
    return inc - exp + opening;
  };
  const cash = calc("cash");
  const qr = calc("qr");
  const transfer = calc("transfer");
  return { cash, qr, transfer, total: cash + qr + transfer };
}

// ─── router ─────────────────────────────────────────────────────────────────

export const dashboardRouter = router({

  /**
   * Devuelve los 6 KPIs del Dashboard en una sola llamada.
   * Mock-friendly: funciona con y sin base de datos.
   */
  getKPIs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const monthStart = startOfMonth();
    const today = now();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ────────────────────────────────────────────────────────────
    // MOCK MODE
    // ────────────────────────────────────────────────────────────
    if (!db) {
      // ── KPI 1 & 2: unidades vendidas este mes (via unitEvents sold) ──────
      const soldEventsThisMonth = (MOCK_UNIT_EVENTS as any[]).filter((e: any) =>
        e.eventType === "sold" && new Date(e.createdAt) >= monthStart
      );
      const soldUnitIdsThisMonth = new Set(soldEventsThisMonth.map((e: any) => e.unitId));

      let grossMarginSum = 0;
      let grossMarginCount = 0;
      let inventoryDaysSum = 0;
      let inventoryDaysCount = 0;

      for (const unitId of soldUnitIdsThisMonth) {
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === unitId);
        if (!unit) continue;

        // KPI 1: margen bruto = finalUnitPrice − (purchasePrice + repairCosts)
        const saleItem = (MOCK_SALE_ITEMS as any[]).find((si: any) => si.unitId === unitId);
        const salePrice = saleItem?.finalUnitPrice || unit.salePrice || 0;
        const repairCosts = (MOCK_REPAIRS as any[])
          .filter((r: any) => r.unitId === unitId && r.status === "completed")
          .reduce((s: number, r: any) => s + (r.laborCost || 0) + (r.partsCost || 0), 0);
        const margin = salePrice - (unit.purchasePrice || 0) - repairCosts;
        grossMarginSum += margin;
        grossMarginCount++;

        // KPI 2: días en inventario = soldAt − createdAt(unit)
        const soldEvent = soldEventsThisMonth.find((e: any) => e.unitId === unitId);
        if (soldEvent && unit.createdAt) {
          const days = Math.max(0, Math.round(
            (new Date(soldEvent.createdAt).getTime() - new Date(unit.createdAt).getTime())
            / 86400000
          ));
          inventoryDaysSum += days;
          inventoryDaysCount++;
        }
      }

      const avgGrossMarginCents = grossMarginCount > 0 ? Math.round(grossMarginSum / grossMarginCount) : 0;
      const avgInventoryDays = inventoryDaysCount > 0 ? Math.round(inventoryDaysSum / inventoryDaysCount) : 0;

      // ── KPI 3: tasa de devolución del mes ────────────────────────────────
      const returnsThisMonth = (MOCK_RETURNS as any[]).filter((r: any) =>
        new Date(r.returnDate || r.createdAt) >= monthStart
      ).length;
      const salesThisMonth = (MOCK_SALES as any[]).filter((s: any) =>
        s.status !== "cancelled" && new Date(s.createdAt) >= monthStart
      ).length;
      const returnRatePct = salesThisMonth > 0
        ? Math.round((returnsThisMonth / salesThisMonth) * 1000) / 10
        : 0;

      // ── KPI 4: aging inventario (+30 días sin vender) ────────────────────
      const agingCount = (MOCK_UNITS as any[]).filter((u: any) => {
        if (!["available", "in_repair", "in_diagnosis"].includes(u.status)) return false;
        const created = new Date(u.createdAt);
        return created <= thirtyDaysAgo;
      }).length;

      // ── KPI 5: saldo cajas ────────────────────────────────────────────────
      const balances = calcBalances(MOCK_FINANCIAL_TRANSACTIONS, MOCK_CASH_OPENINGS);

      // ── KPI 6: cuentas por cobrar pendientes ─────────────────────────────
      const cxcPending = (MOCK_ACCOUNTS_RECEIVABLE as any[])
        .filter((ar: any) => ar.status !== "paid")
        .reduce((s: number, ar: any) => s + (ar.balance || 0), 0);

      return {
        avgGrossMarginCents,
        avgInventoryDays,
        returnRatePct,
        agingCount,
        balances,
        cxcPendingCents: cxcPending,
        // meta
        periodLabel: `${monthStart.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}`,
        salesThisMonth,
        returnsThisMonth,
      };
    }

    // ────────────────────────────────────────────────────────────
    // DB MODE — queries paralelas para <500ms
    // ────────────────────────────────────────────────────────────

    // Correr las 6 queries en paralelo
    const [
      soldThisMonthRows,
      returnsThisMonthRows,
      salesThisMonthRows,
      agingRows,
      txRows,
      openingRows,
      cxcRows,
    ] = await Promise.all([

      // Unidades vendidas este mes con sus precios y costos de reparación
      db.select({
        unitId: saleItems.unitId,
        finalUnitPrice: saleItems.finalUnitPrice,
        purchasePrice: units.purchasePrice,
        unitCreatedAt: units.createdAt,
      })
        .from(saleItems)
        .innerJoin(sales, and(
          eq(saleItems.saleId, sales.id),
          eq(sales.status, "completed"),
          gte(sales.createdAt, monthStart)
        ))
        .innerJoin(units, eq(saleItems.unitId, units.id)),

      // Devoluciones del mes
      db.select({ count: sql<number>`count(*)` })
        .from(returns)
        .where(gte(returns.returnDate, monthStart)),

      // Ventas del mes
      db.select({ count: sql<number>`count(*)` })
        .from(sales)
        .where(and(eq(sales.status, "completed"), gte(sales.createdAt, monthStart))),

      // Aging: activas con createdAt <= hoy-30d
      db.select({ count: sql<number>`count(*)` })
        .from(units)
        .where(and(
          inArray(units.status, ["available", "in_repair", "in_diagnosis"]),
          lte(units.createdAt, thirtyDaysAgo)
        )),

      // Todas las financial transactions para saldos (carga rápida, sin filtro de fecha)
      db.select({
        type: financialTransactions.type,
        paymentMethod: financialTransactions.paymentMethod,
        amount: financialTransactions.amount,
      }).from(financialTransactions),

      // Cash openings
      db.select({
        paymentMethod: cashOpenings.paymentMethod,
        openingAmount: cashOpenings.openingAmount,
      }).from(cashOpenings),

      // CXC pendientes
      db.select({ balance: accountsReceivable.balance })
        .from(accountsReceivable)
        .where(ne(accountsReceivable.status, "paid")),
    ]);

    // Costos de reparación por unitId (solo unidades vendidas este mes)
    const unitIds = soldThisMonthRows.map((r: any) => r.unitId);
    let repairCostByUnit: Map<number, number> = new Map();

    if (unitIds.length > 0) {
      const repairRows = await db.select({
        unitId: repairs.unitId,
        laborCost: repairs.laborCost,
        partsCost: repairs.partsCost,
      })
        .from(repairs)
        .where(and(
          eq(repairs.status, "completed"),
          inArray(repairs.unitId, unitIds)
        ));

      for (const r of repairRows as any[]) {
        const prev = repairCostByUnit.get(r.unitId) || 0;
        repairCostByUnit.set(r.unitId, prev + (r.laborCost || 0) + (r.partsCost || 0));
      }
    }

    // Evento "sold" para fecha de venta (días en inventario)
    let soldEventByUnit: Map<number, Date> = new Map();
    if (unitIds.length > 0) {
      const soldEvRows = await db.select({
        unitId: unitEvents.unitId,
        createdAt: unitEvents.createdAt,
      })
        .from(unitEvents)
        .where(and(
          eq(unitEvents.toStatus, "sold"),
          inArray(unitEvents.unitId, unitIds)
        ));

      for (const ev of soldEvRows as any[]) {
        // Tomar el más reciente en caso de múltiples
        const existing = soldEventByUnit.get(ev.unitId);
        if (!existing || new Date(ev.createdAt) > existing) {
          soldEventByUnit.set(ev.unitId, new Date(ev.createdAt));
        }
      }
    }

    // ── KPI 1 & 2 ────────────────────────────────────────────────────────
    let grossSum = 0; let grossCount = 0;
    let daysSum = 0; let daysCount = 0;

    for (const row of soldThisMonthRows as any[]) {
      const repairCost = repairCostByUnit.get(row.unitId) || 0;
      const margin = (row.finalUnitPrice || 0) - (row.purchasePrice || 0) - repairCost;
      grossSum += margin;
      grossCount++;

      const soldAt = soldEventByUnit.get(row.unitId);
      if (soldAt && row.unitCreatedAt) {
        const days = Math.max(0, Math.round(
          (soldAt.getTime() - new Date(row.unitCreatedAt).getTime()) / 86400000
        ));
        daysSum += days;
        daysCount++;
      }
    }

    const avgGrossMarginCents = grossCount > 0 ? Math.round(grossSum / grossCount) : 0;
    const avgInventoryDays = daysCount > 0 ? Math.round(daysSum / daysCount) : 0;

    // ── KPI 3 ─────────────────────────────────────────────────────────────
    const returnsN = Number((returnsThisMonthRows as any[])[0]?.count || 0);
    const salesN = Number((salesThisMonthRows as any[])[0]?.count || 0);
    const returnRatePct = salesN > 0 ? Math.round((returnsN / salesN) * 1000) / 10 : 0;

    // ── KPI 4 ─────────────────────────────────────────────────────────────
    const agingCount = Number((agingRows as any[])[0]?.count || 0);

    // ── KPI 5 ─────────────────────────────────────────────────────────────
    const balances = calcBalances(txRows, openingRows);

    // ── KPI 6 ─────────────────────────────────────────────────────────────
    const cxcPendingCents = (cxcRows as any[]).reduce((s: number, r: any) => s + (r.balance || 0), 0);

    return {
      avgGrossMarginCents,
      avgInventoryDays,
      returnRatePct,
      agingCount,
      balances,
      cxcPendingCents,
      periodLabel: `${monthStart.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}`,
      salesThisMonth: salesN,
      returnsThisMonth: returnsN,
    };
  }),
});
