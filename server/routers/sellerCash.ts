import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { 
  sellerCashRegisters, 
  sellerPartialDeliveries, 
  sellerCashExpenses,
  sales,
  users,
  branches
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getLocalDateKey } from "../_core/date_utils";

/**
 * Router para el sistema de cajas de vendedores
 * Gestiona aperturas, cierres, entregas parciales y gastos
 */
export const sellerCashRouter = router({
  
  // ═══════════════════════════════════════════════════════════════
  // ENDPOINTS PARA VENDEDOR
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Obtener estado de mi caja del día actual
   */
  getMyBoxStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const userId = ctx.user?.id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    
    const today = getLocalDateKey();
    
    const [cashRegister] = await db
      .select()
      .from(sellerCashRegisters)
      .where(
        and(
          eq(sellerCashRegisters.sellerId, userId),
          eq(sellerCashRegisters.date, today)
        )
      )
      .limit(1);
    
    if (!cashRegister) {
      return { hasBox: false, box: null };
    }
    
    // Calcular totales esperados
    const expectedCash = cashRegister.initialCash + cashRegister.salesCash - cashRegister.partialDeliveriesCash - cashRegister.totalExpenses;
    const expectedQr = cashRegister.salesQr;
    const expectedTransfer = cashRegister.salesTransfer;
    
    return {
      hasBox: true,
      box: {
        ...cashRegister,
        expectedCash,
        expectedQr,
        expectedTransfer,
      }
    };
  }),
  
  /**
   * Solicitar apertura de caja
   */
  requestOpening: protectedProcedure
    .input(z.object({
      initialCash: z.number().min(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      // Verificar que el usuario es vendedor
      if (ctx.user?.role !== "seller" && ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo vendedores pueden solicitar apertura de caja" });
      }
      
      const today = getLocalDateKey();
      const branchId = ctx.branchId;
      
      // Verificar que no tenga ya una caja abierta hoy
      const [existing] = await db
        .select()
        .from(sellerCashRegisters)
        .where(
          and(
            eq(sellerCashRegisters.sellerId, userId),
            eq(sellerCashRegisters.date, today)
          )
        )
        .limit(1);
      
      if (existing) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Ya tienes una caja registrada para hoy" 
        });
      }
      
      // Crear solicitud de apertura
      const [result] = await db.insert(sellerCashRegisters).values({
        sellerId: userId,
        branchId: branchId,
        date: today,
        openingStatus: "pending",
        initialCash: Math.round(input.initialCash * 100), // Convertir a centavos
        openedAt: new Date(),
        openingNotes: input.notes || null,
        closingStatus: "open",
      });
      
      return { 
        success: true, 
        message: "Solicitud de apertura enviada. Espera la aprobación del administrador.",
        cashRegisterId: result.insertId
      };
    }),
  
  /**
   * Solicitar entrega parcial de efectivo
   */
  requestPartialDelivery: protectedProcedure
    .input(z.object({
      amount: z.number().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      const today = getLocalDateKey();
      
      // Obtener caja actual
      const [cashRegister] = await db
        .select()
        .from(sellerCashRegisters)
        .where(
          and(
            eq(sellerCashRegisters.sellerId, userId),
            eq(sellerCashRegisters.date, today),
            eq(sellerCashRegisters.closingStatus, "open")
          )
        )
        .limit(1);
      
      if (!cashRegister) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No tienes una caja abierta" });
      }
      
      if (cashRegister.openingStatus !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tu caja aún no ha sido aprobada" });
      }
      
      // Verificar que tenga suficiente efectivo
      const availableCash = cashRegister.initialCash + cashRegister.salesCash - cashRegister.partialDeliveriesCash - cashRegister.totalExpenses;
      if (input.amount * 100 > availableCash) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `No tienes suficiente efectivo. Disponible: Bs. ${(availableCash / 100).toFixed(2)}` 
        });
      }
      
      // Crear solicitud de entrega parcial
      await db.insert(sellerPartialDeliveries).values({
        cashRegisterId: cashRegister.id,
        sellerId: userId,
        amount: Math.round(input.amount * 100),
        status: "pending",
        notes: input.notes || null,
      });
      
      return { 
        success: true, 
        message: "Solicitud de entrega parcial enviada. Espera la aprobación del administrador." 
      };
    }),
  
  /**
   * Solicitar gasto desde caja
   */
  requestExpense: protectedProcedure
    .input(z.object({
      amount: z.number().min(1),
      concept: z.string().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      const today = getLocalDateKey();
      
      // Obtener caja actual
      const [cashRegister] = await db
        .select()
        .from(sellerCashRegisters)
        .where(
          and(
            eq(sellerCashRegisters.sellerId, userId),
            eq(sellerCashRegisters.date, today),
            eq(sellerCashRegisters.closingStatus, "open")
          )
        )
        .limit(1);
      
      if (!cashRegister) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No tienes una caja abierta" });
      }
      
      if (cashRegister.openingStatus !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tu caja aún no ha sido aprobada" });
      }
      
      // Crear solicitud de gasto
      await db.insert(sellerCashExpenses).values({
        cashRegisterId: cashRegister.id,
        sellerId: userId,
        amount: Math.round(input.amount * 100),
        concept: input.concept,
        status: "pending",
        notes: input.notes || null,
      });
      
      return { 
        success: true, 
        message: "Solicitud de gasto enviada. Espera la aprobación del administrador." 
      };
    }),
  
  /**
   * Solicitar cierre de caja
   */
  requestClosing: protectedProcedure
    .input(z.object({
      reportedCash: z.number().min(0),
      reportedQr: z.number().min(0),
      reportedTransfer: z.number().min(0),
      differenceJustification: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      const today = getLocalDateKey();
      
      // Obtener caja actual
      const [cashRegister] = await db
        .select()
        .from(sellerCashRegisters)
        .where(
          and(
            eq(sellerCashRegisters.sellerId, userId),
            eq(sellerCashRegisters.date, today),
            eq(sellerCashRegisters.closingStatus, "open")
          )
        )
        .limit(1);
      
      if (!cashRegister) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No tienes una caja abierta" });
      }
      
      if (cashRegister.openingStatus !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tu caja aún no ha sido aprobada para poder cerrarla" });
      }
      
      // Calcular esperado
      const expectedCash = cashRegister.initialCash + cashRegister.salesCash - cashRegister.partialDeliveriesCash - cashRegister.totalExpenses;
      const differenceCash = Math.round(input.reportedCash * 100) - expectedCash;
      
      // Actualizar con datos de cierre
      await db
        .update(sellerCashRegisters)
        .set({
          closingStatus: "pending",
          reportedCash: Math.round(input.reportedCash * 100),
          reportedQr: Math.round(input.reportedQr * 100),
          reportedTransfer: Math.round(input.reportedTransfer * 100),
          differenceCash,
          differenceJustification: input.differenceJustification || null,
          closedAt: new Date(),
        })
        .where(eq(sellerCashRegisters.id, cashRegister.id));
      
      return { 
        success: true, 
        message: "Solicitud de cierre enviada. Espera la aprobación del administrador.",
        differenceCash: differenceCash / 100,
      };
    }),
  
  /**
   * Obtener historial de mis cajas
   */
  getMyHistory: protectedProcedure
    .input(z.object({
      limit: z.number().optional().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      const history = await db
        .select()
        .from(sellerCashRegisters)
        .where(eq(sellerCashRegisters.sellerId, userId))
        .orderBy(desc(sellerCashRegisters.date))
        .limit(input.limit);
      
      return history;
    }),
  
  /**
   * Obtener solicitudes pendientes (entregas y gastos)
   */
  getMyPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const userId = ctx.user?.id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    
    const [pendingDeliveries, pendingExpenses] = await Promise.all([
      db.select().from(sellerPartialDeliveries)
        .where(
          and(
            eq(sellerPartialDeliveries.sellerId, userId),
            eq(sellerPartialDeliveries.status, "pending")
          )
        ),
      db.select().from(sellerCashExpenses)
        .where(
          and(
            eq(sellerCashExpenses.sellerId, userId),
            eq(sellerCashExpenses.status, "pending")
          )
        ),
    ]);
    
    return {
      pendingDeliveries,
      pendingExpenses,
    };
  }),

  // ═══════════════════════════════════════════════════════════════
  // ENDPOINTS PARA ADMINISTRADOR
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Listar todas las cajas (filtradas por fecha y sucursal)
   */
  admin_listAllBoxes: protectedProcedure
    .input(z.object({
      date: z.string().optional(),
      branchId: z.number().optional(),
      status: z.enum(["all", "open", "pending", "approved", "rejected"]).optional().default("all"),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden ver todas las cajas" });
      }
      
      const today = input.date || getLocalDateKey();
      
      let conditions = [eq(sellerCashRegisters.date, today)];
      
      if (input.branchId) {
        conditions.push(eq(sellerCashRegisters.branchId, input.branchId));
      }
      
      if (input.status !== "all") {
        conditions.push(eq(sellerCashRegisters.closingStatus, input.status));
      }
      
      const boxes = await db
        .select({
          cashRegister: sellerCashRegisters,
          seller: {
            id: users.id,
            name: users.name,
            username: users.username,
          },
          branch: {
            id: branches.id,
            name: branches.name,
          },
        })
        .from(sellerCashRegisters)
        .leftJoin(users, eq(sellerCashRegisters.sellerId, users.id))
        .leftJoin(branches, eq(sellerCashRegisters.branchId, branches.id))
        .where(and(...conditions))
        .orderBy(desc(sellerCashRegisters.createdAt));
      
      return boxes;
    }),
  
  /**
   * Obtener todas las solicitudes pendientes de aprobación
   */
  admin_getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    
    const [pendingOpenings, pendingClosings, pendingDeliveries, pendingExpenses] = await Promise.all([
      // Aperturas pendientes
      db.select({
        cashRegister: sellerCashRegisters,
        seller: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
      })
        .from(sellerCashRegisters)
        .leftJoin(users, eq(sellerCashRegisters.sellerId, users.id))
        .where(eq(sellerCashRegisters.openingStatus, "pending")),
      
      // Cierres pendientes
      db.select({
        cashRegister: sellerCashRegisters,
        seller: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
      })
        .from(sellerCashRegisters)
        .leftJoin(users, eq(sellerCashRegisters.sellerId, users.id))
        .where(eq(sellerCashRegisters.closingStatus, "pending")),
      
      // Entregas parciales pendientes
      db.select({
        delivery: sellerPartialDeliveries,
        seller: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
      })
        .from(sellerPartialDeliveries)
        .leftJoin(users, eq(sellerPartialDeliveries.sellerId, users.id))
        .where(eq(sellerPartialDeliveries.status, "pending")),
      
      // Gastos pendientes
      db.select({
        expense: sellerCashExpenses,
        seller: {
          id: users.id,
          name: users.name,
          username: users.username,
        },
      })
        .from(sellerCashExpenses)
        .leftJoin(users, eq(sellerCashExpenses.sellerId, users.id))
        .where(eq(sellerCashExpenses.status, "pending")),
    ]);
    
    return {
      pendingOpenings,
      pendingClosings,
      pendingDeliveries,
      pendingExpenses,
      totalPending: pendingOpenings.length + pendingClosings.length + pendingDeliveries.length + pendingExpenses.length,
    };
  }),
  
  /**
   * Aprobar apertura de caja
   */
  admin_approveOpening: protectedProcedure
    .input(z.object({
      cashRegisterId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      await db
        .update(sellerCashRegisters)
        .set({
          openingStatus: "approved",
          openingApprovedBy: ctx.user.id,
          openingApprovedAt: new Date(),
          closingNotes: input.notes || null,
        })
        .where(eq(sellerCashRegisters.id, input.cashRegisterId));
      
      return { success: true, message: "Apertura aprobada correctamente" };
    }),
  
  /**
   * Rechazar apertura de caja
   */
  admin_rejectOpening: protectedProcedure
    .input(z.object({
      cashRegisterId: z.number(),
      notes: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      await db
        .update(sellerCashRegisters)
        .set({
          openingStatus: "rejected",
          openingApprovedBy: ctx.user.id,
          openingApprovedAt: new Date(),
          closingNotes: input.notes,
        })
        .where(eq(sellerCashRegisters.id, input.cashRegisterId));
      
      return { success: true, message: "Apertura rechazada" };
    }),
  
  /**
   * Aprobar cierre de caja
   */
  admin_approveClosing: protectedProcedure
    .input(z.object({
      cashRegisterId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      await db
        .update(sellerCashRegisters)
        .set({
          closingStatus: "approved",
          closingApprovedBy: ctx.user.id,
          closingApprovedAt: new Date(),
          closingNotes: input.notes || null,
        })
        .where(eq(sellerCashRegisters.id, input.cashRegisterId));
      
      return { success: true, message: "Cierre aprobado correctamente" };
    }),
  
  /**
   * Rechazar cierre de caja
   */
  admin_rejectClosing: protectedProcedure
    .input(z.object({
      cashRegisterId: z.number(),
      notes: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      await db
        .update(sellerCashRegisters)
        .set({
          closingStatus: "open", // Volver a abrir para que el vendedor corrija
          closingNotes: input.notes,
        })
        .where(eq(sellerCashRegisters.id, input.cashRegisterId));
      
      return { success: true, message: "Cierre rechazado. El vendedor debe corregir." };
    }),
  
  /**
   * Aprobar entrega parcial
   */
  admin_approvePartialDelivery: protectedProcedure
    .input(z.object({
      deliveryId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      // Obtener la entrega
      const [delivery] = await db
        .select()
        .from(sellerPartialDeliveries)
        .where(eq(sellerPartialDeliveries.id, input.deliveryId))
        .limit(1);
      
      if (!delivery) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entrega no encontrada" });
      }
      
      // Aprobar entrega
      await db
        .update(sellerPartialDeliveries)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          adminNotes: input.notes || null,
        })
        .where(eq(sellerPartialDeliveries.id, input.deliveryId));
      
      // Actualizar el total de entregas parciales en la caja
      await db
        .update(sellerCashRegisters)
        .set({
          partialDeliveriesCash: sql`${sellerCashRegisters.partialDeliveriesCash} + ${delivery.amount}`,
        })
        .where(eq(sellerCashRegisters.id, delivery.cashRegisterId));
      
      return { success: true, message: "Entrega parcial aprobada" };
    }),
  
  /**
   * Rechazar entrega parcial
   */
  admin_rejectPartialDelivery: protectedProcedure
    .input(z.object({
      deliveryId: z.number(),
      notes: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      await db
        .update(sellerPartialDeliveries)
        .set({
          status: "rejected",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          adminNotes: input.notes,
        })
        .where(eq(sellerPartialDeliveries.id, input.deliveryId));
      
      return { success: true, message: "Entrega parcial rechazada" };
    }),
  
  /**
   * Aprobar gasto
   */
  admin_approveExpense: protectedProcedure
    .input(z.object({
      expenseId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      // Obtener el gasto
      const [expense] = await db
        .select()
        .from(sellerCashExpenses)
        .where(eq(sellerCashExpenses.id, input.expenseId))
        .limit(1);
      
      if (!expense) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado" });
      }
      
      // Aprobar gasto
      await db
        .update(sellerCashExpenses)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          adminNotes: input.notes || null,
        })
        .where(eq(sellerCashExpenses.id, input.expenseId));
      
      // Actualizar el total de gastos en la caja
      await db
        .update(sellerCashRegisters)
        .set({
          totalExpenses: sql`${sellerCashRegisters.totalExpenses} + ${expense.amount}`,
        })
        .where(eq(sellerCashRegisters.id, expense.cashRegisterId));
      
      return { success: true, message: "Gasto aprobado" };
    }),
  
  /**
   * Rechazar gasto
   */
  admin_rejectExpense: protectedProcedure
    .input(z.object({
      expenseId: z.number(),
      notes: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      await db
        .update(sellerCashExpenses)
        .set({
          status: "rejected",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          adminNotes: input.notes,
        })
        .where(eq(sellerCashExpenses.id, input.expenseId));
      
      return { success: true, message: "Gasto rechazado" };
    }),
  
  /**
   * Cerrar caja forzosamente (admin)
   */
  admin_forceClose: protectedProcedure
    .input(z.object({
      cashRegisterId: z.number(),
      notes: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      await db
        .update(sellerCashRegisters)
        .set({
          closingStatus: "forced_closed",
          closingApprovedBy: ctx.user.id,
          closingApprovedAt: new Date(),
          closedAt: new Date(),
          closingNotes: `CIERRE FORZOSO: ${input.notes}`,
        })
        .where(eq(sellerCashRegisters.id, input.cashRegisterId));
      
      return { success: true, message: "Caja cerrada forzosamente" };
    }),
  
  /**
   * Editar montos de caja (admin)
   */
  admin_editAmounts: protectedProcedure
    .input(z.object({
      cashRegisterId: z.number(),
      initialCash: z.number().optional(),
      reportedCash: z.number().optional(),
      reportedQr: z.number().optional(),
      reportedTransfer: z.number().optional(),
      notes: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      const updateData: any = {
        closingNotes: `EDITADO POR ADMIN: ${input.notes}`,
      };
      
      if (input.initialCash !== undefined) updateData.initialCash = Math.round(input.initialCash * 100);
      if (input.reportedCash !== undefined) updateData.reportedCash = Math.round(input.reportedCash * 100);
      if (input.reportedQr !== undefined) updateData.reportedQr = Math.round(input.reportedQr * 100);
      if (input.reportedTransfer !== undefined) updateData.reportedTransfer = Math.round(input.reportedTransfer * 100);
      
      await db
        .update(sellerCashRegisters)
        .set(updateData)
        .where(eq(sellerCashRegisters.id, input.cashRegisterId));
      
      return { success: true, message: "Montos actualizados correctamente" };
    }),
});
