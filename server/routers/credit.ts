import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAllAccountsReceivable,
  getAllAccountsPayable,
  createCreditPayment,
  getAllCreditPayments,
  getCustomerCreditStatus,
} from "../db";

export const creditRouter = router({
  // ------ CUENTAS POR COBRAR (CXC) ------
  listReceivable: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllAccountsReceivable();
  }),

  // ------ CUENTAS POR PAGAR (CXP) ------
  listPayable: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllAccountsPayable();
  }),

  // ------ HISTORIAL DE ABONOS ------
  listPayments: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllCreditPayments();
  }),

  // ------ ESTADO DE CRÉDITO DE UN CLIENTE ------
  getCustomerCreditStatus: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      return await getCustomerCreditStatus(input.customerId);
    }),

  // ------ REGISTRAR ABONO (CXC o CXP) ------
  registerPayment: protectedProcedure
    .input(z.object({
      type: z.enum(["receivable", "payable"]),
      accountsReceivableId: z.number().optional(),
      accountsPayableId: z.number().optional(),
      amount: z.number().min(1, "El monto debe ser mayor a 0"),
      paymentMethod: z.enum(["cash", "qr", "transfer"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden registrar abonos." });
      }

      if (input.type === "receivable" && !input.accountsReceivableId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Debe especificar la cuenta por cobrar a abonar." });
      }
      if (input.type === "payable" && !input.accountsPayableId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Debe especificar la cuenta por pagar a abonar." });
      }

      try {
        const result = await createCreditPayment({
          type: input.type,
          accountsReceivableId: input.accountsReceivableId,
          accountsPayableId: input.accountsPayableId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          userId: ctx.user!.id,
        });
        return { success: true, payment: result };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo registrar el abono.",
        });
      }
    }),
});
