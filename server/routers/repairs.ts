import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDb,
  MOCK_GENERATED_CODES,
  MOCK_REPAIRS,
  MOCK_UNITS,
  MOCK_UNIT_EVENTS,
  MOCK_WARRANTIES,
  syncMocksToDisk,
  createAutomaticOperationalExpense,
} from "../db";
import { generatedCodes, repairs, units, unitEvents, users, warranties, financialTransactions, customers, sales, saleItems } from "../../drizzle/schema";
import * as schema from "../../drizzle/schema";
import { eq, desc, and, sql, inArray, or } from "drizzle-orm";
import { readCompanyConfig } from "./settings";
import { MOCK_CUSTOMERS, MOCK_SALES, MOCK_USERS } from "../db";

// ─── WARRANTY PAUSE/RESUME helpers ───────────────────────────────────────────

function getDaysLeftLocal(now: Date, endDate: Date): number {
  return Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function mockPauseWarranty(unitId: number): void {
  const now = new Date();
  const idx = (MOCK_WARRANTIES as any[]).findIndex(
    (w: any) => w.unitId === unitId && (w.status === "active" || !w.status) && !w.pausedAt
  );
  if (idx === -1) return;
  const w = MOCK_WARRANTIES[idx];
  const endDate = w.endDate ? new Date(w.endDate) : now;
  MOCK_WARRANTIES[idx] = {
    ...w,
    pausedAt: now.toISOString(),
    remainingDaysAtPause: getDaysLeftLocal(now, endDate),
  };
}

function mockResumeWarranty(unitId: number): void {
  const now = new Date();
  const idx = (MOCK_WARRANTIES as any[]).findIndex(
    (w: any) => w.unitId === unitId && w.pausedAt && typeof w.remainingDaysAtPause === "number"
  );
  if (idx === -1) return;
  const w = MOCK_WARRANTIES[idx];
  const daysPaused = Math.max(0, Math.floor((now.getTime() - new Date(w.pausedAt).getTime()) / (1000 * 60 * 60 * 24)));
  const currentEnd = w.endDate ? new Date(w.endDate) : now;
  const newEndDate = new Date(currentEnd.getTime() + daysPaused * 24 * 60 * 60 * 1000);
  MOCK_WARRANTIES[idx] = {
    ...w,
    endDate: newEndDate.toISOString(),
    pausedAt: null,
    remainingDaysAtPause: null,
    status: "active",
  };
}

async function dbPauseWarranty(db: any, unitId: number): Promise<void> {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(warranties)
    .where(and(eq(warranties.unitId, unitId), eq(warranties.status, "active"), sql`${warranties.pausedAt} IS NULL`))
    .limit(1);
  if (!existing) return;
  await db.update(warranties)
    .set({ pausedAt: now, remainingDaysAtPause: getDaysLeftLocal(now, new Date(existing.endDate)) })
    .where(eq(warranties.id, existing.id));
}

async function dbResumeWarranty(db: any, unitId: number): Promise<void> {
  const now = new Date();
  const [paused] = await db
    .select()
    .from(warranties)
    .where(and(
      eq(warranties.unitId, unitId),
      sql`${warranties.pausedAt} IS NOT NULL`,
      sql`${warranties.remainingDaysAtPause} IS NOT NULL`,
    ))
    .limit(1);
  if (!paused) return;
  const daysPaused = Math.max(0, Math.floor((now.getTime() - new Date(paused.pausedAt!).getTime()) / (1000 * 60 * 60 * 24)));
  const newEndDate = new Date(new Date(paused.endDate).getTime() + daysPaused * 24 * 60 * 60 * 1000);
  await db.update(warranties)
    .set({ endDate: newEndDate, pausedAt: null, remainingDaysAtPause: null, status: "active" })
    .where(eq(warranties.id, paused.id));
}

/**
 * Dada una búsqueda de texto, devuelve posibles variantes de fecha YYYY-MM-DD
 * que matchearían el término (acepta dd/mm/aaaa, dd-mm-aaaa, yyyy-mm-dd).
 * Si no matchea ningún patrón de fecha, devuelve [].
 */
function parseDateSearchVariants(term: string): string[] {
  const out: string[] = [];
  const ddmmyyyyHyphen = term.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  const yyyymmdd = term.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (ddmmyyyyHyphen) {
    const [, dd, mm, yyyy] = ddmmyyyyHyphen;
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      out.push(`${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`);
    }
  }
  if (yyyymmdd) {
    const [, yyyy, mm, dd] = yyyymmdd;
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      out.push(`${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`);
    }
  }
  return out;
}

/** Convierte una fecha (Date | ISO string) a YYYY-MM-DD en local. */
function isoToDayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Genera el siguiente número de ORDEN DE TRABAJO con formato OT-AAAA-NNNNNN.
 * Se crea uno nuevo por cada entrada al taller. El contador se reinicia cada año.
 */
async function getNextOTNumber(db: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OT-${year}-`;
  const numLen = 6;
  const yearPattern = /^OT-\d{4}-(\d+)$/;

  if (!db) {
    const nums = (MOCK_REPAIRS as any[])
      .map((r) => (r?.otNumber || "").match(yearPattern)?.[1])
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(numLen, "0");
  }

  const likePrefix = `${prefix}%`;
  const rows: any = await db
    .select({ otNumber: repairs.otNumber })
    .from(repairs)
    .where(sql`${repairs.otNumber} LIKE ${likePrefix}`)
    .orderBy(desc(repairs.id))
    .limit(100);

  const nums = (rows as any[])
    .map((r) => (r?.otNumber || "").match(yearPattern)?.[1])
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(next).padStart(numLen, "0");
}

/**
 * Genera el siguiente número de RMA permanente de unidad con formato RMA-AAAA-NNNNNN.
 * Se asigna UNA SOLA VEZ por equipo, la primera vez que entra al taller.
 * El contador se basa en unidades que ya tienen RMA asignado.
 */
async function getNextUnitRMANumber(db: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RMA-${year}-`;
  const numLen = 6;
  const yearPattern = /^RMA-\d{4}-(\d+)$/;

  if (!db) {
    // En mock: buscar en MOCK_UNITS el rmaNumber asignado más alto del año actual
    const unitNums = (MOCK_UNITS as any[])
      .map((u) => (u?.rmaNumber || "").match(yearPattern)?.[1])
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
    // También revisar rmaNumbers en MOCK_REPAIRS (retrocompat)
    const repairNums = (MOCK_REPAIRS as any[])
      .map((r) => (r?.rmaNumber || "").match(yearPattern)?.[1])
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
    const allNums = [...unitNums, ...repairNums];
    const next = (allNums.length ? Math.max(...allNums) : 0) + 1;
    return prefix + String(next).padStart(numLen, "0");
  }

  const likePrefix = `${prefix}%`;
  const rows: any = await db
    .select({ rmaNumber: units.rmaNumber })
    .from(units)
    .where(sql`${units.rmaNumber} LIKE ${likePrefix}`)
    .limit(200);

  const nums = (rows as any[])
    .map((r) => (r?.rmaNumber || "").match(yearPattern)?.[1])
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(next).padStart(numLen, "0");
}

