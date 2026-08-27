import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, MOCK_WARRANTIES, MOCK_UNITS, MOCK_SALES, MOCK_CUSTOMERS, MOCK_RETURNS, MOCK_REPAIRS, syncMocksToDisk } from "../db";
import { warranties, units, sales, customers, returns, repairs } from "../../drizzle/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

function toDate(v: any): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  return new Date(v);
}

function getDaysLeft(now: Date, endDate: Date): number {
  return Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function buildWarrantyView(w: any, unit: any, sale: any, customer: any, returnRma?: any, activeRepair?: any) {
  const now = new Date();
  const startDate = toDate(w.startDate) || now;
  const endDate = toDate(w.endDate) || now;
  const pausedAt = toDate(w.pausedAt);
  const remainingDaysAtPause = typeof w.remainingDaysAtPause === "number" ? w.remainingDaysAtPause : null;

  let resolvedStatus = w.status || "active";
  let effectiveEndDate = endDate;
  let computedDaysLeft = 0;
  let displayEndDate = endDate;

  // Si hay repair activa y la warranty está active, mostrarla como "paused"
  const hasActiveRepair = !!activeRepair && activeRepair.status === "in_progress";
  const isPausedByRepair = hasActiveRepair && resolvedStatus === "active";
  const warrantyExpired = endDate.getTime() <= now.getTime();

  // Reglas de estado (en orden de prioridad):
  // 1) Si hay repair activa en la unidad -> "paused" (la garantía se pausó por el taller)
  // 2) Si está pausada por un repair que ya cerró pero no se reanudó -> "paused"
  // 3) Si la garantía venció Y tuvo al menos un return -> "claimed" (definitivo, se usó y venció)
  // 4) Si la garantía venció (sin return) -> "expired"
  // 5) Si está activa y vigente -> "active" — incluso si tuvo returns previos.
  //    El cliente puede registrar nuevas devoluciones mientras la garantía esté vigente.
  if (isPausedByRepair) {
    resolvedStatus = "paused";
  } else if (pausedAt && remainingDaysAtPause !== null) {
    resolvedStatus = "paused";
  } else if (warrantyExpired && (!!returnRma || unit?.status === "returned")) {
    resolvedStatus = "claimed";
  } else if (warrantyExpired) {
    resolvedStatus = "expired";
  }

  // Cálculo de días restantes:
  // - Si está paused por repair activa, mostrar remainingDaysAtPause (lo que se guardó al pausar)
  // - Si está paused pero sin repair activa (caso edge), mostrar remainingDaysAtPause
  // - Si está active/expired/claimed, calcular normal contra endDate
  if (resolvedStatus === "paused") {
    computedDaysLeft = remainingDaysAtPause ?? getDaysLeft(now, endDate);
  } else {
    computedDaysLeft = getDaysLeft(now, endDate);
  }

  const totalMs = Math.max(1, endDate.getTime() - startDate.getTime());
  const elapsedMs = Math.max(0, now.getTime() - startDate.getTime());
  const remainingMs = endDate.getTime() - now.getTime();
  const isExpired = remainingMs <= 0 && resolvedStatus !== "paused";
  const hoursLeft = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const progressPercent = isExpired ? 100 : Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));

  const specsParsed = typeof unit?.specs === "string"
    ? (() => { try { return JSON.parse(unit.specs); } catch { return {}; } })()
    : (unit?.specs || {});

  return {
    id: w.id,
    saleId: w.saleId,
    orderId: w.orderId,
    unitId: w.unitId,
    days: w.days,
    startDate: w.startDate,
    endDate: w.endDate,
    effectiveEndDate,
    pausedAt: w.pausedAt || null,
    remainingDaysAtPause,
    status: resolvedStatus,
    createdAt: w.createdAt,
    // Unit info
    unitCode: unit?.code || `UNIT-${w.unitId}`,
    unitBrand: unit?.brand || "Equipo",
    unitModel: unit?.model || "",
    unitType: unit?.type || "laptop",
    unitCondition: unit?.condition || null,
    unitBatteryHealth: unit?.batteryHealth || "n_a",
    unitStatus: unit?.status || "sold",
    unitSpecs: specsParsed,
    // Sale info
    saleNumber: sale?.saleNumber || null,
    saleDate: sale?.createdAt || w.createdAt,
    saleTotal: sale?.total || null,
    // Customer info
    customerName: customer?.name || sale?.customerName || "Cliente Venta Directa",
    customerPhone: customer?.phone || null,
    // Active repair (si existe)
    activeRepair: hasActiveRepair ? {
      id: activeRepair.id,
      rmaNumber: activeRepair.rmaNumber || `#${activeRepair.id}`,
      startDate: activeRepair.startDate,
      notes: activeRepair.notes || null,
    } : null,
    // Calculated countdown metrics
    isExpired,
    daysLeft: resolvedStatus === "paused" ? computedDaysLeft : (isExpired ? 0 : computedDaysLeft),
    hoursLeft,
    progressPercent,
    isClaimed: resolvedStatus === "claimed",
    isPaused: resolvedStatus === "paused",
    // Indica que ya se registró al menos un RMA (informativo, no bloquea nuevas RMAs
    // mientras la garantía siga vigente y la unidad no esté en status "returned").
    hasPreviousReturns: !!returnRma,
    previousReturnsCount: returnRma ? 1 : 0,
  };
}

