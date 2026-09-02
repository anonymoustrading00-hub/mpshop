import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getAllOrders,
  getAllUnits,
  getFinancialTransactions,
  getOperationalExpenses,
  getAllSales,
  getSaleItemsBySaleId,
  getDb,
  MOCK_REPAIRS,
  MOCK_WARRANTIES,
  MOCK_RETURNS,
  MOCK_UNITS,
  MOCK_SALE_ITEMS,
} from "../db";
import { repairs, saleItems } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const statsRouter = router({
  // ─── Dashboard stats (existing) ──────────────────────────────────────────
  getDashboardStats: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const branchId = input?.branchId !== undefined ? input.branchId : ctx.branchId;

      const orders = await getAllOrders();
      const unitsList = await getAllUnits(branchId);
      const transactions = await getFinancialTransactions(undefined, branchId);

    const revenueByMethod = {
      cash: transactions
        .filter((t: any) => t.type === "income" && (t.paymentMethod === "cash" || !t.paymentMethod))
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
      qr: transactions
        .filter((t: any) => t.type === "income" && t.paymentMethod === "qr")
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
      transfer: transactions
        .filter((t: any) => t.type === "income" && t.paymentMethod === "transfer")
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
    };

    const availableUnits = unitsList.filter((u: any) => u.status === "available");

    // Ganancia potencial del inventario disponible
    const inventoryPurchaseValue = availableUnits.reduce((s: number, u: any) => s + (u.purchasePrice || 0), 0);
    const inventorySaleValue = availableUnits.reduce((s: number, u: any) => s + (u.salePrice || 0), 0);
    const inventoryPotentialProfit = inventorySaleValue - inventoryPurchaseValue;

    // Ganancia real acumulada de equipos vendidos
    const soldUnits = unitsList.filter((u: any) => u.status === "sold");
    const totalSoldCost = soldUnits.reduce((s: number, u: any) => s + (u.purchasePrice || 0), 0);
    const avgMarginPct = totalSoldCost > 0
      ? ((revenueByMethod.cash + revenueByMethod.qr + revenueByMethod.transfer - totalSoldCost) / totalSoldCost) * 100
      : 0;

    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter((o: any) => o.status === "pending").length,
      assignedOrders: orders.filter((o: any) => o.status === "assigned").length,
      inTransitOrders: orders.filter((o: any) => o.status === "in_transit").length,
      deliveredOrders: orders.filter((o: any) => o.status === "delivered").length,
      cancelledOrders: orders.filter((o: any) => o.status === "cancelled").length,
      totalRevenue: revenueByMethod.cash + revenueByMethod.qr + revenueByMethod.transfer,
      revenueByMethod,
      availableUnitsCount: availableUnits.length,
      totalUnits: unitsList.length,
      totalInventoryValue: inventorySaleValue,           // valor de venta del stock
      inventoryPurchaseValue,                            // costo del stock
      inventoryPotentialProfit,                          // ganancia si se vende todo
      soldUnitsCount: soldUnits.length,
      avgMarginPct: Math.round(avgMarginPct * 10) / 10,  // margen % acumulado real
    };
  }),

  // ─── Delivery stats (existing) ───────────────────────────────────────────
  getDeliveryStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "user") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const orders = await getAllOrders();
    const myOrders = orders.filter((o: any) => o.deliveryPersonId === ctx.user?.id);

    return {
      totalAssigned: myOrders.length,
      pending: myOrders.filter((o: any) => o.status === "assigned").length,
      inTransit: myOrders.filter((o: any) => o.status === "in_transit").length,
      delivered: myOrders.filter((o: any) => o.status === "delivered").length,
      cancelled: myOrders.filter((o: any) => o.status === "cancelled").length,
    };
  }),

  // ─── NEW: Profitability / Margen Real ────────────────────────────────────
  /**
   * Calcula el P&L (Estado de Resultados) del negocio para cualquier rango de fechas y filtros.
   */
  getProfitability: protectedProcedure
    .input(
      z.object({
        from: z.string().optional(), // YYYY-MM-DD
        to: z.string().optional(),   // YYYY-MM-DD
        period: z.enum(["today", "week", "month", "last_month", "quarter", "year", "all", "custom"]).default("month"),
        branchId: z.number().optional(),
        paymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
        brand: z.string().optional(),
        priceType: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const period = input?.period || "month";
      const from = input?.from;
      const to = input?.to;
      const branchId = input?.branchId;
      const paymentMethod = input?.paymentMethod;
      const brandFilter = input?.brand?.toLowerCase().trim();
      const priceTypeFilter = input?.priceType;

      // ── Fechas del período ────────────────────────────────────────────
      const { startDate, endDate, label: periodLabel } = computeDateRange(period, from, to);

      // ── Datos ─────────────────────────────────────────────────────────
      const db = await getDb();
      const [allTransactions, allExpenses, allUnits, allSales, allDbRepairs, allDbSaleItems] = await Promise.all([
        getFinancialTransactions(undefined, branchId),
        getOperationalExpenses(branchId),
        getAllUnits(),
        getAllSales(branchId),
        db ? db.select().from(repairs) : MOCK_REPAIRS,
        db ? db.select().from(saleItems) : MOCK_SALE_ITEMS,
      ]);

      // ── Helper rango de fechas ─────────────────────────────────────────
      const inPeriod = (dateVal: any) => {
        if (!dateVal) return false;
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (isNaN(d.getTime())) return false;
        return d >= startDate && d <= endDate;
      };

      const safeDateStr = (dateVal: any): string => {
        if (!dateVal) return new Date().toISOString().split("T")[0];
        if (dateVal instanceof Date) {
          return isNaN(dateVal.getTime()) ? new Date().toISOString().split("T")[0] : dateVal.toISOString().split("T")[0];
        }
        if (typeof dateVal === "string") {
          if (dateVal.includes("T")) return dateVal.split("T")[0];
          if (/^\d{4}-\d{2}-\d{2}/.test(dateVal)) return dateVal.substring(0, 10);
          const p = new Date(dateVal);
          return isNaN(p.getTime()) ? String(dateVal) : p.toISOString().split("T")[0];
        }
        return new Date(dateVal).toISOString().split("T")[0];
      };

      // ── 1. VENTAS Y COGS EN EL PERÍODO (Filtrado por rango, sucursal, método de pago, marca, precio) ──
      const filteredSales = (allSales as any[]).filter((s: any) => {
        if (s.status === "cancelled") return false;
        if (!inPeriod(s.createdAt)) return false;
        if (branchId && (s.branchId || 1) !== branchId) return false;
        if (paymentMethod && s.paymentMethod !== paymentMethod) return false;
        return true;
      });

      let totalIngresos = 0;
      let totalCOGS = 0;
      let unitsSoldInPeriod = 0;
      const soldUnitsDetail: any[] = [];
      const brandStats: Record<string, { brand: string; count: number; ingresos: number; cogs: number; margenBruto: number }> = {};
      const methodStats = { cash: 0, qr: 0, transfer: 0 };

      for (const sale of filteredSales) {
        // Buscar items de la venta
        const items = (allDbSaleItems as any[]).filter((si: any) => si.saleId === sale.id);
        
        if (items.length > 0) {
          for (const item of items) {
            const unit = (allUnits as any[]).find((u: any) => u.id === item.unitId);
            const brand = (unit?.brand || "Desconocida").trim();
            
            // Filtro por marca si aplica
            if (brandFilter && brand.toLowerCase() !== brandFilter) continue;
            // Filtro por tipo de precio si aplica
            if (priceTypeFilter && item.priceType !== priceTypeFilter) continue;

            const salePrice = Number(item.finalUnitPrice || item.unitPrice || unit?.salePrice || sale.total || 0);
            const purchaseCost = Number(unit?.purchasePrice || item.purchasePrice || 0);

            // Costo de taller asociado a esta unidad si lo hubo
            const repairCost = (allDbRepairs as any[])
              .filter((r: any) => r.unitId === item.unitId && r.status === "completed")
              .reduce((s: number, r: any) => s + (Number(r.laborCost) || 0) + (Number(r.partsCost) || 0), 0);

            totalIngresos += salePrice;
            totalCOGS += purchaseCost;
            unitsSoldInPeriod += 1;

            const margin = salePrice - purchaseCost - repairCost;
            const marginPct = purchaseCost > 0 ? (margin / purchaseCost) * 100 : 0;

            // Stats por Marca
            if (!brandStats[brand]) {
              brandStats[brand] = { brand, count: 0, ingresos: 0, cogs: 0, margenBruto: 0 };
            }
            brandStats[brand].count += 1;
            brandStats[brand].ingresos += salePrice;
            brandStats[brand].cogs += purchaseCost;
            brandStats[brand].margenBruto += (salePrice - purchaseCost);

            // Stats por Método de Pago
            const m = (sale.paymentMethod as "cash" | "qr" | "transfer") || "cash";
            if (m in methodStats) {
              methodStats[m] += salePrice;
            }

            soldUnitsDetail.push({
              saleId: sale.id,
              saleCode: sale.code,
              unitId: unit?.id || item.unitId,
              code: unit?.code || "—",
              brand,
              model: unit?.model || "—",
              customerName: sale.customerName || "Cliente Mostrador",
              paymentMethod: sale.paymentMethod || "cash",
              salePrice,
              purchasePrice: purchaseCost,
              repairCost,
              grossMargin: margin,
              grossMarginPct: Math.round(marginPct * 10) / 10,
              saleDate: sale.createdAt,
            });
          }
        } else {
          // Venta directa sin items enlazados
          if (!brandFilter && !priceTypeFilter) {
            const salePrice = Number(sale.total || 0);
            totalIngresos += salePrice;
            unitsSoldInPeriod += 1;
            const m = (sale.paymentMethod as "cash" | "qr" | "transfer") || "cash";
            if (m in methodStats) methodStats[m] += salePrice;
          }
        }
      }

      // ── 2. COSTOS DE TALLER EN EL PERÍODO ──────────────────────────────
      const filteredRepairs = (allDbRepairs as any[]).filter((r: any) => {
        if (r.status === "cancelled") return false;
        const repDate = r.endDate || r.startDate || r.createdAt || r.entryDate;
        if (!inPeriod(repDate)) return false;
        if (branchId && (r.branchId || 1) !== branchId) return false;
        return true;
      });
      const totalRepairCost = filteredRepairs.reduce(
        (s: number, r: any) => s + (Number(r.partsCost) || 0) + (Number(r.laborCost) || 0), 0
      );

      const repairsDetail = filteredRepairs.map((r: any) => {
        const unit = (allUnits as any[]).find((u: any) => u.id === r.unitId);
        return {
          id: r.id,
          otNumber: r.otNumber || `OT-#${r.id}`,
          rmaNumber: r.rmaNumber || r.unitRmaNumber || unit?.rmaNumber || "—",
          unitCode: unit?.code || "—",
          brand: unit?.brand || "—",
          model: unit?.model || "—",
          laborCost: Number(r.laborCost) || 0,
          partsCost: Number(r.partsCost) || 0,
          totalCost: (Number(r.laborCost) || 0) + (Number(r.partsCost) || 0),
          status: r.status,
          date: r.endDate || r.startDate || r.createdAt,
        };
      });

      // ── 3. COSTOS DE GARANTÍA EN EL PERÍODO ────────────────────────────
      const warrantyExpenses = (allExpenses as any[]).filter(
        (e: any) => ["warranty_repair_cost", "warranty_replacement_cost", "warranty_refund"].includes(e.category) && inPeriod(e.createdAt || e.expenseDate)
      );
      const totalWarrantyCost = warrantyExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

      // ── 4. GASTOS OPERATIVOS DEL PERÍODO ───────────────────────────────
      const DIRECT_CATS = new Set(["cogs", "repair_cost", "warranty_repair_cost", "warranty_replacement_cost", "warranty_refund"]);
      const opExpenses = (allExpenses as any[]).filter((e: any) => {
        if (DIRECT_CATS.has(e.category)) return false;
        if (e.status !== "paid") return false;
        if (!inPeriod(e.expenseDate || e.createdAt)) return false;
        if (branchId && (e.branchId || 1) !== branchId) return false;
        return true;
      });
      const totalOpExpenses = opExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

      const expensesDetail = opExpenses.map((e: any) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: Number(e.amount) || 0,
        status: e.status,
        paymentMethod: e.paymentMethod || "cash",
        date: e.expenseDate || e.createdAt,
      }));

      // ── 5. TRANSACCIONES FINANCIERAS EN EL PERÍODO ─────────────────────
      const transactionsDetail = (allTransactions as any[]).filter((t: any) => {
        if (!inPeriod(t.createdAt || t.date)) return false;
        if (branchId && (t.branchId || 1) !== branchId) return false;
        return true;
      }).map((t: any) => ({
        id: t.id,
        type: t.type,
        category: t.category,
        amount: Number(t.amount) || 0,
        paymentMethod: t.paymentMethod,
        description: t.description || t.notes || "—",
        date: t.createdAt || t.date,
      }));

      // ── 6. CÁLCULOS P&L FINALES ────────────────────────────────────────
      const margenBruto = totalIngresos - totalCOGS;
      const margenBrutoPct = totalIngresos > 0 ? (margenBruto / totalIngresos) * 100 : 0;
      const utilidadOperativa = margenBruto - totalRepairCost - totalWarrantyCost;
      const utilidadNeta = utilidadOperativa - totalOpExpenses;
      const utilidadNetaPct = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;
      const avgTicket = unitsSoldInPeriod > 0 ? Math.round(totalIngresos / unitsSoldInPeriod) : 0;

      // ── 7. EVOLUCIÓN TEMPORAL (TREND TIMELINE CHART) ───────────────────
      const timelineMap: Record<string, { date: string; label: string; ingresos: number; cogs: number; gastos: number; utilidadNeta: number }> = {};
      
      // Agrupar por día
      for (const sale of soldUnitsDetail) {
        const d = safeDateStr(sale.saleDate);
        if (!timelineMap[d]) {
          timelineMap[d] = { date: d, label: d.substring(5), ingresos: 0, cogs: 0, gastos: 0, utilidadNeta: 0 };
        }
        timelineMap[d].ingresos += sale.salePrice;
        timelineMap[d].cogs += sale.purchasePrice;
        timelineMap[d].utilidadNeta += sale.grossMargin;
      }
      for (const exp of opExpenses) {
        const d = safeDateStr(exp.expenseDate || exp.createdAt);
        if (!timelineMap[d]) {
          timelineMap[d] = { date: d, label: d.substring(5), ingresos: 0, cogs: 0, gastos: 0, utilidadNeta: 0 };
        }
        timelineMap[d].gastos += (exp.amount || 0);
        timelineMap[d].utilidadNeta -= (exp.amount || 0);
      }

      const timelineData = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

      // ── 8. RANKING POR MARCA ──────────────────────────────────────────
      const brandRanking = Object.values(brandStats)
        .map(b => ({
          ...b,
          margenBrutoPct: b.cogs > 0 ? Math.round((b.margenBruto / b.cogs) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.margenBruto - a.margenBruto);

      // ── 9. DESGLOSE DE GASTOS POR CATEGORÍA ────────────────────────────
      const expensesByCategory: Record<string, number> = {};
      for (const e of opExpenses) {
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
      }

      // ── 10. INVENTARIO ACTUAL DISPONIBLE ────────────────────────────────
      const availableUnits = (allUnits as any[]).filter((u: any) => {
        if (u.status !== "available") return false;
        if (branchId && (u.branchId || 1) !== branchId) return false;
        if (brandFilter && (u.brand || "").toLowerCase().trim() !== brandFilter) return false;
        return true;
      });
      const inventoryValue = availableUnits.reduce((s: number, u: any) => s + (u.purchasePrice || 0), 0);
      const inventoryPotentialRevenue = availableUnits.reduce((s: number, u: any) => s + (u.salePrice || 0), 0);

      return {
        period: {
          periodType: period,
          label: periodLabel,
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
        // P&L
        totalIngresos,
        totalCOGS,
        margenBruto,
        margenBrutoPct: Math.round(margenBrutoPct * 10) / 10,
        totalRepairCost,
        totalWarrantyCost,
        utilidadOperativa,
        totalOpExpenses,
        utilidadNeta,
        utilidadNetaPct: Math.round(utilidadNetaPct * 10) / 10,
        // Inventario y ventas
        unitsSoldInPeriod,
        avgTicket,
        availableUnitsCount: availableUnits.length,
        inventoryValue,
        inventoryPotentialRevenue,
        inventoryPotentialMargin: inventoryPotentialRevenue - inventoryValue,
        // Desgloses y Gráficos
        expensesByCategory,
        timelineData,
        brandRanking,
        methodStats,
        soldUnitsDetail: soldUnitsDetail.sort((a, b) => b.grossMargin - a.grossMargin),
        repairsDetail: repairsDetail.sort((a: any, b: any) => b.totalCost - a.totalCost),
        expensesDetail: expensesDetail.sort((a: any, b: any) => b.amount - a.amount),
        transactionsDetail: transactionsDetail.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };
    }),

  // ─── NEW: Operational Alerts ─────────────────────────────────────────────
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const now = new Date();
    const units = await getAllUnits();

    // Equipos en taller más de 7 días
    const stuckInRepair = (MOCK_REPAIRS as any[])
      .filter((r: any) => {
        if (r.status !== "in_progress") return false;
        return Math.floor((now.getTime() - new Date(r.startDate).getTime()) / 86400000) >= 7;
      })
      .map((r: any) => {
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === r.unitId);
        const d = Math.floor((now.getTime() - new Date(r.startDate).getTime()) / 86400000);
        return {
          type: "stuck_repair" as const,
          severity: d >= 14 ? "high" : "medium",
          otNumber: r.otNumber || r.rmaNumber || `#${r.id}`,
          unitCode: unit?.code || "—", unitBrand: unit?.brand || "—", unitModel: unit?.model || "—",
          daysSince: d, startDate: r.startDate,
          message: `${unit?.brand || "Equipo"} ${unit?.model || ""} lleva ${d} días en taller`,
        };
      });

    // Garantías que vencen en 3 días
    const expiringWarranties = (MOCK_WARRANTIES as any[])
      .filter((w: any) => {
        if (w.status !== "active" || !w.endDate) return false;
        const dl = Math.ceil((new Date(w.endDate).getTime() - now.getTime()) / 86400000);
        return dl >= 0 && dl <= 3;
      })
      .map((w: any) => {
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === w.unitId);
        const dl = Math.ceil((new Date(w.endDate).getTime() - now.getTime()) / 86400000);
        return {
          type: "warranty_expiring" as const,
          severity: dl === 0 ? "high" : "medium",
          warrantyId: w.id,
          unitCode: unit?.code || "—", unitBrand: unit?.brand || "—", unitModel: unit?.model || "—",
          daysLeft: dl, endDate: w.endDate,
          message: dl === 0
            ? `Garantía de ${unit?.brand || "equipo"} ${unit?.model || ""} vence HOY`
            : `Garantía de ${unit?.brand || ""} ${unit?.model || ""} vence en ${dl} día${dl !== 1 ? "s" : ""}`,
        };
      });

    // Devoluciones sin resolución
    const pendingReturns = (MOCK_RETURNS as any[])
      .filter((r: any) => {
        if (r.reenteredRepair) return false;
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === r.unitId);
        return unit?.status === "returned";
      })
      .map((r: any) => {
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === r.unitId);
        const d = Math.floor((now.getTime() - new Date(r.returnDate).getTime()) / 86400000);
        return {
          type: "pending_return" as const,
          severity: d >= 3 ? "high" : "medium",
          returnId: r.id,
          unitCode: unit?.code || "—", unitBrand: unit?.brand || "—", unitModel: unit?.model || "—",
          daysSince: d, returnDate: r.returnDate, reason: r.reason,
          message: `Devolución de ${unit?.brand || ""} ${unit?.model || ""} sin resolución hace ${d} día${d !== 1 ? "s" : ""}`,
        };
      });

    // Equipos en diagnóstico más de 3 días
    const stuckDiagnosis = (units as any[])
      .filter((u: any) => {
        if (u.status !== "in_diagnosis") return false;
        return Math.floor((now.getTime() - new Date(u.updatedAt || u.createdAt).getTime()) / 86400000) >= 3;
      })
      .map((u: any) => {
        const d = Math.floor((now.getTime() - new Date(u.updatedAt || u.createdAt).getTime()) / 86400000);
        return {
          type: "stuck_diagnosis" as const,
          severity: d >= 7 ? "high" : "medium",
          unitId: u.id, unitCode: u.code || "—", unitBrand: u.brand || "—", unitModel: u.model || "—",
          daysSince: d,
          message: `${u.brand || "Equipo"} ${u.model || ""} lleva ${d} días en diagnóstico`,
        };
      });

    const all = [...stuckInRepair, ...expiringWarranties, ...pendingReturns, ...stuckDiagnosis]
      .sort((a, b) => (a.severity === "high" ? -1 : 1));

    return { total: all.length, high: all.filter(a => a.severity === "high").length, alerts: all };
  }),
});

