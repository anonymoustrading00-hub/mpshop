import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  cancelSaleRecord,
  createSaleWithItems,
  getAllSales,
  getNextSaleNumber,
  getSaleById,
  getSaleItemsBySaleId,
  markSalePaymentCompleted,
} from "../db";
import { ensureCustomerRecord } from "./customer_utils";

const discountTypeSchema = z.enum(["none", "percentage", "fixed"]);
const paymentMethodSchema = z.enum(["cash", "qr", "transfer", "credit"]);
const paymentStatusSchema = z.enum(["pending", "completed"]);

function getLinePricing(basePrice: number, quantity: number, discountType: "none" | "percentage" | "fixed", discountValue: number) {
  const safeBasePrice = Math.max(0, Math.round(basePrice));
  const safeQuantity = Math.max(1, Math.trunc(quantity));
  const safeDiscountValue = Math.max(0, Math.round(discountValue));

  let finalUnitPrice = safeBasePrice;

  if (discountType === "percentage") {
    const percentage = Math.min(100, safeDiscountValue);
    finalUnitPrice = Math.max(0, Math.round(safeBasePrice * (1 - percentage / 100)));
  }

  if (discountType === "fixed") {
    finalUnitPrice = Math.max(0, safeBasePrice - safeDiscountValue);
  }

  const subtotal = finalUnitPrice * safeQuantity;
  const discountAmount = Math.max(0, safeBasePrice * safeQuantity - subtotal);

  return {
    basePrice: safeBasePrice,
    quantity: safeQuantity,
    discountValue: safeDiscountValue,
    discountAmount,
    finalUnitPrice,
    subtotal,
  };
}

function getGlobalDiscountAmount(subtotal: number, discountType: "none" | "percentage" | "fixed", discountValue: number) {
  const safeSubtotal = Math.max(0, Math.round(subtotal));
  const safeDiscountValue = Math.max(0, Math.round(discountValue));

  if (discountType === "percentage") {
    return Math.min(safeSubtotal, Math.round(safeSubtotal * (Math.min(100, safeDiscountValue) / 100)));
  }

  if (discountType === "fixed") {
    return Math.min(safeSubtotal, safeDiscountValue);
  }

  return 0;
}

export const salesRouter = router({
  getNextSaleNumber: protectedProcedure.query(async () => {
    return { saleNumber: await getNextSaleNumber() };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const allSales = await getAllSales(ctx.branchId);
    if (ctx.user?.role === "admin") {
      return allSales;
    }

    return (allSales as any[]).filter((sale: any) => sale.soldBy === ctx.user?.id);
  }),

  getDetails: protectedProcedure
    .input(z.object({ saleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const sale = await getSaleById(input.saleId);
      if (!sale) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venta no encontrada" });
      }

      if (ctx.user?.role !== "admin" && sale.soldBy !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const items = await getSaleItemsBySaleId(input.saleId);
      return { sale, items };
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.number().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        customerTaxId: z.string().optional(),
        creditDays: z.number().default(30),
        saleChannel: z.enum(["local", "delivery"]).default("local"),
        orderId: z.number().optional(),
        paymentMethod: paymentMethodSchema,
        paymentStatus: paymentStatusSchema.default("completed"),
        discountType: discountTypeSchema.default("none"),
        discountValue: z.number().default(0),
        notes: z.string().optional(),
        adminOverrideUserId: z.number().optional(),
        adminOverrideReason: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.number(),
            pricingType: z.enum(["unit", "wholesale", "discount"]).default("unit"),
            quantity: z.number(),
            basePrice: z.number(),
            discountType: discountTypeSchema.default("none"),
            discountValue: z.number().default(0),
          })
        ).min(1, "Debes agregar al menos un producto"),
        customerType: z.enum(["retail", "wholesale"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedItems = input.items.map((item) => {
        const pricing = getLinePricing(item.basePrice, item.quantity, item.discountType, item.discountValue);

        return {
          productId: item.productId,
          pricingType: item.pricingType,
          quantity: pricing.quantity,
          basePrice: pricing.basePrice,
          discountType: item.discountType,
          discountValue: pricing.discountValue,
          discountAmount: pricing.discountAmount,
          finalUnitPrice: pricing.finalUnitPrice,
          subtotal: pricing.subtotal,
        };
      });

      const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const discountAmount = getGlobalDiscountAmount(subtotal, input.discountType, input.discountValue);
      const total = Math.max(0, subtotal - discountAmount);
      const saleNumber = await getNextSaleNumber();

      let customerId = input.customerId;

      // Si no hay ID pero hay nombre y teléfono, intentamos asegurar el registro
      if (!customerId && input.customerName && input.customerPhone) {
        const customer = await ensureCustomerRecord({
          clientNumber: input.customerPhone,
          clientName: input.customerName,
          phone: input.customerPhone,
          taxId: input.customerTaxId,
          zone: "Venta Directa",
          sourceChannel: "other",
          customerType: input.customerType
        });
        if (customer) {
          customerId = customer.id;
        }
      }

      try {
        const result = await createSaleWithItems({
          saleNumber,
          branchId: ctx.branchId,
          customerId,
          customerName: customerId ? undefined : input.customerName,
          saleChannel: input.saleChannel,
          orderId: input.orderId,
          soldBy: ctx.user!.id,
          subtotal,
          discountType: input.discountType,
          discountValue: Math.round(input.discountValue),
          discountAmount,
          total,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === "credit" ? "pending" : input.paymentStatus,
          creditDays: input.creditDays,
          adminOverrideUserId: input.adminOverrideUserId,
          adminOverrideReason: input.adminOverrideReason,
          notes: input.notes,
          items: normalizedItems as any,
        });

        return { success: true, saleId: (result as any).insertId, saleNumber };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo registrar la venta",
        });
      }
    }),

  markPaymentCompleted: protectedProcedure
    .input(z.object({ saleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        return await markSalePaymentCompleted(input.saleId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo actualizar el pago",
        });
      }
    }),

  cancel: protectedProcedure
    .input(z.object({
      saleId: z.number(),
      reason: z.string().min(3, "Debes indicar el motivo"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        return await cancelSaleRecord(input.saleId, ctx.user!.id, input.reason);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo anular la venta",
        });
      }
    }),
});
