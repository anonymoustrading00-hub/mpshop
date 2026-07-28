import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getCashClosureByUserIdAndDate,
  createCashClosure,
  getAllCashClosures,
  updateCashClosure,
  getCashClosureById,
  getCashClosuresByUserId,
  getExpectedDailyTotals,
  getFinancialTransactions,
  createDeliveryExpense,
  getAllCashOpenings,
  getCashOpeningByUserIdAndDateMethod,
  getActiveCashOpeningByUserIdAndMethod,
  createCashOpening,
  getAllUsers,
  getPendingOrdersTotal,
  createFinancialTransactionsForDeliveries,
  getAllOrders,
  getOrderItems,
  updateCashOpeningStatus,
  processFinancialLiquidation,
} from "../db";
import { getLocalDateKey, pad2 } from "../_core/date_utils";
import { TRPCError } from "@trpc/server";


export const financeRouter = router({
  getTransactions: protectedProcedure.query(async ({ ctx }) => {
    // Si es repartidor, solo ve las suyas. Si es admin, ve todas.
    const userId = ctx.user?.role === "admin" ? undefined : ctx.user?.id;
    return await getFinancialTransactions(userId);
  }),

  getGlobalBalances: protectedProcedure.query(async () => {
    const transactions = await getFinancialTransactions(undefined);
    const openings = await getAllCashOpenings();

    const calc = (method: "cash" | "qr" | "transfer") => {
      const income = (transactions as any[])
        .filter((t: any) => t.type === "income" && (t.paymentMethod === method || (method === "cash" && !t.paymentMethod)))
        .reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const expense = (transactions as any[])
        .filter((t: any) => t.type === "expense" && (t.paymentMethod === method || (method === "cash" && !t.paymentMethod)))
        .reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const openingTotal = (openings as any[])
        .filter((o: any) => o.paymentMethod === method || (method === "cash" && !o.paymentMethod))
        .reduce((s: number, o: any) => s + (o.openingAmount || 0), 0);
      return income - expense + openingTotal;
    };

    return {
      cash: calc("cash"),
      qr: calc("qr"),
      transfer: calc("transfer"),
    };
  }),


  getCashOpenings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return await getAllCashOpenings();
  }),

  listResponsibleUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return await getAllUsers();
  }),

  openCashRegister: protectedProcedure
    .input(
      z.object({
        openingAmount: z.number().min(0, "El fondo inicial no puede ser negativo"),
        paymentMethod: z.enum(["cash", "qr", "transfer"]),
        openingDate: z.string().min(1, "La fecha de apertura es requerida"),
        responsibleUserId: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const methods: ("cash" | "qr" | "transfer")[] = ["cash", "qr", "transfer"];
      const results = [];

      for (const method of methods) {
        const existing = await getCashOpeningByUserIdAndDateMethod(
          input.responsibleUserId,
          input.openingDate,
          method
        );

        if (!existing) {
          // Si es el método solicitado, usamos el monto enviado, sino 0
          const amount = method === input.paymentMethod ? Math.round(input.openingAmount) : 0;
          
          const result = await createCashOpening({
            openingAmount: amount,
            paymentMethod: method,
            openingDate: input.openingDate,
            responsibleUserId: input.responsibleUserId,
            openedByUserId: ctx.user.id,
            notes: method === input.paymentMethod ? input.notes : `Apertura automática (${input.paymentMethod.toUpperCase()})`,
            status: "open",
          });
          results.push(result);
        }
      }

      if (results.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Este usuario ya tiene todas las cajas abiertas para esta fecha.`,
        });
      }

      return results[0]; // Retornamos el primero para mantener compatibilidad
    }),

  transferFunds: protectedProcedure
    .input(z.object({
      fromMethod: z.enum(["cash", "qr", "transfer"]),
      toMethod: z.enum(["cash", "qr", "transfer"]),
      amount: z.number().min(0.01, "Monto inválido"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (input.fromMethod === input.toMethod) throw new TRPCError({ code: "BAD_REQUEST", message: "Las cajas de origen y destino deben ser distintas." });

      const amountInCents = Math.round(input.amount);
      const { createFinancialTransaction } = await import("../db");
      
      await createFinancialTransaction({
        type: "expense",
        category: "transfer_between_registers",
        amount: amountInCents,
        paymentMethod: input.fromMethod,
        userId: ctx.user.id,
        notes: `Traspaso hacia ${input.toMethod.toUpperCase()}` + (input.notes ? ` - ${input.notes}` : ""),
      });

      await createFinancialTransaction({
        type: "income",
        category: "transfer_between_registers",
        amount: amountInCents,
        paymentMethod: input.toMethod,
        userId: ctx.user.id,
        notes: `Traspaso desde ${input.fromMethod.toUpperCase()}` + (input.notes ? ` - ${input.notes}` : ""),
      });

      return { success: true };
    }),

  addExtraordinaryIncome: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(1, "El monto debe ser mayor a 0"),
        paymentMethod: z.enum(["cash", "qr", "transfer"]),
        category: z.enum(["donation", "loan", "gift", "other_income"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { createFinancialTransaction } = await import("../db");
      
      return await createFinancialTransaction({
        type: "income",
        category: input.category,
        paymentMethod: input.paymentMethod,
        amount: input.amount,
        userId: ctx.user.id,
        notes: input.notes,
      });
    }),

  addDeliveryExpense: protectedProcedure
    .input(z.object({
      deliveryPersonId: z.number(),
      amount: z.number(),
      type: z.enum(["fuel", "subsistence", "other"]),
      notes: z.string().optional(),
      orderId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await createDeliveryExpense({
        deliveryPersonId: input.deliveryPersonId,
        amount: Math.round(input.amount),
        type: input.type,
        notes: input.notes,
        orderId: input.orderId,
      });
    }),
  // Obtener historial de entregas del repartidor hoy
  getDeliveryHistory: protectedProcedure
    .input(z.object({ date: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const targetUserId = ctx.user?.role === "admin" ? undefined : Number(ctx.user?.id);
      if (!targetUserId && ctx.user?.role !== "admin") throw new TRPCError({ code: "BAD_REQUEST" });

      const { getDb } = await import("../db");
      const { orders, users, customers } = await import("../../drizzle/schema");
      const { and, eq, sql } = await import("drizzle-orm");
      const db = await getDb();

      if (!db) {
        const { getAllOrders, getOrderItems } = await import("../db");
        const allOrders = await getAllOrders();
        const ordersForUser = allOrders.filter((o: any) =>
          o.deliveryPersonId === targetUserId &&
          o.status === "delivered" &&
          (!input.date || getLocalDateKey(o.deliveredAt) === input.date)
        );

        const results = await Promise.all(ordersForUser.map(async (order: any) => {
          const items = await getOrderItems(order.id);
          return { order, items };
        }));
        return results;
      }

      // Consulta directa a DB optimizada
      const date = input.date || getLocalDateKey(new Date());
      const ordersForUser = await db.select({
        order: {
          id: orders.id,
          orderNumber: orders.orderNumber,
          totalPrice: orders.totalPrice,
          paymentMethod: orders.paymentMethod,
          deliveredAt: orders.deliveredAt,
          status: orders.status,
          deliveryPersonId: orders.deliveryPersonId,
        }
      })
      .from(orders)
      .where(and(
        eq(orders.deliveryPersonId, targetUserId!),
        eq(orders.status, "delivered"),
        sql`DATE(DATE_SUB(${orders.deliveredAt}, INTERVAL 4 HOUR)) = ${date}`
      ));

      const results = await Promise.all(ordersForUser.map(async (row: any) => {
        const { getOrderItems } = await import("../db");
        const items = await getOrderItems(row.order.id);
        return { order: row.order, items };
      }));

      return results;
    }),

  // Obtener totales esperados para un repartidor en una fecha específica
  getExpectedDaily: protectedProcedure
    .input(z.object({ 
      userId: z.number().optional(), 
      date: z.string() 
    }))
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId || ctx.user?.id;
      if (!targetUserId) throw new TRPCError({ code: "BAD_REQUEST" });
      
      // Solo el mismo usuario o un admin pueden ver esto
      if (ctx.user?.role !== "admin" && targetUserId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await getExpectedDailyTotals(targetUserId, input.date);
    }),

  // Enviar un nuevo cierre de caja
  submitClosure: protectedProcedure
    .input(z.object({
      date: z.string(),
      initialCash: z.number(),
      reportedCash: z.number(),
      reportedQr: z.number(),
      reportedTransfer: z.number(),
      expenses: z.number().optional(),
      expectedCash: z.number(),
      expectedQr: z.number(),
      expectedTransfer: z.number(),
      pendingOrders: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Verificar si ya existe un cierre para esta fecha
      const lastClosure = await getCashClosureByUserIdAndDate(userId, input.date);
      if (lastClosure?.status === "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ya tienes un cierre de caja pendiente de aprobación. Espera a que el administrador lo valide."
        });
      }

      const pending = input.pendingOrders ?? 0;
      const isAdmin = ctx.user?.role === "admin";
      const finalStatus = isAdmin ? "approved" : "pending";

      const result = await createCashClosure({
        userId,
        date: input.date,
        initialCash: Math.round(input.initialCash),
        reportedCash: Math.round(input.reportedCash),
        reportedQr: Math.round(input.reportedQr),
        reportedTransfer: Math.round(input.reportedTransfer),
        expectedCash: Math.round(input.expectedCash),
        expectedQr: Math.round(input.expectedQr),
        expectedTransfer: Math.round(input.expectedTransfer),
        expenses: Math.round(input.expenses || 0),
        pendingOrders: Math.round(pending),
        status: finalStatus
      });

      // Independientemente de si es admin o repartidor, al enviar un cierre
      // se deben cerrar las aperturas activas para bloquear nuevas ventas
      const { closeAllActiveOpeningsForUser } = await import("../db");
      await closeAllActiveOpeningsForUser(userId, input.date);

      // Capturar ID de forma robusta (soporta diferentes drivers de DB)
      const closureId = (result as any).insertId || (Array.isArray(result) && result[0]?.insertId);

      // Si es admin, liquidar financieramente ahora
      if (isAdmin && closureId) {
        await processFinancialLiquidation(Number(closureId));
      }

      return result;
    }),

  // Obtener mi estado de cierre para hoy
  getMyStatus: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) return null;
      return await getCashClosureByUserIdAndDate(userId, input.date);
    }),
  
  // Verificar si tiene algún cierre pendiente (de cualquier fecha)
  hasPendingClosure: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) return { hasPending: false };
    const closures = await getCashClosuresByUserId(userId);
    const pendingClosure = closures.find((c: any) => c.status === "pending");
    return { 
      hasPending: !!pendingClosure,
      pendingClosure 
    };
  }),

  hasActiveOpening: protectedProcedure
    .input(z.object({ paymentMethod: z.enum(["cash", "qr", "transfer"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) return { hasActive: false };
    
    const method = input?.paymentMethod || "cash";
    let activeOpening = await getActiveCashOpeningByUserIdAndMethod(userId, method);
    
    // Fallback de compatibilidad: Si pidió QR o Transferencia y no está, verificamos si la de Efectivo está abierta.
    // Esto pasa porque antes solo se abría una caja global (efectivo).
    if (!activeOpening && method !== "cash") {
      activeOpening = await getActiveCashOpeningByUserIdAndMethod(userId, "cash");
    }

    return { 
      hasActive: !!activeOpening && activeOpening.status === "open",
      activeOpening 
    };
  }),

  // Obtener monto pendiente de órdenes sin entregar del repartidor
  getPendingOrders: protectedProcedure
    .input(z.object({ userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId || ctx.user?.id;
      if (!targetUserId) throw new TRPCError({ code: "BAD_REQUEST" });
      if (ctx.user?.role !== "admin" && targetUserId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await getPendingOrdersTotal(targetUserId);
    }),

  // Listar todos los cierres (Solo Admin)
  listAllClosures: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllCashClosures();
  }),

  // Listar mis cierres (Repartidor)
  listMyClosures: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return await getCashClosuresByUserId(userId);
  }),

  // Aprobar/Rechazar cierre (Solo Admin)
  updateClosureStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["approved", "rejected"]),
      adminNotes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await updateCashClosure(input.id, {
        status: input.status,
        adminNotes: input.adminNotes
      });

      // Si se aprueba, creamos las transacciones financieras y la próxima apertura
      // Si se aprueba, creamos las transacciones financieras
      if (input.status === "approved") {
        const closure = await getCashClosureById(input.id);
        if (closure) {
          // Liquidar financieramente el cierre (registra ventas, ajustes y retiro)
          await processFinancialLiquidation(input.id);
          
          // Cerrar TODAS las aperturas de caja activas de este usuario (Efectivo, QR, Transferencia)
          const methods = ["cash", "qr", "transfer"];
          for (const method of methods) {
            const activeOpening = await getCashOpeningByUserIdAndDateMethod(closure.userId, closure.date, method);
            if (activeOpening) {
              await updateCashOpeningStatus(activeOpening.id, "closed");
            }
          }
        }
      }

      return result;
    }),

  // Reparar un cierre específico (solo admin) - ejecutar una vez
  repairClosure: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      // force=true para ignorar anti-duplicado y registrar siempre
      await processFinancialLiquidation(input.id, true);
      return { success: true };
    }),

  // Limpiar transacciones duplicadas de closure_report (solo admin)
  cleanupDuplicateClosures: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { cleanupDuplicateClosureReports } = await import("../db");
      const result = await cleanupDuplicateClosureReports();
      return result;
    }),

  // Historial de transacciones por caja con filtros de fecha
  getBoxHistory: protectedProcedure
    .input(z.object({
      paymentMethod: z.enum(["cash", "qr", "transfer"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.enum(["all", "income", "expense"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const allTransactions = await getFinancialTransactions();
      const allOpenings = await getAllCashOpenings();

      // Filtrar transacciones por método de pago
      let filtered = allTransactions.filter((t: any) => t.paymentMethod === input.paymentMethod);

      // Filtrar openings por método de pago
      const filteredOpenings = allOpenings.filter((o: any) => o.paymentMethod === input.paymentMethod);

      // Filtrar por tipo
      if (input.type !== "all") {
        filtered = filtered.filter((t: any) => t.type === input.type);
      }

      // Filtrar openings por tipo (siempre "income")
      const visibleOpenings = input.type === "expense" ? [] : filteredOpenings;

      // Construir filas de aperturas para intercalar en el historial
      const openingRows = visibleOpenings.map((o: any) => ({
        id: `opening-${o.id}`,
        type: "income",
        category: "cash_opening",
        amount: o.openingAmount,
        paymentMethod: o.paymentMethod,
        notes: `Apertura de caja - ${o.responsibleUserName || `Usuario #${o.responsibleUserId}`}`,
        createdAt: new Date(o.openingDate + "T00:00:00"),
        runningBalance: 0,
        direction: "entry",
        isOpening: true,
      }));

      // Construir filas de transacciones
      const txRows = filtered.map((t: any) => ({
        ...t,
        runningBalance: 0,
        direction: t.type === "income" ? "entry" : "exit",
        isOpening: false,
      }));

      // Combinar y ordenar por fecha ASCENDENTE para el cálculo correcto del saldo correlativo
      const sortedAsc = [...openingRows, ...txRows].sort((a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Calcular saldo acumulado correlativo
      let runningBalance = 0;
      const calculatedRows = sortedAsc.map((t: any) => {
        if (t.isOpening || t.type === "income") {
          runningBalance += t.amount;
        } else {
          runningBalance -= t.amount;
        }
        return {
          ...t,
          runningBalance,
        };
      });

      // Filtrar por rango de fechas (después de calcular el saldo para mantener la correlación histórica si es posible, 
      // aunque aquí el saldo inicial siempre parte de 0 en el set completo por ahora)
      let finalRows = calculatedRows;
      if (input.startDate) {
        finalRows = finalRows.filter((t: any) => {
          const txDate = getLocalDateKey(t.createdAt);
          return txDate && txDate >= input.startDate!;
        });
      }
      if (input.endDate) {
        finalRows = finalRows.filter((t: any) => {
          const txDate = getLocalDateKey(t.createdAt);
          return txDate && txDate <= input.endDate!;
        });
      }

      // Ordenar por fecha DESCENDENTE para mostrar lo más reciente arriba (Historial)
      const transactionsWithBalance = [...finalRows].sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const totalIncome = finalRows
        .filter((t: any) => t.type === "income")
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
      const totalExpense = finalRows
        .filter((t: any) => t.type === "expense")
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      return {
        transactions: transactionsWithBalance,
        summary: {
          totalIncome,
          totalExpense,
          finalBalance: runningBalance, // Este es el saldo final absoluto del set completo
          count: transactionsWithBalance.length,
        },
      };
    }),

  // Exportar transacciones de caja a CSV
  exportBoxCsv: protectedProcedure
    .input(z.object({
      paymentMethod: z.enum(["cash", "qr", "transfer"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const allTransactions = await getFinancialTransactions();
      const allUsers = await getAllUsers();

      // Filtrar por método de pago
      let filtered = allTransactions.filter((t: any) => t.paymentMethod === input.paymentMethod);

      // Filtrar por rango de fechas
      if (input.startDate) {
        filtered = filtered.filter((t: any) => {
          const txDate = getLocalDateKey(t.createdAt);
          return txDate && txDate >= input.startDate!;
        });
      }

      if (input.endDate) {
        filtered = filtered.filter((t: any) => {
          const txDate = getLocalDateKey(t.createdAt);
          return txDate && txDate <= input.endDate!;
        });
      }

      // Ordenar por fecha
      filtered.sort((a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Calcular saldo acumulado
      let runningBalance = 0;
      const rows = filtered.map((t: any) => {
        const date = new Date(t.createdAt);
        const user = allUsers.find((u: any) => u.id === t.userId);
        if (t.type === "income") {
          runningBalance += t.amount;
        } else {
          runningBalance -= t.amount;
        }

        return {
          fecha: date.toLocaleDateString("es-BO"),
          hora: date.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }),
          usuario: user?.name || user?.username || `Usuario #${t.userId}` || "—",
          tipo: t.type === "income" ? "Ingreso" : "Egreso",
          categoria: t.category,
          referencia: t.referenceId ? `#${t.referenceId}` : "—",
          metodo: input.paymentMethod === "cash" ? "Efectivo" : input.paymentMethod === "qr" ? "QR" : "Transferencia",
          monto: t.amount / 100,
          ingreso: t.type === "income" ? t.amount / 100 : "",
          egreso: t.type === "expense" ? t.amount / 100 : "",
          saldo: runningBalance / 100,
          notas: t.notes || "",
        };
      });

      return { rows, methodName: input.paymentMethod === "cash" ? "Caja_Efectivo" : input.paymentMethod === "qr" ? "Caja_QR" : "Cuenta_Bancaria" };
    }),
});
