import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createOrder,
  updateOrder,
  getAllOrders,
  getOrderByNumber,
  getOrderById,
  createOrderItem,
  getOrderItems,
  createPayment,
  getPaymentByOrderId,
  updatePayment,
  getCustomerByNumber,
  createCustomer,
  getCustomerById,
  updateCustomer,
  getAllCustomers,
  getAllSales,
  deleteOrderItems,
  completeOrderDelivery,
  deductInventoryForOrder,
  restoreInventoryForOrder,
  getOrdersByDeliveryPerson,
  assignDeliveryExtraLoad,
  getDeliveryExtraLoad,
  updateDeliveryExtraLoadStatus,
} from "../db";
import { ensureCustomerRecord } from "./customer_utils";
import { getLocalDateKey, pad2 } from "../_core/date_utils";
import { TRPCError } from "@trpc/server";



export const ordersRouter = router({
  // Generar próximo número de pedido
  getNextOrderNumber: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const allOrders = await getAllOrders(ctx.branchId);

    // Extraer números de los pedidos existentes
    const orderNumbers = allOrders
      .map((o: any) => {
        const match = o.orderNumber?.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      })
      .filter((n: number) => !isNaN(n) && n > 0);

    // Obtener el número más alto y sumarle 1
    const maxExisting = orderNumbers.length > 0 ? Math.max(...orderNumbers) : 0;
    const nextNumber = maxExisting + 1;
    const paddedNumber = String(nextNumber).padStart(3, "0");

    return { orderNumber: `ORD-${paddedNumber}` };
  }),

  // Obtener todos los pedidos
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllOrders(ctx.branchId);
  }),

  // Hoja de reparto del dÃ­a (Admin): pedidos asignados + productos
  getDeliverySheet: protectedProcedure
    .input(z.object({
      deliveryPersonId: z.number(),
      date: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [orders, customers, sales] = await Promise.all([
        getAllOrders(ctx.branchId),
        getAllCustomers(),
        getAllSales(),
      ]);

      const customerById = new Map<number, any>((customers as any[]).map((customer: any) => [customer.id, customer]));

      const dayOrders = (orders as any[]).filter((order: any) => {
        if (order.deliveryPersonId !== input.deliveryPersonId) return false;
        if (order.status === "cancelled") return false;

        if (order.deliveryDate) return order.deliveryDate === input.date;
        return getLocalDateKey(order.createdAt) === input.date;
      });

      const hasPreviousActivity = (order: any) => {
        const customerId = order.customerId || null;
        const customer = customerId ? customerById.get(customerId) : null;
        const clientNumber = customer?.clientNumber || null;

        const orderActivityKey = (value: any) => value?.deliveryDate || getLocalDateKey(value?.createdAt) || null;

        const previousOrder = (orders as any[]).some((other: any) => {
          if (!other || other.status === "cancelled") return false;
          if (other.id === order.id) return false;
          if (customerId && other.customerId === customerId) {
            const key = orderActivityKey(other);
            return !!key && key < input.date;
          }
          if (clientNumber) {
            const otherCustomer = other.customerId ? customerById.get(other.customerId) : null;
            if (otherCustomer?.clientNumber === clientNumber) {
              const key = orderActivityKey(other);
              return !!key && key < input.date;
            }
          }
          return false;
        });

        if (previousOrder) return true;

        const previousSale = (sales as any[]).some((sale: any) => {
          if (!sale || sale.status === "cancelled") return false;
          if (customerId && sale.customerId === customerId) {
            const key = getLocalDateKey(sale.createdAt);
            return !!key && key < input.date;
          }
          return false;
        });

        return previousSale;
      };

      const entries = await Promise.all(dayOrders.map(async (order: any) => {
        const items = await getOrderItems(order.id);
        const customer = order.customerId ? customerById.get(order.customerId) : null;
        const isNew = !hasPreviousActivity(order);
        return {
          order,
          customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, whatsapp: customer.whatsapp, clientNumber: customer.clientNumber } : null,
          items,
          cohort: isNew ? "new" : "repeat",
        };
      }));

      entries.sort((a: any, b: any) => {
        const timeA = a.order.deliveryTime || "99:99";
        const timeB = b.order.deliveryTime || "99:99";
        return timeA.localeCompare(timeB) || String(a.order.orderNumber || "").localeCompare(String(b.order.orderNumber || ""));
      });

      const totals = {
        totalBs: entries.reduce((sum: number, row: any) => sum + (row.order.totalPrice || 0), 0),
        cashBs: entries.reduce((sum: number, row: any) => sum + ((row.order.paymentMethod === "cash" ? row.order.totalPrice : 0) || 0), 0),
        qrBs: entries.reduce((sum: number, row: any) => sum + ((row.order.paymentMethod === "qr" ? row.order.totalPrice : 0) || 0), 0),
        transferBs: entries.reduce((sum: number, row: any) => sum + ((row.order.paymentMethod === "transfer" ? row.order.totalPrice : 0) || 0), 0),
        totalProducts: entries.reduce((sum: number, row: any) => sum + (row.items || []).reduce((acc: number, item: any) => acc + Number(item.quantity || 0), 0), 0),
        newCustomers: entries.filter((row: any) => row.cohort === "new").length,
        repeatCustomers: entries.filter((row: any) => row.cohort === "repeat").length,
      };

      const deliveryPersonName = (dayOrders as any[])[0]?.deliveryPersonName || null;

      return {
        date: input.date,
        deliveryPersonId: input.deliveryPersonId,
        deliveryPersonName,
        entries,
        totals,
      };
    }),

  // Obtener pedidos del repartidor
  listForDelivery: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "user") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const allOrders = await getOrdersByDeliveryPerson(ctx.user.id);
    return (allOrders as any[]).filter((o: any) => 
      ["assigned", "in_transit", "rescheduled", "delivered"].includes(o.status)
    );
  }),

  // Carga del repartidor: productos agregados por pedidos activos
  getMyLoad: protectedProcedure
    .input(z.object({
      date: z.string().optional(),
      status: z.enum(["all", "assigned", "in_transit", "rescheduled"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "user") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const statusFilter = input?.status && input.status !== "all" ? input.status : null;
      const dateFilter = input?.date || null;
      const allOrders = await getOrdersByDeliveryPerson(ctx.user.id);

      const activeOrders = (allOrders as any[]).filter((o: any) => {
        if (!["assigned", "in_transit", "rescheduled"].includes(o.status)) return false;
        if (statusFilter && o.status !== statusFilter) return false;

        if (dateFilter) {
          if (o.deliveryDate) return o.deliveryDate === dateFilter;
          return getLocalDateKey(o.createdAt) === dateFilter;
        }

        return true;
      });

      const results = await Promise.all(activeOrders.map(async (order: any) => {
        const [items, customer] = await Promise.all([
          getOrderItems(order.id),
          order.customerId ? getCustomerById(order.customerId) : null,
        ]);
        return { order, items, customer };
      }));

      return results;
    }),

  // Crear un nuevo pedido
  create: protectedProcedure
    .input(
      z.object({
        orderNumber: z.string(),
        clientNumber: z.string(),
        clientName: z.string(),
        zone: z.string(),
        sourceChannel: z.enum(["facebook", "tiktok", "marketplace", "referral", "other"]).default("other"),
        deliveryDate: z.string().optional(),
        deliveryTime: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number(),
            price: z.number(),
            pricingType: z.enum(["unit", "wholesale", "discount"]).default("unit"),
          })
        ),
        totalPrice: z.number(),
        paymentMethod: z.enum(["qr", "cash", "transfer"]).optional(),
        deliveryPersonId: z.number().optional(),
        notes: z.string().optional(),
        customerType: z.enum(["retail", "wholesale"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const customer = await ensureCustomerRecord({
        clientNumber: input.clientNumber,
        clientName: input.clientName,
        zone: input.zone,
        sourceChannel: input.sourceChannel,
        customerType: input.customerType,
      });

      if (!customer) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create customer",
        });
      }

      // Verificar si el numero de pedido ya existe para evitar errores de concurrencia
      let finalOrderNumber = input.orderNumber;
      let existingOrder = await getOrderByNumber(finalOrderNumber);
      
      if (existingOrder) {
        // Generar un nuevo número de forma automática si ya existe
        const allOrders = await getAllOrders(ctx.branchId);
        const orderNumbers = allOrders
          .map((o: any) => {
            const match = o.orderNumber?.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
          })
          .filter((n: number) => !isNaN(n) && n > 0);
          
        const maxExisting = orderNumbers.length > 0 ? Math.max(...orderNumbers) : 0;
        const nextNumber = maxExisting + 1;
        finalOrderNumber = `ORD-${String(nextNumber).padStart(3, "0")}`;
      }

      // Crear pedido
      const orderResult = await createOrder({
        orderNumber: finalOrderNumber,
        branchId: ctx.branchId,
        customerId: customer.id,
        zone: input.zone,
        deliveryDate: input.deliveryDate,
        deliveryTime: input.deliveryTime,
        totalPrice: input.totalPrice,
        paymentMethod: input.paymentMethod,
        deliveryPersonId: input.deliveryPersonId,
        status: input.deliveryPersonId ? "assigned" : "pending",
        paymentStatus: "pending",
        notes: input.notes,
        sourceChannel: input.sourceChannel,
      });

      // Obtener el ID del pedido creado
      const newOrder = await getOrderByNumber(finalOrderNumber);
      if (!newOrder) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve created order",
        });
      }

      // Verificar que todos los productos existen en la BD real
      const db = await import("../db").then(m => m.getDb());
      if (db) {
        const { products } = await import("../../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        const productIds = input.items.map(item => item.productId);
        const existingProducts = await db.select({ id: products.id }).from(products).where(inArray(products.id, productIds));
        const existingIds = existingProducts.map(p => p.id);
        
        for (const id of productIds) {
          if (!existingIds.includes(id)) {
            // Log for debugging
            const allDbProducts = await db.select({ id: products.id, name: products.name }).from(products);
            console.error(`Product ID ${id} not found in DB! Available products:`, allDbProducts);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `El producto con ID ${id} no existe en la base de datos. Por favor, recarga la página.`,
            });
          }
        }
      }

      // Crear items del pedido
      for (const item of input.items) {
        try {
          await createOrderItem({
            orderId: newOrder.id,
            productId: item.productId,
            pricingType: item.pricingType,
            quantity: item.quantity,
            price: item.price,
          });
        } catch (error: any) {
          console.error("Error inserting order item:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Error MySQL al insertar item (Order: ${newOrder.id}, Product: ${item.productId}): ${error.sqlMessage || error.message || String(error)}`,
          });
        }
      }

      // Descontar stock del inventario y registrar en historial
      await deductInventoryForOrder(newOrder.id, finalOrderNumber, input.items.map(i => ({ ...i, orderId: newOrder.id })));

      return newOrder;
    }),

  // Actualizar pedido
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        orderNumber: z.string(),
        clientNumber: z.string(),
        clientName: z.string(),
        zone: z.string(),
        sourceChannel: z.enum(["facebook", "tiktok", "marketplace", "referral", "other"]),
        deliveryDate: z.string(),
        deliveryTime: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number(),
            price: z.number(),
            pricingType: z.enum(["unit", "wholesale", "discount"]).default("unit"),
          })
        ),
        totalPrice: z.number(),
        paymentMethod: z.enum(["qr", "cash", "transfer"]).optional(),
        deliveryPersonId: z.number().optional(),
        notes: z.string().optional(),
        status: z.string().optional(),
        customerType: z.enum(["retail", "wholesale"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Obtener el pedido actual para revertir inventario
      const currentOrder = await getOrderById(input.id);
      if (!currentOrder) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      // 1. Revertir inventario de los items actuales antes de borrarlos
      const currentItems = await getOrderItems(input.id);
      await restoreInventoryForOrder(input.id, currentOrder.orderNumber || "", currentItems as any);

      // 2. Asegurar registro del cliente
      const customer = await ensureCustomerRecord({
        clientNumber: input.clientNumber,
        clientName: input.clientName,
        zone: input.zone,
        sourceChannel: input.sourceChannel,
        customerType: input.customerType,
      });

      if (!customer) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update customer",
        });
      }

      // 3. Actualizar el pedido
      await updateOrder(input.id, {
        orderNumber: input.orderNumber,
        customerId: customer.id,
        zone: input.zone,
        deliveryDate: input.deliveryDate,
        deliveryTime: input.deliveryTime,
        totalPrice: input.totalPrice,
        paymentMethod: input.paymentMethod,
        deliveryPersonId: input.deliveryPersonId,
        status: (input.status as any) || (input.deliveryPersonId ? "assigned" : "pending"),
        notes: input.notes,
        sourceChannel: input.sourceChannel,
        updatedAt: new Date(),
      });

      // 4. Actualizar items (borrar y crear de nuevo)
      await deleteOrderItems(input.id);
      for (const item of input.items) {
        await createOrderItem({
          orderId: input.id,
          productId: item.productId,
          pricingType: item.pricingType,
          quantity: item.quantity,
          price: item.price,
        });
      }

      // 5. Descontar stock del nuevo inventario
      await deductInventoryForOrder(input.id, input.orderNumber, input.items.map(i => ({ ...i, orderId: input.id })));

      return { success: true };
    }),

  // Obtener detalles del pedido
  getDetails: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verificar permisos
      if (ctx.user?.role === "user" && order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [items, customer] = await Promise.all([
        getOrderItems(input.orderId),
        order.customerId ? getCustomerById(order.customerId) : null,
      ]);
      return { order, items, customer };
    }),

  // Registrar pago (Entrega Automática)
  recordPayment: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        amount: z.number(),
        method: z.enum(["qr", "cash", "transfer"]),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      
      // Permisos: Admin o el repartidor asignado
      if (ctx.user?.role !== "admin" && order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Registrar pago
      const existingPayment = await getPaymentByOrderId(input.orderId);
      if (existingPayment) {
        await updatePayment(existingPayment.id, {
          amount: input.amount,
          method: input.method,
          status: "completed",
          reference: input.reference,
          notes: input.notes,
        });
      } else {
        await createPayment({
          orderId: input.orderId,
          amount: input.amount,
          method: input.method,
          status: "completed",
          reference: input.reference,
          notes: input.notes,
        });
      }

      // Marcar entrega automática y procesar impacto (Stock + Finanzas)
      await completeOrderDelivery(input.orderId, input.method);

      return { success: true };
    }),

  // Solicitar reprogramación (Repartidor)
  requestReschedule: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      newDate: z.string(),
      newTime: z.string().optional(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      
      if (!order || (ctx.user?.role !== "admin" && order.deliveryPersonId !== ctx.user?.id)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await updateOrder(input.orderId, {
        rescheduleRequested: 1,
        requestedDate: input.newDate,
        requestedTime: input.newTime,
        rescheduleReason: input.reason
      });

      return { success: true };
    }),

  // Reprogramar / Aprobar (Admin)
  rescheduleOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      newDate: z.string(),
      newTime: z.string().optional(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await updateOrder(input.orderId, {
        deliveryDate: input.newDate,
        deliveryTime: input.newTime,
        rescheduleReason: input.reason,
        status: 'rescheduled', 
        rescheduleRequested: 0,
      });

      return { success: true };
    }),

  // Solicitar baja (Repartidor)
  requestCancellation: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      
      if (!order || (ctx.user?.role !== "admin" && order.deliveryPersonId !== ctx.user?.id)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (order.status === "delivered" || order.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede solicitar baja para un pedido ya entregado/cancelado." });
      }

      await updateOrder(input.orderId, {
        cancellationRequested: 1,
        cancellationReason: input.reason
      });

      return { success: true };
    }),

  // Rechazar reprogramación (Admin)
  rejectRescheduleRequest: protectedProcedure
    .input(z.object({
      orderId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await updateOrder(input.orderId, {
        rescheduleRequested: 0,
      });

      return { success: true };
    }),

  // Dar de baja definitiva (Admin)
  dismissOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      cancelledBy: z.enum(["client", "company", "system"]),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      // Restaurar stock del pedido cancelado
      if (!["delivered"].includes(order.status)) {
        const items = await getOrderItems(input.orderId);
        await restoreInventoryForOrder(input.orderId, order.orderNumber, items);
      }

      await updateOrder(input.orderId, {
        status: "cancelled",
        cancelledBy: input.cancelledBy,
        cancelReason: input.reason,
        cancellationRequested: 0,
      });

      return { success: true };
    }),

  // Otros métodos originales simplificados o corregidos si es necesario...
  updateStatus: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      status: z.enum(["pending", "assigned", "in_transit", "delivered", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.user?.role !== "admin" && order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (input.status === "delivered") {
        // Usar la lógica de entrega completa que incluye stock y finanzas
        const currentMethod = order.paymentMethod || "cash";
        await completeOrderDelivery(input.orderId, currentMethod);
      } else {
        await updateOrder(input.orderId, { status: input.status });
      }
      return { success: true };
  }),

  // Actualización masiva de estados
  bulkUpdateStatus: protectedProcedure
    .input(z.object({
      orderIds: z.array(z.number()),
      status: z.enum(["pending", "assigned", "in_transit", "delivered", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      let updatedCount = 0;
      for (const orderId of input.orderIds) {
        const order = await getOrderById(orderId);
        if (!order) continue;

        // Skip if already in the target status
        if (order.status === input.status) continue;

        if (input.status === "delivered") {
          const currentMethod = order.paymentMethod || "cash";
          await completeOrderDelivery(orderId, currentMethod);
        } else {
          await updateOrder(orderId, { status: input.status });
        }
        updatedCount++;
      }
      
      return { success: true, updatedCount };
    }),

  // Carga Extra
  assignExtraLoad: protectedProcedure
    .input(z.object({
      deliveryPersonId: z.number(),
      productId: z.number(),
      quantity: z.number(),
      type: z.enum(["sale", "sample"]),
      date: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await assignDeliveryExtraLoad(input);
    }),

  getExtraLoad: protectedProcedure
    .input(z.object({
      deliveryPersonId: z.number(),
      date: z.string(),
    }))
    .query(async ({ input }) => {
      return await getDeliveryExtraLoad(input.deliveryPersonId, input.date);
    }),

  getMyExtraLoad: protectedProcedure
    .input(z.object({
      date: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      return await getDeliveryExtraLoad(ctx.user.id, input.date);
    }),

  updateExtraLoadStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["loaded", "sold", "used", "returned"]),
    }))
    .mutation(async ({ input, ctx }) => {
      return await updateDeliveryExtraLoadStatus(input.id, input.status, ctx.user.id);
    }),
});
