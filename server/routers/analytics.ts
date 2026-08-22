/**
 * Analytics Router â€” KPIs secundarios con filtros de fecha/marca/modelo/tÃ©cnico/vendedor
 * Pantalla de investigaciÃ³n â€” puede ser mÃ¡s lento que Dashboard.
 * Todos los cÃ¡lculos son solo-lectura sobre tablas existentes.
 * Nota sobre gap: returnâ†’technician se resuelve via unitâ†’repairs (join por unitId).
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getDb,
  MOCK_UNITS, MOCK_UNIT_EVENTS, MOCK_SALES, MOCK_SALE_ITEMS,
  MOCK_REPAIRS, MOCK_RETURNS, MOCK_WARRANTIES, MOCK_FINANCIAL_TRANSACTIONS,
  MOCK_OPERATIONAL_EXPENSES, MOCK_ORDERS, MOCK_ACCOUNTS_RECEIVABLE,
  MOCK_PURCHASES, MOCK_USERS,
} from "../db";
import {
  units, saleItems, sales, returns, warranties,
  financialTransactions, operationalExpenses,
  repairs, unitEvents, orders, accountsReceivable, users, purchases,
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql, ne, inArray, isNotNull } from "drizzle-orm";

// â”€â”€â”€ Input schema compartido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const dateRangeInput = z.object({
  from: z.string().optional(), // YYYY-MM-DD, default: inicio mes actual
  to:   z.string().optional(), // YYYY-MM-DD, default: hoy
  brand:        z.string().optional(),
  model:        z.string().optional(),
  supplierId:   z.number().optional(),
  technicianId: z.number().optional(),
  sellerId:     z.number().optional(),
  paymentMethod: z.enum(["cash","qr","transfer"]).optional(),
}).optional();

function getRange(input: any) {
  const now = new Date();
  const from = input?.from
    ? new Date(input.from + "T00:00:00")
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = input?.to
    ? new Date(input.to + "T23:59:59")
    : now;
  return { from, to };
}

function inRange(dateStr: any, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= from && d <= to;
}

function matchesUnit(unit: any, input: any): boolean {
  if (input?.brand && unit.brand?.toLowerCase() !== input.brand.toLowerCase()) return false;
  if (input?.model && unit.model?.toLowerCase() !== input.model.toLowerCase()) return false;
  if (input?.supplierId && unit.supplierId !== input.supplierId) return false;
  return true;
}

export const analyticsRouter = router({

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENTABILIDAD
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /** Margen bruto por unidad (tabla detallada) */
  marginByUnit: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { from, to } = getRange(input);
    const db = await getDb();

    if (!db) {
      const rows: any[] = [];
      for (const si of MOCK_SALE_ITEMS as any[]) {
        const sale = (MOCK_SALES as any[]).find((s: any) => s.id === si.saleId && s.status !== "cancelled");
        if (!sale || !inRange(sale.createdAt, from, to)) continue;
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === si.unitId);
        if (!unit || !matchesUnit(unit, input)) continue;
        const repairCost = (MOCK_REPAIRS as any[])
          .filter((r: any) => r.unitId === unit.id && r.status === "completed")
          .reduce((s: number, r: any) => s + (r.laborCost || 0) + (r.partsCost || 0), 0);
        const warrantyCost = (MOCK_OPERATIONAL_EXPENSES as any[])
          .filter((e: any) => (e.category === "warranty_repair_cost" || e.category === "warranty_replacement_cost") &&
            (MOCK_REPAIRS as any[]).some((r: any) => r.unitId === unit.id && r.id === e.referenceId))
          .reduce((s: number, e: any) => s + (e.amount || 0), 0);
        const grossMargin = (si.finalUnitPrice || 0) - (unit.purchasePrice || 0) - repairCost;
        const netMargin = grossMargin - warrantyCost;
        rows.push({
          unitId: unit.id, code: unit.code, brand: unit.brand, model: unit.model,
          type: unit.type, condition: unit.condition,
          purchasePrice: unit.purchasePrice || 0,
          repairCost, warrantyCost,
          salePrice: si.finalUnitPrice || 0,
          grossMarginCents: grossMargin,
          netMarginCents: netMargin,
          grossMarginPct: unit.purchasePrice > 0 ? Math.round((grossMargin / unit.purchasePrice) * 1000) / 10 : 0,
          saleDate: sale.createdAt,
          sellerName: (MOCK_USERS as any[]).find((u: any) => u.id === sale.soldBy)?.name || "â€”",
        });
      }
      return rows;
    }

    const rows = await db.select({
      unitId: saleItems.unitId,
      code: units.code, brand: units.brand, model: units.model,
      type: units.type, condition: units.condition,
      purchasePrice: units.purchasePrice,
      salePrice: saleItems.finalUnitPrice,
      saleDate: sales.createdAt,
      sellerName: users.name,
    })
      .from(saleItems)
      .innerJoin(sales, and(eq(saleItems.saleId, sales.id), eq(sales.status, "completed"),
        gte(sales.createdAt, from), lte(sales.createdAt, to)))
      .innerJoin(units, eq(saleItems.unitId, units.id))
      .leftJoin(users, eq(sales.soldBy, users.id));

    const filtered = (rows as any[]).filter((r: any) => matchesUnit(r, input));
    const unitIdList = filtered.map((r: any) => r.unitId);

    let repairByUnit = new Map<number, number>();
    let warrantyByUnit = new Map<number, number>();

    if (unitIdList.length > 0) {
      const reps = await db.select({ unitId: repairs.unitId, laborCost: repairs.laborCost, partsCost: repairs.partsCost })
        .from(repairs).where(and(eq(repairs.status, "completed"), inArray(repairs.unitId, unitIdList)));
      for (const r of reps as any[]) {
        repairByUnit.set(r.unitId, (repairByUnit.get(r.unitId) || 0) + (r.laborCost || 0) + (r.partsCost || 0));
      }
      const wExp = await db.select({ referenceId: operationalExpenses.referenceId, amount: operationalExpenses.amount })
        .from(operationalExpenses)
        .where(inArray(operationalExpenses.category, ["warranty_repair_cost", "warranty_replacement_cost"] as any));
      // match warranty costs back to units via repair referenceId
      for (const e of wExp as any[]) {
        // referenceId points to a repair; find that repair's unitId
        for (const [uid] of repairByUnit) {
          warrantyByUnit.set(uid, (warrantyByUnit.get(uid) || 0) + (e.amount || 0));
        }
      }
    }

    return filtered.map((r: any) => {
      const repairCost = repairByUnit.get(r.unitId) || 0;
      const warrantyCost = warrantyByUnit.get(r.unitId) || 0;
      const gross = (r.salePrice || 0) - (r.purchasePrice || 0) - repairCost;
      return {
        ...r,
        repairCost, warrantyCost,
        grossMarginCents: gross,
        netMarginCents: gross - warrantyCost,
        grossMarginPct: r.purchasePrice > 0 ? Math.round((gross / r.purchasePrice) * 1000) / 10 : 0,
      };
    });
  }),

  /** Margen bruto % promedio agrupado por marca, modelo, condiciÃ³n */
  marginGrouped: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { from, to } = getRange(input);
    const db = await getDb();

    // Helper: agrupa array de {brand,model,condition,grossMarginCents,purchasePrice}
    function aggregate(rows: any[]) {
      const byBrand = new Map<string, {sum:number;cost:number;count:number}>();
      const byModel = new Map<string, {sum:number;cost:number;count:number}>();
      const byCondition = new Map<string, {sum:number;cost:number;count:number}>();
      for (const r of rows) {
        const g = (map: Map<string,any>, k: string) => {
          if (!map.has(k)) map.set(k, {sum:0,cost:0,count:0});
          const v = map.get(k)!;
          v.sum += r.grossMarginCents;
          v.cost += r.purchasePrice || 0;
          v.count++;
        };
        g(byBrand, r.brand || "Sin marca");
        g(byModel, `${r.brand} ${r.model}`);
        const cond = r.condition ? `${Math.floor((r.condition-1)/2)*2+1}-${Math.floor((r.condition-1)/2)*2+2}` : "N/A";
        g(byCondition, cond);
      }
      const fmt = (map: Map<string,any>) => Array.from(map.entries()).map(([k,v]) => ({
        group: k, count: v.count,
        avgMarginCents: v.count > 0 ? Math.round(v.sum/v.count) : 0,
        avgMarginPct: v.cost > 0 ? Math.round((v.sum/v.cost)*1000)/10 : 0,
      })).sort((a,b) => b.avgMarginPct - a.avgMarginPct);
      return { byBrand: fmt(byBrand), byModel: fmt(byModel), byCondition: fmt(byCondition) };
    }

    if (!db) {
      const rows: any[] = [];
      for (const si of MOCK_SALE_ITEMS as any[]) {
        const sale = (MOCK_SALES as any[]).find((s: any) => s.id === si.saleId && s.status !== "cancelled" && inRange(s.createdAt, from, to));
        if (!sale) continue;
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === si.unitId);
        if (!unit || !matchesUnit(unit, input)) continue;
        const repairCost = (MOCK_REPAIRS as any[]).filter((r: any) => r.unitId === unit.id && r.status === "completed")
          .reduce((s: number, r: any) => s+(r.laborCost||0)+(r.partsCost||0), 0);
        rows.push({ brand: unit.brand, model: unit.model, condition: unit.condition,
          purchasePrice: unit.purchasePrice||0,
          grossMarginCents: (si.finalUnitPrice||0)-(unit.purchasePrice||0)-repairCost });
      }
      return aggregate(rows);
    }

    const dbRows = await db.select({
      brand: units.brand, model: units.model, condition: units.condition,
      purchasePrice: units.purchasePrice, salePrice: saleItems.finalUnitPrice,
      unitId: saleItems.unitId,
    }).from(saleItems)
      .innerJoin(sales, and(eq(saleItems.saleId, sales.id), eq(sales.status, "completed"),
        gte(sales.createdAt, from), lte(sales.createdAt, to)))
      .innerJoin(units, eq(saleItems.unitId, units.id));

    const filtered = (dbRows as any[]).filter((r: any) => matchesUnit(r, input));
    const ids = filtered.map((r: any) => r.unitId);
    let repMap = new Map<number,number>();
    if (ids.length > 0) {
      const reps = await db.select({ unitId: repairs.unitId, laborCost: repairs.laborCost, partsCost: repairs.partsCost })
        .from(repairs).where(and(eq(repairs.status,"completed"), inArray(repairs.unitId, ids)));
      for (const r of reps as any[]) repMap.set(r.unitId,(repMap.get(r.unitId)||0)+(r.laborCost||0)+(r.partsCost||0));
    }
    const enriched = filtered.map((r: any) => ({
      ...r, grossMarginCents: (r.salePrice||0)-(r.purchasePrice||0)-(repMap.get(r.unitId)||0)
    }));
    return aggregate(enriched);
  }),

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROTACIÃ“N
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /** DistribuciÃ³n de dÃ­as en inventario: 0-15, 15-30, 30-60, 60+ */
  inventoryAgingDistribution: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { from, to } = getRange(input);
    const db = await getDb();

    function bucketize(rows: {days:number}[]) {
      const buckets = {"0-15":0,"15-30":0,"30-60":0,"60+":0};
      for (const {days} of rows) {
        if (days < 15) buckets["0-15"]++;
        else if (days < 30) buckets["15-30"]++;
        else if (days < 60) buckets["30-60"]++;
        else buckets["60+"]++;
      }
      return Object.entries(buckets).map(([range,count])=>({range,count}));
    }

    if (!db) {
      const rows: {days:number}[] = [];
      for (const ev of MOCK_UNIT_EVENTS as any[]) {
        if (ev.toStatus !== "sold" || !inRange(ev.createdAt, from, to)) continue;
        const unit = (MOCK_UNITS as any[]).find((u: any) => u.id === ev.unitId);
        if (!unit || !matchesUnit(unit, input)) continue;
        const days = Math.max(0, Math.round((new Date(ev.createdAt).getTime()-new Date(unit.createdAt).getTime())/86400000));
        rows.push({days});
      }
      return { distribution: bucketize(rows), count: rows.length, avgDays: rows.length>0 ? Math.round(rows.reduce((s,r)=>s+r.days,0)/rows.length) : 0 };
    }

    const soldEvs = await db.select({ unitId: unitEvents.unitId, soldAt: unitEvents.createdAt })
      .from(unitEvents).where(and(eq(unitEvents.toStatus,"sold"), gte(unitEvents.createdAt,from), lte(unitEvents.createdAt,to)));

    const ids = (soldEvs as any[]).map((e:any)=>e.unitId);
    if (ids.length===0) return { distribution: bucketize([]), count:0, avgDays:0 };

    const unitRows = await db.select({ id: units.id, createdAt: units.createdAt, brand: units.brand, model: units.model, supplierId: units.supplierId })
      .from(units).where(inArray(units.id, ids));

    const unitMap = new Map((unitRows as any[]).map((u:any)=>[u.id, u]));
    const rows: {days:number}[] = [];
    for (const ev of soldEvs as any[]) {
      const unit = unitMap.get(ev.unitId);
      if (!unit || !matchesUnit(unit, input)) continue;
      rows.push({ days: Math.max(0, Math.round((new Date(ev.soldAt).getTime()-new Date(unit.createdAt).getTime())/86400000)) });
    }
    return { distribution: bucketize(rows), count: rows.length, avgDays: rows.length>0 ? Math.round(rows.reduce((s,r)=>s+r.days,0)/rows.length):0 };
  }),

  /** Valor de inventario actual = SUM(purchasePrice + repairCosts) unidades no vendidas */
  inventoryValue: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();

    if (!db) {
      let purchaseValue=0, repairValue=0, potentialRevenue=0;
      const activeUnits = (MOCK_UNITS as any[]).filter((u:any) => u.status !== "sold");
      for (const u of activeUnits) {
        purchaseValue += u.purchasePrice||0;
        potentialRevenue += u.salePrice||0;
        const repCost = (MOCK_REPAIRS as any[]).filter((r:any)=>r.unitId===u.id&&r.status==="completed")
          .reduce((s:number,r:any)=>s+(r.laborCost||0)+(r.partsCost||0),0);
        repairValue += repCost;
      }
      return { count: activeUnits.length, purchaseValueCents: purchaseValue, repairValueCents: repairValue, totalCostCents: purchaseValue+repairValue, potentialRevenueCents: potentialRevenue };
    }

    const activeRows = await db.select({ id: units.id, purchasePrice: units.purchasePrice, salePrice: units.salePrice })
      .from(units).where(ne(units.status,"sold"));

    const ids = (activeRows as any[]).map((u:any)=>u.id);
    let repairTotal = 0;
    if (ids.length > 0) {
      const repRows = await db.select({ unitId: repairs.unitId, laborCost: repairs.laborCost, partsCost: repairs.partsCost })
        .from(repairs).where(and(eq(repairs.status,"completed"), inArray(repairs.unitId, ids)));
      repairTotal = (repRows as any[]).reduce((s:number,r:any)=>s+(r.laborCost||0)+(r.partsCost||0),0);
    }
    const purchaseValueCents = (activeRows as any[]).reduce((s:number,u:any)=>s+(u.purchasePrice||0),0);
    const potentialRevenueCents = (activeRows as any[]).reduce((s:number,u:any)=>s+(u.salePrice||0),0);
    return { count: activeRows.length, purchaseValueCents, repairValueCents: repairTotal, totalCostCents: purchaseValueCents+repairTotal, potentialRevenueCents };
  }),

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TALLER / CALIDAD
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /** Tiempo promedio en taller, agrupable por tÃ©cnico */
  repairTimes: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { from, to } = getRange(input);
    const db = await getDb();

    if (!db) {
      const byTech = new Map<string, {hours:number;count:number}>();
      for (const r of MOCK_REPAIRS as any[]) {
        if (r.status !== "completed" || !r.startDate || !r.endDate) continue;
        if (!inRange(r.endDate, from, to)) continue;
        if (input?.technicianId && r.technicianId !== input.technicianId) continue;
        const hours = Math.max(0, (new Date(r.endDate).getTime()-new Date(r.startDate).getTime())/(1000*3600));
        const tech = (MOCK_USERS as any[]).find((u:any)=>u.id===r.technicianId)?.name || `TÃ©cnico ${r.technicianId}`;
        const prev = byTech.get(tech) || {hours:0,count:0};
        prev.hours += hours; prev.count++;
        byTech.set(tech, prev);
      }
      const byTechArr = Array.from(byTech.entries()).map(([tech,v])=>({tech, count:v.count, avgHours: Math.round(v.hours/v.count*10)/10}));
      const total = byTechArr.reduce((s,r)=>s+r.count*r.avgHours,0);
      const cnt = byTechArr.reduce((s,r)=>s+r.count,0);
      return { avgHours: cnt>0 ? Math.round(total/cnt*10)/10 : 0, byTechnician: byTechArr };
    }

    const reps = await db.select({
      startDate: repairs.startDate, endDate: repairs.endDate,
      technicianId: repairs.technicianId, techName: users.name,
    }).from(repairs)
      .leftJoin(users, eq(repairs.technicianId, users.id))
      .where(and(eq(repairs.status,"completed"), isNotNull(repairs.endDate), gte(repairs.endDate, from), lte(repairs.endDate, to)));

    const filtered = (reps as any[]).filter((r:any) => !input?.technicianId || r.technicianId === input.technicianId);
    const byTech = new Map<string,{hours:number;count:number}>();
    for (const r of filtered) {
      const h = Math.max(0,(new Date(r.endDate).getTime()-new Date(r.startDate).getTime())/(1000*3600));
      const k = r.techName || `#${r.technicianId}`;
      const p = byTech.get(k)||{hours:0,count:0};
      p.hours+=h; p.count++; byTech.set(k,p);
    }
    const byTechArr = Array.from(byTech.entries()).map(([tech,v])=>({tech,count:v.count,avgHours:Math.round(v.hours/v.count*10)/10}));
    const total = byTechArr.reduce((s,r)=>s+r.count*r.avgHours,0);
    const cnt = byTechArr.reduce((s,r)=>s+r.count,0);
    return { avgHours: cnt>0?Math.round(total/cnt*10)/10:0, byTechnician: byTechArr };
  }),

  /** % unidades que pasaron por taller + tasa de devoluciÃ³n por tÃ©cnico */
  workshopStats: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { from, to } = getRange(input);
    const db = await getDb();

    if (!db) {
      const totalUnits = (MOCK_UNITS as any[]).length;
      const hadRepair = new Set((MOCK_REPAIRS as any[]).map((r:any)=>r.unitId)).size;
      const workshopPct = totalUnits > 0 ? Math.round((hadRepair/totalUnits)*1000)/10 : 0;

      // Tasa devoluciÃ³n por tÃ©cnico: join returnsâ†’unitâ†’repairs(last completed)
      const byTech = new Map<string,{returns:number;total:number}>();
      for (const ret of MOCK_RETURNS as any[]) {
        if (!inRange(ret.returnDate||ret.createdAt, from, to)) continue;
        const lastRepair = (MOCK_REPAIRS as any[]).filter((r:any)=>r.unitId===ret.unitId&&r.status==="completed").sort((a:any,b:any)=>new Date(b.endDate).getTime()-new Date(a.endDate).getTime())[0];
        const techName = lastRepair ? ((MOCK_USERS as any[]).find((u:any)=>u.id===lastRepair.technicianId)?.name||`#${lastRepair.technicianId}`) : "Sin tÃ©cnico";
        const p = byTech.get(techName)||{returns:0,total:0}; p.returns++; p.total++;
        byTech.set(techName, p);
      }
      return { workshopPct, hadRepairCount: hadRepair, totalUnits, byTechnician: Array.from(byTech.entries()).map(([tech,v])=>({tech,returnCount:v.returns})) };
    }

    const [totalCount, repairUnitCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(units),
      db.select({ unitId: repairs.unitId }).from(repairs).groupBy(repairs.unitId),
    ]);
    const total = Number((totalCount as any[])[0]?.count||0);
    const hadRepair = (repairUnitCount as any[]).length;
    const workshopPct = total > 0 ? Math.round((hadRepair/total)*1000)/10 : 0;

    const retRows = await db.select({ unitId: returns.unitId, returnDate: returns.returnDate })
      .from(returns).where(and(gte(returns.returnDate, from), lte(returns.returnDate, to)));

    const byTech = new Map<string,number>();
    for (const ret of retRows as any[]) {
      const lastRep = await db.select({ technicianId: repairs.technicianId, techName: users.name })
        .from(repairs).leftJoin(users, eq(repairs.technicianId, users.id))
        .where(and(eq(repairs.unitId, ret.unitId), eq(repairs.status,"completed")))
        .orderBy(repairs.id).limit(1);
      const tn = (lastRep as any[])[0]?.techName || "Sin tÃ©cnico";
      byTech.set(tn, (byTech.get(tn)||0)+1);
    }
    return { workshopPct, hadRepairCount: hadRepair, totalUnits: total, byTechnician: Array.from(byTech.entries()).map(([tech,returnCount])=>({tech,returnCount})) };
  }),

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FINANCIERO
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /** Flujo de caja neto del perÃ­odo, gasto operativo % ventas, ratio CXC/ventas, utilidad neta */
  financialSummary: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { from, to } = getRange(input);
    const db = await getDb();

    if (!db) {
      const pm = input?.paymentMethod;
      const txs = (MOCK_FINANCIAL_TRANSACTIONS as any[]).filter((t: any) => inRange(t.createdAt, from, to) && (!pm || t.paymentMethod === pm));
      const income = txs.filter((t:any)=>t.type==="income").reduce((s:number,t:any)=>s+t.amount,0);
      const expense = txs.filter((t:any)=>t.type==="expense").reduce((s:number,t:any)=>s+t.amount,0);
      const opExp = (MOCK_OPERATIONAL_EXPENSES as any[]).filter((e:any)=>e.status==="paid"&&inRange(e.createdAt,from,to)).reduce((s:number,e:any)=>s+e.amount,0);
      const salesTotal = (MOCK_SALES as any[]).filter((s:any)=>s.status!=="cancelled"&&inRange(s.createdAt,from,to)).reduce((s:number,sale:any)=>s+sale.total,0);
      const cxcPending = (MOCK_ACCOUNTS_RECEIVABLE as any[]).filter((ar:any)=>ar.status!=="paid").reduce((s:number,ar:any)=>s+ar.balance,0);
      const grossMargin = income - txs.filter((t:any)=>t.category==="cogs").reduce((s:number,t:any)=>s+t.amount,0);
      return {
        incomeCents: income, expenseCents: expense, netFlowCents: income-expense,
        opExpenseCents: opExp, salesCents: salesTotal,
        opExpPct: salesTotal>0 ? Math.round((opExp/salesTotal)*1000)/10 : 0,
        cxcPendingCents: cxcPending,
        cxcSalesPct: salesTotal>0 ? Math.round((cxcPending/salesTotal)*1000)/10 : 0,
        netProfitCents: grossMargin - opExp,
      };
    }

    const [txRows, opRows, salesRows, cxcRows] = await Promise.all([
      db.select({ type: financialTransactions.type, category: financialTransactions.category,
        paymentMethod: financialTransactions.paymentMethod, amount: financialTransactions.amount })
        .from(financialTransactions).where(and(gte(financialTransactions.createdAt, from), lte(financialTransactions.createdAt, to))),
      db.select({ amount: operationalExpenses.amount })
        .from(operationalExpenses).where(and(eq(operationalExpenses.status,"paid"),
          gte(operationalExpenses.createdAt, from), lte(operationalExpenses.createdAt, to))),
      db.select({ total: sales.total }).from(sales)
        .where(and(eq(sales.status,"completed"), gte(sales.createdAt,from), lte(sales.createdAt,to))),
      db.select({ balance: accountsReceivable.balance }).from(accountsReceivable).where(ne(accountsReceivable.status,"paid")),
    ]);

    const pm = (input as any)?.paymentMethod;
    const filteredTx = (txRows as any[]).filter((t:any)=>!pm||t.paymentMethod===pm);
    const income = filteredTx.filter((t:any)=>t.type==="income").reduce((s:number,t:any)=>s+t.amount,0);
    const expense = filteredTx.filter((t:any)=>t.type==="expense").reduce((s:number,t:any)=>s+t.amount,0);
    const cogsCents = filteredTx.filter((t:any)=>t.category==="cogs").reduce((s:number,t:any)=>s+t.amount,0);
    const opExp = (opRows as any[]).reduce((s:number,r:any)=>s+r.amount,0);
    const salesTotal = (salesRows as any[]).reduce((s:number,r:any)=>s+r.total,0);
    const cxcPending = (cxcRows as any[]).reduce((s:number,r:any)=>s+r.balance,0);
    const grossMargin = income - cogsCents;
    return {
      incomeCents: income, expenseCents: expense, netFlowCents: income-expense,
      opExpenseCents: opExp, salesCents: salesTotal,
      opExpPct: salesTotal>0?Math.round((opExp/salesTotal)*1000)/10:0,
      cxcPendingCents: cxcPending,
      cxcSalesPct: salesTotal>0?Math.round((cxcPending/salesTotal)*1000)/10:0,
      netProfitCents: grossMargin-opExp,
    };
  }),

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // COMERCIAL
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /** Ticket promedio, desempeÃ±o por vendedor, repartidor, tiempo entrega */
  commercialSummary: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { from, to } = getRange(input);
    const db = await getDb();

    if (!db) {
      const salesInRange = (MOCK_SALES as any[]).filter((s:any)=>s.status!=="cancelled"&&inRange(s.createdAt,from,to));
      const byType = {laptop:{total:0,count:0}, accessory:{total:0,count:0}, other:{total:0,count:0}};
      const bySeller = new Map<string,{total:number;count:number;returns:number}>();

      for (const sale of salesInRange) {
        const items = (MOCK_SALE_ITEMS as any[]).filter((si:any)=>si.saleId===sale.id);
        for (const si of items) {
          const unit = (MOCK_UNITS as any[]).find((u:any)=>u.id===si.unitId);
          const t = unit?.type === "laptop" ? "laptop" : unit?.type === "accessory" ? "accessory" : "other";
          byType[t].total += si.finalUnitPrice||0; byType[t].count++;
        }
        if (input?.sellerId && sale.soldBy !== input.sellerId) continue;
        const sellerName = (MOCK_USERS as any[]).find((u:any)=>u.id===sale.soldBy)?.name || `#${sale.soldBy}`;
        const p = bySeller.get(sellerName)||{total:0,count:0,returns:0};
        p.total += sale.total||0; p.count++; bySeller.set(sellerName,p);
      }
      // Returns por vendedor
      for (const ret of (MOCK_RETURNS as any[]).filter((r:any)=>inRange(r.returnDate||r.createdAt,from,to))) {
        const sale = ret.saleId ? (MOCK_SALES as any[]).find((s:any)=>s.id===ret.saleId) : null;
        if (!sale) continue;
        const n = (MOCK_USERS as any[]).find((u:any)=>u.id===sale.soldBy)?.name||`#${sale.soldBy}`;
        const p = bySeller.get(n)||{total:0,count:0,returns:0}; p.returns++; bySeller.set(n,p);
      }
      // Delivery
      const delivOrders = (MOCK_ORDERS as any[]).filter((o:any)=>o.status==="delivered"&&inRange(o.deliveredAt,from,to)&&o.deliveredAt);
      const byDelivery = new Map<string,{hours:number;count:number}>();
      for (const o of delivOrders) {
        const dn = (MOCK_USERS as any[]).find((u:any)=>u.id===o.deliveryPersonId)?.name||`#${o.deliveryPersonId}`;
        const h = Math.max(0,(new Date(o.deliveredAt).getTime()-new Date(o.createdAt).getTime())/3600000);
        const p = byDelivery.get(dn)||{hours:0,count:0}; p.hours+=h; p.count++; byDelivery.set(dn,p);
      }

      return {
        avgTicketCents: {
          laptop: byType.laptop.count>0?Math.round(byType.laptop.total/byType.laptop.count):0,
          accessory: byType.accessory.count>0?Math.round(byType.accessory.total/byType.accessory.count):0,
        },
        bySeller: Array.from(bySeller.entries()).map(([seller,v])=>({
          seller, salesCount:v.count, totalCents:v.total,
          avgTicketCents: v.count>0?Math.round(v.total/v.count):0,
          returnCount: v.returns,
          returnRatePct: v.count>0?Math.round((v.returns/v.count)*1000)/10:0,
        })),
        byDelivery: Array.from(byDelivery.entries()).map(([person,v])=>({
          person, deliveryCount:v.count, avgHours: Math.round(v.hours/v.count*10)/10,
        })),
      };
    }

    // DB mode
    const [saleRows, retRows, orderRows] = await Promise.all([
      db.select({ saleId: sales.id, total: sales.total, soldBy: sales.soldBy, sellerName: users.name, type: units.type, finalUnitPrice: saleItems.finalUnitPrice })
        .from(sales).innerJoin(saleItems, eq(saleItems.saleId, sales.id)).innerJoin(units, eq(saleItems.unitId, units.id))
        .leftJoin(users, eq(sales.soldBy, users.id))
        .where(and(eq(sales.status,"completed"), gte(sales.createdAt,from), lte(sales.createdAt,to))),
      db.select({ saleId: returns.saleId }).from(returns)
        .where(and(gte(returns.returnDate,from), lte(returns.returnDate,to), isNotNull(returns.saleId))),
      db.select({ deliveryPersonId: orders.deliveryPersonId, delivPersonName: users.name, createdAt: orders.createdAt, deliveredAt: orders.deliveredAt })
        .from(orders).leftJoin(users, eq(orders.deliveryPersonId, users.id))
        .where(and(eq(orders.status,"delivered"), gte(orders.deliveredAt,from), lte(orders.deliveredAt,to), isNotNull(orders.deliveredAt))),
    ]);

    const byType = {laptop:{t:0,c:0},accessory:{t:0,c:0},other:{t:0,c:0}};
    const bySeller = new Map<string,{total:number;count:number;returns:number}>();
    for (const r of saleRows as any[]) {
      const t = r.type==="laptop"?"laptop":r.type==="accessory"?"accessory":"other";
      byType[t].t+=r.finalUnitPrice||0; byType[t].c++;
      if (input?.sellerId && r.soldBy !== input.sellerId) continue;
      const n = r.sellerName||`#${r.soldBy}`; const p = bySeller.get(n)||{total:0,count:0,returns:0};
      p.total+=r.total||0; p.count++; bySeller.set(n,p);
    }
    const saleIdSet = new Set((saleRows as any[]).map((r:any)=>r.saleId));
    for (const ret of retRows as any[]) {
      if (!ret.saleId || !saleIdSet.has(ret.saleId)) continue;
      const sale = (saleRows as any[]).find((r:any)=>r.saleId===ret.saleId);
      if (!sale) continue;
      const n = sale.sellerName||`#${sale.soldBy}`; const p = bySeller.get(n)||{total:0,count:0,returns:0}; p.returns++; bySeller.set(n,p);
    }
    const byDelivery = new Map<string,{hours:number;count:number}>();
    for (const o of orderRows as any[]) {
      const n = o.delivPersonName||`#${o.deliveryPersonId}`; const h = Math.max(0,(new Date(o.deliveredAt).getTime()-new Date(o.createdAt).getTime())/3600000);
      const p = byDelivery.get(n)||{hours:0,count:0}; p.hours+=h; p.count++; byDelivery.set(n,p);
    }
    return {
      avgTicketCents: { laptop: byType.laptop.c>0?Math.round(byType.laptop.t/byType.laptop.c):0, accessory: byType.accessory.c>0?Math.round(byType.accessory.t/byType.accessory.c):0 },
      bySeller: Array.from(bySeller.entries()).map(([seller,v])=>({ seller, salesCount:v.count, totalCents:v.total, avgTicketCents:v.count>0?Math.round(v.total/v.count):0, returnCount:v.returns, returnRatePct:v.count>0?Math.round((v.returns/v.count)*1000)/10:0 })),
      byDelivery: Array.from(byDelivery.entries()).map(([person,v])=>({ person, deliveryCount:v.count, avgHours:Math.round(v.hours/v.count*10)/10 })),
    };
  }),

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PROVEEDORES
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /** Margen promedio por proveedor, % con daÃ±os al ingreso */
  supplierStats: protectedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { from, to } = getRange(input);
    const db = await getDb();

    if (!db) {
      const bySupplier = new Map<string,{margin:number;cost:number;count:number;damaged:number}>();
      for (const si of MOCK_SALE_ITEMS as any[]) {
        const sale = (MOCK_SALES as any[]).find((s:any)=>s.id===si.saleId&&s.status!=="cancelled"&&inRange(s.createdAt,from,to));
        if (!sale) continue;
        const unit = (MOCK_UNITS as any[]).find((u:any)=>u.id===si.unitId);
        if (!unit) continue;
        const repCost = (MOCK_REPAIRS as any[]).filter((r:any)=>r.unitId===unit.id&&r.status==="completed").reduce((s:number,r:any)=>s+(r.laborCost||0)+(r.partsCost||0),0);
        const supplierName = `Proveedor #${unit.supplierId||0}`;
        const p = bySupplier.get(supplierName)||{margin:0,cost:0,count:0,damaged:0};
        p.margin += (si.finalUnitPrice||0)-(unit.purchasePrice||0)-repCost;
        p.cost += unit.purchasePrice||0; p.count++;
        const dc = unit.damageChecklist ? JSON.parse(unit.damageChecklist) : {};
        if (Object.values(dc).some((v:any)=>v===true)) p.damaged++;
        bySupplier.set(supplierName, p);
      }
      return Array.from(bySupplier.entries()).map(([supplier,v])=>({
        supplier, count:v.count, avgMarginCents:v.count>0?Math.round(v.margin/v.count):0,
        avgMarginPct:v.cost>0?Math.round((v.margin/v.cost)*1000)/10:0,
        damagedPct:v.count>0?Math.round((v.damaged/v.count)*1000)/10:0,
      }));
    }

    const rows = await db.select({
      supplierId: units.supplierId, supplierName: purchases.purchaseNumber,
      purchasePrice: units.purchasePrice, salePrice: saleItems.finalUnitPrice,
      unitId: saleItems.unitId, damageChecklist: units.damageChecklist,
    }).from(saleItems)
      .innerJoin(sales, and(eq(saleItems.saleId,sales.id), eq(sales.status,"completed"), gte(sales.createdAt,from), lte(sales.createdAt,to)))
      .innerJoin(units, eq(saleItems.unitId,units.id))
      .leftJoin(purchases, eq(units.purchaseId,purchases.id));

    const ids = (rows as any[]).map((r:any)=>r.unitId);
    let repMap = new Map<number,number>();
    if (ids.length>0) {
      const reps = await db.select({unitId:repairs.unitId,laborCost:repairs.laborCost,partsCost:repairs.partsCost})
        .from(repairs).where(and(eq(repairs.status,"completed"),inArray(repairs.unitId,ids)));
      for (const r of reps as any[]) repMap.set(r.unitId,(repMap.get(r.unitId)||0)+(r.laborCost||0)+(r.partsCost||0));
    }

    const bySupplier = new Map<string,{margin:number;cost:number;count:number;damaged:number}>();
    for (const r of rows as any[]) {
      const key = `Proveedor #${r.supplierId||0}`;
      const repCost = repMap.get(r.unitId)||0;
      const dc = r.damageChecklist ? JSON.parse(r.damageChecklist) : {};
      const hasDmg = Object.values(dc).some((v:any)=>v===true);
      const p = bySupplier.get(key)||{margin:0,cost:0,count:0,damaged:0};
      p.margin += (r.salePrice||0)-(r.purchasePrice||0)-repCost;
      p.cost += r.purchasePrice||0; p.count++; if(hasDmg) p.damaged++;
      bySupplier.set(key,p);
    }
    return Array.from(bySupplier.entries()).map(([supplier,v])=>({
      supplier, count:v.count,
      avgMarginCents:v.count>0?Math.round(v.margin/v.count):0,
      avgMarginPct:v.cost>0?Math.round((v.margin/v.cost)*1000)/10:0,
      damagedPct:v.count>0?Math.round((v.damaged/v.count)*1000)/10:0,
    }));
  }),
});
