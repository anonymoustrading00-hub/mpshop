/**
 * Dashboard Router — KPIs endpoint (usado por DashboardKPIs page)
 * La página /dashboard fue eliminada. Este router persiste solo para
 * proveer el endpoint getKPIs que usa la página /dashboard-kpis.
 */
import { z } from "zod";
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
  MOCK_PURCHASES,
  MOCK_ACCOUNTS_PAYABLE,
} from "../db";
import {
  units, saleItems, sales, returns,
  financialTransactions, cashOpenings,
  accountsReceivable, unitEvents, repairs,
  purchases, accountsPayable,
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

interface DateRangeResolved {
  startDate: Date;
  endDate: Date;
  prevStartDate: Date;
  prevEndDate: Date;
  label: string;
  days: number;
}

function resolveDateRange(
  preset: string = "current_month",
  customStart?: string,
  customEnd?: string
): DateRangeResolved {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (preset === "custom" && customStart && customEnd) {
    start = new Date(`${customStart}T00:00:00`);
    end = new Date(`${customEnd}T23:59:59.999`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  } else if (preset === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (preset === "yesterday") {
    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
    end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
  } else if (preset === "this_week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    start = new Date(now.setDate(diff));
    start.setHours(0, 0, 0, 0);
    end = new Date();
    end.setHours(23, 59, 59, 999);
  } else if (preset === "last_7_days") {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (preset === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (preset === "last_3_months") {
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (preset === "this_year") {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (preset === "all_time") {
    start = new Date(2020, 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
  } else {
    // current_month
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - days * 24 * 60 * 60 * 1000 + 1);

  const startStr = start.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const endStr = end.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const label = `${startStr} al ${endStr} (${days} ${days === 1 ? "día" : "días"})`;

  return {
    startDate: start,
    endDate: end,
    prevStartDate: prevStart,
    prevEndDate: prevEnd,
    label,
    days,
  };
}

function computeBusinessDashboardData({
  unitsList,
  repairsList,
  salesList,
  saleItemsList,
  expensesList,
  purchasesList = [],
  apList = [],
  arList = [],
  resolvedRange,
}: {
  unitsList: any[];
  repairsList: any[];
  salesList: any[];
  saleItemsList: any[];
  expensesList: any[];
  purchasesList?: any[];
  apList?: any[];
  arList?: any[];
  resolvedRange: DateRangeResolved;
}) {
  const { startDate, endDate, prevStartDate, prevEndDate, label, days } = resolvedRange;

  // 1. Filtrar ventas completadas dentro del período
  const currentSales = salesList.filter((s: any) => {
    if (s.status === "cancelled") return false;
    const d = new Date(s.createdAt);
    return d >= startDate && d <= endDate;
  });

  const prevSales = salesList.filter((s: any) => {
    if (s.status === "cancelled") return false;
    const d = new Date(s.createdAt);
    return d >= prevStartDate && d <= prevEndDate;
  });

  // 2. Items vendidos en el período
  const currentSaleIds = new Set(currentSales.map((s: any) => s.id));
  const currentSaleItems = saleItemsList.filter((si: any) => currentSaleIds.has(si.saleId));

  // 3. Totales de Ingresos y Comparativos
  const totalRevenue = currentSales.reduce((s: number, sale: any) => s + (sale.total || 0), 0);
  const prevRevenue = prevSales.reduce((s: number, sale: any) => s + (sale.total || 0), 0);
  const revenueGrowthPct = prevRevenue > 0
    ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
    : totalRevenue > 0 ? 100 : 0;

  const salesCount = currentSales.length;
  const prevSalesCount = prevSales.length;
  const salesCountGrowthPct = prevSalesCount > 0
    ? ((salesCount - prevSalesCount) / prevSalesCount) * 100
    : salesCount > 0 ? 100 : 0;

  const averageTicket = salesCount > 0 ? Math.round(totalRevenue / salesCount) : 0;

  // 4. Costo de Mercancía Vendida (COGS) y Clasificación por Flujo
  const flowData: Record<string, any[]> = { usado_directo: [], reparado: [], inventario_nuevo: [] };
  let totalCOGS = 0;

  for (const saleItem of currentSaleItems) {
    const unit = unitsList.find((u: any) => u.id === saleItem.unitId);
    const purchaseCost = unit?.purchasePrice || 0;
    const unitRepairs = repairsList.filter((r: any) => r.unitId === saleItem.unitId && r.status === "completed");
    const repairCost = unitRepairs.reduce((s: number, r: any) => s + (r.laborCost || 0) + (r.partsCost || 0), 0);
    const itemCOGS = purchaseCost + repairCost;
    totalCOGS += itemCOGS;

    const salePrice = saleItem.finalUnitPrice || saleItem.basePrice || unit?.salePrice || 0;
    const margin = salePrice - itemCOGS;
    const marginPct = salePrice > 0 ? (margin / salePrice) * 100 : 0;

    const sale = currentSales.find((s: any) => s.id === saleItem.saleId);
    const daysInInventory = sale && unit?.createdAt
      ? Math.max(0, Math.round((new Date(sale.createdAt).getTime() - new Date(unit.createdAt).getTime()) / 86400000))
      : 0;

    const itemObj = {
      unitId: saleItem.unitId,
      code: unit?.code || `ID-${saleItem.unitId}`,
      type: unit?.type || "laptop",
      brand: unit?.brand || "",
      model: unit?.model || "",
      purchasePrice: purchaseCost,
      repairCost,
      salePrice,
      margin,
      marginPct,
      daysInInventory,
    };

    const isNew = unit?.condition === 10 || unit?.type === "charger" || unit?.type === "accessory";
    const wasRepaired = unitRepairs.length > 0;
    if (isNew) flowData.inventario_nuevo.push(itemObj);
    else if (wasRepaired) flowData.reparado.push(itemObj);
    else flowData.usado_directo.push(itemObj);
  }

  // 5. Ganancia Bruta
  const grossProfit = totalRevenue - totalCOGS;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // 6. Gastos Operativos (Excluyendo compras de mercadería para evitar doble conteo contable)
  const currentExpenses = expensesList.filter((e: any) => {
    if (e.type !== "expense") return false;
    if (e.category === "purchase") return false;
    const d = new Date(e.expenseDate || e.createdAt);
    return d >= startDate && d <= endDate;
  });

  const operationalExpenses = currentExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const expensesByCategory = currentExpenses.reduce((acc: any, e: any) => {
    const cat = e.category || "other";
    acc[cat] = (acc[cat] || 0) + (e.amount || 0);
    return acc;
  }, {});

  // 7. Ganancia Neta
  const netProfit = grossProfit - operationalExpenses;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // 8. Compras realizadas en el período
  const currentPurchases = purchasesList.filter((p: any) => {
    if (p.status === "cancelled") return false;
    const d = new Date(p.orderDate || p.createdAt);
    return d >= startDate && d <= endDate;
  });
  const totalPurchases = currentPurchases.reduce((s: number, p: any) => s + (p.totalAmount || 0), 0);
  const purchasesCount = currentPurchases.length;

  // 9. Inventario Activo (Capital inmovilizado en stock)
  const activeStockUnits = unitsList.filter((u: any) =>
    ["available", "in_repair", "in_diagnosis", "reserved"].includes(u.status)
  );
  const inventoryValue = activeStockUnits.reduce((s: number, u: any) => s + (u.purchasePrice || 0), 0);
  const availableCount = unitsList.filter((u: any) => u.status === "available").length;
  const inRepairCount = unitsList.filter((u: any) => u.status === "in_repair").length;
  const inDiagnosisCount = unitsList.filter((u: any) => u.status === "in_diagnosis").length;
  const soldTotalCount = unitsList.filter((u: any) => u.status === "sold").length;

  // 10. Deudas y Créditos
  const totalAR = arList.filter((ar: any) => ar.status !== "paid").reduce((s: number, ar: any) => s + (ar.balance || 0), 0);
  const totalAP = apList.filter((ap: any) => ap.status !== "paid").reduce((s: number, ap: any) => s + (ap.balance || 0), 0);

  // 11. Rentabilidad por Flujo
  const flowSummary = Object.keys(flowData).map((flow: string) => {
    const items = flowData[flow];
    const count = items.length;
    const revenue = items.reduce((s: number, i: any) => s + i.salePrice, 0);
    const cogs = items.reduce((s: number, i: any) => s + i.purchasePrice + i.repairCost, 0);
    const profit = revenue - cogs;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { flow, count, revenue, cogs, profit, marginPct };
  });

  // 12. Top Productos en el rango
  const productStats = currentSaleItems.reduce((acc: any, si: any) => {
    const unit = unitsList.find((u: any) => u.id === si.unitId);
    const name = unit ? `${unit.brand || ""} ${unit.model || ""}`.trim() : (si.productName || "Producto");
    if (!acc[name]) {
      acc[name] = { name, sales: 0, revenue: 0, profit: 0 };
    }
    const salePrice = si.finalUnitPrice || si.basePrice || unit?.salePrice || 0;
    const purchasePrice = unit?.purchasePrice || 0;
    const unitRepairs = repairsList.filter((r: any) => r.unitId === si.unitId && r.status === "completed");
    const repCost = unitRepairs.reduce((s: number, r: any) => s + (r.laborCost || 0) + (r.partsCost || 0), 0);
    const profit = salePrice - purchasePrice - repCost;

    acc[name].sales += si.quantity || 1;
    acc[name].revenue += salePrice;
    acc[name].profit += profit;
    return acc;
  }, {});

  const topProducts = Object.values(productStats)
    .sort((a: any, b: any) => b.sales - a.sales)
    .slice(0, 5);

  const topProfitable = Object.values(productStats)
    .sort((a: any, b: any) => b.profit - a.profit)
    .slice(0, 5);

  // 13. Reparaciones del período
  const currentRepairs = repairsList.filter((r: any) => {
    const d = new Date(r.endDate || r.updatedAt || r.createdAt);
    return d >= startDate && d <= endDate;
  });
  const repairsCompleted = currentRepairs.filter((r: any) => r.status === "completed").length;
  const repairsInProgress = repairsList.filter((r: any) => r.status === "in_progress").length;

  const completedWithDates = currentRepairs.filter((r: any) => r.status === "completed" && r.endDate && r.startDate);
  const avgRepairDays = completedWithDates.length > 0
    ? Math.round(
        completedWithDates.reduce((s: number, r: any) => s + Math.max(0, (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000), 0) /
        completedWithDates.length
      )
    : 0;

  // 14. Rotación de Inventario en el período
  const allSoldInRange = Object.values(flowData).flat();
  const avgRotationDays = allSoldInRange.length > 0
    ? Math.round(allSoldInRange.reduce((s: number, i: any) => s + i.daysInInventory, 0) / allSoldInRange.length)
    : 0;

  const rotationByFlow = Object.keys(flowData).map((flow: string) => {
    const items = flowData[flow];
    const avg = items.length > 0
      ? items.reduce((s: number, i: any) => s + i.daysInInventory, 0) / items.length
      : 0;
    return { flow, avgDays: Math.round(avg) };
  });

  // 15. Serie Temporal Dinámica Adaptativa
  const timeSeries: any[] = [];
  if (days <= 31) {
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dayStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
      const daySales = currentSales.filter((s: any) => {
        const d = new Date(s.createdAt);
        return d >= dayStart && d <= dayEnd;
      });
      const dayRev = daySales.reduce((s: number, sale: any) => s + (sale.total || 0), 0);
      const dayItems = currentSaleItems.filter((si: any) => daySales.some((s: any) => s.id === si.saleId));
      const dayCOGS = dayItems.reduce((s: number, si: any) => {
        const u = unitsList.find((unit: any) => unit.id === si.unitId);
        const rep = repairsList.filter((r: any) => r.unitId === si.unitId && r.status === "completed");
        const rCost = rep.reduce((sum: number, r: any) => sum + (r.laborCost || 0) + (r.partsCost || 0), 0);
        return s + (u?.purchasePrice || 0) + rCost;
      }, 0);

      timeSeries.push({
        label: cur.toLocaleDateString("es-BO", { day: "2-digit", month: "short" }),
        revenue: dayRev,
        profit: dayRev - dayCOGS,
        count: daySales.length,
      });

      cur.setDate(cur.getDate() + 1);
    }
  } else if (days <= 90) {
    const cur = new Date(startDate);
    let weekIdx = 1;
    while (cur <= endDate) {
      const weekStart = new Date(cur);
      const weekEnd = new Date(cur.getTime() + 7 * 86400000 - 1);
      const wEnd = weekEnd > endDate ? endDate : weekEnd;

      const wSales = currentSales.filter((s: any) => {
        const d = new Date(s.createdAt);
        return d >= weekStart && d <= wEnd;
      });
      const wRev = wSales.reduce((s: number, sale: any) => s + (sale.total || 0), 0);
      const wItems = currentSaleItems.filter((si: any) => wSales.some((s: any) => s.id === si.saleId));
      const wCOGS = wItems.reduce((s: number, si: any) => {
        const u = unitsList.find((unit: any) => unit.id === si.unitId);
        const rep = repairsList.filter((r: any) => r.unitId === si.unitId && r.status === "completed");
        const rCost = rep.reduce((sum: number, r: any) => sum + (r.laborCost || 0) + (r.partsCost || 0), 0);
        return s + (u?.purchasePrice || 0) + rCost;
      }, 0);

      timeSeries.push({
        label: `Sem ${weekIdx} (${weekStart.getDate()}/${weekStart.getMonth() + 1})`,
        revenue: wRev,
        profit: wRev - wCOGS,
        count: wSales.length,
      });

      weekIdx++;
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cur <= endDate) {
      const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1, 0, 0, 0, 0);
      const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);

      const mSales = currentSales.filter((s: any) => {
        const d = new Date(s.createdAt);
        return d >= mStart && d <= mEnd;
      });
      const mRev = mSales.reduce((s: number, sale: any) => s + (sale.total || 0), 0);
      const mItems = currentSaleItems.filter((si: any) => mSales.some((s: any) => s.id === si.saleId));
      const mCOGS = mItems.reduce((s: number, si: any) => {
        const u = unitsList.find((unit: any) => unit.id === si.unitId);
        const rep = repairsList.filter((r: any) => r.unitId === si.unitId && r.status === "completed");
        const rCost = rep.reduce((sum: number, r: any) => sum + (r.laborCost || 0) + (r.partsCost || 0), 0);
        return s + (u?.purchasePrice || 0) + rCost;
      }, 0);

      timeSeries.push({
        label: cur.toLocaleDateString("es-BO", { month: "short", year: "2-digit" }),
        revenue: mRev,
        profit: mRev - mCOGS,
        count: mSales.length,
      });

      cur.setMonth(cur.getMonth() + 1);
    }
  }

  // 16. Alertas automáticas
  const alerts: any[] = [];
  const oldStock = activeStockUnits.filter((u: any) => {
    if (!u.createdAt) return false;
    const ageDays = (new Date().getTime() - new Date(u.createdAt).getTime()) / 86400000;
    return ageDays >= 60;
  });
  if (oldStock.length > 0) {
    alerts.push({
      type: "warning",
      title: `${oldStock.length} equipos con +60 días en inventario`,
      description: "Revisar precios o aplicar promociones para liberar capital inmovilizado.",
    });
  }

  if (totalRevenue > 0 && netMarginPct >= 15) {
    alerts.push({
      type: "success",
      title: `Margen neto excelente: ${netMarginPct.toFixed(1)}%`,
      description: `Rendimiento de alto nivel en el período seleccionado.`,
    });
  } else if (totalRevenue > 0 && netMarginPct < 0) {
    alerts.push({
      type: "error",
      title: `Margen neto negativo: ${netMarginPct.toFixed(1)}%`,
      description: "Los costos de venta y gastos operativos superaron los ingresos en este rango.",
    });
  }

  if (totalAP > 0) {
    alerts.push({
      type: "info",
      title: `Deudas por pagar a proveedores (CXP)`,
      description: `Saldo pendiente total: Bs. ${(totalAP / 100).toFixed(2)}.`,
    });
  }

  return {
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      label,
      days,
    },
    kpis: {
      totalRevenue,
      revenueGrowthPct,
      totalCOGS,
      grossProfit,
      grossMarginPct,
      operationalExpenses,
      netProfit,
      netMarginPct,
      inventoryValue,
      totalPurchases,
      purchasesCount,
      salesCount,
      salesCountGrowthPct,
      averageTicket,
      totalAR,
      totalAP,
      previousMonthComparison: revenueGrowthPct,
    },
    waterfall: [
      { name: "Ingresos", value: totalRevenue },
      { name: "(-) Costo Mercadería", value: -totalCOGS },
      { name: "= Ganancia Bruta", value: grossProfit },
      { name: "(-) Gastos Operativos", value: -operationalExpenses },
      { name: "= Ganancia Neta", value: netProfit },
    ],
    flowSummary,
    equipmentFlow: {
      purchased: unitsList.length,
      inDiagnosis: inDiagnosisCount,
      inRepair: inRepairCount,
      available: availableCount,
      sold: soldTotalCount,
    },
    expensesByCategory,
    repairStatus: {
      inProgress: repairsInProgress,
      completed: repairsCompleted,
      avgDays: avgRepairDays,
      lossRepairs: 0,
    },
    rotation: {
      avgDays: avgRotationDays,
      byFlow: rotationByFlow,
    },
    topProducts,
    topProfitable,
    alerts,
    weeklySales: timeSeries,
  };
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
   */
  getBusinessDashboard: protectedProcedure
    .input(
      z
        .object({
          rangePreset: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          branchId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const resolvedRange = resolveDateRange(input?.rangePreset, input?.startDate, input?.endDate);

      let unitsList: any[] = [];
      let repairsList: any[] = [];
      let salesList: any[] = [];
      let saleItemsList: any[] = [];
      let expensesList: any[] = [];
      let purchasesList: any[] = [];
      let apList: any[] = [];
      let arList: any[] = [];

      if (!db) {
        // ═══ MODO DEMO (MOCK) ═══
        const { MOCK_OPERATIONAL_EXPENSES } = await import("../db");
        unitsList = MOCK_UNITS as any[];
        repairsList = MOCK_REPAIRS as any[];
        salesList = MOCK_SALES as any[];
        saleItemsList = MOCK_SALE_ITEMS as any[];
        expensesList = (MOCK_OPERATIONAL_EXPENSES || []) as any[];
        purchasesList = (MOCK_PURCHASES || []) as any[];
        apList = (MOCK_ACCOUNTS_PAYABLE || []) as any[];
        arList = (MOCK_ACCOUNTS_RECEIVABLE || []) as any[];
      } else {
        // ═══ MODO REAL (DATABASE) ═══
        const [
          dbUnits,
          dbRepairs,
          dbSales,
          dbSaleItems,
          dbTransactions,
          dbPurchases,
          dbAP,
          dbAR,
        ] = await Promise.all([
          db.select().from(units),
          db.select().from(repairs),
          db.select().from(sales).where(ne(sales.status, "cancelled")),
          db.select().from(saleItems),
          db.select().from(financialTransactions),
          db.select().from(purchases).where(ne(purchases.status, "cancelled")),
          db.select().from(accountsPayable),
          db.select().from(accountsReceivable),
        ]);

        unitsList = dbUnits;
        repairsList = dbRepairs;
        salesList = dbSales;
        saleItemsList = dbSaleItems;
        // Solo egresos operativos reales
        expensesList = dbTransactions.filter((t: any) => t.type === "expense");
        purchasesList = dbPurchases;
        apList = dbAP;
        arList = dbAR;
      }

      return computeBusinessDashboardData({
        unitsList,
        repairsList,
        salesList,
        saleItemsList,
        expensesList,
        purchasesList,
        apList,
        arList,
        resolvedRange,
      });
    }),
});
