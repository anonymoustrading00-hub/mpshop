import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { generatedCodeBatches, generatedCodes, systemSettings, units, users } from "../../drizzle/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

// In-memory mock store for offline/demo mode (when DATABASE_URL is not set)
let MOCK_SETTINGS = { defaultCodeType: "qr" };
let MOCK_BATCHES: any[] = [];
let MOCK_CODES: any[] = [];

export const codesRouter = router({
  // Obtener configuraciones del sistema (ej: tipo de código por defecto)
  getSettings: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return MOCK_SETTINGS;

    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "default_code_type"))
      .limit(1);

    return {
      defaultCodeType: setting ? setting.value : "qr",
    };
  }),

  // Actualizar configuración por defecto (QR o Código de barras)
  updateSettings: protectedProcedure
    .input(z.object({ defaultCodeType: z.enum(["qr", "barcode"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        MOCK_SETTINGS.defaultCodeType = input.defaultCodeType;
        return { success: true };
      }

      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "default_code_type"))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({ value: input.defaultCodeType })
          .where(eq(systemSettings.key, "default_code_type"));
      } else {
        await db.insert(systemSettings).values({
          key: "default_code_type",
          value: input.defaultCodeType,
        });
      }

      return { success: true };
    }),

  // Generar un lote de códigos en blanco (unassigned)
  generateBatch: protectedProcedure
    .input(
      z.object({
        quantity: z.number().min(1).max(500, "Máximo 500 códigos por lote"),
        type: z.enum(["qr", "barcode"]),
        notes: z.string().optional(),
        prefix: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        const batchId = MOCK_BATCHES.length + 1;
        const prefix = input.prefix || (input.type === "qr" ? "QR" : "BC");
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

        for (let i = 0; i < input.quantity; i++) {
          const uniqueSuffix = nanoid(6).toUpperCase();
          const codeString = `${prefix}-${uniqueSuffix}`;
          MOCK_CODES.push({
            id: MOCK_CODES.length + 1,
            code: codeString,
            type: input.type,
            status: "unassigned" as const,
            batchId,
            assignedUnitId: null,
            assignedAt: null,
            createdAt: new Date(),
          });
        }

        const batchObj = {
          id: batchId,
          quantity: input.quantity,
          type: input.type,
          createdBy: ctx.user?.id || 1,
          creatorName: ctx.user?.name || "Administrador",
          notes: input.notes || null,
          createdAt: new Date(),
        };
        MOCK_BATCHES.unshift(batchObj);

        return {
          success: true,
          batchId,
          quantity: input.quantity,
          type: input.type,
        };
      }

      // 1. Registrar el lote
      const [batchResult] = await db.insert(generatedCodeBatches).values({
        quantity: input.quantity,
        type: input.type,
        createdBy: ctx.user.id,
        notes: input.notes || null,
      });

      const batchId = batchResult?.insertId || batchResult?.[0]?.insertId;
      const prefix = input.prefix || (input.type === "qr" ? "QR" : "BC");

      // 2. Generar códigos únicos (cortos y legibles)
      const codeValues = [];
      for (let i = 0; i < input.quantity; i++) {
        const uniqueSuffix = nanoid(6).toUpperCase();
        const codeString = `${prefix}-${uniqueSuffix}`;
        codeValues.push({
          code: codeString,
          type: input.type,
          status: "unassigned" as const,
          batchId,
          createdAt: new Date(),
        });
      }

      // Insertar masivamente los códigos
      await db.insert(generatedCodes).values(codeValues);

      return {
        success: true,
        batchId,
        quantity: input.quantity,
        type: input.type,
      };
    }),

  // Listar lotes de códigos generados
  listBatches: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        const offset = input?.offset || 0;
        const limit = input?.limit || 20;
        return {
          items: MOCK_BATCHES.slice(offset, offset + limit),
          total: MOCK_BATCHES.length,
        };
      }

      const items = await db
        .select({
          id: generatedCodeBatches.id,
          quantity: generatedCodeBatches.quantity,
          type: generatedCodeBatches.type,
          createdBy: generatedCodeBatches.createdBy,
          creatorName: users.name,
          notes: generatedCodeBatches.notes,
          createdAt: generatedCodeBatches.createdAt,
        })
        .from(generatedCodeBatches)
        .leftJoin(users, eq(generatedCodeBatches.createdBy, users.id))
        .orderBy(desc(generatedCodeBatches.id))
        .limit(input?.limit || 20)
        .offset(input?.offset || 0);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(generatedCodeBatches);

      return {
        items,
        total: Number(countResult[0]?.count || 0),
      };
    }),

  // Obtener los códigos individuales de un lote (para imprimir la hoja)
  getBatchCodes: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        const batch = MOCK_BATCHES.find(b => b.id === input.batchId);
        if (!batch) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lote de códigos no encontrado" });
        }
        const codes = MOCK_CODES.filter(c => c.batchId === input.batchId);
        return { batch, codes };
      }

      const [batch] = await db
        .select()
        .from(generatedCodeBatches)
        .where(eq(generatedCodeBatches.id, input.batchId))
        .limit(1);

      if (!batch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lote de códigos no encontrado" });
      }

      const codesList = await db
        .select()
        .from(generatedCodes)
        .where(eq(generatedCodes.batchId, input.batchId))
        .orderBy(generatedCodes.id);

      return {
        batch,
        codes: codesList,
      };
    }),

  // Verificar estado de un código escaneado
  checkCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        const codeStr = input.code.trim();
        const genCode = MOCK_CODES.find(c => c.code === codeStr);
        if (!genCode) return { exists: false, isGenerated: false };
        return {
          exists: true,
          isGenerated: true,
          code: genCode,
          status: genCode.status,
          assignedUnit: null,
        };
      }

      const codeStr = input.code.trim();

      const [genCode] = await db
        .select()
        .from(generatedCodes)
        .where(eq(generatedCodes.code, codeStr))
        .limit(1);

      if (!genCode) {
        return { exists: false, isGenerated: false };
      }

      let assignedUnit = null;
      if (genCode.status === "assigned" && genCode.assignedUnitId) {
        const [u] = await db
          .select()
          .from(units)
          .where(eq(units.id, genCode.assignedUnitId))
          .limit(1);
        assignedUnit = u || null;
      }

      return {
        exists: true,
        isGenerated: true,
        code: genCode,
        status: genCode.status,
        assignedUnit,
      };
    }),
});
