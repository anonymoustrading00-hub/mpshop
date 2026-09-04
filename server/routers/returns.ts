import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDb,
  MOCK_RETURNS,
  MOCK_REPAIRS,
  MOCK_UNITS,
  MOCK_UNIT_EVENTS,
  MOCK_WARRANTIES,
  syncMocksToDisk,
  createAutomaticOperationalExpense,
} from "../db";
import { repairs, returns, warranties, units, unitEvents } from "../../drizzle/schema";
import * as schema from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

// â”€â”€â”€ Warranty pause helpers (inline) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mockPauseWarrantyReturns(unitId: number): void {
  const now = new Date();
  const idx = (MOCK_WARRANTIES as any[]).findIndex(
    (w: any) => w.unitId === unitId && (w.status === "active" || !w.status) && !w.pausedAt
  );
  if (idx === -1) return;
  const w = MOCK_WARRANTIES[idx];
  const endDate = w.endDate ? new Date(w.endDate) : now;
  const daysLeft = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  MOCK_WARRANTIES[idx] = { ...w, pausedAt: now.toISOString(), remainingDaysAtPause: daysLeft };
}

async function dbPauseWarrantyReturns(db: any, unitId: number): Promise<void> {
  const now = new Date();
  const [existing] = await db.select().from(warranties)
    .where(and(eq(warranties.unitId, unitId), eq(warranties.status, "active"), sql`${warranties.pausedAt} IS NULL`))
    .limit(1);
  if (!existing) return;
  const daysLeft = Math.max(0, Math.floor((new Date(existing.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  await db.update(warranties).set({ pausedAt: now, remainingDaysAtPause: daysLeft }).where(eq(warranties.id, existing.id));
}

// â”€â”€â”€ Warranty claim helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mockClaimWarranty(unitId: number, warrantyId?: number): void {
  const idx = (MOCK_WARRANTIES as any[]).findIndex(
    (w: any) => (warrantyId ? w.id === warrantyId : w.unitId === unitId)
  );
  if (idx !== -1) MOCK_WARRANTIES[idx] = { ...MOCK_WARRANTIES[idx], status: "claimed" };
}

async function dbClaimWarranty(db: any, unitId: number, warrantyId?: number): Promise<void> {
  if (warrantyId) {
    await db.update(warranties).set({ status: "claimed" }).where(eq(warranties.id, warrantyId));
  } else {
    await db.update(warranties).set({ status: "claimed" }).where(eq(warranties.unitId, unitId));
  }
}

/**
 * Genera el siguiente nÃºmero RMA con formato RMA-AAAA-NNNNNN (anual con reset).
 * Misma firma y comportamiento que en server/routers/repairs.ts. Se duplica aquÃ­
 * para evitar acoplamiento entre routers; si se mueve a un util compartido,
 * mantener la firma.
 */
async function getNextRepairNumber(db: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RMA-${year}-`;
  const numLen = 6;
  const yearPattern = /^RMA-\d{4}-(\d+)$/;

  if (!db) {
    const nums = (MOCK_REPAIRS as any[])
      .map((r) => (r?.rmaNumber || "").match(yearPattern)?.[1])
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(numLen, "0");
  }

  const likePrefix = `${prefix}%`;
  const rows: any = await db
    .select({ rmaNumber: repairs.rmaNumber })
    .from(repairs)
    .where(sql`${repairs.rmaNumber} LIKE ${likePrefix}`)
    .orderBy(desc(repairs.id))
    .limit(50);

  const nums = (rows as any[])
    .map((r) => (r?.rmaNumber || "").match(yearPattern)?.[1])
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(next).padStart(numLen, "0");
}

export const returnsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        unitId: z.number().optional(),
        warrantyId: z.number().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        let filtered = [...MOCK_RETURNS];
        if (input?.unitId) filtered = filtered.filter((r: any) => r.unitId === input.unitId);
        if (input?.warrantyId) filtered = filtered.filter((r: any) => r.warrantyId === input.warrantyId);

        const items = filtered
          .sort((a: any, b: any) => b.id - a.id)
          .slice(input?.offset || 0, (input?.offset || 0) + (input?.limit || 50))
          .map((r: any) => {
            const unit = MOCK_UNITS.find((u: any) => u.id === r.unitId);
            return {
              id: r.id,
              warrantyId: r.warrantyId,
              unitId: r.unitId,
              unitCode: unit?.code || "â€”",
              unitBrand: unit?.brand || "â€”",
              unitModel: unit?.model || "â€”",
              returnDate: r.returnDate,
              reason: r.reason,
              resolution: r.resolution,
              reenteredRepair: r.reenteredRepair,
              createdAt: r.createdAt,
            };
          });

        return { items, total: filtered.length };
      }

      const conditions = [];
      if (input?.unitId) conditions.push(eq(returns.unitId, input.unitId));
      if (input?.warrantyId) conditions.push(eq(returns.warrantyId, input.warrantyId));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await db
        .select({
          id: returns.id,
          warrantyId: returns.warrantyId,
          unitId: returns.unitId,
          unitCode: units.code,
          unitBrand: units.brand,
          unitModel: units.model,
          returnDate: returns.returnDate,
          reason: returns.reason,
          resolution: returns.resolution,
          reenteredRepair: returns.reenteredRepair,
          createdAt: returns.createdAt,
        })
        .from(returns)
        .leftJoin(units, eq(returns.unitId, units.id))
        .where(whereClause)
        .orderBy(desc(returns.id))
        .limit(input?.limit || 50)
        .offset(input?.offset || 0);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(returns)
        .where(whereClause);

      return {
        items,
        total: Number(countResult[0]?.count || 0),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        unitId: z.number(),
        warrantyId: z.number().optional(),
        saleId: z.number().optional(),
        reason: z.string().min(1, "Motivo requerido"),
        resolution: z.string().optional(),
        reenteredRepair: z.boolean().default(true),
        // DevoluciÃ³n de dinero al cliente (opcional â€” solo cuando NO re-ingresa a taller)
        refundAmount: z.number().min(0).optional(),
        refundPaymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
        // DevoluciÃ³n con reemplazo: cliente recibe otro equipo
        replacementUnitId: z.number().optional(),
        replacementCostDifference: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // DEMO MODE
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      if (!db) {
        const unitIdx = MOCK_UNITS.findIndex((u: any) => u.id === input.unitId);
        if (unitIdx === -1) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });
        }
        const oldStatus = MOCK_UNITS[unitIdx].status;

        const returnId = Date.now();
        MOCK_RETURNS.push({
          id: returnId,
          warrantyId: input.warrantyId || null,
          saleId: input.saleId || null,
          unitId: input.unitId,
          returnDate: new Date().toISOString(),
          reason: input.reason,
          resolution: input.resolution || null,
          reenteredRepair: input.reenteredRepair ? 1 : 0,
          refundAmount: input.refundAmount || null,
          refundPaymentMethod: input.refundPaymentMethod || null,
          createdAt: new Date().toISOString(),
        });

        const targetStatus = input.reenteredRepair ? "in_repair" : "returned";

        MOCK_UNITS[unitIdx] = {
          ...MOCK_UNITS[unitIdx],
          status: targetStatus,
          updatedAt: new Date().toISOString(),
        };

        MOCK_UNIT_EVENTS.push({
          id: Date.now() + 1,
          unitId: input.unitId,
          eventType: "return_rma",
          fromStatus: oldStatus,
          toStatus: targetStatus,
          userId: ctx.user.id,
          notes: `DevoluciÃ³n (RMA #${returnId}) - Motivo: ${input.reason}${
            input.reenteredRepair ? " â†’ Reingresado a taller" : ""
          }${input.replacementUnitId ? ` â†’ Reemplazo con unidad #${input.replacementUnitId}` : ""}${
            input.refundAmount ? ` â†’ Reembolso Bs. ${(input.refundAmount / 100).toFixed(2)}` : ""
          }`,
          createdAt: new Date().toISOString(),
        });

        // â”€â”€ Reingreso a taller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (input.reenteredRepair) {
          const repairId = Date.now() + 2;
          const rmaNumber = await getNextRepairNumber(null);
          MOCK_REPAIRS.push({
            id: repairId,
            rmaNumber,
            unitId: input.unitId,
            technicianId: ctx.user.id,
            startDate: new Date().toISOString(),
            endDate: null,
            partsUsed: JSON.stringify([]),
            laborCost: 0,
            partsCost: 0,
            status: "in_progress",
            resolutionType: null,
            notes: `RMA #${returnId}. ${input.reason}`,
            createdAt: new Date().toISOString(),
          });

          MOCK_UNIT_EVENTS.push({
            id: Date.now() + 3,
            unitId: input.unitId,
            eventType: "repair_start",
            fromStatus: oldStatus,
            toStatus: "in_repair",
            userId: ctx.user.id,
            notes: `Ingreso a taller - ${rmaNumber} (post-RMA)`,
            createdAt: new Date().toISOString(),
          });

          // â”€â”€ Pausa automÃ¡tica de garantÃ­a â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          mockPauseWarrantyReturns(input.unitId);
        }

        // â”€â”€ Reembolso de dinero al cliente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (input.refundAmount && input.refundAmount > 0 && input.refundPaymentMethod) {
          // Egreso de caja
          const { MOCK_FINANCIAL_TRANSACTIONS, MOCK_OPERATIONAL_EXPENSES } = await import("../db");
          MOCK_FINANCIAL_TRANSACTIONS.push({
            id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
            branchId: 1,
            type: "expense",
            category: "warranty_refund",
            amount: input.refundAmount,
            paymentMethod: input.refundPaymentMethod,
            referenceId: returnId,
            userId: ctx.user.id,
            notes: `Reembolso garantÃ­a - ${MOCK_UNITS[unitIdx]?.brand || ""} ${MOCK_UNITS[unitIdx]?.model || ""} (RMA #${returnId})`,
            createdAt: new Date().toISOString(),
          });

          MOCK_OPERATIONAL_EXPENSES.push({
            id: MOCK_OPERATIONAL_EXPENSES.length + 1,
            branchId: 1,
            description: `Reembolso GarantÃ­a - ${MOCK_UNITS[unitIdx]?.brand || ""} ${MOCK_UNITS[unitIdx]?.model || ""}`,
            category: "warranty_replacement_cost",
            costType: "warranty_cost",
            referenceType: "return",
            referenceId: returnId,
            isAutomatic: 1,
            amount: input.refundAmount,
            paymentMethod: input.refundPaymentMethod,
            expenseDate: new Date().toISOString(),
            status: "paid",
            userId: ctx.user.id,
            notes: `DevoluciÃ³n de dinero al cliente por garantÃ­a`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Marcar garantÃ­a como reclamada
          mockClaimWarranty(input.unitId, input.warrantyId);
        }

        // ── Reemplazo de equipo ──────────────────────────────────────────
        if (input.replacementUnitId) {
          const replacedUnit = MOCK_UNITS[unitIdx];
          const replacementUnit = MOCK_UNITS.find((u: any) => u.id === input.replacementUnitId);
          const netCostToCompany = Math.max(0, (replacementUnit?.purchasePrice || 0) - (input.replacementCostDifference || 0));
          if (netCostToCompany > 0) {
            await createAutomaticOperationalExpense({
              branchId: 1,
              description: `Costo GarantÃ­a (Reemplazo) - ${replacedUnit?.brand || ""} ${replacedUnit?.model || ""} â†’ ${replacementUnit?.brand || ""} ${replacementUnit?.model || ""}`,
              category: "warranty_replacement_cost",
              costType: "warranty_cost",
              referenceType: "return",
              referenceId: returnId,
              amount: netCostToCompany,
              paymentMethod: "cash",
              userId: ctx.user.id,
              notes: `Equipo original: ${replacedUnit?.code || input.unitId} | Equipo entregado: ${replacementUnit?.code || input.replacementUnitId} | Diferencia pagada: ${input.replacementCostDifference || 0}`,
              status: "paid",
            });
          }
          const replIdx = MOCK_UNITS.findIndex((u: any) => u.id === input.replacementUnitId);
          if (replIdx !== -1) {
            MOCK_UNITS[replIdx] = { ...MOCK_UNITS[replIdx], status: "sold", updatedAt: new Date().toISOString() };
          }
          // Marcar garantÃ­a como reclamada
          mockClaimWarranty(input.unitId, input.warrantyId);
        }

        syncMocksToDisk();
        return { success: true, returnId };
      }

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // DB MODE
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      const [unit] = await db.select().from(units).where(eq(units.id, input.unitId)).limit(1);
      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });

      const [insertResult] = await db.insert(returns).values({
        unitId: input.unitId,
        warrantyId: input.warrantyId || null,
        saleId: input.saleId || null,
        returnDate: new Date(),
        reason: input.reason,
        resolution: input.resolution || null,
        reenteredRepair: input.reenteredRepair ? 1 : 0,
        refundAmount: input.refundAmount || null,
        refundPaymentMethod: input.refundPaymentMethod || null,
      });

      const returnId = insertResult?.insertId || insertResult?.[0]?.insertId;
      const targetStatus = input.reenteredRepair ? "in_repair" : "returned";
      const oldStatus = unit.status;

      await db.update(units).set({ status: targetStatus }).where(eq(units.id, input.unitId));

      await db.insert(unitEvents).values({
        unitId: input.unitId,
        eventType: "return_rma",
        fromStatus: oldStatus,
        toStatus: targetStatus,
        userId: ctx.user.id,
        notes: `DevoluciÃ³n (RMA #${returnId}) - Motivo: ${input.reason}${
          input.reenteredRepair ? " â†’ Reingresado a taller" : ""
        }${input.replacementUnitId ? ` â†’ Reemplazo con unidad #${input.replacementUnitId}` : ""}${
          input.refundAmount ? ` â†’ Reembolso Bs. ${(input.refundAmount / 100).toFixed(2)}` : ""
        }`,
      });

      // â”€â”€ Reingreso a taller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (input.reenteredRepair) {
        const rmaNumber = await getNextRepairNumber(db);
        await db.insert(repairs).values({
          rmaNumber,
          unitId: input.unitId,
          technicianId: ctx.user.id,
          startDate: new Date(),
          partsUsed: JSON.stringify([]),
          laborCost: 0,
          partsCost: 0,
          status: "in_progress",
          notes: `RMA #${returnId}. ${input.reason}`,
        });

        await db.insert(unitEvents).values({
          unitId: input.unitId,
          eventType: "repair_start",
          fromStatus: oldStatus,
          toStatus: "in_repair",
          userId: ctx.user.id,
          notes: `Ingreso a taller - (post-RMA #${returnId})`,
        });

        // â”€â”€ Pausa automÃ¡tica de garantÃ­a â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        await dbPauseWarrantyReturns(db, input.unitId);
      }

      // â”€â”€ Reembolso de dinero al cliente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (input.refundAmount && input.refundAmount > 0 && input.refundPaymentMethod) {
        // Egreso de caja
        await db.insert(schema.financialTransactions).values({
          branchId: unit.branchId || ctx.branchId || 1,
          type: "expense",
          category: "warranty_refund",
          amount: input.refundAmount,
          paymentMethod: input.refundPaymentMethod,
          referenceId: returnId,
          userId: ctx.user.id,
          notes: `Reembolso garantÃ­a - ${unit.brand} ${unit.model} (RMA #${returnId})`,
        });

        // Registro en costos/gastos
        await db.insert(schema.operationalExpenses).values({
          branchId: unit.branchId || ctx.branchId || 1,
          description: `Reembolso GarantÃ­a - ${unit.brand} ${unit.model}`,
          category: "warranty_replacement_cost",
          costType: "warranty_cost",
          referenceType: "return",
          referenceId: returnId,
          isAutomatic: 1,
          amount: input.refundAmount,
          paymentMethod: input.refundPaymentMethod,
          expenseDate: new Date(),
          status: "paid",
          userId: ctx.user.id,
          notes: `DevoluciÃ³n de dinero al cliente por garantÃ­a`,
        });

        // Marcar garantÃ­a como reclamada
        await dbClaimWarranty(db, input.unitId, input.warrantyId);
      }

      // ── Reemplazo de equipo ──────────────────────────────────────────
      if (input.replacementUnitId) {
        const [replacementUnit] = await db.select().from(units).where(eq(units.id, input.replacementUnitId)).limit(1);
        const netCostToCompany = Math.max(0, (replacementUnit?.purchasePrice || 0) - (input.replacementCostDifference || 0));

        if (netCostToCompany > 0) {
          await db.insert(schema.operationalExpenses).values({
            branchId: unit.branchId || ctx.branchId || 1,
            description: `Costo GarantÃ­a (Reemplazo) - ${unit.brand} ${unit.model} â†’ ${replacementUnit?.brand || ""} ${replacementUnit?.model || ""}`,
            category: "warranty_replacement_cost",
            costType: "warranty_cost",
            referenceType: "return",
            referenceId: returnId,
            isAutomatic: 1,
            amount: netCostToCompany,
            paymentMethod: "cash",
            expenseDate: new Date(),
            status: "paid",
            userId: ctx.user.id,
            notes: `Equipo original: ${unit.code} | Equipo entregado: ${replacementUnit?.code || input.replacementUnitId} | Diferencia pagada: ${input.replacementCostDifference || 0}`,
          });

          await db.insert(schema.financialTransactions).values({
            type: "expense",
            category: "warranty_replacement_cost",
            amount: netCostToCompany,
            paymentMethod: "cash",
            referenceId: returnId,
            userId: ctx.user.id,
            branchId: unit.branchId || ctx.branchId || 1,
            notes: `GarantÃ­a Reemplazo - ${unit.code} â†’ ${replacementUnit?.code || input.replacementUnitId}`,
          });
        }

        await db.update(units).set({ status: "sold", updatedAt: new Date() }).where(eq(units.id, input.replacementUnitId));
        await db.insert(unitEvents).values({
          unitId: input.replacementUnitId,
          eventType: "sold",
          fromStatus: "available",
          toStatus: "sold",
          userId: ctx.user.id,
          notes: `Entregado como reemplazo de garantÃ­a (RMA #${returnId})`,
        });

        // Marcar garantÃ­a como reclamada
        await dbClaimWarranty(db, input.unitId, input.warrantyId);
      }

      return { success: true, returnId };
    }),
});