export const warrantiesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "expired", "claimed"]).optional(),
        unitId: z.number().optional(),
        saleId: z.number().optional(),
        orderId: z.number().optional(),
        branchId: z.number().optional(),
        search: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      if (!db) {
        let filtered = [...MOCK_WARRANTIES];
        if (input?.unitId) filtered = filtered.filter((w: any) => w.unitId === input.unitId);
        if (input?.saleId) filtered = filtered.filter((w: any) => w.saleId === input.saleId);
        if (input?.orderId) filtered = filtered.filter((w: any) => w.orderId === input.orderId);
        if (input?.branchId) {
          filtered = filtered.filter((w: any) => {
            const unit = MOCK_UNITS.find((u: any) => u.id === w.unitId);
            return !unit || unit.branchId === input.branchId;
          });
        }

        let items = filtered.map((w: any) => {
          const unit = MOCK_UNITS.find((u: any) => u.id === w.unitId);
          const sale = MOCK_SALES.find((s: any) => s.id === w.saleId);
          const customer = sale?.customerId ? MOCK_CUSTOMERS.find((c: any) => c.id === sale.customerId) : null;
          const returnRma = MOCK_RETURNS.find((r: any) => r.unitId === w.unitId || r.warrantyId === w.id);
          const activeRepair = MOCK_REPAIRS.find((r: any) => r.unitId === w.unitId && r.status === "in_progress");
          return buildWarrantyView(w, unit, sale, customer, returnRma, activeRepair);
        });

        if (input?.status) {
          items = items.filter((w: any) => w.status === input.status);
        }

        if (input?.search) {
          const s = input.search.toLowerCase().trim();
          items = items.filter((w: any) =>
            w.unitCode?.toLowerCase().includes(s) ||
            w.unitBrand?.toLowerCase().includes(s) ||
            w.unitModel?.toLowerCase().includes(s) ||
            w.customerName?.toLowerCase().includes(s) ||
            w.customerPhone?.toLowerCase().includes(s) ||
            w.saleNumber?.toLowerCase().includes(s)
          );
        }

        return { items, total: items.length };
      }

      const conditions = [];
      if (input?.unitId) conditions.push(eq(warranties.unitId, input.unitId));
      if (input?.saleId) conditions.push(eq(warranties.saleId, input.saleId));
      if (input?.orderId) conditions.push(eq(warranties.orderId, input.orderId));
      if (input?.branchId) conditions.push(eq(units.branchId, input.branchId));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rawItems = await db
        .select({
          warranty: warranties,
          unit: units,
          sale: sales,
          customer: customers,
        })
        .from(warranties)
        .leftJoin(units, eq(warranties.unitId, units.id))
        .leftJoin(sales, eq(warranties.saleId, sales.id))
        .leftJoin(customers, eq(sales.customerId, customers.id))
        .where(whereClause)
        .orderBy(desc(warranties.id))
        .limit(input?.limit || 100)
        .offset(input?.offset || 0);

      const unitIds = rawItems.map((r: any) => r.warranty.unitId).filter((id: any) => typeof id === "number");
      let allReturns: any[] = [];
      let allRepairs: any[] = [];

      if (unitIds.length > 0) {
        allReturns = await db
          .select()
          .from(returns)
          .where(inArray(returns.unitId, unitIds));
        allRepairs = await db
          .select()
          .from(repairs)
          .where(and(inArray(repairs.unitId, unitIds), eq(repairs.status, "in_progress")));
      }

      let items = rawItems.map((r: any) => {
        const returnRma = allReturns.find((ret: any) => ret.unitId === r.warranty.unitId || ret.warrantyId === r.warranty.id);
        const activeRepair = allRepairs.find((rep: any) => rep.unitId === r.warranty.unitId);
        return buildWarrantyView(r.warranty, r.unit, r.sale, r.customer, returnRma, activeRepair);
      });

      if (input?.status) {
        items = items.filter((w: any) => w.status === input.status);
      }

      if (input?.search) {
        const s = input.search.toLowerCase().trim();
        items = items.filter((w: any) =>
          w.unitCode?.toLowerCase().includes(s) ||
          w.unitBrand?.toLowerCase().includes(s) ||
          w.unitModel?.toLowerCase().includes(s) ||
          w.customerName?.toLowerCase().includes(s) ||
          w.customerPhone?.toLowerCase().includes(s) ||
          w.saleNumber?.toLowerCase().includes(s)
        );
      }

      return {
        items,
        total: items.length,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        unitId: z.number(),
        saleId: z.number().optional(),
        orderId: z.number().optional(),
        days: z.number().default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + input.days * 24 * 60 * 60 * 1000);

      if (!db) {
        const newWarranty = {
          id: MOCK_WARRANTIES.length + 1,
          saleId: input.saleId || null,
          orderId: input.orderId || null,
          unitId: input.unitId,
          days: input.days,
          startDate,
          endDate,
          status: "active",
          createdAt: new Date(),
        };
        MOCK_WARRANTIES.push(newWarranty);
        return {
          success: true,
          warrantyId: newWarranty.id,
          endDate,
        };
      }

      const [result] = await db.insert(warranties).values({
        unitId: input.unitId,
        saleId: input.saleId || null,
        orderId: input.orderId || null,
        days: input.days,
        startDate,
        endDate,
        status: "active",
      });

      return {
        success: true,
        warrantyId: result.insertId,
        endDate,
      };
    }),

  extend: protectedProcedure
    .input(
      z.object({
        warrantyId: z.number(),
        additionalDays: z.number().min(1).max(365),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();

      if (!db) {
        const idx = MOCK_WARRANTIES.findIndex((w: any) => w.id === input.warrantyId);
        if (idx === -1) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Garantía no encontrada" });
        }
        const current = MOCK_WARRANTIES[idx];
        const baseEnd = current.endDate ? new Date(current.endDate) : new Date();
        const newEndDate = new Date(baseEnd.getTime() + input.additionalDays * 24 * 60 * 60 * 1000);
        const previousDays = current.days || 0;
        MOCK_WARRANTIES[idx] = {
          ...current,
          endDate: newEndDate,
          days: previousDays + input.additionalDays,
          status: "active",
        };
        syncMocksToDisk();
        return {
          success: true,
          warrantyId: input.warrantyId,
          newEndDate,
          totalDays: previousDays + input.additionalDays,
          addedDays: input.additionalDays,
        };
      }

      const [existing] = await db
        .select()
        .from(warranties)
        .where(eq(warranties.id, input.warrantyId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Garantía no encontrada" });
      }

      const baseEnd = existing.endDate ? new Date(existing.endDate) : new Date();
      const newEndDate = new Date(baseEnd.getTime() + input.additionalDays * 24 * 60 * 60 * 1000);
      const previousDays = existing.days || 0;
      const newTotalDays = previousDays + input.additionalDays;

      await db
        .update(warranties)
        .set({
          endDate: newEndDate,
          days: newTotalDays,
          status: "active",
        })
        .where(eq(warranties.id, input.warrantyId));

      return {
        success: true,
        warrantyId: input.warrantyId,
        newEndDate,
        totalDays: newTotalDays,
        addedDays: input.additionalDays,
      };
    }),

  // Pausar una garantía porque el equipo entró a reparación
  pause: protectedProcedure
    .input(z.object({ unitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const now = new Date();

      const findActive = (unitId: number) => {
        return MOCK_WARRANTIES.find((w: any) => w.unitId === unitId && (w.status === "active" || !w.status));
      };

      if (!db) {
        const w = findActive(input.unitId);
        if (!w) return { success: false, paused: false, reason: "No hay garantía activa para esta unidad" };
        const endDate = toDate(w.endDate);
        const daysLeft = endDate ? getDaysLeft(now, endDate) : 0;
        const idx = MOCK_WARRANTIES.findIndex((x: any) => x.id === w.id);
        MOCK_WARRANTIES[idx] = {
          ...w,
          pausedAt: now,
          remainingDaysAtPause: daysLeft,
        };
        syncMocksToDisk();
        return { success: true, paused: true, warrantyId: w.id, daysLeft };
      }

      const [existing] = await db
        .select()
        .from(warranties)
        .where(and(eq(warranties.unitId, input.unitId), eq(warranties.status, "active")))
        .limit(1);

      if (!existing) return { success: false, paused: false, reason: "No hay garantía activa para esta unidad" };

      const daysLeft = getDaysLeft(now, new Date(existing.endDate));

      await db
        .update(warranties)
        .set({ pausedAt: now, remainingDaysAtPause: daysLeft })
        .where(eq(warranties.id, existing.id));

      return { success: true, paused: true, warrantyId: existing.id, daysLeft };
    }),

  // Reanudar una garantía cuando el equipo sale de reparación
  resume: protectedProcedure
    .input(z.object({ unitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const findPaused = (unitId: number) => {
        return MOCK_WARRANTIES.find((w: any) =>
          w.unitId === unitId &&
          w.pausedAt &&
          typeof w.remainingDaysAtPause === "number"
        );
      };

      if (!db) {
        const w = findPaused(input.unitId);
        if (!w) return { success: false, resumed: false, reason: "No hay garantía pausada para esta unidad" };
        const pausedAt = toDate(w.pausedAt);
        const daysPaused = pausedAt ? Math.max(0, Math.floor((Date.now() - pausedAt.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        const currentEnd = toDate(w.endDate);
        const newEndDate = currentEnd
          ? new Date(currentEnd.getTime() + daysPaused * 24 * 60 * 60 * 1000)
          : new Date();
        const idx = MOCK_WARRANTIES.findIndex((x: any) => x.id === w.id);
        MOCK_WARRANTIES[idx] = {
          ...w,
          endDate: newEndDate,
          pausedAt: null,
          remainingDaysAtPause: null,
          status: "active",
        };
        syncMocksToDisk();
        return { success: true, resumed: true, warrantyId: w.id, daysPaused, newEndDate };
      }

      const [paused] = await db
        .select()
        .from(warranties)
        .where(and(
          eq(warranties.unitId, input.unitId),
          sql`${warranties.pausedAt} IS NOT NULL`,
          sql`${warranties.remainingDaysAtPause} IS NOT NULL`,
        ))
        .limit(1);

      if (!paused) return { success: false, resumed: false, reason: "No hay garantía pausada para esta unidad" };

      const pausedAt = new Date(paused.pausedAt!);
      const daysPaused = Math.max(0, Math.floor((Date.now() - pausedAt.getTime()) / (1000 * 60 * 60 * 24)));
      const newEndDate = new Date(new Date(paused.endDate).getTime() + daysPaused * 24 * 60 * 60 * 1000);

      await db
        .update(warranties)
        .set({ endDate: newEndDate, pausedAt: null, remainingDaysAtPause: null, status: "active" })
        .where(eq(warranties.id, paused.id));

      return { success: true, resumed: true, warrantyId: paused.id, daysPaused, newEndDate };
    }),
});