/**
 * Obtiene o asigna el RMA permanente de una unidad.
 * Si la unidad ya tiene rmaNumber, lo devuelve.
 * Si no tiene, genera uno nuevo y lo guarda en units.rmaNumber.
 * Este número NUNCA cambia para el equipo.
 */
async function getOrAssignUnitRMA(unitId: number, db: any): Promise<string> {
  if (!db) {
    const unitIdx = (MOCK_UNITS as any[]).findIndex((u: any) => u.id === unitId);
    if (unitIdx === -1) throw new Error(`Unidad ${unitId} no encontrada`);
    if (MOCK_UNITS[unitIdx].rmaNumber) {
      return MOCK_UNITS[unitIdx].rmaNumber;
    }
    const newRma = await getNextUnitRMANumber(null);
    MOCK_UNITS[unitIdx] = { ...MOCK_UNITS[unitIdx], rmaNumber: newRma };
    return newRma;
  }

  const [unit] = await db.select({ id: units.id, rmaNumber: units.rmaNumber })
    .from(units)
    .where(eq(units.id, unitId))
    .limit(1);

  if (!unit) throw new Error(`Unidad ${unitId} no encontrada`);
  if (unit.rmaNumber) return unit.rmaNumber;

  const newRma = await getNextUnitRMANumber(db);
  await db.update(units).set({ rmaNumber: newRma }).where(eq(units.id, unitId));
  return newRma;
}

// Mantener por retrocompatibilidad (usado en returns.ts)
async function getNextRepairNumber(db: any): Promise<string> {
  return getNextOTNumber(db);
}