// ─── helpers ────────────────────────────────────────────────────────────────

function computeDateRange(period?: string, from?: string, to?: string) {
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);

  if (period === "custom" && from && to) {
    startDate = new Date(from + "T00:00:00");
    endDate = new Date(to + "T23:59:59");
    return {
      startDate,
      endDate,
      label: `Del ${startDate.toLocaleDateString("es-BO")} al ${endDate.toLocaleDateString("es-BO")}`,
    };
  }

  switch (period) {
    case "today":
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate, label: "Hoy" };
    case "week":
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, label: "Últimos 7 días" };
    case "month":
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, label: "Este mes" };
    case "last_month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { startDate, endDate, label: "Mes anterior" };
    case "quarter":
      startDate.setMonth(startDate.getMonth() - 3, 1);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, label: "Último trimestre" };
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      return { startDate, endDate, label: `Año ${now.getFullYear()}` };
    case "all":
      startDate = new Date(2020, 0, 1);
      return { startDate, endDate, label: "Todo el histórico" };
    default:
      if (from && to) {
        startDate = new Date(from + "T00:00:00");
        endDate = new Date(to + "T23:59:59");
        return { startDate, endDate, label: `Del ${from} al ${to}` };
      }
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, label: "Este mes" };
  }
}

function getPeriodStart(now: Date, period: string): Date {
  const d = new Date(now);
  switch (period) {
    case "week":
      d.setDate(d.getDate() - 7);
      break;
    case "month":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
    case "quarter":
      d.setMonth(d.getMonth() - 3, 1);
      d.setHours(0, 0, 0, 0);
      break;
    case "year":
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      break;
    default:
      d.setFullYear(2000);
  }
  return d;
}
