import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDb,
  getAllUnits,
  getUnitById,
  getUnitByCode,
  createUnit,
  updateUnit,
  MOCK_UNIT_EVENTS,
  MOCK_UNITS,
  MOCK_PURCHASES,
  MOCK_PURCHASE_ITEMS,
  MOCK_FINANCIAL_TRANSACTIONS,
  MOCK_OPERATIONAL_EXPENSES,
  MOCK_REPAIRS,
  MOCK_WARRANTIES,
  MOCK_RETURNS,
  MOCK_SALES,
  MOCK_SALE_ITEMS,
  syncMocksToDisk,
  createAutomaticOperationalExpense,
} from "../db";
import { generatedCodes, units, unitEvents, purchases, purchaseItems, suppliers, financialTransactions, operationalExpenses, users, repairs, warranties, returns, saleItems, sales, systemSettings } from "../../drizzle/schema";
import * as schema from "../../drizzle/schema";
import { eq, like, or, and, desc, sql, asc, inArray } from "drizzle-orm";
import { DEFAULT_COMPANY_CONFIG, readCompanyConfig } from "./settings";

// Tipos de unidad que no requieren diagnóstico (van directo a 'available')
const SIMPLE_TYPES = new Set(["charger", "accessory", "other"]);
function defaultStatusForType(type: string): "in_diagnosis" | "available" {
  return SIMPLE_TYPES.has(type) ? "available" : "in_diagnosis";
}

// Helper: lee configuración de empresa dinámica (compatible con BD y local)
async function getCompanyInfo(_db?: any) {
  return readCompanyConfig();
}

