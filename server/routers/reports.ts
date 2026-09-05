import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc.js";
import {
  getDb,
  MOCK_CUSTOMERS,
  MOCK_OPERATIONAL_EXPENSES,
  MOCK_ORDERS,
  MOCK_ORDER_ITEMS,
  MOCK_PURCHASES,
  MOCK_PURCHASE_ITEMS,
  MOCK_SUPPLIERS,
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
  purchaseItems,
  suppliers,
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

  // Reporte de Compras
  purchasesReport: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      supplierId: z.number().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        let list = MOCK_PURCHASES || [];
        if (input?.startDate) {
          list = list.filter((p: any) => new Date(p.orderDate || p.createdAt) >= new Date(input.startDate!));
        }
        if (input?.endDate) {
          list = list.filter((p: any) => new Date(p.orderDate || p.createdAt) <= new Date(input.endDate! + " 23:59:59"));
        }
        if (input?.supplierId) {
          list = list.filter((p: any) => p.supplierId === input.supplierId);
        }
        if (input?.status) {
          list = list.filter((p: any) => p.status === input.status);
        }
        return list.map((p: any) => {
          const supplier = (MOCK_SUPPLIERS || []).find((s: any) => s.id === p.supplierId);
          return {
            ...p,
            supplier: supplier || { name: "Proveedor General" },
            items: [],
          };
        });
      }

      let conditions: any[] = [];
      if (input?.startDate) {
        conditions.push(gte(purchases.orderDate, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(purchases.orderDate, new Date(input.endDate + " 23:59:59")));
      }
      if (input?.supplierId) {
        conditions.push(eq(purchases.supplierId, input.supplierId));
      }
      if (input?.status) {
        conditions.push(eq(purchases.status, input.status as any));
      }

      const purchaseList = await db
        .select({
          id: purchases.id,
          purchaseNumber: purchases.purchaseNumber,
          orderDate: purchases.orderDate,
          totalAmount: purchases.totalAmount,
          status: purchases.status,
          paymentStatus: purchases.paymentStatus,
          paymentMethod: purchases.paymentMethod,
          isCredit: purchases.isCredit,
          branchId: purchases.branchId,
          createdAt: purchases.createdAt,
          supplierId: purchases.supplierId,
          supplierName: suppliers.name,
          supplierPhone: suppliers.phone,
        })
        .from(purchases)
        .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(purchases.orderDate));

      const purchaseIds = purchaseList.map((p: any) => p.id);
      let itemsByPurchase = new Map<number, any[]>();

      if (purchaseIds.length > 0) {
        const rawItems = await db
          .select({
            id: purchaseItems.id,
            purchaseId: purchaseItems.purchaseId,
            quantity: purchaseItems.quantity,
            price: purchaseItems.price,
            unitCode: units.code,
            unitBrand: units.brand,
            unitModel: units.model,
          })
          .from(purchaseItems)
          .leftJoin(units, eq(purchaseItems.unitId, units.id))
          .where(sql`${purchaseItems.purchaseId} IN (${sql.join(purchaseIds, sql`, `)})`);

        rawItems.forEach((item: any) => {
          const list = itemsByPurchase.get(item.purchaseId) || [];
          list.push(item);
          itemsByPurchase.set(item.purchaseId, list);
        });
      }

      return purchaseList.map((p: any) => ({
        ...p,
        supplier: {
          name: p.supplierName || "Proveedor General",
          phone: p.supplierPhone || "-",
        },
        items: itemsByPurchase.get(p.id) || [],
      }));
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

  // Reporte integral de inventario (unidades, taller, valuación, marcas y rotación)
  inventoryReport: protectedProcedure.query(async () => {
    const db = await getDb();
    let allUnits: any[] = [];
    let allRepairs: any[] = [];
    let allPurchases: any[] = [];

    if (!db) {
      allUnits = (MOCK_UNITS as any[]) || [];
      allRepairs = (MOCK_REPAIRS as any[]) || [];
      allPurchases = (MOCK_PURCHASES as any[]) || [];
    } else {
      [allUnits, allRepairs, allPurchases] = await Promise.all([
        db.select().from(units),
        db.select().from(repairs),
        db.select().from(purchases),
      ]);
    }

    const purchaseMap = new Map<number, any>();
    allPurchases.forEach((p: any) => purchaseMap.set(p.id, p));

    allUnits = allUnits.map((u: any) => {
      const p = u.purchaseId ? purchaseMap.get(u.purchaseId) : null;
      const effectivePurchaseDate = u.purchaseDate || (p ? (p.orderDate || p.createdAt) : u.createdAt);
      return {
        ...u,
        purchaseDate: effectivePurchaseDate,
        purchaseNumber: p?.purchaseNumber || null,
      };
    });

    const todayMs = Date.now();

    // Mapeo de costos de taller por unidad
    const repairCostMap = new Map<number, { laborCost: number; partsCost: number; totalRepairCost: number; activeOT?: string; activeStatus?: string; startDate?: Date }>();
    allRepairs.forEach((r: any) => {
      const uId = r.unitId;
      if (!uId) return;
      const prev = repairCostMap.get(uId) || { laborCost: 0, partsCost: 0, totalRepairCost: 0 };
      const labor = Number(r.laborCost || 0);
      const parts = Number(r.partsCost || 0);
      const total = labor + parts;
      prev.laborCost += labor;
      prev.partsCost += parts;
      prev.totalRepairCost += total;
      if (r.status === "in_progress") {
        prev.activeOT = r.otNumber || `OT-#${r.id}`;
        prev.activeStatus = r.status;
        prev.startDate = r.startDate ? new Date(r.startDate) : new Date(r.createdAt);
      }
      repairCostMap.set(uId, prev);
    });

    // Unidades disponibles para la venta
    const availableUnits = allUnits.filter((u: any) => u.status === "available");
    const availableCostCents = availableUnits.reduce((sum: number, u: any) => sum + (Number(u.purchasePrice) || 0), 0);
    const availableSaleValueCents = availableUnits.reduce((sum: number, u: any) => sum + (Number(u.salePrice) || 0), 0);
    const availablePotentialProfitCents = Math.max(0, availableSaleValueCents - availableCostCents);
    const availableMarginPct = availableCostCents > 0 ? (availablePotentialProfitCents / availableCostCents) * 100 : 0;

    // Unidades en taller (reparación o diagnóstico)
    const workshopUnits = allUnits.filter((u: any) => ["in_repair", "in_diagnosis"].includes(u.status));
    const workshopUnitsCostCents = workshopUnits.reduce((sum: number, u: any) => sum + (Number(u.purchasePrice) || 0), 0);

    let workshopLaborCostCents = 0;
    let workshopPartsCostCents = 0;

    const workshopDetail = workshopUnits.map((u: any) => {
      const rep = repairCostMap.get(u.id);
      const labor = rep?.laborCost || 0;
      const parts = rep?.partsCost || 0;
      const repairCost = labor + parts;
      workshopLaborCostCents += labor;
      workshopPartsCostCents += parts;
      const purchasePrice = Number(u.purchasePrice || 0);
      const totalTiedCapital = purchasePrice + repairCost;
      const startDate = rep?.startDate || (u.updatedAt ? new Date(u.updatedAt) : new Date(u.createdAt));
      const daysInWorkshop = Math.max(0, Math.floor((todayMs - startDate.getTime()) / 86400000));

      return {
        id: u.id,
        code: u.code || `UNI-${u.id}`,
        brand: u.brand || "—",
        model: u.model || "—",
        type: u.type || "other",
        status: u.status,
        otNumber: rep?.activeOT || "—",
        purchasePrice,
        repairCost,
        totalTiedCapital,
        daysInWorkshop,
      };
    });

    const workshopTotalTiedCapitalCents = workshopUnitsCostCents + workshopLaborCostCents + workshopPartsCostCents;

    // Unidades vendidas
    const soldUnits = allUnits.filter((u: any) => u.status === "sold");
    const soldCostCents = soldUnits.reduce((sum: number, u: any) => sum + (Number(u.purchasePrice) || 0), 0);
    const soldRevenueCents = soldUnits.reduce((sum: number, u: any) => sum + (Number(u.salePrice) || 0), 0);

    // Unidades en garantía activa
    const inWarrantyUnits = allUnits.filter((u: any) => u.warrantyStatus === "active" || (u.warrantyMonths && u.warrantyMonths > 0 && u.status !== "scrapped"));

    // Desglose por Estado
    const STATUS_LABELS: Record<string, string> = {
      available: "Disponible para Venta",
      in_repair: "En Taller (Reparación)",
      in_diagnosis: "En Diagnóstico",
      sold: "Vendido",
      reserved: "Reservado",
      returned: "Devuelto / En Garantía",
      scrapped: "Baja / Desecho",
    };

    const byStatusMap = new Map<string, { count: number; costCents: number; saleValueCents: number }>();
    allUnits.forEach((u: any) => {
      const st = u.status || "unknown";
      const curr = byStatusMap.get(st) || { count: 0, costCents: 0, saleValueCents: 0 };
      curr.count += 1;
      curr.costCents += Number(u.purchasePrice || 0);
      curr.saleValueCents += Number(u.salePrice || 0);
      byStatusMap.set(st, curr);
    });

    const byStatus = Array.from(byStatusMap.entries()).map(([statusKey, val]) => ({
      statusKey,
      label: STATUS_LABELS[statusKey] || statusKey,
      count: val.count,
      pctOfTotal: allUnits.length > 0 ? Math.round((val.count / allUnits.length) * 1000) / 10 : 0,
      costCents: val.costCents,
      saleValueCents: val.saleValueCents,
    }));

    // Desglose por Tipo de Equipo (Categoría)
    const TYPE_LABELS: Record<string, string> = {
      laptop: "Laptops / Portátiles",
      tablet: "Tablets",
      phone: "Celulares / Teléfonos",
      monitor: "Monitores / Pantallas",
      charger: "Cargadores y Fuentes",
      accessory: "Accesorios y Periféricos",
      other: "Otros Equipos",
    };

    const byTypeMap = new Map<string, { totalCount: number; availableCount: number; workshopCount: number; costCents: number; saleValueCents: number }>();
    allUnits.forEach((u: any) => {
      const t = u.type || "other";
      const curr = byTypeMap.get(t) || { totalCount: 0, availableCount: 0, workshopCount: 0, costCents: 0, saleValueCents: 0 };
      curr.totalCount += 1;
      if (u.status === "available") {
        curr.availableCount += 1;
        curr.costCents += Number(u.purchasePrice || 0);
        curr.saleValueCents += Number(u.salePrice || 0);
      } else if (["in_repair", "in_diagnosis"].includes(u.status)) {
        curr.workshopCount += 1;
      }
      byTypeMap.set(t, curr);
    });

    const byType = Array.from(byTypeMap.entries()).map(([typeKey, val]) => {
      const potentialProfit = Math.max(0, val.saleValueCents - val.costCents);
      const marginPct = val.costCents > 0 ? Math.round((potentialProfit / val.costCents) * 1000) / 10 : 0;
      return {
        typeKey,
        label: TYPE_LABELS[typeKey] || typeKey,
        totalCount: val.totalCount,
        availableCount: val.availableCount,
        workshopCount: val.workshopCount,
        costCents: val.costCents,
        saleValueCents: val.saleValueCents,
        potentialProfitCents: potentialProfit,
        marginPct,
      };
    }).sort((a, b) => b.costCents - a.costCents);

    // Desglose por Marca (para stock disponible)
    const brandMap = new Map<string, { availableCount: number; costCents: number; saleValueCents: number }>();
    availableUnits.forEach((u: any) => {
      const b = (u.brand || "Sin marca").trim();
      const curr = brandMap.get(b) || { availableCount: 0, costCents: 0, saleValueCents: 0 };
      curr.availableCount += 1;
      curr.costCents += Number(u.purchasePrice || 0);
      curr.saleValueCents += Number(u.salePrice || 0);
      brandMap.set(b, curr);
    });

    const byBrand = Array.from(brandMap.entries()).map(([brand, val]) => {
      const profit = Math.max(0, val.saleValueCents - val.costCents);
      const marginPct = val.costCents > 0 ? Math.round((profit / val.costCents) * 1000) / 10 : 0;
      return {
        brand,
        availableCount: val.availableCount,
        costCents: val.costCents,
        saleValueCents: val.saleValueCents,
        potentialProfitCents: profit,
        marginPct,
      };
    }).sort((a, b) => b.costCents - a.costCents);

    // Análisis de Antigüedad (Aging de inventario no vendido)
    const unsoldUnits = allUnits.filter((u: any) => u.status !== "sold");
    let totalDaysSum = 0;
    const agingBuckets = {
      fresh: { label: "0 - 30 días (Rotación Rápida)", count: 0, costCents: 0, saleValueCents: 0 },
      normal: { label: "31 - 60 días (Stock Normal)", count: 0, costCents: 0, saleValueCents: 0 },
      attention: { label: "61 - 90 días (Atención / Observación)", count: 0, costCents: 0, saleValueCents: 0 },
      aging: { label: "+90 días (Inmovilizado / Envejecido)", count: 0, costCents: 0, saleValueCents: 0 },
    };

    unsoldUnits.forEach((u: any) => {
      const purchaseDate = u.purchaseDate ? new Date(u.purchaseDate) : new Date(u.createdAt);
      const days = Math.max(0, Math.floor((todayMs - purchaseDate.getTime()) / 86400000));
      totalDaysSum += days;

      const pCost = Number(u.purchasePrice || 0);
      const sVal = Number(u.salePrice || 0);

      if (days <= 30) {
        agingBuckets.fresh.count++;
        agingBuckets.fresh.costCents += pCost;
        agingBuckets.fresh.saleValueCents += sVal;
      } else if (days <= 60) {
        agingBuckets.normal.count++;
        agingBuckets.normal.costCents += pCost;
        agingBuckets.normal.saleValueCents += sVal;
      } else if (days <= 90) {
        agingBuckets.attention.count++;
        agingBuckets.attention.costCents += pCost;
        agingBuckets.attention.saleValueCents += sVal;
      } else {
        agingBuckets.aging.count++;
        agingBuckets.aging.costCents += pCost;
        agingBuckets.aging.saleValueCents += sVal;
      }
    });

    const avgDaysInStock = unsoldUnits.length > 0 ? Math.round(totalDaysSum / unsoldUnits.length) : 0;

    const stats = {
      total: allUnits.length,
      availableCount: availableUnits.length,
      availableCostCents,
      availableSaleValueCents,
      availablePotentialProfitCents,
      availableMarginPct: Math.round(availableMarginPct * 10) / 10,
      
      // Taller
      workshopCount: workshopUnits.length,
      inRepairCount: allUnits.filter((u: any) => u.status === "in_repair").length,
      inDiagnosisCount: allUnits.filter((u: any) => u.status === "in_diagnosis").length,
      workshopUnitsCostCents,
      workshopLaborCostCents,
      workshopPartsCostCents,
      workshopTotalTiedCapitalCents,
      workshopDetail,

      // Ventas y Garantías
      soldCount: soldUnits.length,
      soldCostCents,
      soldRevenueCents,
      inWarrantyCount: inWarrantyUnits.length,

      // Antigüedad y Desgloses
      avgDaysInStock,
      agingBuckets,
      byStatus,
      byType,
      byBrand,

      // Retrocompatibilidad con campos previos
      totalCost: availableCostCents,
      totalSaleValue: availableSaleValueCents,
      potentialProfit: availablePotentialProfitCents,
      inRepair: workshopUnits.length,
      inWarranty: inWarrantyUnits.length,
      byStatusMap: Object.fromEntries(byStatusMap),
      byTypeMap: Object.fromEntries(byTypeMap),
    };

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
      let purchaseList: any[] = [];

      if (!db) {
        unitList = (MOCK_UNITS as any[]).filter((u: any) => u.status !== "sold" && new Date(u.createdAt) <= cutoff);
        repairList = (MOCK_REPAIRS as any[]).filter((r: any) => r.status === "completed");
        purchaseList = (MOCK_PURCHASES as any[]) || [];
      } else {
        [unitList, repairList, purchaseList] = await Promise.all([
          db.select().from(units).where(and(ne(units.status, "sold"), lte(units.createdAt, cutoff))),
          db.select({ unitId: repairs.unitId, laborCost: repairs.laborCost, partsCost: repairs.partsCost })
            .from(repairs).where(eq(repairs.status, "completed")),
          db.select().from(purchases),
        ]);
      }

      const purchaseMap = new Map<number, any>();
      for (const p of purchaseList as any[]) purchaseMap.set(p.id, p);

      const repMap = new Map<number, number>();
      for (const r of repairList as any[]) repMap.set(r.unitId, (repMap.get(r.unitId)||0)+(r.laborCost||0)+(r.partsCost||0));

      const today = cutoff.getTime();
      const headers = ["Código", "Marca", "Modelo", "Tipo", "Estado", "Cond.", "Fecha de Compra", "P. Compra (Bs)", "Costo Reparación (Bs)", "Costo Total (Bs)", "P. Venta (Bs)", "Días en Inventario", "Fecha Registro"];
      const rows = (unitList as any[]).map((u: any) => {
        const repCost = repMap.get(u.id) || 0;
        const p = u.purchaseId ? purchaseMap.get(u.purchaseId) : null;
        const rawDate = u.purchaseDate || (p ? (p.orderDate || p.createdAt) : u.createdAt);
        const pDate = rawDate ? new Date(rawDate) : null;
        const days = Math.max(0, Math.round((today - new Date(u.createdAt).getTime()) / 86400000));
        return [
          u.code, u.brand, u.model, u.type, u.status, u.condition || "—",
          pDate && !isNaN(pDate.getTime()) ? pDate.toLocaleDateString("es-BO") : "—",
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

  /**
   * Reporte de Compras del período en Excel
   */
  purchasesExcel: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const fromDate = new Date(input.from + "T00:00:00");
      const toDate   = new Date(input.to   + "T23:59:59");

      let purchaseList: any[] = [];

      if (!db) {
        purchaseList = (MOCK_PURCHASES || []).filter((p: any) => {
          const d = new Date(p.orderDate || p.createdAt);
          return d >= fromDate && d <= toDate;
        }).map((p: any) => {
          const supplier = (MOCK_SUPPLIERS || []).find((s: any) => s.id === p.supplierId);
          return { ...p, supplierName: supplier?.name || "Proveedor General" };
        });
      } else {
        purchaseList = await db
          .select({
            id: purchases.id,
            purchaseNumber: purchases.purchaseNumber,
            orderDate: purchases.orderDate,
            totalAmount: purchases.totalAmount,
            status: purchases.status,
            paymentStatus: purchases.paymentStatus,
            paymentMethod: purchases.paymentMethod,
            isCredit: purchases.isCredit,
            createdAt: purchases.createdAt,
            supplierName: suppliers.name,
          })
          .from(purchases)
          .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
          .where(and(gte(purchases.orderDate, fromDate), lte(purchases.orderDate, toDate)))
          .orderBy(desc(purchases.orderDate));
      }

      const headers = ["Nº Compra", "Proveedor", "Fecha de Compra", "Estado", "Método Pago", "Estado Pago", "A Crédito", "Total (Bs)"];
      const rows = (purchaseList as any[]).map((p: any) => [
        p.purchaseNumber,
        p.supplierName || "Proveedor General",
        new Date(p.orderDate || p.createdAt).toLocaleString("es-BO"),
        p.status === "received" ? "Recibido" : p.status === "cancelled" ? "Cancelado" : "Pendiente",
        p.paymentMethod || "Efectivo",
        p.paymentStatus === "paid" ? "Pagado" : "Pendiente",
        p.isCredit ? "Sí" : "No",
        fmtCents(p.totalAmount || 0),
      ]);

      const totalMonto = (purchaseList as any[]).reduce((s: number, p: any) => s + (p.totalAmount || 0), 0);
      const totalPagado = (purchaseList as any[]).filter((p: any) => p.paymentStatus === "paid").reduce((s: number, p: any) => s + (p.totalAmount || 0), 0);
      const totalPendiente = totalMonto - totalPagado;

      const summary = [
        [dateHeader(input.from, input.to)],
        [],
        ["Total órdenes de compra", purchaseList.length],
        ["Total compras (Bs)", fmtCents(totalMonto)],
        ["Total pagado (Bs)", fmtCents(totalPagado)],
        ["Saldo pendiente / Crédito (Bs)", fmtCents(totalPendiente)],
      ];

      const base64 = buildXlsx([
        { name: "Compras", data: [headers, ...rows] },
        { name: "Resumen", data: summary },
      ]);

      return { base64, filename: `Compras_${input.from}_${input.to}.xlsx` };
    }),
});
