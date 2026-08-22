import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createQuotationWithItems,
  getAllQuotations,
  getNextQuotationNumber,
  getQuotationById,
  getQuotationItemsByQuotationId,
  updateQuotationStatus,
} from "../db";

const discountTypeSchema = z.enum(["none", "percentage", "fixed"]);

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

export const quotationsRouter = router({
  getNextNumber: protectedProcedure.query(async () => {
    return { quotationNumber: await getNextQuotationNumber() };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const allQuotations = await getAllQuotations();
    if (ctx.user?.role === "admin") {
      return allQuotations;
    }
    // Todos los usuarios pueden ver sus cotizaciones o todas, según la nueva directiva "todos pueden crear"
    // Lo dejaremos que vean todas para que los vendedores puedan cargarlas
    return allQuotations;
  }),

  getDetails: protectedProcedure
    .input(z.object({ quotationId: z.number() }))
    .query(async ({ input }) => {
      const quotation = await getQuotationById(input.quotationId);
      if (!quotation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });
      }

      const items = await getQuotationItemsByQuotationId(input.quotationId);
      return { quotation, items };
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.number().optional(),
        customerName: z.string().optional(),
        discountType: discountTypeSchema.default("none"),
        discountValue: z.number().default(0),
        notes: z.string().optional(),
        termsAndConditions: z.string().optional(),
        validUntil: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.number(),
            pricingType: z.enum(["unit", "wholesale", "discount"]).default("unit"),
            quantity: z.number().int().min(1),
            basePrice: z.number().min(0),
            discountType: discountTypeSchema.default("none"),
            discountValue: z.number().default(0),
          })
        ).min(1, "Debes agregar al menos un producto"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedItems = input.items.map((item) => {
        const pricing = getLinePricing(item.basePrice, item.quantity, item.discountType, item.discountValue);

        return {
          unitId: item.productId,
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
      const quotationNumber = await getNextQuotationNumber();

      try {
        const result = await createQuotationWithItems({
          quotationNumber,
          customerId: input.customerId,
          customerName: input.customerId ? undefined : input.customerName,
          status: "pending",
          subtotal,
          discountType: input.discountType,
          discountValue: Math.round(input.discountValue),
          discountAmount,
          total,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          notes: input.notes,
          termsAndConditions: input.termsAndConditions,
          createdBy: ctx.user!.id,
          items: normalizedItems as any,
        });

        return { success: true, quotationId: (result as any).insertId, quotationNumber: result.quotationNumber };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo registrar la cotización",
        });
      }
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      quotationId: z.number(),
      status: z.enum(["pending", "accepted", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      try {
        return await updateQuotationStatus(input.quotationId, input.status);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo actualizar el estado",
        });
      }
    }),
});