export const unitsRouter = router({
  // Obtener catálogo/listado de unidades con filtros
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.enum(["laptop", "tablet", "phone", "monitor", "charger", "accessory", "other"]).optional(),
        status: z.enum(["in_diagnosis", "in_repair", "available", "sold", "returned"]).optional(),
        branchId: z.number().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }).nullish()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        const allUnits = await getAllUnits();
        let filtered = allUnits as any[];
        if (input?.type) filtered = filtered.filter((u: any) => u.type === input.type);
        if (input?.status) filtered = filtered.filter((u: any) => u.status === input.status);
        if (input?.branchId) filtered = filtered.filter((u: any) => u.branchId === input.branchId);
        if (input?.search) {
          const s = input.search.toLowerCase();
          filtered = filtered.filter((u: any) =>
            u.code?.toLowerCase().includes(s) ||
            u.brand?.toLowerCase().includes(s) ||
            u.model?.toLowerCase().includes(s) ||
            u.serialNumber?.toLowerCase().includes(s) ||
            u.rmaNumber?.toLowerCase().includes(s)
          );
        }
        const total = filtered.length;
        // Aplicar paginación en mock mode
        const limit = input?.limit ?? 100;
        const offset = input?.offset ?? 0;
        const paginated = filtered.slice(offset, offset + limit);

        const sanitized = paginated.map((unit: any) => {
          const specsParsed = typeof unit.specs === "string" ? JSON.parse(unit.specs) : (unit.specs || {});
          const damageChecklistParsed = typeof unit.damageChecklist === "string" ? JSON.parse(unit.damageChecklist) : (unit.damageChecklist || {});
          return {
            ...unit,
            specs: specsParsed,
            damageChecklist: damageChecklistParsed,
          };
        });
        return { items: sanitized, total };
      }

      const conditions = [];

      if (input?.type) {
        conditions.push(eq(units.type, input.type));
      }

      if (input?.status) {
        conditions.push(eq(units.status, input.status));
      }

      if (input?.branchId) {
        conditions.push(eq(units.branchId, input.branchId));
      }

      if (input?.search) {
        const searchTerm = `%${input.search.trim()}%`;
        conditions.push(
          or(
            like(units.code, searchTerm),
            like(units.brand, searchTerm),
            like(units.model, searchTerm),
            like(units.serialNumber, searchTerm),
            like(units.rmaNumber, searchTerm),
            like(units.specs, searchTerm)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await db
        .select()
        .from(units)
        .where(whereClause)
        .orderBy(desc(units.id))
        .limit(input?.limit || 100)
        .offset(input?.offset || 0);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(units)
        .where(whereClause);

      const role = ctx.user.role;

      const sanitizedItems = items.map((unit: any) => {
        const specsParsed = unit.specs ? JSON.parse(unit.specs) : {};
        const damageChecklistParsed = unit.damageChecklist ? JSON.parse(unit.damageChecklist) : {};

        return {
          ...unit,
          specs: specsParsed,
          damageChecklist: damageChecklistParsed,
          purchasePrice: role === "technician" ? null : unit.purchasePrice,
          salePrice: role === "technician" ? null : unit.salePrice,
          discountPrice: role === "technician" ? null : unit.discountPrice,
          wholesalePrice: role === "technician" ? null : unit.wholesalePrice,
          ...(role === "seller" ? { purchasePrice: null } : {}),
        };
      });

      return {
        items: sanitizedItems,
        total: Number(countResult[0]?.count || 0),
      };
    }),

  // Buscar unidad por código (QR, Barcode o código interno)
  // Devuelve el Kardex completo cuando se encuentra la unidad
  getByCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const role = ctx.user.role;

      // ─── MOCK MODE ─────────────────────────────────────────────────────────
      if (!db) {
        const codeStr = input.code.trim();
        const unitByCode = await getUnitByCode(codeStr);
        if (unitByCode) {
          const specs = typeof unitByCode.specs === "string" ? JSON.parse(unitByCode.specs) : (unitByCode.specs || {});
          const damageChecklist = typeof unitByCode.damageChecklist === "string" ? JSON.parse(unitByCode.damageChecklist) : (unitByCode.damageChecklist || {});

          const repairsList = (MOCK_REPAIRS as any[])
            .filter((r: any) => r.unitId === unitByCode.id)
            .sort((a: any, b: any) => a.id - b.id)
            .map((r: any) => ({
              id: r.id, otNumber: r.otNumber || null, rmaNumber: r.rmaNumber || null,
              startDate: r.startDate, endDate: r.endDate, status: r.status,
              resolutionType: r.resolutionType,
              laborCost: role === "seller" ? null : r.laborCost,
              partsCost: role === "seller" ? null : r.partsCost,
              partsUsed: r.partsUsed ? (typeof r.partsUsed === "string" ? JSON.parse(r.partsUsed) : r.partsUsed) : [],
              notes: r.notes, technicianName: "Demo Técnico",
            }));

          const warrantiesList = (MOCK_WARRANTIES as any[])
            .filter((w: any) => w.unitId === unitByCode.id)
            .sort((a: any, b: any) => a.id - b.id);

          const returnsList = (MOCK_RETURNS as any[])
            .filter((r: any) => r.unitId === unitByCode.id)
            .sort((a: any, b: any) => a.id - b.id);

          const saleItemsList = (MOCK_SALE_ITEMS as any[])
            .filter((si: any) => si.unitId === unitByCode.id)
            .map((si: any) => {
              const sale = (MOCK_SALES as any[]).find((s: any) => s.id === si.saleId);
              return { id: si.id, saleId: si.saleId, saleNumber: sale?.saleNumber || null, saleDate: sale?.createdAt || null, finalUnitPrice: si.finalUnitPrice, paymentMethod: sale?.paymentMethod || null, customerName: sale?.customerName || null };
            });

          return {
            found: true,
            unit: {
              ...unitByCode, specs, damageChecklist,
              repairHistory: repairsList,
              warrantyHistory: warrantiesList,
              returnHistory: returnsList,
              saleHistory: saleItemsList,
            },
          };
        }
        return {
          found: false,
          isUnassignedCode: true,
          message: "Código generado válido y disponible para vincular a una nueva unidad.",
        };
      }

      // ─── DB MODE ────────────────────────────────────────────────────────────
      const codeStr = input.code.trim();

      // Helper: enriquece una unidad encontrada con su Kardex completo
      const enrichUnit = async (foundUnit: any) => {
        const specs = foundUnit.specs ? JSON.parse(foundUnit.specs) : {};
        const damageChecklist = foundUnit.damageChecklist ? JSON.parse(foundUnit.damageChecklist) : {};

        const [repairsList, warrantiesList, returnsList, saleItemsList] = await Promise.all([
          db.select({
            id: repairs.id, otNumber: repairs.otNumber, rmaNumber: repairs.rmaNumber,
            startDate: repairs.startDate, endDate: repairs.endDate, status: repairs.status,
            resolutionType: repairs.resolutionType, laborCost: repairs.laborCost,
            partsCost: repairs.partsCost, partsUsed: repairs.partsUsed,
            notes: repairs.notes, technicianName: users.name,
          }).from(repairs).leftJoin(users, eq(repairs.technicianId, users.id))
            .where(eq(repairs.unitId, foundUnit.id)).orderBy(asc(repairs.id)),

          db.select({
            id: warranties.id, days: warranties.days, startDate: warranties.startDate,
            endDate: warranties.endDate, status: warranties.status, saleId: warranties.saleId,
          }).from(warranties).where(eq(warranties.unitId, foundUnit.id)).orderBy(asc(warranties.id)),

          db.select({
            id: returns.id, returnDate: returns.returnDate, reason: returns.reason,
            resolution: returns.resolution, reenteredRepair: returns.reenteredRepair,
          }).from(returns).where(eq(returns.unitId, foundUnit.id)).orderBy(asc(returns.id)),

          db.select({
            id: saleItems.id, saleId: saleItems.saleId, finalUnitPrice: saleItems.finalUnitPrice,
            saleNumber: sales.saleNumber, saleDate: sales.createdAt,
            paymentMethod: sales.paymentMethod, customerName: sales.customerName,
          }).from(saleItems).leftJoin(sales, eq(saleItems.saleId, sales.id))
            .where(eq(saleItems.unitId, foundUnit.id)).orderBy(desc(saleItems.id)),
        ]);

        return {
          ...foundUnit, specs, damageChecklist,
          purchasePrice: role === "technician" || role === "seller" ? null : foundUnit.purchasePrice,
          salePrice: role === "technician" ? null : foundUnit.salePrice,
          repairHistory: repairsList.map((r: any) => ({
            ...r,
            partsUsed: r.partsUsed ? JSON.parse(r.partsUsed) : [],
            laborCost: role === "seller" ? null : r.laborCost,
            partsCost: role === "seller" ? null : r.partsCost,
          })),
          warrantyHistory: warrantiesList,
          returnHistory: returnsList,
          saleHistory: saleItemsList,
        };
      };

      // Buscar por código interno de unidad
      const [unitByCode] = await db.select().from(units).where(eq(units.code, codeStr)).limit(1);
      if (unitByCode) {
        return { found: true, unit: await enrichUnit(unitByCode) };
      }

      // Buscar por código generado (QR/barcode físico)
      const [genCode] = await db.select().from(generatedCodes).where(eq(generatedCodes.code, codeStr)).limit(1);
      if (!genCode) {
        return { found: false, message: "El código escaneado no existe ni fue generado en el sistema." };
      }

      if (genCode.status === "assigned" && genCode.assignedUnitId) {
        const [assignedUnit] = await db.select().from(units).where(eq(units.id, genCode.assignedUnitId)).limit(1);
        if (assignedUnit) {
          return { found: true, isAssignedCode: true, unit: await enrichUnit(assignedUnit) };
        }
      }

      return {
        found: false,
        isUnassignedCode: true,
        generatedCode: genCode,
        message: "Código generado válido y disponible para vincular a una nueva unidad.",
      };
    }),

  // Detalle de una unidad por ID — devuelve Kardex completo
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const role = ctx.user.role;

      // ─── MOCK MODE ──────────────────────────────────────────────────────────
      if (!db) {
        const unit = await getUnitById(input.id);
        if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });
        const specs = typeof unit.specs === "string" ? JSON.parse(unit.specs) : (unit.specs || {});
        const damageChecklist = typeof unit.damageChecklist === "string" ? JSON.parse(unit.damageChecklist) : (unit.damageChecklist || {});

        const events = (MOCK_UNIT_EVENTS as any[])
          .filter((e: any) => e.unitId === input.id)
          .sort((a: any, b: any) => a.id - b.id)
          .map((e: any) => ({ id: e.id, eventType: e.eventType, fromStatus: e.fromStatus, toStatus: e.toStatus, notes: e.notes, createdAt: e.createdAt, userName: "Demo Técnico" }));

        const repairsList = (MOCK_REPAIRS as any[])
          .filter((r: any) => r.unitId === input.id)
          .sort((a: any, b: any) => a.id - b.id)
          .map((r: any) => ({
            id: r.id,
            otNumber: r.otNumber || null,
            rmaNumber: r.rmaNumber || null,
            startDate: r.startDate,
            endDate: r.endDate,
            status: r.status,
            resolutionType: r.resolutionType,
            laborCost: role === "seller" ? null : r.laborCost,
            partsCost: role === "seller" ? null : r.partsCost,
            partsUsed: r.partsUsed ? (typeof r.partsUsed === "string" ? JSON.parse(r.partsUsed) : r.partsUsed) : [],
            notes: r.notes,
            technicianName: "Demo Técnico",
          }));

        const warrantiesList = (MOCK_WARRANTIES as any[])
          .filter((w: any) => w.unitId === input.id)
          .sort((a: any, b: any) => a.id - b.id)
          .map((w: any) => ({ id: w.id, days: w.days, startDate: w.startDate, endDate: w.endDate, status: w.status, saleId: w.saleId }));

        const returnsList = (MOCK_RETURNS as any[])
          .filter((r: any) => r.unitId === input.id)
          .sort((a: any, b: any) => a.id - b.id)
          .map((r: any) => ({ id: r.id, returnDate: r.returnDate, reason: r.reason, resolution: r.resolution, reenteredRepair: r.reenteredRepair }));

        const saleItemsList = (MOCK_SALE_ITEMS as any[])
          .filter((si: any) => si.unitId === input.id)
          .map((si: any) => {
            const sale = (MOCK_SALES as any[]).find((s: any) => s.id === si.saleId);
            return { id: si.id, saleId: si.saleId, saleNumber: sale?.saleNumber || null, saleDate: sale?.createdAt || null, finalUnitPrice: si.finalUnitPrice, paymentMethod: sale?.paymentMethod || null, customerName: sale?.customerName || null };
          });

        const purchase = unit.purchaseId
          ? (MOCK_PURCHASES as any[]).find((p: any) => p.id === unit.purchaseId) || null
          : null;

        return {
          ...unit, specs, damageChecklist,
          purchasePrice: role === "technician" || role === "seller" ? null : unit.purchasePrice,
          salePrice: role === "technician" ? null : unit.salePrice,
          discountPrice: role === "technician" ? null : unit.discountPrice,
          wholesalePrice: role === "technician" ? null : unit.wholesalePrice,
          events,
          repairHistory: repairsList,
          warrantyHistory: warrantiesList,
          returnHistory: returnsList,
          saleHistory: saleItemsList,
          purchaseRecord: role === "seller" ? null : purchase,
        };
      }

      // ─── DB MODE ─────────────────────────────────────────────────────────────
      const [unit] = await db.select().from(units).where(eq(units.id, input.id)).limit(1);
      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });

      // Run all queries in parallel for performance
      const [events, repairsList, warrantiesList, returnsList, saleItemsList, purchaseRecord] = await Promise.all([
        // 1. Timeline de eventos
        db.select({
          id: unitEvents.id, eventType: unitEvents.eventType,
          fromStatus: unitEvents.fromStatus, toStatus: unitEvents.toStatus,
          notes: unitEvents.notes, createdAt: unitEvents.createdAt, userName: users.name,
        }).from(unitEvents).leftJoin(users, eq(unitEvents.userId, users.id))
          .where(eq(unitEvents.unitId, unit.id)).orderBy(asc(unitEvents.id)),

        // 2. Historial de Órdenes de Trabajo
        db.select({
          id: repairs.id, otNumber: repairs.otNumber, rmaNumber: repairs.rmaNumber,
          startDate: repairs.startDate, endDate: repairs.endDate, status: repairs.status,
          resolutionType: repairs.resolutionType, laborCost: repairs.laborCost,
          partsCost: repairs.partsCost, partsUsed: repairs.partsUsed,
          notes: repairs.notes, technicianName: users.name,
        }).from(repairs).leftJoin(users, eq(repairs.technicianId, users.id))
          .where(eq(repairs.unitId, unit.id)).orderBy(asc(repairs.id)),

        // 3. Garantías
        db.select({
          id: warranties.id, days: warranties.days, startDate: warranties.startDate,
          endDate: warranties.endDate, status: warranties.status, saleId: warranties.saleId,
          pausedAt: warranties.pausedAt, remainingDaysAtPause: warranties.remainingDaysAtPause,
        }).from(warranties).where(eq(warranties.unitId, unit.id)).orderBy(asc(warranties.id)),

        // 4. Devoluciones
        db.select({
          id: returns.id, returnDate: returns.returnDate, reason: returns.reason,
          resolution: returns.resolution, reenteredRepair: returns.reenteredRepair, createdAt: returns.createdAt,
        }).from(returns).where(eq(returns.unitId, unit.id)).orderBy(asc(returns.id)),

        // 5. Ventas
        db.select({
          id: saleItems.id, saleId: saleItems.saleId, finalUnitPrice: saleItems.finalUnitPrice,
          saleNumber: sales.saleNumber, saleDate: sales.createdAt,
          paymentMethod: sales.paymentMethod, customerName: sales.customerName,
          saleStatus: sales.status,
        }).from(saleItems).leftJoin(sales, eq(saleItems.saleId, sales.id))
          .where(eq(saleItems.unitId, unit.id)).orderBy(desc(saleItems.id)),

        // 6. Compra original
        unit.purchaseId
          ? db.select({ id: purchases.id, purchaseNumber: purchases.purchaseNumber, orderDate: purchases.orderDate, totalAmount: purchases.totalAmount, paymentMethod: purchases.paymentMethod, status: purchases.status })
              .from(purchases).where(eq(purchases.id, unit.purchaseId)).limit(1)
              .then((r: any[]) => r[0] || null)
          : Promise.resolve(null),
      ]);

      const specsParsed = unit.specs ? JSON.parse(unit.specs) : {};
      const damageChecklistParsed = unit.damageChecklist ? JSON.parse(unit.damageChecklist) : {};

      return {
        ...unit,
        specs: specsParsed,
        damageChecklist: damageChecklistParsed,
        purchasePrice: role === "technician" || role === "seller" ? null : unit.purchasePrice,
        salePrice: role === "technician" ? null : unit.salePrice,
        discountPrice: role === "technician" ? null : unit.discountPrice,
        wholesalePrice: role === "technician" ? null : unit.wholesalePrice,
        events,
        repairHistory: repairsList.map((r: any) => ({
          ...r,
          partsUsed: r.partsUsed ? JSON.parse(r.partsUsed) : [],
          laborCost: role === "seller" ? null : r.laborCost,
          partsCost: role === "seller" ? null : r.partsCost,
        })),
        warrantyHistory: warrantiesList,
        returnHistory: returnsList,
        saleHistory: saleItemsList,
        purchaseRecord: role === "seller" ? null : purchaseRecord,
      };
    }),

  // Crear/Registrar nueva unidad
  create: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1, "Código requerido"),
        codeId: z.number().optional(),
        type: z.enum(["laptop", "tablet", "phone", "monitor", "charger", "accessory", "other"]),
        brand: z.string().min(1, "Marca requerida"),
        model: z.string().min(1, "Modelo requerido"),
        serialNumber: z.string().max(100).optional(),
        specs: z.record(z.string(), z.any()).optional(),
        condition: z.number().min(1).max(10).optional(),
        batteryHealth: z.enum(["100", "90", "80", "70", "60", "50", "40", "plugged_only", "good", "fair", "bad_plugged_only", "n_a"]).default("n_a"),
        damageChecklist: z.record(z.string(), z.any()).optional(),
        damageNotes: z.string().optional(),
        functionalTestPassed: z.boolean().optional(),
        status: z.enum(["in_diagnosis", "in_repair", "available", "sold", "returned"]).default("in_diagnosis"),
        purchaseId: z.number().optional(),
        purchasePrice: z.number().min(0, "Precio de compra requerido"),
        salePrice: z.number().min(0).optional(),
        discountPrice: z.number().min(0).optional(),
        wholesalePrice: z.number().min(0).optional(),
        supplierId: z.number().optional(),
        purchaseDate: z.string().optional(),
        quantity: z.number().int().min(1).max(500).default(1),
        // Método de pago con que se compró el equipo (afecta la caja)
        paymentMethod: z.enum(["cash", "qr", "transfer"]).default("cash"),
        branchId: z.number().default(1),
        photos: z.string().optional(), // JSON array of base64 strings
        tiktokUrl: z.string().optional(), // Enlace a video de TikTok
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const qty = input.quantity || 1;
      const baseCodeClean = input.code.trim();

      // ─── HELPER: genera número de compra único ───────────────────────────
      const genPurchaseNumber = (id: number | string) =>
        `COMP-UNIT-${String(id).padStart(6, "0")}`;

      const getUnitCode = (index: number) => {
        if (qty <= 1) return baseCodeClean;
        const padLen = qty > 99 ? 3 : 2;
        return `${baseCodeClean}-${String(index + 1).padStart(padLen, "0")}`;
      };

      if (!db) {
        // ─── MOCK MODE ─────────────────────────────────────────────────────
        const createdUnitIds: number[] = [];
        const createdCodes: string[] = [];

        // 1. Crear registro de compra maestro y egreso consolidado si hay precio
        let purchaseId: number | null = null;
        const totalPurchaseAmount = (input.purchasePrice || 0) * qty;

        if (totalPurchaseAmount > 0) {
          purchaseId = MOCK_PURCHASES.length + 1;
          const purchaseNumber = genPurchaseNumber(purchaseId);

          MOCK_PURCHASES.push({
            id: purchaseId,
            supplierId: input.supplierId || null,
            purchaseNumber,
            orderDate: input.purchaseDate ? new Date(input.purchaseDate) : new Date(),
            totalAmount: totalPurchaseAmount,
            status: "received",
            paymentStatus: "paid",
            paymentMethod: input.paymentMethod,
            isCredit: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Egreso de caja consolidado
          MOCK_FINANCIAL_TRANSACTIONS.push({
            id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
            branchId: input.branchId || 1,
            type: "expense",
            category: "purchase",
            amount: totalPurchaseAmount,
            paymentMethod: input.paymentMethod,
            referenceId: purchaseId,
            userId: ctx.user.id,
            notes: `Compra (${qty} uds.) ${input.brand} ${input.model} (${baseCodeClean}) · ${purchaseNumber}`,
            createdAt: new Date(),
          });
        }

        // 2. Crear las N unidades
        for (let i = 0; i < qty; i++) {
          const unitCode = getUnitCode(i);
          const newUnitId = MOCK_UNITS.length + 1;
          const finalStatus = input.status || defaultStatusForType(input.type);

          MOCK_UNITS.push({
            id: newUnitId,
            code: unitCode,
            codeId: i === 0 ? (input.codeId || null) : null,
            type: input.type,
            brand: input.brand,
            model: input.model,
            serialNumber: input.serialNumber ? (qty > 1 ? `${input.serialNumber}-${i + 1}` : input.serialNumber) : null,
            specs: JSON.stringify(input.specs || {}),
            condition: input.condition || 10,
            batteryHealth: input.batteryHealth || "n_a",
            damageChecklist: JSON.stringify(input.damageChecklist || {}),
            damageNotes: input.damageNotes || null,
            functionalTestPassed: SIMPLE_TYPES.has(input.type) ? (input.functionalTestPassed ? 1 : 0) : 1,
            status: finalStatus,
            purchaseId: purchaseId,
            purchasePrice: input.purchasePrice || 0,
            salePrice: input.salePrice || 0,
            discountPrice: input.discountPrice || null,
            wholesalePrice: input.wholesalePrice || null,
            supplierId: input.supplierId || null,
            branchId: input.branchId || 1,
            photos: input.photos || null,
            tiktokUrl: input.tiktokUrl || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          if (purchaseId && input.purchasePrice > 0) {
            MOCK_PURCHASE_ITEMS.push({
              id: MOCK_PURCHASE_ITEMS.length + 1,
              purchaseId,
              unitId: newUnitId,
              quantity: 1,
              price: input.purchasePrice,
              createdAt: new Date(),
            });
          }

          MOCK_UNIT_EVENTS.push({
            id: Date.now() + i + 1,
            unitId: newUnitId,
            eventType: "created",
            fromStatus: null,
            toStatus: finalStatus,
            userId: ctx.user.id,
            notes: `Registro inicial ${qty > 1 ? `(Lote ${i + 1}/${qty}) ` : ""}— ${input.type.toUpperCase()} ${input.brand} ${input.model} · Estado: ${finalStatus}`,
            createdAt: new Date().toISOString(),
          });

          createdUnitIds.push(newUnitId);
          createdCodes.push(unitCode);
        }

        syncMocksToDisk();
        return {
          success: true,
          unitId: createdUnitIds[0],
          unitIds: createdUnitIds,
          code: createdCodes[0],
          codes: createdCodes,
          count: qty,
          purchaseId,
        };
      }

      // ─── DB MODE (MYSQL) ─────────────────────────────────────────────────
      // Verificar que los códigos a generar no colisionen
      const codesToCheck = Array.from({ length: qty }, (_, i) => getUnitCode(i));
      const existingUnits = await db
        .select({ code: units.code })
        .from(units)
        .where(inArray(units.code, codesToCheck));

      if (existingUnits.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `El código ${existingUnits[0].code} ya está registrado para otra unidad.`,
        });
      }

      let resolvedCodeId = input.codeId;
      if (!resolvedCodeId && qty === 1) {
        const [genCode] = await db
          .select()
          .from(generatedCodes)
          .where(eq(generatedCodes.code, baseCodeClean))
          .limit(1);
        if (genCode) {
          resolvedCodeId = genCode.id;
        }
      }

      const specsJson = input.specs ? JSON.stringify(input.specs) : JSON.stringify({});
      const damageChecklistJson = input.damageChecklist ? JSON.stringify(input.damageChecklist) : JSON.stringify({});

      // Resolver o crear proveedor genérico si no se especificó
      let finalSupplierId = input.supplierId || null;
      if (!finalSupplierId) {
        const genericName = "Proveedor Genérico (Compra Directa)";
        const [existingSupplier] = await db
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(eq(suppliers.name, genericName))
          .limit(1);
        if (existingSupplier) {
          finalSupplierId = existingSupplier.id;
        } else {
          const created = await db.insert(suppliers).values({ name: genericName });
          finalSupplierId = (created as any)[0]?.insertId || (created as any)?.insertId || null;
        }
      }

      const totalPurchaseAmount = (input.purchasePrice || 0) * qty;

      // Toda la operación en una transacción atómica
      return await db.transaction(async (tx: any) => {
        let newPurchaseId: number | null = null;
        const purchaseNumber = genPurchaseNumber(Date.now());

        // 1. Si tiene precio de compra → crear registro maestro en purchases + egreso consolidado en caja
        if (totalPurchaseAmount > 0) {
          const purchaseResult: any = await tx.insert(purchases).values({
            supplierId: finalSupplierId!,
            purchaseNumber,
            orderDate: input.purchaseDate ? new Date(input.purchaseDate + "T00:00:00") : new Date(),
            totalAmount: totalPurchaseAmount,
            status: "received",
            paymentStatus: "paid",
            paymentMethod: input.paymentMethod,
            isCredit: 0,
          });

          newPurchaseId = purchaseResult?.insertId || purchaseResult?.[0]?.insertId;

          if (!newPurchaseId) {
            throw new Error("No se pudo obtener el ID de la compra recién creada. insertId vacío.");
          }

          // Egreso de caja consolidado (transacción financiera real del lote)
          await tx.insert(financialTransactions).values({
            branchId: input.branchId || 1,
            type: "expense",
            category: "purchase",
            amount: totalPurchaseAmount,
            paymentMethod: input.paymentMethod,
            referenceId: newPurchaseId,
            userId: ctx.user.id,
            notes: `Compra (${qty} uds.) ${input.brand} ${input.model} (${baseCodeClean}) · ${purchaseNumber}`,
          });
        }

        const createdUnitIds: number[] = [];
        const createdCodes: string[] = [];
        const finalStatus = input.status || defaultStatusForType(input.type);

        // 2. Insertar las N unidades individuales
        for (let i = 0; i < qty; i++) {
          const unitCode = getUnitCode(i);
          const unitSerialNumber = input.serialNumber ? (qty > 1 ? `${input.serialNumber}-${i + 1}` : input.serialNumber) : null;

          const unitInsertResult: any = await tx.insert(units).values({
            code: unitCode,
            codeId: i === 0 ? resolvedCodeId : null,
            type: input.type,
            brand: input.brand,
            model: input.model,
            serialNumber: unitSerialNumber,
            specs: specsJson,
            condition: input.condition,
            batteryHealth: input.batteryHealth,
            damageChecklist: damageChecklistJson,
            damageNotes: input.damageNotes || null,
            functionalTestPassed: SIMPLE_TYPES.has(input.type) ? (input.functionalTestPassed ? 1 : 0) : 1,
            status: finalStatus,
            purchasePrice: input.purchasePrice,
            salePrice: input.salePrice || 0,
            discountPrice: input.discountPrice ?? null,
            wholesalePrice: input.wholesalePrice ?? null,
            supplierId: finalSupplierId,
            purchaseId: newPurchaseId,
            branchId: input.branchId,
            photos: input.photos || null,
            tiktokUrl: input.tiktokUrl || null,
          });

          const unitId = unitInsertResult?.insertId || unitInsertResult?.[0]?.insertId;

          if (!unitId) {
            throw new Error(`No se pudo obtener el ID de la unidad #${i + 1}. insertId vacío.`);
          }

          createdUnitIds.push(unitId);
          createdCodes.push(unitCode);

          // Si es la primera unidad y tenía codeId, marcar el generatedCode como asignado
          if (i === 0 && resolvedCodeId) {
            await tx
              .update(generatedCodes)
              .set({ status: "assigned", assignedUnitId: unitId, assignedAt: new Date() })
              .where(eq(generatedCodes.id, resolvedCodeId));
          }

          // Insertar item de compra para cada unidad individual
          if (newPurchaseId && input.purchasePrice > 0) {
            await tx.insert(purchaseItems).values({
              purchaseId: newPurchaseId,
              unitId: unitId,
              quantity: 1,
              price: input.purchasePrice,
            });
          }

          // Evento de creación en el historial del equipo
          await tx.insert(unitEvents).values({
            unitId: unitId,
            eventType: "created",
            fromStatus: null,
            toStatus: finalStatus,
            userId: ctx.user.id,
            notes: `Registro inicial ${qty > 1 ? `(Lote ${i + 1}/${qty}) ` : ""}de unidad ${input.type.toUpperCase()} ${input.brand} ${input.model}`,
          });
        }

        return {
          success: true,
          unitId: createdUnitIds[0],
          unitIds: createdUnitIds,
          code: createdCodes[0],
          codes: createdCodes,
          count: qty,
          purchaseId: newPurchaseId,
        };
      });
    }),

  // Editar datos de una unidad
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        brand: z.string().optional(),
        model: z.string().optional(),
        specs: z.record(z.string(), z.any()).optional(),
        condition: z.number().optional(),
        batteryHealth: z.enum(["100", "90", "80", "70", "60", "50", "40", "plugged_only", "good", "fair", "bad_plugged_only", "n_a"]).optional(),
        damageChecklist: z.record(z.string(), z.any()).optional(),
        damageNotes: z.string().optional(),
        functionalTestPassed: z.boolean().optional(),
        salePrice: z.number().optional(),
        discountPrice: z.number().optional(),
        wholesalePrice: z.number().optional(),
        purchasePrice: z.number().optional(),
        supplierId: z.number().optional(),
        purchaseDate: z.string().optional(),
        branchId: z.number().optional(),
        status: z.enum(["in_diagnosis", "in_repair", "available", "sold", "returned"]).optional(),
        notes: z.string().optional(),
        photos: z.string().optional(),
        tiktokUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        const updateData: Record<string, any> = {};
        if (input.brand !== undefined) updateData.brand = input.brand;
        if (input.model !== undefined) updateData.model = input.model;
        if (input.specs !== undefined) updateData.specs = typeof input.specs === "string" ? input.specs : JSON.stringify(input.specs);
        if (input.condition !== undefined) updateData.condition = input.condition;
        if (input.batteryHealth !== undefined) updateData.batteryHealth = input.batteryHealth;
        if (input.damageChecklist !== undefined) updateData.damageChecklist = typeof input.damageChecklist === "string" ? input.damageChecklist : JSON.stringify(input.damageChecklist);
        if (input.damageNotes !== undefined) updateData.damageNotes = input.damageNotes;
        if (input.functionalTestPassed !== undefined) updateData.functionalTestPassed = input.functionalTestPassed ? 1 : 0;
        if (input.salePrice !== undefined) updateData.salePrice = input.salePrice;
        if (input.discountPrice !== undefined) updateData.discountPrice = input.discountPrice;
        if (input.wholesalePrice !== undefined) updateData.wholesalePrice = input.wholesalePrice;
        if (input.purchasePrice !== undefined && ctx.user.role === "admin") updateData.purchasePrice = input.purchasePrice;
        if (input.supplierId !== undefined) updateData.supplierId = input.supplierId;
        if (input.purchaseDate !== undefined) updateData.purchaseDate = input.purchaseDate;
        if (input.branchId !== undefined) updateData.branchId = input.branchId;
        if (input.photos !== undefined) updateData.photos = input.photos;
        if (input.tiktokUrl !== undefined) updateData.tiktokUrl = input.tiktokUrl;
        if (input.status !== undefined) updateData.status = input.status;
        await updateUnit(input.id, updateData as any);
        return { success: true };
      }

      const [unit] = await db
        .select()
        .from(units)
        .where(eq(units.id, input.id))
        .limit(1);

      if (!unit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });
      }

      const updateData: Record<string, any> = {};

      if (input.brand !== undefined) updateData.brand = input.brand;
      if (input.model !== undefined) updateData.model = input.model;
      if (input.specs !== undefined) updateData.specs = JSON.stringify(input.specs);
      if (input.condition !== undefined) updateData.condition = input.condition;
      if (input.batteryHealth !== undefined) updateData.batteryHealth = input.batteryHealth;
      if (input.damageChecklist !== undefined) updateData.damageChecklist = JSON.stringify(input.damageChecklist);
      if (input.damageNotes !== undefined) updateData.damageNotes = input.damageNotes;
      if (input.functionalTestPassed !== undefined) updateData.functionalTestPassed = input.functionalTestPassed ? 1 : 0;
      if (input.salePrice !== undefined) updateData.salePrice = input.salePrice;
      if (input.discountPrice !== undefined) updateData.discountPrice = input.discountPrice;
      if (input.wholesalePrice !== undefined) updateData.wholesalePrice = input.wholesalePrice;
      if (input.purchasePrice !== undefined && ctx.user.role === "admin") updateData.purchasePrice = input.purchasePrice;
      if (input.supplierId !== undefined) updateData.supplierId = input.supplierId;
      if (input.purchaseDate !== undefined) updateData.purchaseDate = input.purchaseDate;
      if (input.branchId !== undefined) updateData.branchId = input.branchId;
      if (input.photos !== undefined) updateData.photos = input.photos;
      if (input.tiktokUrl !== undefined) updateData.tiktokUrl = input.tiktokUrl;

      let statusChanged = false;
      const oldStatus = unit.status;

      if (input.status !== undefined && input.status !== oldStatus) {
        updateData.status = input.status;
        statusChanged = true;
      }

      await db
        .update(units)
        .set(updateData)
        .where(eq(units.id, input.id));

      if (statusChanged) {
        await db.insert(unitEvents).values({
          unitId: input.id,
          eventType: "status_change",
          fromStatus: oldStatus,
          toStatus: input.status,
          userId: ctx.user.id,
          notes: input.notes || `Cambio de estado manual a ${input.status}`,
        });
      }

      return { success: true };
    }),

  // Cambiar estado de unidad
  changeStatus: protectedProcedure
    .input(
      z.object({
        unitId: z.number(),
        toStatus: z.enum(["in_diagnosis", "in_repair", "available", "sold", "returned"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        const unit = MOCK_UNITS.find((u: any) => u.id === input.unitId);
        if (!unit) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });
        }
        if (input.toStatus === "available") {
          const hasActiveRepair = (MOCK_REPAIRS as any[]).some(
            (r: any) => r.unitId === input.unitId && (r.status === "in_progress" || r.status === "pending")
          );
          if (hasActiveRepair) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Esta unidad tiene una orden activa en taller técnico. Debe completar o cancelar la reparación en el módulo de Taller antes de marcarla como disponible para la venta.",
            });
          }
        }
        const fromStatus = unit?.status || null;
        await updateUnit(input.unitId, { status: input.toStatus } as any);
        // ── Evento de cambio de estado ──────────────────────────────────────
        MOCK_UNIT_EVENTS.push({
          id: Date.now() + 1,
          unitId: input.unitId,
          eventType: "status_change",
          fromStatus,
          toStatus: input.toStatus,
          userId: ctx.user.id,
          notes: input.notes || `Estado actualizado: ${fromStatus} → ${input.toStatus}`,
          createdAt: new Date().toISOString(),
        });
        syncMocksToDisk();
        return { success: true };
      }

      const [unit] = await db
        .select()
        .from(units)
        .where(eq(units.id, input.unitId))
        .limit(1);

      if (!unit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });
      }

      if (input.toStatus === "available") {
        const activeRepairs = await db
          .select()
          .from(repairs)
          .where(and(eq(repairs.unitId, input.unitId), eq(repairs.status, "in_progress")))
          .limit(1);
        if (activeRepairs.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esta unidad tiene una orden activa en taller técnico. Debe completar o cancelar la reparación en el módulo de Taller antes de marcarla como disponible para la venta.",
          });
        }
      }

      const fromStatus = unit.status;

      await db
        .update(units)
        .set({ status: input.toStatus })
        .where(eq(units.id, input.unitId));

      await db.insert(unitEvents).values({
        unitId: input.unitId,
        eventType: "status_change",
        fromStatus,
        toStatus: input.toStatus,
        userId: ctx.user.id,
        notes: input.notes || `Estado actualizado a ${input.toStatus}`,
      });

      return { success: true };
    }),

  // ─── FASE 2: CATÁLOGO COMERCIAL SEGURO (SOLO PRODUCTOS DISPONIBLES) ──────
  getCommercialCatalog: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.enum(["laptop", "tablet", "phone", "monitor", "charger", "accessory", "other"]).optional(),
        branchId: z.number().optional(),
        brand: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const DEFAULT_COMPANY_INFO = await getCompanyInfo(db);

      // ─── MOCK MODE ───
      if (!db) {
        const allUnits = await getAllUnits();
        // REGLA FUNDAMENTAL: Solo productos con status === 'available'
        let available = (allUnits as any[]).filter((u: any) => u.status === "available");

        if (input?.type) available = available.filter((u: any) => u.type === input.type);
        if (input?.branchId) available = available.filter((u: any) => u.branchId === input.branchId);
        if (input?.brand) {
          const b = input.brand.toLowerCase();
          available = available.filter((u: any) => u.brand?.toLowerCase().includes(b));
        }
        if (input?.search) {
          const s = input.search.toLowerCase();
          available = available.filter((u: any) =>
            u.code?.toLowerCase().includes(s) ||
            u.brand?.toLowerCase().includes(s) ||
            u.model?.toLowerCase().includes(s) ||
            (typeof u.specs === "string" && u.specs.toLowerCase().includes(s))
          );
        }

        const items = available.map((u: any, idx: number) => {
          const specsParsed = typeof u.specs === "string" ? JSON.parse(u.specs) : (u.specs || {});
          const photosParsed = u.photos
            ? (typeof u.photos === "string" ? JSON.parse(u.photos) : u.photos)
            : [];

          return {
            catalogIndex: idx + 1, // Posición 01, 02, 03... en el catálogo
            id: u.id,
            code: u.code,
            type: u.type,
            brand: u.brand,
            model: u.model,
            serialNumber: u.serialNumber,
            specs: specsParsed,
            condition: u.condition,
            batteryHealth: u.batteryHealth,
            salePrice: u.salePrice || 0,
            discountPrice: u.discountPrice || 0,
            wholesalePrice: u.wholesalePrice || 0,
            photos: Array.isArray(photosParsed) ? photosParsed.slice(0, 6) : [],
            mainPhoto: Array.isArray(photosParsed) && photosParsed.length > 0 ? photosParsed[0] : null,
            tiktokUrl: u.tiktokUrl || null,
            status: u.status,
          };
        });

        return {
          items,
          total: items.length,
          company: DEFAULT_COMPANY_INFO,
          generatedAt: new Date().toISOString(),
        };
      }

      // ─── DB MODE ───
      const conditions: any[] = [eq(units.status, "available")];

      if (input?.type) conditions.push(eq(units.type, input.type));
      if (input?.branchId) conditions.push(eq(units.branchId, input.branchId));
      if (input?.brand) conditions.push(like(units.brand, `%${input.brand.trim()}%`));
      if (input?.search) {
        const s = `%${input.search.trim()}%`;
        conditions.push(or(like(units.code, s), like(units.brand, s), like(units.model, s), like(units.specs, s)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: units.id,
          code: units.code,
          type: units.type,
          brand: units.brand,
          model: units.model,
          serialNumber: units.serialNumber,
          specs: units.specs,
          condition: units.condition,
          batteryHealth: units.batteryHealth,
          salePrice: units.salePrice,
          discountPrice: units.discountPrice,
          wholesalePrice: units.wholesalePrice,
          photos: units.photos,
          tiktokUrl: units.tiktokUrl,
          status: units.status,
        })
        .from(units)
        .where(whereClause as any)
        .orderBy(asc(units.id));

      const items = rows.map((u: any, idx: number) => {
        const specsParsed = u.specs ? JSON.parse(u.specs) : {};
        const photosParsed = u.photos ? (typeof u.photos === "string" ? JSON.parse(u.photos) : u.photos) : [];
        return {
          catalogIndex: idx + 1,
          id: u.id,
          code: u.code,
          type: u.type,
          brand: u.brand,
          model: u.model,
          serialNumber: u.serialNumber,
          specs: specsParsed,
          condition: u.condition,
          batteryHealth: u.batteryHealth,
          salePrice: u.salePrice || 0,
          discountPrice: u.discountPrice || 0,
          wholesalePrice: u.wholesalePrice || 0,
          photos: Array.isArray(photosParsed) ? photosParsed.slice(0, 6) : [],
          mainPhoto: Array.isArray(photosParsed) && photosParsed.length > 0 ? photosParsed[0] : null,
          tiktokUrl: u.tiktokUrl || null,
          status: u.status,
        };
      });

      return {
        items,
        total: items.length,
        company: DEFAULT_COMPANY_INFO,
        generatedAt: new Date().toISOString(),
      };
    }),

  // ─── FASE 2: FICHA COMERCIAL INDIVIDUAL SEGURA (1 PRODUCTO) ──────────────
  getCommercialSheet: protectedProcedure
    .input(
      z.object({
        unitId: z.number().optional(),
        code: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const DEFAULT_COMPANY_INFO = await getCompanyInfo(db);

      // ─── MOCK MODE ───
      if (!db) {
        let foundUnit: any = null;
        if (input.unitId) {
          foundUnit = await getUnitById(input.unitId);
        } else if (input.code) {
          foundUnit = await getUnitByCode(input.code);
        }

        if (!foundUnit) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado para ficha comercial" });
        }

        const specsParsed = typeof foundUnit.specs === "string" ? JSON.parse(foundUnit.specs) : (foundUnit.specs || {});
        const photosParsed = foundUnit.photos
          ? (typeof foundUnit.photos === "string" ? JSON.parse(foundUnit.photos) : foundUnit.photos)
          : [];

        return {
          unit: {
            id: foundUnit.id,
            code: foundUnit.code,
            rmaNumber: foundUnit.rmaNumber || null,
            type: foundUnit.type,
            brand: foundUnit.brand,
            model: foundUnit.model,
            serialNumber: foundUnit.serialNumber || null,
            specs: specsParsed,
            condition: foundUnit.condition,
            batteryHealth: foundUnit.batteryHealth,
            salePrice: foundUnit.salePrice || 0,
            discountPrice: foundUnit.discountPrice || 0,
            wholesalePrice: foundUnit.wholesalePrice || 0,
            photos: Array.isArray(photosParsed) ? photosParsed.slice(0, 6) : [],
            mainPhoto: Array.isArray(photosParsed) && photosParsed.length > 0 ? photosParsed[0] : null,
            tiktokUrl: foundUnit.tiktokUrl || null,
            status: foundUnit.status,
            warrantyDaysDefault: 30,
            functionalTestPassed: foundUnit.functionalTestPassed === 1,
          },
          company: DEFAULT_COMPANY_INFO,
          generatedAt: new Date().toISOString(),
        };
      }

      // ─── DB MODE ───
      let queryCondition = undefined;
      if (input.unitId) {
        queryCondition = eq(units.id, input.unitId);
      } else if (input.code) {
        queryCondition = eq(units.code, input.code.trim());
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Debe proporcionar unitId o code" });
      }

      const [foundUnit] = await db
        .select({
          id: units.id,
          code: units.code,
          rmaNumber: units.rmaNumber,
          type: units.type,
          brand: units.brand,
          model: units.model,
          serialNumber: units.serialNumber,
          specs: units.specs,
          condition: units.condition,
          batteryHealth: units.batteryHealth,
          salePrice: units.salePrice,
          discountPrice: units.discountPrice,
          wholesalePrice: units.wholesalePrice,
          photos: units.photos,
          tiktokUrl: units.tiktokUrl,
          status: units.status,
          functionalTestPassed: units.functionalTestPassed,
        })
        .from(units)
        .where(queryCondition)
        .limit(1);

      if (!foundUnit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado para ficha comercial" });
      }

      const specsParsed = foundUnit.specs ? JSON.parse(foundUnit.specs) : {};
      const photosParsed = foundUnit.photos ? (typeof foundUnit.photos === "string" ? JSON.parse(foundUnit.photos) : foundUnit.photos) : [];

      return {
        unit: {
          id: foundUnit.id,
          code: foundUnit.code,
          rmaNumber: foundUnit.rmaNumber || null,
          type: foundUnit.type,
          brand: foundUnit.brand,
          model: foundUnit.model,
          serialNumber: foundUnit.serialNumber || null,
          specs: specsParsed,
          condition: foundUnit.condition,
          batteryHealth: foundUnit.batteryHealth,
          salePrice: foundUnit.salePrice || 0,
          discountPrice: foundUnit.discountPrice || 0,
          wholesalePrice: foundUnit.wholesalePrice || 0,
          photos: Array.isArray(photosParsed) ? photosParsed.slice(0, 6) : [],
          mainPhoto: Array.isArray(photosParsed) && photosParsed.length > 0 ? photosParsed[0] : null,
          tiktokUrl: foundUnit.tiktokUrl || null,
          status: foundUnit.status,
          warrantyDaysDefault: 30,
          functionalTestPassed: foundUnit.functionalTestPassed === 1,
        },
        company: DEFAULT_COMPANY_INFO,
        generatedAt: new Date().toISOString(),
      };
    }),
});
