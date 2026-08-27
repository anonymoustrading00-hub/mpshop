import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc.js";
import {
  getDb,
  MOCK_CUSTOMERS,
  MOCK_OPERATIONAL_EXPENSES,
  MOCK_ORDERS,
  MOCK_ORDER_ITEMS,
  MOCK_PURCHASES,
  MOCK_SALES,
  MOCK_SALE_ITEMS,
} from "../db.js";
import {
  orders,
  customers,
  sales,
  financialTransactions,
  cashClosures,
  users,
  operationalExpenses,
  purchases,
  orderItems,
  saleItems,
  units,
  unitEvents,
  repairs,
  returns,
  generatedCodes,
  warranties,
} from "../../drizzle/schema";
import { desc, eq, and, gte, lte, lt, sql, ne } from "drizzle-orm";

export const reportsRouter = router({
  // Reporte de Pedidos
  ordersReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.string().optional(),
      customerId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let conditions: any[] = [];

      if (input?.startDate) {
        conditions.push(gte(orders.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(orders.createdAt, new Date(input.endDate + " 23:59:59")));
      }
      if (input?.status) {
        conditions.push(eq(orders.status, input.status as any));
      }
      if (input?.customerId) {
        conditions.push(eq(orders.customerId, input.customerId));
      }

      const result = await db.query.orders.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          customer: true,
          deliveryPerson: true,
          items: true,
          payments: true,
        },
        orderBy: [desc(orders.createdAt)],
      });

      return result;
    }),

  // Reporte de Ventas
  salesReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      soldBy: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let conditions: any[] = [];

      if (input?.startDate) {
        conditions.push(gte(sales.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(sales.createdAt, new Date(input.endDate + " 23:59:59")));
      }
      if (input?.soldBy) {
        conditions.push(eq(sales.soldBy, input.soldBy));
      }

      const result = await db.query.sales.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          customer: true,
          seller: true,
          items: true,
        },
        orderBy: [desc(sales.createdAt)],
      });

      return result;
    }),

  // KPIs específicos para Electrónica Reacondicionada y Reparaciones
  electronicsKpis: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        unitMargins: [],
        marginByBrand: [],
        avgInventoryDays: 0,
        avgRepairHours: 0,
        returnRatePercentage: 0,
        totalWarrantyCostCents: 0,
        codesStats: { generated: 0, assigned: 0, unassigned: 0 },
      };
    }

    // 1. Unidades vendidas (márgenes)
    const soldUnits = await db
      .select({
        id: units.id,
        code: units.code,
        brand: units.brand,
        model: units.model,
        purchasePrice: units.purchasePrice,
        salePrice: units.salePrice,
        supplierId: units.supplierId,
        createdAt: units.createdAt,
      })
      .from(units)
      .where(eq(units.status, "sold"));

    const unitMargins = soldUnits.map((u: any) => {
      const pPrice = u.purchasePrice || 0;
      const sPrice = u.salePrice || 0;
      const marginCents = sPrice - pPrice;
      const marginPct = pPrice > 0 ? Math.round((marginCents / pPrice) * 100) : 0;
      return {
        id: u.id,
        code: u.code,
        brand: u.brand,
        model: u.model,
        purchasePrice: pPrice,
        salePrice: sPrice,
        marginCents,
        marginPct,
      };
    });

    // Agrupado por marca
    const brandMap = new Map<string, { totalRevenue: number; totalCost: number; count: number }>();
    soldUnits.forEach((u: any) => {
      const b = u.brand || "Sin marca";
      const curr = brandMap.get(b) || { totalRevenue: 0, totalCost: 0, count: 0 };
      curr.totalRevenue += u.salePrice || 0;
      curr.totalCost += u.purchasePrice || 0;
      curr.count += 1;
      brandMap.set(b, curr);
    });

    const marginByBrand = Array.from(brandMap.entries()).map(([brand, data]) => ({
      brand,
      count: data.count,
      marginCents: data.totalRevenue - data.totalCost,
      marginPct: data.totalCost > 0 ? Math.round(((data.totalRevenue - data.totalCost) / data.totalCost) * 100) : 0,
    }));

    // 2. Rotación de inventario (días promedio)
    const soldEvents = await db
      .select({
        unitId: unitEvents.unitId,
        soldAt: unitEvents.createdAt,
      })
      .from(unitEvents)
      .where(eq(unitEvents.toStatus, "sold"));

    let totalDaysSum = 0;
    let rotationCount = 0;

    soldEvents.forEach((ev: any) => {
      const matchedUnit = soldUnits.find((u: any) => u.id === ev.unitId);
      if (matchedUnit && matchedUnit.createdAt && ev.soldAt) {
        const diffMs = new Date(ev.soldAt).getTime() - new Date(matchedUnit.createdAt).getTime();
        const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        totalDaysSum += diffDays;
        rotationCount++;
      }
    });

    const avgInventoryDays = rotationCount > 0 ? Math.round(totalDaysSum / rotationCount) : 0;

    // 3. Tiempo promedio en taller
    const completedRepairs = await db
      .select()
      .from(repairs)
      .where(eq(repairs.status, "completed"));

    let totalRepairHoursSum = 0;
    let repairCount = 0;
    let totalWarrantyCostCents = 0;

    completedRepairs.forEach((rep: any) => {
      totalWarrantyCostCents += (rep.laborCost || 0) + (rep.partsCost || 0);
      if (rep.startDate && rep.endDate) {
        const diffMs = new Date(rep.endDate).getTime() - new Date(rep.startDate).getTime();
        const hours = Math.max(0, diffMs / (1000 * 60 * 60));
        totalRepairHoursSum += hours;
        repairCount++;
      }
    });

    const avgRepairHours = repairCount > 0 ? Math.round(totalRepairHoursSum / repairCount) : 0;

    // 4. Tasa de devolución
    const totalReturnsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(returns);

    const returnsNum = Number(totalReturnsCount[0]?.count || 0);
    const soldNum = soldUnits.length;
    const returnRatePercentage = soldNum > 0 ? Number(((returnsNum / soldNum) * 100).toFixed(1)) : 0;

    // 5. Estadísticas de Códigos (generados vs asignados)
    const codeCounts = await db
      .select({
        status: generatedCodes.status,
        count: sql<number>`count(*)`,
      })
      .from(generatedCodes)
      .groupBy(generatedCodes.status);

    let assigned = 0;
    let unassigned = 0;
    codeCounts.forEach((c: any) => {
      if (c.status === "assigned") assigned = Number(c.count);
      if (c.status === "unassigned") unassigned = Number(c.count);
    });

    return {
      unitMargins,
      marginByBrand,
      avgInventoryDays,
      avgRepairHours,
      returnRatePercentage,
      totalWarrantyCostCents,
      codesStats: {
        generated: assigned + unassigned,
        assigned,
        unassigned,
      },
    };
  }),

  // Reporte mejorado de inventario (unidades)
  inventoryReport: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        units: [],
        stats: {
          total: 0,
          byStatus: {},
          byType: {},
          totalCost: 0,
          totalSaleValue: 0,
          potentialProfit: 0,
          avgDaysInStock: 0,
          inRepair: 0,
          inWarranty: 0,
        },
      };
    }

    const allUnits = await db.select().from(units);

    // Calcular estadísticas
    const stats = {
      total: allUnits.length,
      byStatus: allUnits.reduce((acc: Record<string, number>, u: any) => {
        const status = u.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: allUnits.reduce((acc: Record<string, number>, u: any) => {
        const type = u.type || "other";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalCost: allUnits.reduce((sum: number, u: any) => sum + (u.purchasePrice || 0), 0),
      totalSaleValue: allUnits.filter((u: any) => u.status === "available").reduce((sum: number, u: any) => sum + (u.salePrice || 0), 0),
      potentialProfit: 0,
      avgDaysInStock: 0,
      inRepair: allUnits.filter((u: any) => u.status === "in_repair").length,
      inWarranty: allUnits.filter((u: any) => u.warrantyStatus === "active").length,
    };

    // Calcular ganancia potencial
    stats.potentialProfit = stats.totalSaleValue - allUnits
      .filter((u: any) => u.status === "available")
      .reduce((sum: number, u: any) => sum + (u.purchasePrice || 0), 0);

    // Calcular días promedio en stock (para unidades no vendidas)
    const unsoldUnits = allUnits.filter((u: any) => u.status !== "sold");
    if (unsoldUnits.length > 0) {
      const totalDays = unsoldUnits.reduce((sum: number, u: any) => {
        const purchaseDate = u.purchaseDate ? new Date(u.purchaseDate) : new Date(u.createdAt);
        const daysDiff = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysDiff;
      }, 0);
      stats.avgDaysInStock = Math.round(totalDays / unsoldUnits.length);
    }

    return {
      units: allUnits,
      stats,
    };
  }),

  inventoryMovementsReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(unitEvents);
    }),

  financeReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(financialTransactions);
    }),

  customersReport: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(customers);
  }),
});


