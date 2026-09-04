/**
 * Dashboard Router — KPIs endpoint (usado por DashboardKPIs page)
 * La página /dashboard fue eliminada. Este router persiste solo para
 * proveer el endpoint getKPIs que usa la página /dashboard-kpis.
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
} from "../db";
import {
  units, saleItems, sales, returns,
  financialTransactions, cashOpenings,
  accountsReceivable, unitEvents, repairs,
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql, ne, inArray } from "drizzle-orm";

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function now(): Date { return new Date(); }

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

export const dashboardRouter = router({
  getKPIs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const monthStart = startOfMonth();
    const today = now();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (!db) {
      const soldEventsThisMonth = (MOCK_UNIT_EVENTS as any[]).filter((e: any) =>
        e.eventType === "sold" && new Date(e.createdAt) >= monthStart
      );
      const soldUnitIdsThisMonth = new Set(soldEventsThisMonth.map((e: any) => e.unitId));
      let grossMarginSum = 0, grossMarginCount = 0, inventoryDaysSum = 0, inventoryDaysCount = 0;
      for (const unitId of soldUnitIdsThisMonth) {
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === unitId);
        if (!unit) continue;
        const saleItem = (MOCK_SALE_ITEMS as any[]).find((si: any) => si.unitId === unitId);
        const salePrice = saleItem?.finalUnitPrice || unit.salePrice || 0;
        const repairCosts = (MOCK_REPAIRS as any[])
          .filter((r: any) => r.unitId === unitId && r.status === "completed")
          .reduce((s: number, r: any) => s + (r.laborCost || 0) + (r.partsCost || 0), 0);
        grossMarginSum += salePrice - (unit.purchasePrice || 0) - repairCosts;
        grossMarginCount++;
        const soldEvent = soldEventsThisMonth.find((e: any) => e.unitId === unitId);
        if (soldEvent && unit.createdAt) {
          const days = Math.max(0, Math.round(
            (new Date(soldEvent.createdAt).getTime() - new Date(unit.createdAt).getTime()) / 86400000
          ));
          inventoryDaysSum += days;
          inventoryDaysCount++;
        }
      }
      const avgGrossMarginCents = grossMarginCount > 0 ? Math.round(grossMarginSum / grossMarginCount) : 0;
      const avgInventoryDays = inventoryDaysCount > 0 ? Math.round(inventoryDaysSum / inventoryDaysCount) : 0;
      const returnsThisMonth = (MOCK_RETURNS as any[]).filter((r: any) =>
        new Date(r.returnDate || r.createdAt) >= monthStart
      ).length;
      const salesThisMonth = (MOCK_SALES as any[]).filter((s: any) =>
        s.status !== "cancelled" && new Date(s.createdAt) >= monthStart
      ).length;
      const returnRatePct = salesThisMonth > 0
        ? Math.round((returnsThisMonth / salesThisMonth) * 1000) / 10 : 0;
      const agingCount = (MOCK_UNITS as any[]).filter((u: any) => {
        if (!["available", "in_repair", "in_diagnosis"].includes(u.status)) return false;
        return new Date(u.createdAt) <= thirtyDaysAgo;
      }).length;
      const balances = calcBalances(MOCK_FINANCIAL_TRANSACTIONS, MOCK_CASH_OPENINGS);
      const cxcPending = (MOCK_ACCOUNTS_RECEIVABLE as any[])
        .filter((ar: any) => ar.status !== "paid")
        .reduce((s: number, ar: any) => s + (ar.balance || 0), 0);
      return {
        avgGrossMarginCents, avgInventoryDays, returnRatePct, agingCount, balances,
        cxcPendingCents: cxcPending,
        periodLabel: monthStart.toLocaleDateString("es-BO", { month: "long", year: "numeric" }),
        salesThisMonth, returnsThisMonth,
      };
    }

    const [soldThisMonthRows, returnsThisMonthRows, salesThisMonthRows, agingRows, txRows, openingRows, cxcRows] =
      await Promise.all([
        db.select({ unitId: saleItems.unitId, finalUnitPrice: saleItems.finalUnitPrice, purchasePrice: units.purchasePrice, unitCreatedAt: units.createdAt })
          .from(saleItems)
          .innerJoin(sales, and(eq(saleItems.saleId, sales.id), eq(sales.status, "completed"), gte(sales.createdAt, monthStart)))
          .innerJoin(units, eq(saleItems.unitId, units.id)),
        db.select({ count: sql<number>`count(*)` }).from(returns).where(gte(returns.returnDate, monthStart)),
        db.select({ count: sql<number>`count(*)` }).from(sales).where(and(eq(sales.status, "completed"), gte(sales.createdAt, monthStart))),
        db.select({ count: sql<number>`count(*)` }).from(units).where(and(inArray(units.status, ["available", "in_repair", "in_diagnosis"]), lte(units.createdAt, thirtyDaysAgo))),
        db.select({ type: financialTransactions.type, paymentMethod: financialTransactions.paymentMethod, amount: financialTransactions.amount }).from(financialTransactions),
        db.select({ paymentMethod: cashOpenings.paymentMethod, openingAmount: cashOpenings.openingAmount }).from(cashOpenings),
        db.select({ balance: accountsReceivable.balance }).from(accountsReceivable).where(ne(accountsReceivable.status, "paid")),
      ]);

    const unitIds = soldThisMonthRows.map((r: any) => r.unitId);
    let repairCostByUnit: Map<number, number> = new Map();
    if (unitIds.length > 0) {
      const repairRows = await db.select({ unitId: repairs.unitId, laborCost: repairs.laborCost, partsCost: repairs.partsCost })
        .from(repairs).where(and(eq(repairs.status, "completed"), inArray(repairs.unitId, unitIds)));
      for (const r of repairRows as any[]) {
        repairCostByUnit.set(r.unitId, (repairCostByUnit.get(r.unitId) || 0) + (r.laborCost || 0) + (r.partsCost || 0));
      }
    }

    let soldEventByUnit: Map<number, Date> = new Map();
    if (unitIds.length > 0) {
      const soldEvRows = await db.select({ unitId: unitEvents.unitId, createdAt: unitEvents.createdAt })
        .from(unitEvents).where(and(eq(unitEvents.toStatus, "sold"), inArray(unitEvents.unitId, unitIds)));
      for (const ev of soldEvRows as any[]) {
        const existing = soldEventByUnit.get(ev.unitId);
        if (!existing || new Date(ev.createdAt) > existing) soldEventByUnit.set(ev.unitId, new Date(ev.createdAt));
      }
    }

    let grossSum = 0, grossCount = 0, daysSum = 0, daysCount = 0;
    for (const row of soldThisMonthRows as any[]) {
      const repairCost = repairCostByUnit.get(row.unitId) || 0;
      grossSum += (row.finalUnitPrice || 0) - (row.purchasePrice || 0) - repairCost;
      grossCount++;
      const soldAt = soldEventByUnit.get(row.unitId);
      if (soldAt && row.unitCreatedAt) {
        daysSum += Math.max(0, Math.round((soldAt.getTime() - new Date(row.unitCreatedAt).getTime()) / 86400000));
        daysCount++;
      }
    }

    const returnsN = Number((returnsThisMonthRows as any[])[0]?.count || 0);
    const salesN = Number((salesThisMonthRows as any[])[0]?.count || 0);
    return {
      avgGrossMarginCents: grossCount > 0 ? Math.round(grossSum / grossCount) : 0,
      avgInventoryDays: daysCount > 0 ? Math.round(daysSum / daysCount) : 0,
      returnRatePct: salesN > 0 ? Math.round((returnsN / salesN) * 1000) / 10 : 0,
      agingCount: Number((agingRows as any[])[0]?.count || 0),
      balances: calcBalances(txRows, openingRows),
      cxcPendingCents: (cxcRows as any[]).reduce((s: number, r: any) => s + (r.balance || 0), 0),
      periodLabel: monthStart.toLocaleDateString("es-BO", { month: "long", year: "numeric" }),
      salesThisMonth: salesN,
      returnsThisMonth: returnsN,
    };
  }),

  /**
   * getBusinessDashboard — Dashboard completo de rentabilidad por flujo de negocio
   * 
   * Flujos detectados:
   * 1. usado_directo: compra usado → venta sin reparar
   * 2. reparado: compra usado → reparación → venta
   * 3. inventario_nuevo: compra nuevo → venta (accesorios, etc.)
   */
  getBusinessDashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const monthStart = startOfMonth();
    const today = now();
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    if (!db) {
      // ═══ MODO DEMO (MOCK) ═══
      const { MOCK_OPERATIONAL_EXPENSES, MOCK_PURCHASES } = await import("../db");

      // 1. Clasificar equipos vendidos por flujo
      const soldUnits = (MOCK_UNITS as any[]).filter((u: any) => u.status === "sold");
      
      const flowData: any = { usado_directo: [], reparado: [], inventario_nuevo: [] };
      
      for (const unit of soldUnits) {
        const wasRepaired = (MOCK_REPAIRS as any[]).some((r: any) => 
          r.unitId === unit.id && r.status === "completed"
        );
        const isNew = unit.condition === 10 || unit.type === "charger" || unit.type === "accessory";
        
        const saleItem = (MOCK_SALE_ITEMS as any[]).find((si: any) => si.unitId === unit.id);
        const salePrice = saleItem?.finalUnitPrice || unit.salePrice || 0;
        
        const repairCosts = (MOCK_REPAIRS as any[])
          .filter((r: any) => r.unitId === unit.id && r.status === "completed")
          .reduce((s: number, r: any) => s + (r.laborCost || 0) + (r.partsCost || 0), 0);
        
        const cogs = (unit.purchasePrice || 0) + repairCosts;
        const margin = salePrice - cogs;
        const marginPct = salePrice > 0 ? (margin / salePrice) * 100 : 0;
        
        const sale = (MOCK_SALES as any[]).find((s: any) => 
          (MOCK_SALE_ITEMS as any[]).some((si: any) => si.saleId === s.id && si.unitId === unit.id)
        );
        const daysInInventory = sale && unit.createdAt 
          ? Math.max(0, Math.round((new Date(sale.createdAt).getTime() - new Date(unit.createdAt).getTime()) / 86400000))
          : 0;
        
        const item = {
          unitId: unit.id,
          code: unit.code,
          type: unit.type,
          brand: unit.brand,
          model: unit.model,
          purchasePrice: unit.purchasePrice || 0,
          repairCost: repairCosts,
          salePrice,
          margin,
          marginPct,
          daysInInventory,
        };
        
        if (isNew) flowData.inventario_nuevo.push(item);
        else if (wasRepaired) flowData.reparado.push(item);
        else flowData.usado_directo.push(item);
      }

      // 2. KPIs principales
      const totalRevenue = soldUnits.reduce((s: number, u: any) => {
        const si = (MOCK_SALE_ITEMS as any[]).find((item: any) => item.unitId === u.id);
        return s + (si?.finalUnitPrice || u.salePrice || 0);
      }, 0);

      const totalCOGS = soldUnits.reduce((s: number, u: any) => {
        const repairCosts = (MOCK_REPAIRS as any[])
          .filter((r: any) => r.unitId === u.id && r.status === "completed")
          .reduce((sum: number, r: any) => sum + (r.laborCost || 0) + (r.partsCost || 0), 0);
        return s + (u.purchasePrice || 0) + repairCosts;
      }, 0);

      const grossProfit = totalRevenue - totalCOGS;

      const operationalExpenses = (MOCK_OPERATIONAL_EXPENSES as any[])
        .filter((e: any) => new Date(e.expenseDate || e.createdAt) >= monthStart)
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);

      const netProfit = grossProfit - operationalExpenses;
      const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      const inventoryValue = (MOCK_UNITS as any[])
        .filter((u: any) => ["available", "in_repair", "in_diagnosis"].includes(u.status))
        .reduce((s: number, u: any) => s + (u.purchasePrice || 0), 0);

      // 3. Rentabilidad por flujo
      const flowSummary = Object.keys(flowData).map((flow: string) => {
        const items = flowData[flow];
        const count = items.length;
        const revenue = items.reduce((s: number, i: any) => s + i.salePrice, 0);
        const cogs = items.reduce((s: number, i: any) => s + i.purchasePrice + i.repairCost, 0);
        const profit = revenue - cogs;
        const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
        return { flow, count, revenue, cogs, profit, marginPct };
      });

      // 4. Flujo de equipos (embudo)
      const purchased = (MOCK_UNITS as any[]).length;
      const inRepair = (MOCK_UNITS as any[]).filter((u: any) => u.status === "in_repair").length;
      const available = (MOCK_UNITS as any[]).filter((u: any) => u.status === "available").length;
      const sold = soldUnits.length;

      // 5. Gastos operativos por categoría
      const expensesByCategory = (MOCK_OPERATIONAL_EXPENSES as any[])
        .filter((e: any) => new Date(e.expenseDate || e.createdAt) >= monthStart)
        .reduce((acc: any, e: any) => {
          const cat = e.category || "other";
          acc[cat] = (acc[cat] || 0) + (e.amount || 0);
          return acc;
        }, {});

      // 6. Estado de reparaciones
      const repairsInProgress = (MOCK_REPAIRS as any[]).filter((r: any) => r.status === "in_progress").length;
      const repairsCompleted = (MOCK_REPAIRS as any[]).filter((r: any) => 
        r.status === "completed" && new Date(r.endDate || r.updatedAt) >= monthStart
      ).length;
      
      const avgRepairDays = (MOCK_REPAIRS as any[])
        .filter((r: any) => r.status === "completed" && r.endDate && r.startDate)
        .reduce((acc: any, r: any) => {
          const days = Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000);
          acc.sum += days;
          acc.count++;
          return acc;
        }, { sum: 0, count: 0 });

      const avgRepairDaysValue = avgRepairDays.count > 0 ? Math.round(avgRepairDays.sum / avgRepairDays.count) : 0;

      // Reparaciones en pérdida (costo reparación > incremento valor venta)
      const lossRepairs = (MOCK_REPAIRS as any[])
        .filter((r: any) => {
          if (r.status !== "completed") return false;
          const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === r.unitId);
          if (!unit) return false;
          const repairCost = (r.laborCost || 0) + (r.partsCost || 0);
          const salePrice = unit.salePrice || 0;
          const purchasePrice = unit.purchasePrice || 0;
          return repairCost > (salePrice - purchasePrice);
        }).length;

      // 7. Rotación de inventario
      const avgInventoryDays = soldUnits
        .map((u: any) => {
          const sale = (MOCK_SALES as any[]).find((s: any) => 
            (MOCK_SALE_ITEMS as any[]).some((si: any) => si.saleId === s.id && si.unitId === u.id)
          );
          if (!sale || !u.createdAt) return 0;
          return Math.round((new Date(sale.createdAt).getTime() - new Date(u.createdAt).getTime()) / 86400000);
        })
        .reduce((acc: any, days: number) => {
          acc.sum += days;
          acc.count++;
          return acc;
        }, { sum: 0, count: 0 });

      const avgRotationDays = avgInventoryDays.count > 0 ? Math.round(avgInventoryDays.sum / avgInventoryDays.count) : 0;

      const rotationByFlow = Object.keys(flowData).map((flow: string) => {
        const items = flowData[flow];
        const avg = items.length > 0 
          ? items.reduce((s: number, i: any) => s + i.daysInInventory, 0) / items.length
          : 0;
        return { flow, avgDays: Math.round(avg) };
      });

      // 8. Top productos
      const productStats = soldUnits.reduce((acc: any, u: any) => {
        const key = `${u.brand || "Sin marca"} ${u.model || "Sin modelo"}`.trim();
        if (!acc[key]) {
          acc[key] = { name: key, sales: 0, revenue: 0, profit: 0 };
        }
        const si = (MOCK_SALE_ITEMS as any[]).find((item: any) => item.unitId === u.id);
        const salePrice = si?.finalUnitPrice || u.salePrice || 0;
        const repairCosts = (MOCK_REPAIRS as any[])
          .filter((r: any) => r.unitId === u.id && r.status === "completed")
          .reduce((s: number, r: any) => s + (r.laborCost || 0) + (r.partsCost || 0), 0);
        const profit = salePrice - (u.purchasePrice || 0) - repairCosts;
        
        acc[key].sales++;
        acc[key].revenue += salePrice;
        acc[key].profit += profit;
        return acc;
      }, {});

      const topProducts = Object.values(productStats)
        .sort((a: any, b: any) => b.sales - a.sales)
        .slice(0, 5);

      const topProfitable = Object.values(productStats)
        .sort((a: any, b: any) => b.profit - a.profit)
        .slice(0, 5);

      // 9. Alertas automáticas
      const alerts: any[] = [];

      // Equipos +60 días
      const oldInventory = (MOCK_UNITS as any[]).filter((u: any) => {
        if (!["available", "in_repair", "in_diagnosis"].includes(u.status)) return false;
        return new Date(u.createdAt) <= sixtyDaysAgo;
      });
      if (oldInventory.length > 0) {
        alerts.push({
          type: "warning",
          title: `${oldInventory.length} equipos con +60 días en inventario`,
          description: "Revisar precios o promociones",
        });
      }

      // Reparaciones en pérdida
      if (lossRepairs > 0) {
        alerts.push({
          type: "error",
          title: `${lossRepairs} reparaciones resultaron en pérdida`,
          description: "Revisar criterios de aceptación",
        });
      }

      // Margen neto positivo
      if (netMarginPct > 15) {
        alerts.push({
          type: "success",
          title: `Margen neto del ${netMarginPct.toFixed(1)}%`,
          description: "Excelente rentabilidad este mes",
        });
      }

      // 10. Ventas por período (últimas 8 semanas)
      const weeklySales: any[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const weekSales = (MOCK_SALES as any[]).filter((s: any) => {
          const d = new Date(s.createdAt);
          return d >= weekStart && d < weekEnd && s.status !== "cancelled";
        });

        const revenue = weekSales.reduce((s: number, sale: any) => s + (sale.total || 0), 0);
        const cogs = weekSales.reduce((s: number, sale: any) => {
          return s + (MOCK_SALE_ITEMS as any[])
            .filter((si: any) => si.saleId === sale.id)
            .reduce((ss: number, si: any) => {
              const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === si.unitId);
              if (!unit) return ss;
              const repairCosts = (MOCK_REPAIRS as any[])
                .filter((r: any) => r.unitId === unit.id && r.status === "completed")
                .reduce((rr: number, r: any) => rr + (r.laborCost || 0) + (r.partsCost || 0), 0);
              return ss + (unit.purchasePrice || 0) + repairCosts;
            }, 0);
        }, 0);

        weeklySales.push({
          week: `Sem ${8 - i}`,
          revenue,
          profit: revenue - cogs,
        });
      }

      return {
        kpis: {
          totalRevenue,
          totalCOGS,
          grossProfit,
          operationalExpenses,
          netProfit,
          netMarginPct,
          inventoryValue,
          previousMonthComparison: 0, // TODO: calcular mes anterior
        },
        waterfall: [
          { name: "Ingresos", value: totalRevenue },
          { name: "(-) Costo Mercadería", value: -totalCOGS },
          { name: "= Ganancia Bruta", value: grossProfit },
          { name: "(-) Gastos Operativos", value: -operationalExpenses },
          { name: "= Ganancia Neta", value: netProfit },
        ],
        flowSummary,
        equipmentFlow: { purchased, inRepair, available, sold },
        expensesByCategory,
        repairStatus: {
          inProgress: repairsInProgress,
          completed: repairsCompleted,
          avgDays: avgRepairDaysValue,
          lossRepairs,
        },
        rotation: {
          avgDays: avgRotationDays,
          byFlow: rotationByFlow,
        },
        topProducts,
        topProfitable,
        alerts,
        weeklySales,
      };
    }

    // ═══ MODO REAL (DATABASE) ═══
    // TODO: Implementar queries reales cuando se conecte MySQL
    throw new Error("Database mode not implemented yet for getBusinessDashboard");
  }),
});