export const repairsRouter = router({
  // Obtener ordenes de trabajo de taller
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
        technicianId: z.number().optional(),
        unitId: z.number().optional(),
        branchId: z.number().optional(),
        search: z.string().max(100).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      // === DEMO MODE ===
      if (!db) {
        let filtered = [...MOCK_REPAIRS];
        if (input?.status) filtered = filtered.filter(r => r.status === input.status);
        if (input?.technicianId) filtered = filtered.filter(r => r.technicianId === input.technicianId);
        if (input?.unitId) filtered = filtered.filter(r => r.unitId === input.unitId);
        if (input?.branchId) {
          filtered = filtered.filter(r => {
            const unit = MOCK_UNITS.find((u: any) => u.id === r.unitId);
            return !unit || unit.branchId === input.branchId;
          });
        }

        // Indexar códigos generados por unidad para búsqueda O(1).
        const codeByUnitId = new Map<number, string[]>();
        for (const gc of MOCK_GENERATED_CODES as any[]) {
          if (gc.assignedUnitId) {
            const arr = codeByUnitId.get(gc.assignedUnitId) || [];
            arr.push(gc.code);
            codeByUnitId.set(gc.assignedUnitId, arr);
          }
        }

        if (input?.search) {
          const term = input.search.trim().toLowerCase();
          const dayKeys = parseDateSearchVariants(term); // posibles dd-mm-yyyy a chequear
          filtered = filtered.filter((r: any) => {
            const unit = MOCK_UNITS.find((u: any) => u.id === r.unitId);
            const haystack = [
              r.otNumber,
              r.rmaNumber,
              unit?.rmaNumber,
              unit?.code,
              unit?.brand,
              unit?.model,
              ...(codeByUnitId.get(r.unitId) || []),
            ]
              .filter(Boolean)
              .map((v) => String(v).toLowerCase())
              .join(" || ");
            if (haystack.includes(term)) return true;
            // Búsqueda por fecha de ingreso
            if (dayKeys.length > 0 && r.startDate) {
              const dayKey = isoToDayKey(r.startDate);
              if (dayKeys.includes(dayKey)) return true;
            }
            return false;
          });
        }

        const items = filtered
          .sort((a, b) => b.id - a.id)
          .slice(input?.offset || 0, (input?.offset || 0) + (input?.limit || 50))
          .map((r: any) => {
            const unit = MOCK_UNITS.find((u: any) => u.id === r.unitId);
            return {
              ...r,
              unitCode: unit?.code || "—",
              unitRmaNumber: unit?.rmaNumber || null,
              unitBrand: unit?.brand || "—",
              unitModel: unit?.model || "—",
              unitType: unit?.type || "laptop",
              unitSalePrice: unit?.salePrice || 0,
              unitPurchasePrice: unit?.purchasePrice || 0,
              technicianName: "Demo Técnico",
              partsUsed: r.partsUsed ? (typeof r.partsUsed === "string" ? JSON.parse(r.partsUsed) : r.partsUsed) : [],
              laborCost: ctx.user.role === "seller" ? 0 : r.laborCost,
              partsCost: ctx.user.role === "seller" ? 0 : r.partsCost,
              otNumber: r.otNumber || null,
              rmaNumber: r.rmaNumber || null,
              resolutionType: r.resolutionType || null,
            };
          });

        return { items, total: filtered.length };
      }

      // === DB MODE ===
      const conditions = [];
      if (input?.status) conditions.push(eq(repairs.status, input.status));
      if (input?.technicianId) conditions.push(eq(repairs.technicianId, input.technicianId));
      if (input?.unitId) conditions.push(eq(repairs.unitId, input.unitId));
      if (input?.branchId) conditions.push(eq(units.branchId, input.branchId));

      if (input?.search) {
        const term = input.search.trim();
        const dayKeys = parseDateSearchVariants(term.toLowerCase());
        const like = `%${term}%`;
        const conditionsSearch: any[] = [
          sql`${repairs.otNumber} LIKE ${like}`,
          sql`${repairs.rmaNumber} LIKE ${like}`,
          sql`${units.rmaNumber} LIKE ${like}`,
          sql`${units.code} LIKE ${like}`,
          sql`${units.brand} LIKE ${like}`,
          sql`${units.model} LIKE ${like}`,
          sql`${generatedCodes.code} LIKE ${like}`,
        ];
        if (dayKeys.length > 0) {
          for (const d of dayKeys) {
            conditionsSearch.push(sql`DATE(${repairs.startDate}) = ${d}`);
          }
        }
        conditions.push(or(...conditionsSearch)!);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await db
        .select({
          id: repairs.id,
          otNumber: repairs.otNumber,
          rmaNumber: repairs.rmaNumber,
          unitId: repairs.unitId,
          unitCode: units.code,
          unitRmaNumber: units.rmaNumber,
          unitBrand: units.brand,
          unitModel: units.model,
          unitType: units.type,
          unitSalePrice: units.salePrice,
          unitPurchasePrice: units.purchasePrice,
          technicianId: repairs.technicianId,
          technicianName: users.name,
          startDate: repairs.startDate,
          endDate: repairs.endDate,
          partsUsed: repairs.partsUsed,
          laborCost: repairs.laborCost,
          partsCost: repairs.partsCost,
          status: repairs.status,
          resolutionType: repairs.resolutionType,
          notes: repairs.notes,
          createdAt: repairs.createdAt,
        })
        .from(repairs)
        .leftJoin(units, eq(repairs.unitId, units.id))
        .leftJoin(users, eq(repairs.technicianId, users.id))
        .leftJoin(generatedCodes, eq(generatedCodes.assignedUnitId, units.id))
        .where(whereClause)
        .orderBy(desc(repairs.id))
        .limit(input?.limit || 50)
        .offset(input?.offset || 0);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(repairs)
        .leftJoin(units, eq(repairs.unitId, units.id))
        .leftJoin(generatedCodes, eq(generatedCodes.assignedUnitId, units.id))
        .where(whereClause);

      const role = ctx.user.role;

      const sanitizedItems = items.map((item: any) => ({
        ...item,
        partsUsed: item.partsUsed ? JSON.parse(item.partsUsed) : [],
        laborCost: role === "seller" ? 0 : item.laborCost,
        partsCost: role === "seller" ? 0 : item.partsCost,
      }));

      return {
        items: sanitizedItems,
        total: Number(countResult[0]?.count || 0),
      };
    }),

  // Crear orden de reparación
  create: protectedProcedure
    .input(
      z.object({
        unitId: z.number(),
        technicianId: z.number().optional(),
        notes: z.string().optional(),
        partsUsed: z.array(z.record(z.string(), z.any())).optional(),
        laborCost: z.number().default(0),
        partsCost: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // === DEMO MODE ===
      if (!db) {
        const unit = MOCK_UNITS.find((u: any) => u.id === input.unitId);
        if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });

        const repairId = Date.now();
        // Asignar RMA permanente al equipo (una sola vez)
        const unitRmaNumber = await getOrAssignUnitRMA(input.unitId, null);
        // Generar OT nueva para esta entrada
        const otNumber = await getNextOTNumber(null);

        const newRepair = {
          id: repairId,
          rmaNumber: unitRmaNumber, // referencia al RMA del equipo
          otNumber,                 // número único de esta orden de trabajo
          unitId: input.unitId,
          technicianId: input.technicianId || ctx.user.id,
          startDate: new Date().toISOString(),
          endDate: null,
          partsUsed: JSON.stringify(input.partsUsed || []),
          laborCost: input.laborCost,
          partsCost: input.partsCost,
          status: "in_progress",
          resolutionType: null,
          notes: input.notes || null,
          createdAt: new Date().toISOString(),
        };
        MOCK_REPAIRS.push(newRepair);

        // Actualizar estado de la unidad en mock
        const unitIdx = MOCK_UNITS.findIndex((u: any) => u.id === input.unitId);
        if (unitIdx !== -1) {
          const oldStatus = MOCK_UNITS[unitIdx].status;
          MOCK_UNITS[unitIdx] = { ...MOCK_UNITS[unitIdx], status: "in_repair", updatedAt: new Date().toISOString() };

          MOCK_UNIT_EVENTS.push({
            id: Date.now() + 1,
            unitId: input.unitId,
            eventType: "repair_start",
            fromStatus: oldStatus,
            toStatus: "in_repair",
            userId: ctx.user.id,
            notes: `Ingreso a taller — ${otNumber} (RMA equipo: ${unitRmaNumber}). ${input.notes || ""}`,
            createdAt: new Date().toISOString(),
          });

          // ── Pausa automática de garantía ──────────────────────────────
          mockPauseWarranty(input.unitId);
        }

        syncMocksToDisk();
        return { success: true, repairId, otNumber, rmaNumber: unitRmaNumber };
      }

      // === DB MODE ===
      const [unit] = await db
        .select()
        .from(units)
        .where(eq(units.id, input.unitId))
        .limit(1);

      if (!unit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });
      }

      if (unit.type === "accessory") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El módulo de taller solo aplica para laptops, no para accesorios.",
        });
      }

      const techId = input.technicianId || ctx.user.id;
      const partsUsedJson = input.partsUsed ? JSON.stringify(input.partsUsed) : JSON.stringify([]);

      // Asignar RMA permanente al equipo (solo si no tiene uno ya)
      const unitRmaNumber = await getOrAssignUnitRMA(input.unitId, db);
      // Generar OT nueva para esta entrada al taller
      const otNumber = await getNextOTNumber(db);

      const result: any = await db.insert(repairs).values({
        rmaNumber: unitRmaNumber, // referencia al RMA del equipo
        otNumber,                 // orden de trabajo única para esta entrada
        unitId: input.unitId,
        technicianId: techId,
        startDate: new Date(),
        partsUsed: partsUsedJson,
        laborCost: input.laborCost,
        partsCost: input.partsCost,
        status: "in_progress",
        notes: input.notes || null,
      });

      const repairId = result?.insertId || result[0]?.insertId || 0;

      const oldStatus = unit.status;
      await db
        .update(units)
        .set({ status: "in_repair" })
        .where(eq(units.id, input.unitId));

      await db.insert(unitEvents).values({
        unitId: input.unitId,
        eventType: "repair_start",
        fromStatus: oldStatus,
        toStatus: "in_repair",
        userId: ctx.user.id,
        notes: `Ingreso a taller — ${otNumber} (RMA equipo: ${unitRmaNumber}). ${input.notes || ""}`,
      });

      // ── Pausa automática de garantía ─────────────────────────────────
      await dbPauseWarranty(db, input.unitId);

      return {
        success: true,
        repairId,
        otNumber,
        rmaNumber: unitRmaNumber,
      };
    }),

  // Completar o actualizar orden de reparación
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
        partsUsed: z.array(z.record(z.string(), z.any())).optional(),
        laborCost: z.number().optional(),
        partsCost: z.number().optional(),
        notes: z.string().optional(),
        targetUnitStatus: z.enum(["available", "in_diagnosis", "in_repair", "sold"]).default("available"),
        // === Resolución 2do ingreso (sólo se usa cuando se completa y la unidad tiene repairs previas) ===
        resolutionType: z.enum(["return_to_customer", "return_to_inventory"]).optional(),
        extendWarrantyDays: z.number().min(1).max(365).optional(),
        warrantyId: z.number().optional(),
        secondaryRepairNotes: z.string().optional(),
        // === Opciones de compensación al cliente si retorna a inventario de venta ===
        customerResolution: z.enum(["refund", "exchange", "none"]).optional(),
        refundAmount: z.number().min(0).optional(), // en centavos
        refundPaymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
        replacementUnitId: z.number().optional(),
        priceDifference: z.number().optional(), // en centavos (+ cliente paga, - tienda reembolsa)
        differencePaymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // === DEMO MODE ===
      if (!db) {
        const repairIdx = MOCK_REPAIRS.findIndex((r: any) => r.id === input.id);
        if (repairIdx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });

        const repair = MOCK_REPAIRS[repairIdx];
        const updatedRepair: any = { ...repair };

        if (input.status !== undefined) {
          updatedRepair.status = input.status;
          if (input.status === "completed" || input.status === "cancelled") {
            updatedRepair.endDate = new Date().toISOString();
          }
        }
        if (input.partsUsed !== undefined) updatedRepair.partsUsed = JSON.stringify(input.partsUsed);
        if (input.laborCost !== undefined) updatedRepair.laborCost = input.laborCost;
        if (input.partsCost !== undefined) updatedRepair.partsCost = input.partsCost;
        if (input.notes !== undefined) updatedRepair.notes = input.notes;
        if (input.resolutionType !== undefined) updatedRepair.resolutionType = input.resolutionType;

        MOCK_REPAIRS[repairIdx] = updatedRepair;

        if (input.status === "completed") {
          if (!input.resolutionType) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Para cerrar la reparación elegí una opción de resolución (A: devolver al cliente, B: retornar a inventario).",
            });
          }

          const unitIdx = MOCK_UNITS.findIndex((u: any) => u.id === repair.unitId);
          if (unitIdx !== -1) {
            // Detectar 2do ingreso: ¿hay otras repairs completadas para esta unidad (excluyendo la actual)?
            const otherCompleted = MOCK_REPAIRS.filter(
              (r: any) => r.unitId === repair.unitId && r.status === "completed" && r.id !== repair.id
            ).length;
            const isSecondEntry = otherCompleted >= 1;

            // Estado previo de la unidad antes del ingreso al taller.
            function findPreRepairStatus(): "available" | "in_diagnosis" | "in_repair" | "sold" {
              const eventsAsc = MOCK_UNIT_EVENTS
                .filter((e: any) => e.unitId === repair.unitId)
                .slice()
                .sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0));
              for (let i = eventsAsc.length - 1; i >= 0; i--) {
                const ev = eventsAsc[i];
                const fs = ev.fromStatus as "available" | "in_diagnosis" | "in_repair" | "sold" | undefined;
                if (ev.toStatus === "in_repair" && fs) {
                  return fs;
                }
              }
              return MOCK_UNITS[unitIdx].status as "available" | "in_diagnosis" | "in_repair" | "sold";
            }
            const preRepairStatus = findPreRepairStatus();

            let finalUnitStatus = input.targetUnitStatus;
            let resolutionNotes = "";

            if (input.resolutionType === "return_to_customer") {
              finalUnitStatus = preRepairStatus;
              if (input.warrantyId && input.extendWarrantyDays) {
                const wIdx = MOCK_WARRANTIES.findIndex((w: any) => w.id === input.warrantyId);
                if (wIdx !== -1) {
                  const current = MOCK_WARRANTIES[wIdx];
                  const baseEnd = current.endDate ? new Date(current.endDate) : new Date();
                  const newEndDate = new Date(baseEnd.getTime() + input.extendWarrantyDays * 24 * 60 * 60 * 1000);
                  const previousDays = current.days || 0;
                  MOCK_WARRANTIES[wIdx] = {
                    ...current,
                    endDate: newEndDate,
                    days: previousDays + input.extendWarrantyDays,
                    status: "active",
                  };
                  resolutionNotes = `Garantía extendida +${input.extendWarrantyDays} días (total: ${previousDays + input.extendWarrantyDays} días)`;
                }
              } else {
                resolutionNotes = "Re-entregado al cliente (sin extensión de garantía)";
              }
            } else if (input.resolutionType === "return_to_inventory") {
              finalUnitStatus = "available";
              resolutionNotes = "Retornado a inventario de venta";

              // 1. Cerrar la garantía previa de esta unidad para que no quede activa en inventario
              MOCK_WARRANTIES.forEach((w: any) => {
                if (w.unitId === repair.unitId && w.status !== "cancelled") {
                  w.status = "claimed";
                  w.pausedAt = null;
                  w.remainingDaysAtPause = null;
                }
              });

              // 2. Compensación al cliente
              const unit = MOCK_UNITS[unitIdx];
              const rmaCode = repair.otNumber || repair.rmaNumber || `#${repair.id}`;

              if (input.customerResolution === "refund" && input.refundAmount && input.refundAmount > 0) {
                const { MOCK_FINANCIAL_TRANSACTIONS, MOCK_OPERATIONAL_EXPENSES } = await import("../db");
                const method = input.refundPaymentMethod || "cash";

                // Egreso en Caja
                MOCK_FINANCIAL_TRANSACTIONS.push({
                  id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
                  branchId: 1,
                  type: "expense",
                  category: "warranty_refund",
                  amount: input.refundAmount,
                  paymentMethod: method,
                  referenceId: repair.id,
                  userId: ctx.user.id,
                  notes: `Reembolso garantía / devolución de cliente - ${unit?.brand || ""} ${unit?.model || ""} (${rmaCode})`,
                  createdAt: new Date().toISOString(),
                });

                // Gasto operativo
                MOCK_OPERATIONAL_EXPENSES.push({
                  id: MOCK_OPERATIONAL_EXPENSES.length + 1,
                  branchId: 1,
                  description: `Reembolso Garantía - ${unit?.brand || ""} ${unit?.model || ""} (${rmaCode})`,
                  category: "warranty_refund",
                  costType: "warranty_cost",
                  referenceType: "repair",
                  referenceId: repair.id,
                  isAutomatic: 1,
                  amount: input.refundAmount,
                  paymentMethod: method,
                  expenseDate: new Date().toISOString(),
                  status: "paid",
                  userId: ctx.user.id,
                  notes: `Devolución de dinero al cliente por retorno de equipo a inventario`,
                  createdAt: new Date().toISOString(),
                });

                resolutionNotes += ` | Reembolso cliente: Bs. ${(input.refundAmount / 100).toFixed(2)} (${method})`;
              } else if (input.customerResolution === "exchange" && input.replacementUnitId) {
                const repIdx = MOCK_UNITS.findIndex((u: any) => u.id === input.replacementUnitId);
                if (repIdx !== -1) {
                  const repUnit = MOCK_UNITS[repIdx];
                  MOCK_UNITS[repIdx] = { ...repUnit, status: "sold", updatedAt: new Date().toISOString() };

                  MOCK_UNIT_EVENTS.push({
                    id: Date.now() + 1,
                    unitId: repUnit.id,
                    eventType: "sold",
                    fromStatus: "available",
                    toStatus: "sold",
                    userId: ctx.user.id,
                    notes: `Entregado al cliente como cambio/reemplazo de garantía por equipo ${unit?.code || repair.unitId} (${rmaCode})`,
                    createdAt: new Date().toISOString(),
                  });

                  const diff = input.priceDifference || 0;
                  const diffMethod = input.differencePaymentMethod || "cash";
                  const { MOCK_FINANCIAL_TRANSACTIONS, MOCK_OPERATIONAL_EXPENSES } = await import("../db");

                  if (diff > 0) {
                    // Cliente paga diferencia -> Ingreso en caja
                    MOCK_FINANCIAL_TRANSACTIONS.push({
                      id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
                      branchId: 1,
                      type: "income",
                      category: "sale",
                      amount: diff,
                      paymentMethod: diffMethod,
                      referenceId: repair.id,
                      userId: ctx.user.id,
                      notes: `Cobro diferencia cambio de equipo garantía - ${unit?.code} por ${repUnit.code} (${rmaCode})`,
                      createdAt: new Date().toISOString(),
                    });
                  } else if (diff < 0) {
                    // Tienda devuelve diferencia -> Egreso en caja
                    const refundDiff = Math.abs(diff);
                    MOCK_FINANCIAL_TRANSACTIONS.push({
                      id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
                      branchId: 1,
                      type: "expense",
                      category: "warranty_refund",
                      amount: refundDiff,
                      paymentMethod: diffMethod,
                      referenceId: repair.id,
                      userId: ctx.user.id,
                      notes: `Reembolso diferencia cambio de equipo garantía - ${unit?.code} por ${repUnit.code} (${rmaCode})`,
                      createdAt: new Date().toISOString(),
                    });

                    MOCK_OPERATIONAL_EXPENSES.push({
                      id: MOCK_OPERATIONAL_EXPENSES.length + 1,
                      branchId: 1,
                      description: `Reembolso diferencia cambio garantía - ${unit?.code} por ${repUnit.code}`,
                      category: "warranty_refund",
                      costType: "warranty_cost",
                      referenceType: "repair",
                      referenceId: repair.id,
                      isAutomatic: 1,
                      amount: refundDiff,
                      paymentMethod: diffMethod,
                      expenseDate: new Date().toISOString(),
                      status: "paid",
                      userId: ctx.user.id,
                      notes: `Diferencia a favor del cliente en cambio por equipo de menor valor`,
                      createdAt: new Date().toISOString(),
                    });
                  }

                  // Emitir garantía para la unidad de reemplazo
                  const prevW = (MOCK_WARRANTIES as any[]).find((w: any) => w.unitId === repair.unitId);
                  const wDays = prevW?.days || 30;
                  const now = new Date();
                  const end = new Date(now.getTime() + wDays * 24 * 60 * 60 * 1000);
                  MOCK_WARRANTIES.push({
                    id: Date.now() + 2,
                    unitId: repUnit.id,
                    saleId: prevW?.saleId || null,
                    startDate: now.toISOString(),
                    endDate: end.toISOString(),
                    days: wDays,
                    status: "active",
                    terms: `Garantía transferida por cambio de equipo (${rmaCode}). Original: ${unit?.code || repair.unitId}`,
                    createdAt: now.toISOString(),
                  });

                  resolutionNotes += ` | Cambio por equipo: ${repUnit.code} ${repUnit.brand} ${repUnit.model}`;
                }
              }
            }

            MOCK_UNITS[unitIdx] = { ...MOCK_UNITS[unitIdx], status: finalUnitStatus, updatedAt: new Date().toISOString() };
            const rmaLabel = repair.otNumber || repair.rmaNumber || `#${repair.id}`;
            MOCK_UNIT_EVENTS.push({
              id: Date.now(),
              unitId: repair.unitId,
              eventType: isSecondEntry ? `repair_completed_${input.resolutionType}` : `repair_completed_${input.resolutionType}`,
              fromStatus: "in_repair",
              toStatus: finalUnitStatus,
              userId: ctx.user.id,
              notes: `Reparación finalizada (${rmaLabel}). Unidad: ${finalUnitStatus}${resolutionNotes ? ` | ${resolutionNotes}` : ""}`,
              createdAt: new Date().toISOString(),
            });

            // ── Reanudar garantía si el equipo vuelve al cliente ─────────
            if (input.resolutionType === "return_to_customer") {
              mockResumeWarranty(repair.unitId);
            }

            // Registrar costo de reparación si hay costos > 0
            const totalRepairCost = (updatedRepair.laborCost || 0) + (updatedRepair.partsCost || 0);
            if (totalRepairCost > 0) {
              const unit = MOCK_UNITS[unitIdx];
              const isWarrantyRepair = isSecondEntry; // 2do ingreso = reparación de garantía
              await createAutomaticOperationalExpense({
                branchId: 1,
                description: `${isWarrantyRepair ? "Costo Garantía" : "Costo Reparación"} - ${unit?.brand || ""} ${unit?.model || ""} (${rmaLabel})`,
                category: isWarrantyRepair ? "warranty_repair_cost" : "repair_cost",
                costType: isWarrantyRepair ? "warranty_cost" : "repair_cost",
                referenceType: "repair",
                referenceId: repair.id,
                amount: totalRepairCost,
                paymentMethod: "cash",
                userId: ctx.user.id,
                notes: `M.O.: ${updatedRepair.laborCost || 0} | Repuestos: ${updatedRepair.partsCost || 0}`,
                status: "paid",
              });
            }
          }
        } else if (input.status === "cancelled") {
          const unitIdx = MOCK_UNITS.findIndex((u: any) => u.id === repair.unitId);
          if (unitIdx !== -1) {
            MOCK_UNITS[unitIdx] = { ...MOCK_UNITS[unitIdx], status: "in_diagnosis", updatedAt: new Date().toISOString() };
            MOCK_UNIT_EVENTS.push({
              id: Date.now(),
              unitId: repair.unitId,
              eventType: "repair_cancelled",
              fromStatus: "in_repair",
              toStatus: "in_diagnosis",
              userId: ctx.user.id,
              notes: `Reparación cancelada (Orden #${repair.id}).`,
              createdAt: new Date().toISOString(),
            });
          }
        }

        syncMocksToDisk();
        return { success: true };
      }

      // === DB MODE ===
      const [repair] = await db
        .select()
        .from(repairs)
        .where(eq(repairs.id, input.id))
        .limit(1);

      if (!repair) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Orden de reparación no encontrada" });
      }

      const updateData: Record<string, any> = {};

      if (input.status !== undefined) {
        updateData.status = input.status;
        if (input.status === "completed" || input.status === "cancelled") {
          updateData.endDate = new Date();
        }
      }

      if (input.partsUsed !== undefined) {
        updateData.partsUsed = JSON.stringify(input.partsUsed);
      }
      if (input.laborCost !== undefined) updateData.laborCost = input.laborCost;
      if (input.partsCost !== undefined) updateData.partsCost = input.partsCost;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.resolutionType !== undefined) updateData.resolutionType = input.resolutionType;
      if (input.secondaryRepairNotes !== undefined) {
        updateData.notes = (updateData.notes || repair.notes || "") + ` | Secundaria: ${input.secondaryRepairNotes}`;
      }

      await db
        .update(repairs)
        .set(updateData)
        .where(eq(repairs.id, input.id));

      if (input.status === "completed") {
        if (!input.resolutionType) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Para cerrar la reparación elegí una opción de resolución (A: devolver al cliente, B: retornar a inventario).",
          });
        }

        // Detectar 2do ingreso (para evento de auditoría y aviso)
        const otherCompletedResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(repairs)
          .where(
            and(
              eq(repairs.unitId, repair.unitId),
              eq(repairs.status, "completed"),
              sql`${repairs.id} != ${repair.id}`
            )
          );
        const isSecondEntry = Number(otherCompletedResult[0]?.count || 0) >= 1;

        let finalUnitStatus = input.targetUnitStatus;
        let resolutionNotes = "";

        if (input.resolutionType === "return_to_customer") {
          // Restaurar el estado que tenía la unidad antes de entrar al taller.
          // Buscamos el último unitEvent con toStatus='in_repair' (el ingreso actual)
          // y usamos su fromStatus como estado de retorno. Si no hay evento,
          // caemos al estado actual de la unidad (caso borde: repair creada sin evento).
          const preRepairEvents = await db
            .select({ fromStatus: unitEvents.fromStatus, id: unitEvents.id })
            .from(unitEvents)
            .where(
              and(
                eq(unitEvents.unitId, repair.unitId),
                eq(unitEvents.toStatus, "in_repair")
              )
            )
            .orderBy(desc(unitEvents.id))
            .limit(1);
          const [currentUnit] = await db.select().from(units).where(eq(units.id, repair.unitId)).limit(1);
          type UnitStatus = "available" | "in_diagnosis" | "in_repair" | "sold";
          const allowed: UnitStatus[] = ["available", "in_diagnosis", "in_repair", "sold"];
          const rawFrom = preRepairEvents[0]?.fromStatus as UnitStatus | null | undefined;
          const preRepairStatus: UnitStatus =
            (rawFrom && allowed.includes(rawFrom) ? rawFrom : undefined) ||
            (currentUnit?.status as UnitStatus | undefined) ||
            "sold";
          finalUnitStatus = preRepairStatus;
          if (input.warrantyId && input.extendWarrantyDays) {
            const [existingW] = await db.select().from(warranties).where(eq(warranties.id, input.warrantyId)).limit(1);
            if (existingW) {
              const baseEnd = existingW.endDate ? new Date(existingW.endDate) : new Date();
              const newEndDate = new Date(baseEnd.getTime() + input.extendWarrantyDays * 24 * 60 * 60 * 1000);
              const previousDays = existingW.days || 0;
              await db
                .update(warranties)
                .set({
                  endDate: newEndDate,
                  days: previousDays + input.extendWarrantyDays,
                  status: "active",
                })
                .where(eq(warranties.id, input.warrantyId));
              resolutionNotes = `Garantía extendida +${input.extendWarrantyDays} días (total: ${previousDays + input.extendWarrantyDays} días)`;
            }
          } else {
            resolutionNotes = "Re-entregado al cliente (sin extensión de garantía)";
          }
        } else if (input.resolutionType === "return_to_inventory") {
          finalUnitStatus = "available";
          resolutionNotes = "Retornado a inventario de venta";

          // 1. Cerrar la garantía previa de esta unidad para que no figure activa en inventario
          await db
            .update(warranties)
            .set({ status: "claimed", pausedAt: null, remainingDaysAtPause: null })
            .where(eq(warranties.unitId, repair.unitId));

          // 2. Compensación al cliente
          const [u] = await db.select().from(units).where(eq(units.id, repair.unitId)).limit(1);
          const branchId = u?.branchId || ctx.branchId || 1;
          const rmaCode = repair.otNumber || repair.rmaNumber || `#${repair.id}`;

          if (input.customerResolution === "refund" && input.refundAmount && input.refundAmount > 0) {
            const method = input.refundPaymentMethod || "cash";

            // Egreso de Caja
            await db.insert(schema.financialTransactions).values({
              branchId,
              type: "expense",
              category: "warranty_refund",
              amount: input.refundAmount,
              paymentMethod: method,
              referenceId: repair.id,
              userId: ctx.user.id,
              notes: `Reembolso garantía / devolución de cliente - ${u?.brand || ""} ${u?.model || ""} (${rmaCode})`,
            });

            // Gasto operativo
            await db.insert(schema.operationalExpenses).values({
              branchId,
              description: `Reembolso Garantía - ${u?.brand || ""} ${u?.model || ""} (${rmaCode})`,
              category: "warranty_refund",
              costType: "warranty_cost",
              referenceType: "repair",
              referenceId: repair.id,
              isAutomatic: 1,
              amount: input.refundAmount,
              paymentMethod: method,
              expenseDate: new Date(),
              status: "paid",
              userId: ctx.user.id,
              notes: `Devolución de dinero al cliente por retorno de equipo a inventario`,
            });

            resolutionNotes += ` | Reembolso cliente: Bs. ${(input.refundAmount / 100).toFixed(2)} (${method})`;
          } else if (input.customerResolution === "exchange" && input.replacementUnitId) {
            const [repUnit] = await db.select().from(units).where(eq(units.id, input.replacementUnitId)).limit(1);
            if (repUnit) {
              await db.update(units).set({ status: "sold", updatedAt: new Date() }).where(eq(units.id, repUnit.id));

              await db.insert(unitEvents).values({
                unitId: repUnit.id,
                eventType: "sold",
                fromStatus: "available",
                toStatus: "sold",
                userId: ctx.user.id,
                notes: `Entregado al cliente como cambio/reemplazo de garantía por equipo ${u?.code || repair.unitId} (${rmaCode})`,
              });

              const diff = input.priceDifference || 0;
              const diffMethod = input.differencePaymentMethod || "cash";

              if (diff > 0) {
                // Cliente paga diferencia -> Ingreso en caja
                await db.insert(schema.financialTransactions).values({
                  branchId,
                  type: "income",
                  category: "sale",
                  amount: diff,
                  paymentMethod: diffMethod,
                  referenceId: repair.id,
                  userId: ctx.user.id,
                  notes: `Cobro diferencia cambio de equipo garantía - ${u?.code} por ${repUnit.code} (${rmaCode})`,
                });
              } else if (diff < 0) {
                // Tienda reembolsa diferencia -> Egreso en caja
                const refundDiff = Math.abs(diff);
                await db.insert(schema.financialTransactions).values({
                  branchId,
                  type: "expense",
                  category: "warranty_refund",
                  amount: refundDiff,
                  paymentMethod: diffMethod,
                  referenceId: repair.id,
                  userId: ctx.user.id,
                  notes: `Reembolso diferencia cambio de equipo garantía - ${u?.code} por ${repUnit.code} (${rmaCode})`,
                });

                await db.insert(schema.operationalExpenses).values({
                  branchId,
                  description: `Reembolso diferencia cambio garantía - ${u?.code} por ${repUnit.code}`,
                  category: "warranty_refund",
                  costType: "warranty_cost",
                  referenceType: "repair",
                  referenceId: repair.id,
                  isAutomatic: 1,
                  amount: refundDiff,
                  paymentMethod: diffMethod,
                  expenseDate: new Date(),
                  status: "paid",
                  userId: ctx.user.id,
                  notes: `Diferencia a favor del cliente en cambio por equipo de menor valor`,
                });
              }

              // Emitir garantía para la nueva unidad de reemplazo
              const [prevW] = await db.select().from(warranties).where(eq(warranties.unitId, repair.unitId)).limit(1);
              const wDays = prevW?.days || 30;
              const now = new Date();
              const end = new Date(now.getTime() + wDays * 24 * 60 * 60 * 1000);
              await db.insert(warranties).values({
                unitId: repUnit.id,
                saleId: prevW?.saleId || null,
                startDate: now,
                endDate: end,
                days: wDays,
                status: "active",
                terms: `Garantía transferida por cambio de equipo (${rmaCode}). Original: ${u?.code || repair.unitId}`,
              });

              resolutionNotes += ` | Cambio por equipo: ${repUnit.code} ${repUnit.brand} ${repUnit.model}`;
            }
          }
        }

        await db
          .update(units)
          .set({ status: finalUnitStatus })
          .where(eq(units.id, repair.unitId));

        const rmaLabel = repair.otNumber || repair.rmaNumber || `#${repair.id}`;
        await db.insert(unitEvents).values({
          unitId: repair.unitId,
          eventType: `repair_completed_${input.resolutionType}`,
          fromStatus: "in_repair",
          toStatus: finalUnitStatus,
          userId: ctx.user.id,
          notes: `Reparación finalizada (${rmaLabel}). Unidad: ${finalUnitStatus}${resolutionNotes ? ` | ${resolutionNotes}` : ""}${isSecondEntry ? " | Re-ingreso" : ""}`,
        });

        // ── Reanudar garantía si el equipo vuelve al cliente ─────────────
        if (input.resolutionType === "return_to_customer") {
          await dbResumeWarranty(db, repair.unitId);
        }

        // Registrar costo de reparación si hay costos > 0
        const finalLaborCost = input.laborCost !== undefined ? input.laborCost : repair.laborCost;
        const finalPartsCost = input.partsCost !== undefined ? input.partsCost : repair.partsCost;
        const totalRepairCost = (finalLaborCost || 0) + (finalPartsCost || 0);
        if (totalRepairCost > 0) {
          const [unitForCost] = await db.select({ brand: units.brand, model: units.model, branchId: units.branchId })
            .from(units).where(eq(units.id, repair.unitId)).limit(1);
          const isWarrantyRepair = isSecondEntry;
          await db.insert(schema.operationalExpenses).values({
            branchId: unitForCost?.branchId || ctx.branchId || 1,
            description: `${isWarrantyRepair ? "Costo Garantía" : "Costo Reparación"} - ${unitForCost?.brand || ""} ${unitForCost?.model || ""} (${rmaLabel})`,
            category: isWarrantyRepair ? "warranty_repair_cost" : "repair_cost",
            costType: isWarrantyRepair ? "warranty_cost" : "repair_cost",
            referenceType: "repair",
            referenceId: repair.id,
            isAutomatic: 1,
            amount: totalRepairCost,
            paymentMethod: "cash",
            expenseDate: new Date(),
            status: "paid",
            userId: ctx.user.id,
            notes: `M.O.: ${finalLaborCost || 0} | Repuestos: ${finalPartsCost || 0}`,
          });

          await db.insert(financialTransactions).values({
            type: "expense",
            category: isWarrantyRepair ? "warranty_repair_cost" : "repair_cost",
            amount: totalRepairCost,
            paymentMethod: "cash",
            referenceId: repair.id,
            userId: ctx.user.id,
            branchId: unitForCost?.branchId || ctx.branchId || 1,
            notes: `${isWarrantyRepair ? "Costo Garantía" : "Costo Reparación"} (${rmaLabel}) · M.O.: ${finalLaborCost || 0} | Repuestos: ${finalPartsCost || 0}`,
          });
        }
      } else if (input.status === "cancelled") {
        await db
          .update(units)
          .set({ status: "in_diagnosis" })
          .where(eq(units.id, repair.unitId));

        await db.insert(unitEvents).values({
          unitId: repair.unitId,
          eventType: "repair_cancelled",
          fromStatus: "in_repair",
          toStatus: "in_diagnosis",
          userId: ctx.user.id,
          notes: `Reparación cancelada (Orden #${repair.id}).`,
        });
      }

      return { success: true };
    }),

  // Obtener Orden de Trabajo / Formulario de Ingreso al Taller completo para impresión/PDF
  getWorkOrder: protectedProcedure
    .input(
      z.object({
        repairId: z.number().optional(),
        unitId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const company = await readCompanyConfig();

      const reqRepairId = input.repairId ? Number(input.repairId) : null;
      const reqUnitId = input.unitId ? Number(input.unitId) : null;

      if (!reqRepairId && !reqUnitId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Debe proporcionar repairId o unitId" });
      }

      const safeParseObj = (val: any, fallback: any = {}) => {
        if (!val) return fallback;
        if (typeof val === "object") return val;
        try { return JSON.parse(val); } catch { return fallback; }
      };

      const safeParseArr = (val: any, fallback: any = []) => {
        if (!val) return fallback;
        if (Array.isArray(val)) return val;
        try { const p = JSON.parse(val); return Array.isArray(p) ? p : fallback; } catch { return fallback; }
      };

      // === DEMO MODE ===
      if (!db) {
        let repair: any = null;
        if (reqRepairId) {
          repair = MOCK_REPAIRS.find((r: any) => Number(r.id) === reqRepairId) || null;
        }
        if (!repair && reqUnitId) {
          const unitRepairs = MOCK_REPAIRS.filter((r: any) => Number(r.unitId) === reqUnitId);
          repair = unitRepairs.sort((a: any, b: any) => Number(b.id) - Number(a.id))[0] || null;
        }

        const targetUnitId = repair ? Number(repair.unitId) : reqUnitId;
        const unit = MOCK_UNITS.find((u: any) => Number(u.id) === Number(targetUnitId))
          || (reqUnitId ? MOCK_UNITS.find((u: any) => Number(u.id) === reqUnitId) : null);

        if (!unit) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Equipo no encontrado (ID: ${targetUnitId || reqUnitId})` });
        }

        const technician = repair?.technicianId
          ? (MOCK_USERS as any[]).find((u: any) => Number(u.id) === Number(repair.technicianId))
          : ctx.user;

        const warranty = (MOCK_WARRANTIES as any[]).find((w: any) => Number(w.unitId) === Number(unit.id) && w.status === "active")
          || (MOCK_WARRANTIES as any[]).find((w: any) => Number(w.unitId) === Number(unit.id));

        let customer: any = null;
        if (warranty?.customerId) {
          customer = (MOCK_CUSTOMERS as any[]).find((c: any) => Number(c.id) === Number(warranty.customerId));
        }

        const specsParsed = safeParseObj(unit.specs, {});
        const damageChecklistParsed = safeParseObj(unit.damageChecklist, {});
        const photosParsed = safeParseArr(unit.photos, []);

        const otNumber = repair?.otNumber || (repair?.id ? `OT-${String(repair.id).slice(-5).padStart(5, "0")}` : `OT-${String(unit.id).padStart(5, "0")}`);
        const rmaNumber = unit.rmaNumber || repair?.rmaNumber || null;

        return {
          workOrder: {
            otNumber,
            rmaNumber,
            repairId: repair?.id ? Number(repair.id) : null,
            status: repair?.status || "in_progress",
            entryDate: repair?.startDate || repair?.createdAt || new Date().toISOString(),
            exitDate: repair?.endDate || null,
            reportedIssue: repair?.notes || "Revisión técnica general y mantenimiento",
            technicalNotes: repair?.notes || "",
            laborCost: repair?.laborCost ? Number(repair.laborCost) : 0,
            partsCost: repair?.partsCost ? Number(repair.partsCost) : 0,
            totalCost: (repair?.laborCost ? Number(repair.laborCost) : 0) + (repair?.partsCost ? Number(repair.partsCost) : 0),
            technicianName: technician?.name || ctx.user.name || "Servicio Técnico Autorizado",
            technicianRole: technician?.role === "admin" ? "Jefe de Taller" : "Técnico Especialista",
          },
          unit: {
            id: Number(unit.id),
            code: unit.code || "S/C",
            type: unit.type || "laptop",
            brand: unit.brand || "Equipo",
            model: unit.model || "Técnico",
            serialNumber: unit.serialNumber || "S/N no especificado",
            specs: specsParsed,
            condition: unit.condition || "used",
            batteryHealth: unit.batteryHealth || "100",
            damageChecklist: damageChecklistParsed,
            damageNotes: unit.damageNotes || "",
            photos: Array.isArray(photosParsed) ? photosParsed.slice(0, 3) : [],
          },
          customer: customer ? {
            id: Number(customer.id),
            name: customer.name,
            phone: customer.phone || customer.whatsapp || "No registrado",
            whatsapp: customer.whatsapp || customer.phone || "",
            taxId: customer.taxId || "S/N",
            address: customer.address || "La Paz",
          } : null,
          warranty: warranty ? {
            id: Number(warranty.id),
            days: warranty.days || 30,
            startDate: warranty.startDate,
            endDate: warranty.endDate,
            status: warranty.status,
          } : null,
          company,
          generatedAt: new Date().toISOString(),
        };
      }

      // === DB MODE ===
      let repairRecord: any = null;
      if (reqRepairId) {
        const [rep] = await db.select().from(repairs).where(eq(repairs.id, reqRepairId)).limit(1);
        repairRecord = rep || null;
      }
      if (!repairRecord && reqUnitId) {
        const [rep] = await db
          .select()
          .from(repairs)
          .where(eq(repairs.unitId, reqUnitId))
          .orderBy(desc(repairs.id))
          .limit(1);
        repairRecord = rep || null;
      }

      const targetUnitId = repairRecord ? Number(repairRecord.unitId) : reqUnitId;
      const [unitRecord] = await db.select().from(units).where(eq(units.id, targetUnitId!)).limit(1);

      if (!unitRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Equipo no encontrado (ID: ${targetUnitId})` });
      }

      let technicianRecord: any = null;
      if (repairRecord?.technicianId) {
        const [t] = await db.select().from(users).where(eq(users.id, Number(repairRecord.technicianId))).limit(1);
        technicianRecord = t || null;
      }

      const [warrantyRecord] = await db
        .select()
        .from(warranties)
        .where(eq(warranties.unitId, Number(unitRecord.id)))
        .orderBy(desc(warranties.id))
        .limit(1);

      let customerRecord: any = null;
      if (warrantyRecord?.customerId) {
        const [cust] = await db.select().from(customers).where(eq(customers.id, Number(warrantyRecord.customerId))).limit(1);
        customerRecord = cust || null;
      }

      const specsParsed = safeParseObj(unitRecord.specs, {});
      const damageChecklistParsed = safeParseObj(unitRecord.damageChecklist, {});
      const photosParsed = safeParseArr(unitRecord.photos, []);

      const otNumber = repairRecord?.otNumber || (repairRecord?.id ? `OT-${String(repairRecord.id).padStart(5, "0")}` : `OT-${String(unitRecord.id).padStart(5, "0")}`);
      const rmaNumber = unitRecord.rmaNumber || repairRecord?.rmaNumber || null;

      return {
        workOrder: {
          otNumber,
          rmaNumber,
          repairId: repairRecord?.id ? Number(repairRecord.id) : null,
          status: repairRecord?.status || "in_progress",
          entryDate: repairRecord?.startDate || repairRecord?.createdAt || new Date().toISOString(),
          exitDate: repairRecord?.endDate || null,
          reportedIssue: repairRecord?.notes || "Revisión técnica general y mantenimiento",
          technicalNotes: repairRecord?.notes || "",
          laborCost: repairRecord?.laborCost ? Number(repairRecord.laborCost) : 0,
          partsCost: repairRecord?.partsCost ? Number(repairRecord.partsCost) : 0,
          totalCost: (repairRecord?.laborCost ? Number(repairRecord.laborCost) : 0) + (repairRecord?.partsCost ? Number(repairRecord.partsCost) : 0),
          technicianName: technicianRecord?.name || ctx.user.name || "Servicio Técnico Autorizado",
          technicianRole: technicianRecord?.role === "admin" ? "Jefe de Taller" : "Técnico Especialista",
        },
        unit: {
          id: Number(unitRecord.id),
          code: unitRecord.code || "S/C",
          type: unitRecord.type || "laptop",
          brand: unitRecord.brand || "Equipo",
          model: unitRecord.model || "Técnico",
          serialNumber: unitRecord.serialNumber || "S/N no especificado",
          specs: specsParsed,
          condition: unitRecord.condition || "used",
          batteryHealth: unitRecord.batteryHealth || "100",
          damageChecklist: damageChecklistParsed,
          damageNotes: unitRecord.damageNotes || "",
          photos: Array.isArray(photosParsed) ? photosParsed.slice(0, 3) : [],
        },
        customer: customerRecord ? {
          id: Number(customerRecord.id),
          name: customerRecord.name,
          phone: customerRecord.phone || customerRecord.whatsapp || "No registrado",
          whatsapp: customerRecord.whatsapp || customerRecord.phone || "",
          taxId: customerRecord.taxId || "S/N",
          address: customerRecord.address || "La Paz",
        } : null,
        warranty: warrantyRecord ? {
          id: Number(warrantyRecord.id),
          days: warrantyRecord.days || 30,
          startDate: warrantyRecord.startDate,
          endDate: warrantyRecord.endDate,
          status: warrantyRecord.status,
        } : null,
        company,
        generatedAt: new Date().toISOString(),
      };
    }),
});