// ══════════════════════════════════════════════════════════════════
// EXPORTACIONES EXCEL (usando xlsx ya instalado)
// Devuelven base64 de un workbook .xlsx para descarga en el cliente
// ══════════════════════════════════════════════════════════════════

import * as XLSX from "xlsx";
import {
  MOCK_FINANCIAL_TRANSACTIONS,
  MOCK_UNITS, MOCK_REPAIRS, MOCK_RETURNS, MOCK_WARRANTIES,
} from "../db";
import { TRPCError } from "@trpc/server";

const excelDateInput = z.object({
  from: z.string(), // YYYY-MM-DD
  to:   z.string(), // YYYY-MM-DD
}).optional().default({ from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] });

// ─── helper: construir y serializar workbook ─────────────────────
function buildXlsx(sheets: { name: string; data: any[][] }[]): string {
  const wb = XLSX.utils.book_new();
  for (const { name, data } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
}

function fmtCents(c: number): number { return Math.round(c) / 100; }

function dateHeader(from: string, to: string): string { return `Período: ${from} al ${to}`; }

export const reportsExcelRouter = router({

  /**
   * Reporte Financiero Mensual
   * Hoja 1: Ingresos y egresos por categoría y método de pago
   * Hoja 2: Utilidad neta del período
   */
  financialExcel: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const fromDate = new Date(input.from + "T00:00:00");
      const toDate   = new Date(input.to   + "T23:59:59");

      let txList: any[] = [];
      let opList: any[] = [];

      if (!db) {
        txList = (MOCK_FINANCIAL_TRANSACTIONS as any[]).filter((t: any) => {
          const d = new Date(t.createdAt);
          return d >= fromDate && d <= toDate;
        });
        opList = (MOCK_OPERATIONAL_EXPENSES as any[]).filter((e: any) => {
          const d = new Date(e.createdAt);
          return d >= fromDate && d <= toDate && e.status === "paid";
        });
      } else {
        [txList, opList] = await Promise.all([
          db.select().from(financialTransactions)
            .where(and(gte(financialTransactions.createdAt, fromDate), lte(financialTransactions.createdAt, toDate))),
          db.select().from(operationalExpenses)
            .where(and(eq(operationalExpenses.status, "paid"), gte(operationalExpenses.createdAt, fromDate), lte(operationalExpenses.createdAt, toDate))),
        ]);
      }

      // Hoja 1: Transacciones
      const txHeaders = ["Fecha", "Tipo", "Categoría", "Método Pago", "Monto (Bs)", "Notas"];
      const txRows = txList.map((t: any) => [
        new Date(t.createdAt).toLocaleDateString("es-BO"),
        t.type === "income" ? "Ingreso" : "Egreso",
        t.category,
        t.paymentMethod || "cash",
        fmtCents(t.amount),
        t.notes || "",
      ]);

      const income = txList.filter((t:any)=>t.type==="income").reduce((s:number,t:any)=>s+t.amount,0);
      const expense = txList.filter((t:any)=>t.type==="expense").reduce((s:number,t:any)=>s+t.amount,0);
      const opTotal = opList.reduce((s:number,e:any)=>s+e.amount,0);

      // Hoja 2: Resumen
      const summary = [
        [dateHeader(input.from, input.to)],
        [],
        ["RESUMEN FINANCIERO"],
        ["Total Ingresos (Bs)", fmtCents(income)],
        ["Total Egresos (Bs)", fmtCents(expense)],
        ["Flujo Neto (Bs)", fmtCents(income - expense)],
        [],
        ["Gastos Operativos (Bs)", fmtCents(opTotal)],
        ["Utilidad Neta Est. (Bs)", fmtCents(income - expense - opTotal)],
      ];

      // Hoja 3: Gastos operativos por categoría
      const opByCat = new Map<string, number>();
      for (const e of opList as any[]) opByCat.set(e.category, (opByCat.get(e.category)||0)+e.amount);
      const opRows = [["Categoría", "Total (Bs)"], ...Array.from(opByCat.entries()).map(([cat,amt])=>[cat, fmtCents(amt)])];

      const base64 = buildXlsx([
        { name: "Transacciones", data: [txHeaders, ...txRows] },
        { name: "Resumen", data: summary },
        { name: "Gastos por Categoría", data: opRows },
      ]);

      return { base64, filename: `Reporte_Financiero_${input.from}_${input.to}.xlsx` };
    }),

  /**
   * Reporte de Inventario a fecha de corte
   * Unidades disponibles, costo acumulado, antigüedad
   */
  inventoryExcel: protectedProcedure
    .input(z.object({ cutoffDate: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const cutoff = input.cutoffDate ? new Date(input.cutoffDate + "T23:59:59") : new Date();

      let unitList: any[] = [];
      let repairList: any[] = [];

      if (!db) {
        unitList = (MOCK_UNITS as any[]).filter((u: any) => u.status !== "sold" && new Date(u.createdAt) <= cutoff);
        repairList = (MOCK_REPAIRS as any[]).filter((r: any) => r.status === "completed");
      } else {
        [unitList, repairList] = await Promise.all([
          db.select().from(units).where(and(ne(units.status, "sold"), lte(units.createdAt, cutoff))),
          db.select({ unitId: repairs.unitId, laborCost: repairs.laborCost, partsCost: repairs.partsCost })
            .from(repairs).where(eq(repairs.status, "completed")),
        ]);
      }

      const repMap = new Map<number, number>();
      for (const r of repairList as any[]) repMap.set(r.unitId, (repMap.get(r.unitId)||0)+(r.laborCost||0)+(r.partsCost||0));

      const today = cutoff.getTime();
      const headers = ["Código", "Marca", "Modelo", "Tipo", "Estado", "Cond.", "P. Compra (Bs)", "Costo Reparación (Bs)", "Costo Total (Bs)", "P. Venta (Bs)", "Días en Inventario", "Fecha Registro"];
      const rows = (unitList as any[]).map((u: any) => {
        const repCost = repMap.get(u.id) || 0;
        const days = Math.max(0, Math.round((today - new Date(u.createdAt).getTime()) / 86400000));
        return [
          u.code, u.brand, u.model, u.type, u.status, u.condition || "—",
          fmtCents(u.purchasePrice || 0), fmtCents(repCost),
          fmtCents((u.purchasePrice||0) + repCost),
          fmtCents(u.salePrice || 0), days,
          new Date(u.createdAt).toLocaleDateString("es-BO"),
        ];
      });

      const totalCost = (unitList as any[]).reduce((s:number,u:any)=>s+(u.purchasePrice||0)+(repMap.get(u.id)||0),0);
      const totalSalePotential = (unitList as any[]).reduce((s:number,u:any)=>s+(u.salePrice||0),0);
      const summary = [
        [`Inventario al ${cutoff.toLocaleDateString("es-BO")}`],
        [],
        ["Total unidades", unitList.length],
        ["Costo total inventario (Bs)", fmtCents(totalCost)],
        ["Potencial de venta (Bs)", fmtCents(totalSalePotential)],
        ["Margen potencial (Bs)", fmtCents(totalSalePotential - totalCost)],
      ];

      const base64 = buildXlsx([
        { name: "Inventario", data: [headers, ...rows] },
        { name: "Resumen", data: summary },
      ]);

      return { base64, filename: `Inventario_${cutoff.toISOString().split("T")[0]}.xlsx` };
    }),

  /**
   * Reporte de Garantías y Devoluciones del período
   */
  warrantyReturnsExcel: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const fromDate = new Date(input.from + "T00:00:00");
      const toDate   = new Date(input.to   + "T23:59:59");

      let retList: any[] = [];
      let warList: any[] = [];

      if (!db) {
        retList = (MOCK_RETURNS as any[]).filter((r: any) => {
          const d = new Date(r.returnDate || r.createdAt);
          return d >= fromDate && d <= toDate;
        });
        warList = (MOCK_WARRANTIES as any[]);
      } else {
        [retList, warList] = await Promise.all([
          db.select({
            id: returns.id, unitId: returns.unitId, returnDate: returns.returnDate,
            reason: returns.reason, resolution: returns.resolution,
            reenteredRepair: returns.reenteredRepair, refundAmount: returns.refundAmount,
            unitCode: units.code, unitBrand: units.brand, unitModel: units.model,
          }).from(returns)
            .leftJoin(units, eq(returns.unitId, units.id))
            .where(and(gte(returns.returnDate, fromDate), lte(returns.returnDate, toDate))),
          db.select({
            unitId: warranties.unitId, status: warranties.status,
            days: warranties.days, startDate: warranties.startDate, endDate: warranties.endDate,
            unitCode: units.code, unitBrand: units.brand, unitModel: units.model,
          }).from(warranties)
            .leftJoin(units, eq(warranties.unitId, units.id))
            .where(and(gte(warranties.startDate, fromDate), lte(warranties.startDate, toDate))),
        ]);
      }

      const retHeaders = ["ID", "Código", "Marca", "Modelo", "Fecha Devolución", "Motivo", "Resolución", "Ingresó Taller", "Reembolso (Bs)"];
      const retRows = (retList as any[]).map((r: any) => [
        r.id, r.unitCode||r.unitId, r.unitBrand||"—", r.unitModel||"—",
        new Date(r.returnDate||r.createdAt).toLocaleDateString("es-BO"),
        r.reason, r.resolution||"—",
        r.reenteredRepair ? "Sí" : "No",
        r.refundAmount ? fmtCents(r.refundAmount) : 0,
      ]);

      const warHeaders = ["Código", "Marca", "Modelo", "Estado", "Días", "Inicio", "Vencimiento"];
      const warRows = (warList as any[]).map((w: any) => [
        w.unitCode||w.unitId, w.unitBrand||"—", w.unitModel||"—",
        w.status, w.days,
        new Date(w.startDate).toLocaleDateString("es-BO"),
        new Date(w.endDate).toLocaleDateString("es-BO"),
      ]);

      const totalRefund = (retList as any[]).reduce((s:number,r:any)=>s+(r.refundAmount||0),0);
      const summary = [
        [dateHeader(input.from, input.to)],
        [],
        ["Devoluciones del período", retList.length],
        ["Total reembolsado (Bs)", fmtCents(totalRefund)],
        ["Garantías emitidas en el período", warList.length],
        ["Garantías activas", (warList as any[]).filter((w:any)=>w.status==="active").length],
        ["Garantías reclamadas", (warList as any[]).filter((w:any)=>w.status==="claimed").length],
      ];

      const base64 = buildXlsx([
        { name: "Devoluciones", data: [retHeaders, ...retRows] },
        { name: "Garantías", data: [warHeaders, ...warRows] },
        { name: "Resumen", data: summary },
      ]);

      return { base64, filename: `Garantias_Devoluciones_${input.from}_${input.to}.xlsx` };
    }),
});
