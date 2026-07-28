import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { inventory, inventoryTransfers, inventoryTransferItems, users } from "../../drizzle/schema";
import { eq, and, isNull, sql, count, inArray, desc } from "drizzle-orm";
import {
  getAllProducts,
  createProduct,
  getAllInventory,
  getInventoryByProductId,
  getProductsWithStock,
  updateInventory,
  updateProductPrice,
  updateProduct,
  createInventoryMovement,
  getInventoryMovements,
  getProductById,
  getPurchasesByProductId,
  recordInventoryEntryAsPurchase,
  getOnOrderQuantities,
  getSmartInventoryAlerts,
} from "../db";
import { TRPCError } from "@trpc/server";

function formatCurrencyCents(amount?: number | null) {
  if (amount == null) return "Bs. 0.00";
  return `Bs. ${(amount / 100).toFixed(2)}`;
}

function formatStatusLabel(status?: "active" | "inactive") {
  return status === "inactive" ? "inactivo" : "activo";
}

function normalizeProductReference(value?: string | null) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d+(?:[.,]\d+)?)\s*(litros|litro|lts|lt|l)\b/g, "$1l")
    .replace(/(\d+(?:[.,]\d+)?)\s*(mililitros|mililitro|ml)\b/g, "$1ml")
    .replace(/(\d+(?:[.,]\d+)?)\s*(gramos|gramo|grs|gr|g)\b/g, "$1g")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function productReferenceKey(value?: string | null) {
  return normalizeProductReference(value).replace(/\s+/g, "");
}

function productReferenceTokens(value?: string | null) {
  return normalizeProductReference(value)
    .split(/\s+/)
    .filter(token => token.length > 2 || /\d/.test(token));
}

function resolveFinishedProductReference(
  productsData: any[],
  productId: number,
  productName?: string,
  productCode?: string
) {
  if (productCode) {
    const searchCode = productCode.trim().toLowerCase();
    const product = productsData.find(
      product =>
        product.category === "finished_product" &&
        String(product.code || "").trim().toLowerCase() === searchCode
    );
    if (product) return product;
  }

  if (productId > 0) {
    const product = productsData.find(product => product.id === productId);
    if (product && product.category === "finished_product") return product;
    return undefined;
  }

  if (!productName) return undefined;

  const searchKey = productReferenceKey(productName);
  const finishedProducts = productsData.filter(
    product => product.category === "finished_product"
  );

  const exactMatches = finishedProducts.filter(
    product => productReferenceKey(product.name) === searchKey
  );
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `El producto "${productName}" coincide con mas de una referencia del inventario general. Revise el catalogo antes de traspasar.`,
    });
  }

  const searchTokens = productReferenceTokens(productName);
  const tokenMatches = finishedProducts.filter(product => {
    const productTokens = new Set(productReferenceTokens(product.name));
    return (
      searchTokens.length > 0 &&
      searchTokens.every(token => productTokens.has(token))
    );
  });

  if (tokenMatches.length === 1) return tokenMatches[0];
  if (tokenMatches.length > 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `El producto "${productName}" no tiene una referencia unica en inventario general. Seleccione el SKU exacto.`,
    });
  }

  return undefined;
}

function getKefirProductPresentation(product: any) {
  const unit = normalizeProductReference(product?.unit);
  const volume = Number(product?.volume || 0);
  const name = String(product?.name || "");
  const normalizedName = normalizeProductReference(name);
  const volumeMatch = normalizedName.match(/(\d+(?:[.,]\d+)?)(ml|l)\b/);
  const weightMatch = normalizedName.match(/(\d+(?:[.,]\d+)?)(g)\b/);

  if (unit === "l") return { volumeMl: volume * 1000, weightGr: 0, presentationUnit: "ml" };
  if (unit === "ml") return { volumeMl: volume, weightGr: 0, presentationUnit: "ml" };
  if (unit === "g" || unit === "gr") return { volumeMl: 0, weightGr: volume, presentationUnit: "g" };

  if (volumeMatch) {
    const value = Number(volumeMatch[1].replace(",", "."));
    return {
      volumeMl: volumeMatch[2] === "l" ? value * 1000 : value,
      weightGr: 0,
      presentationUnit: "ml",
    };
  }

  if (weightMatch) {
    return {
      volumeMl: 0,
      weightGr: Number(weightMatch[1].replace(",", ".")),
      presentationUnit: "g",
    };
  }

  return { volumeMl: 0, weightGr: 0, presentationUnit: "unidad" };
}

function buildUniqueProductCode(productsData: any[], preferredCode: string, productName: string) {
  const cleanPreferred = String(preferredCode || "").trim();
  const base =
    cleanPreferred ||
    `KF-${productReferenceKey(productName).slice(0, 18).toUpperCase() || "PRODUCTO"}`;
  let code = base;
  let suffix = 1;

  while (
    productsData.some(
      product => String(product.code || "").trim().toLowerCase() === code.toLowerCase()
    )
  ) {
    suffix += 1;
    code = `${base}-${suffix}`;
  }

  return code;
}

function classifyHistoryEvent(movement: any) {
  const reason = (movement.reason || "").toLowerCase();
  const notes = movement.notes || movement.reason || "";

  if (reason.includes("producto creado")) {
    return {
      eventType: "created",
      title: "Producto creado",
      description: notes || "Se registró el producto en el inventario.",
    };
  }

  if (reason.includes("dado de baja")) {
    return {
      eventType: "deactivated",
      title: "Producto dado de baja",
      description: notes || "El producto fue marcado como inactivo.",
    };
  }

  if (reason.includes("reactivado")) {
    return {
      eventType: "reactivated",
      title: "Producto reactivado",
      description: notes || "El producto volvió a estar disponible.",
    };
  }

  if (reason.includes("precio") || reason.includes("datos del producto")) {
    return {
      eventType: "updated",
      title: "Datos actualizados",
      description: notes || "Se modificaron datos del producto.",
    };
  }

  if (reason.includes("pedido reservado")) {
    return {
      eventType: "order_reservation",
      title: "Pedido reservado",
      description: notes || `Stock reservado para ${movement.orderNumber || "pedido"} (${movement.quantity} uds.).`,
    };
  }

  if (reason.includes("pedido cancelado")) {
    return {
      eventType: "order_cancellation",
      title: "Pedido cancelado",
      description: notes || `Stock devuelto por ${movement.orderNumber || "pedido"} (${movement.quantity} uds.).`,
    };
  }

  if (reason.includes("pedido")) {
    return {
      eventType: "order_delivery",
      title: "Pedido entregado",
      description: notes || `Entrega de ${movement.orderNumber || "pedido"} confirmada (${movement.quantity} uds.).`,
    };
  }

  if (reason.includes("venta")) {
    return {
      eventType: "sale",
      title: "Venta registrada",
      description: notes || movement.reason || "Se descontó stock por una venta.",
    };
  }

  if (reason.includes("anulaci")) {
    return {
      eventType: "sale_cancellation",
      title: "Venta anulada y stock repuesto",
      description: notes || movement.reason || "Se devolvió stock por anulación.",
    };
  }

  if (notes.includes("auto-registrado") || reason.includes("compra rapida")) {
    return {
      eventType: "purchase",
      title: "Compra registrada (Rápida)",
      description: notes || "Se registró una compra rápida desde el ajuste de inventario.",
    };
  }

  if (movement.type === "entry") {
    if (reason.includes("producci")) {
      return {
        eventType: "production",
        title: "Ingreso por Producción",
        description: notes || "Se registró entrada de producto terminado por producción.",
      };
    }
    return {
      eventType: "inventory_entry",
      title: "Entrada de inventario",
      description: notes || "Se aumentó el stock del producto.",
    };
  }

  if (movement.type === "exit") {
    return {
      eventType: "inventory_exit",
      title: "Salida de inventario",
      description: notes || "Se redujo el stock del producto.",
    };
  }

  return {
    eventType: "inventory_adjustment",
    title: "Ajuste de inventario",
    description: notes || "Se realizó un ajuste manual del producto.",
  };
}

export const inventoryRouter = router({
  // Obtener todos los productos
  listProducts: protectedProcedure.query(async ({ ctx }) => {
    return await getAllProducts();
  }),

  getProductsWithStock: protectedProcedure.query(async ({ ctx }) => {
    return await getProductsWithStock(ctx.branchId);
  }),

  // Crear un nuevo producto
  createProduct: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1, "El código no puede estar vacío"),
        name: z.string(),
        category: z.enum(["finished_product", "raw_material", "supplies", "insumo"]),
        price: z.number(),
        salePrice: z.number().optional(),
        wholesalePrice: z.number().optional(),
        discountPrice: z.number().optional(),
        imageUrl: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        unit: z.string().optional(),
        presentationQuantity: z.number().optional(),
        presentationUnit: z.string().optional(),
        presentationVolumeMl: z.number().optional(),
        presentationWeightGr: z.number().optional(),
        productionRole: z.enum(["none", "milk", "sugar", "culture", "bottle", "cap", "label", "packaging", "finished_good", "other"]).optional(),
        storageLocation: z.string().optional(),
        supplierName: z.string().optional(),
        productionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await createProduct({
        code: input.code,
        name: input.name,
        category: input.category,
        price: Math.round(input.price * 100), // Convertir a centavos
        salePrice: Math.round((input.salePrice || 0) * 100),
        wholesalePrice: Math.round((input.wholesalePrice || 0) * 100),
        discountPrice: Math.round((input.discountPrice || 0) * 100),
        wholesaleDiscountType: "percentage",
        wholesaleDiscountValue: 0,
        imageUrl: input.imageUrl || null,
        status: (input.status || "active") as "active" | "inactive",
        unit: input.unit || "unidad",
        presentationQuantity: input.presentationQuantity || 1,
        presentationUnit: input.presentationUnit || input.unit || "unidad",
        presentationVolumeMl: input.presentationVolumeMl || 0,
        presentationWeightGr: input.presentationWeightGr || 0,
        productionRole: input.productionRole || "none",
        storageLocation: input.storageLocation || null,
        supplierName: input.supplierName || null,
        productionNotes: input.productionNotes || null,
      });

      let productId = 0;
      if (Array.isArray(result) && result.length > 0) {
        productId = Number(result[0].insertId);
      } else {
        productId = Number((result as any)?.insertId);
      }
      
      if (Number.isFinite(productId) && productId > 0) {
        await createInventoryMovement({
          productId,
          userId: ctx.user.id,
          type: "adjustment",
          quantity: 0,
          reason: "Producto creado",
          notes: `Creado por ${ctx.user.name || ctx.user.username || "usuario"} con precio compra ${formatCurrencyCents(Math.round(input.price * 100))}, venta unitaria ${formatCurrencyCents(Math.round((input.salePrice || 0) * 100))}, mayorista ${formatCurrencyCents(Math.round((input.wholesalePrice || 0) * 100))} y descuento ${formatCurrencyCents(Math.round((input.discountPrice || 0) * 100))}. Estado inicial: ${formatStatusLabel(input.status || "active")}.`,
        });
      }

      return { success: true, productId };
    }),

  syncKefirProducts: protectedProcedure
    .input(
      z.object({
        products: z.array(
          z.object({
            id: z.union([z.string(), z.number()]).optional(),
            code: z.string().optional(),
            generalProductId: z.number().optional(),
            inventoryProductId: z.number().optional(),
            productId: z.number().optional(),
            name: z.string(),
            type: z.string().optional(),
            flavor: z.string().optional(),
            volume: z.number().optional(),
            unit: z.string().optional(),
            sellPrice: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const productsData = await getAllProducts();
      const mappings: any[] = [];

      for (const kefirProduct of input.products) {
        const productName = kefirProduct.name.trim();
        if (!productName) continue;

        const localId = String(kefirProduct.id || kefirProduct.code || productName);
        const linkedId =
          kefirProduct.generalProductId ||
          kefirProduct.inventoryProductId ||
          kefirProduct.productId ||
          0;
        const preferredCode = String(kefirProduct.code || kefirProduct.id || "").trim();

        let product = resolveFinishedProductReference(
          productsData,
          Number(linkedId || 0),
          productName,
          preferredCode
        );
        let created = false;

        if (!product) {
          const presentation = getKefirProductPresentation(kefirProduct);
          const salePrice = Math.max(0, Number(kefirProduct.sellPrice || 0));
          const code = buildUniqueProductCode(productsData, preferredCode, productName);
          const result = await createProduct({
            code,
            name: productName,
            category: "finished_product",
            price: 0,
            salePrice: Math.round(salePrice * 100),
            wholesalePrice: Math.round(salePrice * 100),
            discountPrice: Math.round(salePrice * 100),
            wholesaleDiscountType: "percentage",
            wholesaleDiscountValue: 0,
            imageUrl: null,
            status: "active",
            unit: "unidad",
            presentationQuantity: 1,
            presentationUnit: presentation.presentationUnit,
            presentationVolumeMl: presentation.volumeMl,
            presentationWeightGr: presentation.weightGr,
            productionRole: "finished_good",
            storageLocation: "Inventario General",
            supplierName: "Produccion",
            productionNotes: "Creado automaticamente desde KefirControl",
          } as any);

          const productId = Array.isArray(result)
            ? Number(result[0]?.insertId || 0)
            : Number((result as any)?.insertId || 0);

          if (productId > 0) {
            product = {
              id: productId,
              code,
              name: productName,
              category: "finished_product",
              unit: "unidad",
            };
            productsData.push(product);
            created = true;

            await createInventoryMovement({
              productId,
              userId: ctx.user.id,
              type: "adjustment",
              quantity: 0,
              reason: "Producto creado",
              notes: `Creado automaticamente desde KefirControl para sincronizacion de produccion.`,
            });
          }
        }

        if (product) {
          mappings.push({
            localId,
            productId: product.id,
            code: product.code,
            name: product.name,
            created,
          });
        }
      }

      return { success: true, mappings };
    }),

  // Actualizar un producto
  updateProduct: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().optional(),
        name: z.string().optional(),
        category: z.enum(["finished_product", "raw_material", "supplies", "insumo"]).optional(),
        price: z.number().optional(),
        salePrice: z.number().optional(),
        wholesalePrice: z.number().optional(),
        discountPrice: z.number().optional(),
        imageUrl: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        unit: z.string().optional(),
        presentationQuantity: z.number().optional(),
        presentationUnit: z.string().optional(),
        presentationVolumeMl: z.number().optional(),
        presentationWeightGr: z.number().optional(),
        productionRole: z.enum(["none", "milk", "sugar", "culture", "bottle", "cap", "label", "packaging", "finished_good", "other"]).optional(),
        storageLocation: z.string().optional().nullable(),
        supplierName: z.string().optional().nullable(),
        productionNotes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const existingProduct = await getProductById(input.id);
      if (!existingProduct) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });
      }

      const { id, ...updateData } = input;
      if (updateData.price !== undefined) {
        updateData.price = Math.round(updateData.price * 100);
      }
      if (updateData.salePrice !== undefined) {
        updateData.salePrice = Math.round(updateData.salePrice * 100);
      }
      if (updateData.wholesalePrice !== undefined) {
        updateData.wholesalePrice = Math.round(updateData.wholesalePrice * 100);
      }
      if (updateData.discountPrice !== undefined) {
        updateData.discountPrice = Math.round(updateData.discountPrice * 100);
      }

      await updateProduct(id, updateData as any);

      const actorName = ctx.user.name || ctx.user.username || "usuario";
      const historyEvents: Array<{ reason: string; notes: string }> = [];

      if (updateData.status && updateData.status !== existingProduct.status) {
        historyEvents.push({
          reason: updateData.status === "inactive" ? "Producto dado de baja" : "Producto reactivado",
          notes: `${actorName} cambió el estado de ${formatStatusLabel(existingProduct.status)} a ${formatStatusLabel(updateData.status)}.`,
        });
      }

      if (
        updateData.price !== undefined && updateData.price !== existingProduct.price ||
        updateData.salePrice !== undefined && updateData.salePrice !== existingProduct.salePrice ||
        updateData.wholesalePrice !== undefined && updateData.wholesalePrice !== existingProduct.wholesalePrice ||
        updateData.discountPrice !== undefined && updateData.discountPrice !== existingProduct.discountPrice
      ) {
        const buyChange = updateData.price !== undefined ? `${formatCurrencyCents(existingProduct.price)} -> ${formatCurrencyCents(updateData.price)}` : "sin cambios";
        const saleChange = updateData.salePrice !== undefined ? `${formatCurrencyCents(existingProduct.salePrice)} -> ${formatCurrencyCents(updateData.salePrice)}` : "sin cambios";
        const wholesaleChange = updateData.wholesalePrice !== undefined ? `${formatCurrencyCents(existingProduct.wholesalePrice)} -> ${formatCurrencyCents(updateData.wholesalePrice)}` : "sin cambios";
        const discountChange = updateData.discountPrice !== undefined ? `${formatCurrencyCents(existingProduct.discountPrice)} -> ${formatCurrencyCents(updateData.discountPrice)}` : "sin cambios";

        historyEvents.push({
          reason: "Precios actualizados",
          notes: `${actorName} actualizó precios. Compra: ${buyChange}. Venta: ${saleChange}. Mayorista: ${wholesaleChange}. Descuento: ${discountChange}.`,
        });
      }

      const changedFields: string[] = [];
      if (updateData.name !== undefined && updateData.name !== existingProduct.name) {
        changedFields.push(`nombre: ${existingProduct.name} -> ${updateData.name}`);
      }
      if (updateData.code !== undefined && updateData.code !== existingProduct.code) {
        changedFields.push(`código: ${existingProduct.code} -> ${updateData.code}`);
      }
      if (updateData.category !== undefined && updateData.category !== existingProduct.category) {
        changedFields.push(`categoría: ${existingProduct.category} -> ${updateData.category}`);
      }
      if (updateData.imageUrl !== undefined && updateData.imageUrl !== existingProduct.imageUrl) {
        changedFields.push("imagen actualizada");
      }

      if (changedFields.length > 0) {
        historyEvents.push({
          reason: "Datos del producto actualizados",
          notes: `${actorName} modificó ${changedFields.join(", ")}.`,
        });
      }

      for (const event of historyEvents) {
        await createInventoryMovement({
          productId: id,
          userId: ctx.user.id,
          type: "adjustment",
          quantity: 0,
          reason: event.reason,
          notes: event.notes,
        });
      }

      return { success: true };
    }),

  // Obtener inventario completo
  listInventory: protectedProcedure.query(async ({ ctx }) => {
    const [inventory, products, onOrder] = await Promise.all([
      getAllInventory(ctx.branchId),
      getAllProducts(),
      getOnOrderQuantities()
    ]);

    return inventory.map((inv: any) => {
      const product = products.find((p: any) => p.id === inv.productId);
      return {
        ...inv,
        product,
        onOrder: onOrder[inv.productId] || 0,
        isLowStock: inv.quantity <= inv.minStock,
      };
    });
  }),

  // Actualizar cantidad de producto y precio
  updateQuantity: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        quantity: z.number(),
        price: z.number().optional(), // nuevo precio en centavos
        reason: z.string().optional(),
        type: z.enum(["entry", "exit", "adjustment"]).optional(),
        expiryDate: z.string().optional(),
        batchNumber: z.string().optional(),
        registerPurchase: z.boolean().optional(),
        paymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const product = await getProductById(input.productId);
      
      // Obtener el inventario específico para este lote/producto
      const db = await import("../db").then(m => m.getDb());
      let existingInv = null;
      if (db) {
        const res = await db.select().from(inventory).where(and(
          eq(inventory.productId, input.productId),
          input.batchNumber ? eq(inventory.batchNumber, input.batchNumber) : isNull(inventory.batchNumber)
        )).limit(1);
        existingInv = res.length > 0 ? res[0] : null;
      } else {
        const { MOCK_INVENTORY } = await import("../db");
        existingInv = MOCK_INVENTORY.find(i => i.productId === input.productId && (input.batchNumber ? i.batchNumber === input.batchNumber : !i.batchNumber)) || null;
      }

      const newQuantity = (existingInv?.quantity || 0) + input.quantity;
      console.log(`[SYNC TRACE] updateQuantity: productId=${input.productId}, inputQty=${input.quantity}, existingQty=${existingInv?.quantity || 0}, newQty=${newQuantity}`);
      
      const { updateInventory, createInventoryMovement, updateProductPrice, recordInventoryEntryAsPurchase } = await import("../db");
      await updateInventory(input.productId, newQuantity, input.expiryDate, input.batchNumber, ctx.branchId);

      const notes: string[] = [];
      if (input.price !== undefined && product && input.price !== product.price) {
        notes.push(
          `Precio compra: ${formatCurrencyCents(product.price)} -> ${formatCurrencyCents(input.price)}`
        );
      }
      if (input.expiryDate !== undefined && input.expiryDate !== (existingInv?.expiryDate || undefined)) {
        notes.push(
          `Vencimiento: ${existingInv?.expiryDate || "sin fecha"} -> ${input.expiryDate || "sin fecha"}`
        );
      }

      if (input.quantity !== 0 || notes.length > 0) {
        await createInventoryMovement({
          productId: input.productId,
          userId: ctx.user.id,
          type: input.type || (input.quantity === 0 ? "adjustment" : input.quantity > 0 ? "entry" : "exit"),
          quantity: Math.abs(input.quantity),
          batchNumber: input.batchNumber,
          reason: input.reason || "Ajuste manual",
          notes: notes.length > 0 ? notes.join(". ") : undefined,
        });
      }

      // Actualizar precio si es necesario (solo si se envio)
      if (input.price !== undefined) {
        await updateProductPrice(input.productId, input.price);
      }

      // Compra rapida: registrar como compra (finanzas + historial)
      if (input.registerPurchase && input.quantity > 0) {
        const effectivePrice = input.price ?? product?.price;
        if (!effectivePrice || effectivePrice <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Para compra rapida debes indicar el precio de compra." });
        }

        await recordInventoryEntryAsPurchase(
          input.productId,
          input.quantity,
          effectivePrice,
          input.expiryDate,
          input.batchNumber,
          input.reason,
          input.paymentMethod,
          ctx.user.id
        );
      }

      return { success: true };
    }),

  // Obtener productos con stock bajo
  getLowStockProducts: protectedProcedure.query(async ({ ctx }) => {
    const inventory = await getAllInventory(ctx.branchId);
    const products = await getAllProducts();

    return inventory
      .filter((inv: any) => inv.quantity <= inv.minStock)
      .map((inv: any) => {
        const product = products.find((p: any) => p.id === inv.productId);
        return {
          ...inv,
          product,
        };
      });
  }),

  // Obtener alertas de vencimiento
  getExpiryAlerts: protectedProcedure.query(async ({ ctx }) => {
    const inventory = await getAllInventory(ctx.branchId);
    const products = await getAllProducts();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const alerts = inventory
      .filter((inv: any) => inv.expiryDate !== null)
      .map((inv: any) => {
        const product = products.find((p: any) => p.id === inv.productId);
        const expiryDate = new Date(inv.expiryDate!);
        
        let status: 'expired' | 'critical' | 'warning' = 'warning';
        if (expiryDate < now) status = 'expired';
        else if (expiryDate <= sevenDaysFromNow) status = 'critical';
        else if (expiryDate <= thirtyDaysFromNow) status = 'warning';
        else return null;

        return {
          ...inv,
          product,
          expiryStatus: status,
          daysRemaining: Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        };
      })
      .filter((item: any): item is NonNullable<typeof item> => item !== null)
      .sort((a: any, b: any) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());

    return alerts;
  }),

  // Obtener inventario por producto
  getByProductId: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await getInventoryByProductId(input.productId, ctx.branchId);
    }),

  getProductHistory: protectedProcedure
    .input(z.object({ 
      productId: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const [product, stock, movements, purchases] = await Promise.all([
        getProductById(input.productId),
        getInventoryByProductId(input.productId, ctx.branchId),
        getInventoryMovements(input.productId),
        getPurchasesByProductId(input.productId),
      ]);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });
      }

      // Calcular stock físico total (suma de todos los lotes)
      const currentStock = Array.isArray(stock)
        ? stock.reduce((sum: number, batch: any) => sum + (batch.quantity || 0), 0)
        : (stock?.quantity ?? 0);

      const hasCreationMovement = movements.some((movement: any) =>
        (movement.reason || "").toLowerCase().includes("producto creado")
      );

      // NOTA IMPORTANTE: createPurchase() actualiza inventory.quantity DIRECTAMENTE
      // sin crear un inventoryMovement. Por eso necesitamos DOS fuentes:
      // 1. inventoryMovements → para ajustes manuales, ventas, pedidos, produccion
      // 2. purchases (received) → para compras del modulo Compras (no tienen movement)
      //
      // Para evitar doble conteo, excluimos del purchaseTimeline las compras
      // que SI tienen un movimiento (marcadas como "auto-registrado").

      let timeline: any[] = movements.map((movement: any) => {
        const classification = classifyHistoryEvent(movement);
        return {
          id: `movement-${movement.id}`,
          source: "movement",
          createdAt: movement.createdAt,
          quantity: movement.quantity,
          movementType: movement.type,
          userName: movement.userName,
          userRole: movement.userRole,
          orderNumber: movement.orderNumber,
          saleNumber: movement.saleNumber,
          orderStatus: movement.orderStatus,
          deliveryPersonName: movement.deliveryPersonName,
          ...classification,
        };
      });

      // Compras del modulo Compras: solo "received" y no "auto-registrado"
      // (auto-registrado = compra rapida que SI crea un inventoryMovement)
      // Definir tipos de impacto para el cálculo
      const ENTRY_TYPES = new Set([
        "purchase",          // Compra de proveedor
        "inventory_entry",   // Entrada manual de inventario
        "production",        // Ingreso por produccion
        "sale_cancellation", // Anulacion de venta (devuelve stock)
        "order_cancellation",// Pedido cancelado (devuelve stock)
      ]);

      const EXIT_TYPES = new Set([
        "sale",              // Venta registrada
        "order_reservation", // Pedido reservado (descuenta fisicamente)
        "inventory_exit",    // Salida manual de inventario
      ]);

      const purchaseTimeline = (purchases || [])
        .filter((purchase: any) => {
          const isReceived = purchase.purchaseStatus === "received" || purchase.status === "received";
          const isAutoRegistered = (purchase.notes || "").toLowerCase().includes("auto-registrado");
          return isReceived && !isAutoRegistered;
        })
        .map((purchase: any) => ({
          id: `purchase-item-${purchase.id}`,
          source: "purchase",
          createdAt: purchase.createdAt || purchase.purchaseCreatedAt || purchase.orderDate,
          quantity: purchase.quantity,
          movementType: "entry",
          eventType: "purchase",
          title: "Compra de proveedor",
          description: `Compra ${purchase.purchaseNumber || ""} de ${purchase.supplierName || "proveedor"} - ${formatCurrencyCents(purchase.price)} x unidad.${purchase.expiryDate ? ` Venc: ${purchase.expiryDate}.` : ""}`,
        }));

      if (!hasCreationMovement) {
        timeline.push({
          id: `product-created-${product.id}`,
          source: "product",
          createdAt: product.createdAt,
          quantity: 0,
          movementType: "adjustment",
          eventType: "created",
          title: "Producto creado",
          description: `Se registro el producto ${product.name} con codigo ${product.code}.`,
        });
      }

      timeline.push(...purchaseTimeline);

      // --- RECONCILIACIÓN DE SALDO INICIAL ---
      // Calculamos cuánto suman los movimientos actuales para ver si falta algo 
      // para llegar al Stock Físico Actual.
      let currentMovementsSum = 0;
      timeline.forEach((event: any) => {
        // Ignoramos eventos puramente informativos
        const isNeutral = event.eventType === "order_delivery" || 
                          event.eventType === "updated" || 
                          event.eventType === "created";
        
        if (!isNeutral && event.quantity > 0) {
          if (event.movementType === "entry" || ENTRY_TYPES.has(event.eventType)) {
            currentMovementsSum += event.quantity;
          } else if (event.movementType === "exit" || EXIT_TYPES.has(event.eventType)) {
            currentMovementsSum -= event.quantity;
          }
        }
      });

      const discrepancy = currentStock - currentMovementsSum;
      if (discrepancy !== 0) {
        // Asignar la discrepancia al evento inicial de creación/apertura
        const initialEvent = timeline.find(e => e.eventType === "created");
        if (initialEvent) {
          initialEvent.quantity = Math.abs(discrepancy);
          initialEvent.movementType = discrepancy > 0 ? "entry" : "exit";
          initialEvent.title = "Saldo Inicial / Apertura";
          initialEvent.description = "Ajuste automático para sincronizar el historial con el stock físico actual.";
          // Ya no es neutral si tiene cantidad
          (initialEvent as any).isAdjustmentRecord = true; 
        }
      }
      // ---------------------------------------

      // Calcular Kardex (Saldo acumulado)
      // Ordenar ascendente para el cálculo
      timeline.sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      let runningBalance = 0;
      let runningOnOrder = 0;
      const timelineWithKardex = timeline.map((event: any) => {
        let entry = 0;
        let exit = 0;
        let reserved = 0;   // unidades que entran a pedido
        let released = 0;   // unidades que salen de pedido (entregadas o canceladas)

        if (event.quantity && event.quantity > 0) {
          // Evitar doble descuento: la reserva ya resto stock. 
          // La entrega es un evento informativo/financiero para el Kardex.
          const isNeutral = (event.eventType === "order_delivery" || 
                            event.eventType === "updated" || 
                            event.eventType === "created") && !(event as any).isAdjustmentRecord;

          if (!isNeutral) {
            if (event.movementType === "entry" || ENTRY_TYPES.has(event.eventType)) {
              entry = event.quantity;
            } else if (event.movementType === "exit" || EXIT_TYPES.has(event.eventType)) {
              exit = event.quantity;
            } else if (event.movementType === "adjustment") {
              if (ENTRY_TYPES.has(event.eventType)) entry = event.quantity;
              else if (EXIT_TYPES.has(event.eventType)) exit = event.quantity;
            }
          }

          // Balance de pedidos activos (running)
          if (event.eventType === "order_reservation") {
            reserved = event.quantity;
          } else if (
            event.eventType === "order_delivery" ||
            event.eventType === "order_cancellation"
          ) {
            released = event.quantity;
          }
        }

        runningBalance += (entry - exit);
        runningOnOrder = Math.max(0, runningOnOrder + reserved - released);

        return {
          ...event,
          entry,
          exit,
          balance: runningBalance,
          onOrder: runningOnOrder,
        };
      });

      // Ordenar descendente para la UI
      let finalTimeline = timelineWithKardex.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Aplicar filtros de fecha si existen
      if (input.startDate) {
        const start = new Date(input.startDate);
        finalTimeline = finalTimeline.filter(e => new Date(e.createdAt) >= start);
      }
      if (input.endDate) {
        const end = new Date(input.endDate + " 23:59:59");
        finalTimeline = finalTimeline.filter(e => new Date(e.createdAt) <= end);
      }

      // Usar los valores ya calculados del Kardex (entry/exit semantico)
      // Totales de TODAS las entradas (compras + produccion + devoluciones)
      const totalPurchasedUnits = finalTimeline
        .reduce((sum: number, event: any) => sum + (event.entry || 0), 0);

      // Totales de TODAS las salidas (ventas + pedidos + salidas manuales)
      const totalSoldUnits = finalTimeline
        .reduce((sum: number, event: any) => sum + (event.exit || 0), 0);

      // Saldo calculado por Kardex (ultimo registro de la timeline ordenada desc = el mas reciente)
      const kardexFinalBalance = finalTimeline.length > 0 ? finalTimeline[0].balance : runningBalance;

      return {
        product,
        stock,
        summary: {
          totalEvents: finalTimeline.length,
          totalSoldUnits,
          totalPurchasedUnits,
          currentStatus: product.status,
          // saldo mas antiguo de la timeline antes de sus propios movimientos
          initialBalance: finalTimeline.length > 0
            ? finalTimeline[finalTimeline.length - 1].balance - (finalTimeline[finalTimeline.length - 1].entry - finalTimeline[finalTimeline.length - 1].exit)
            : 0,
          finalBalance: kardexFinalBalance,
        },
        timeline: finalTimeline,
      };
    }),

  getSmartAlerts: protectedProcedure.query(async () => {
    return await getSmartInventoryAlerts();
  }),

  // ==========================================
  // ENDPOINTS DE TRASPASOS (GENERAL <-> PROD)
  // ==========================================

  initTransferTables: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await import("../db").then(m => m.getDb());
    if (!db) return { success: false, message: "No db connection" };
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transferNumber VARCHAR(50) NOT NULL UNIQUE,
        type ENUM('to_production', 'to_general', 'to_branch') NOT NULL,
        status ENUM('pending', 'completed', 'cancelled') DEFAULT 'completed',
        fromBranchId INT NULL,
        toBranchId INT NULL,
        userId INT NOT NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Intento de agregar las columnas si ya existe la tabla (ignoramos errores si ya existen)
    try {
      const pool = (db as any).session?.client || (global as any)._pool;
      await pool.execute("ALTER TABLE inventory_transfers MODIFY COLUMN type ENUM('to_production', 'to_general', 'to_branch') NOT NULL");
      await pool.execute("ALTER TABLE inventory_transfers ADD COLUMN fromBranchId INT NULL");
      await pool.execute("ALTER TABLE inventory_transfers ADD COLUMN toBranchId INT NULL");
    } catch(e) {}

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_transfer_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transferId INT NOT NULL,
        productId INT NOT NULL,
        quantity INT NOT NULL,
        productName VARCHAR(255),
        productUnit VARCHAR(20),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    
    return { success: true };
  }),

  transferToProduction: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number().positive()
      })),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      
      const db = await import("../db").then(m => m.getDb());
      const productsData = await getAllProducts();
      const inventoryData = await getAllInventory(ctx.branchId);
      const transferDetails = [];

      if (!db) {
        const { MOCK_INVENTORY, MOCK_PRODUCTION_INVENTORY, MOCK_MOVEMENTS, MOCK_INVENTORY_TRANSFERS, MOCK_INVENTORY_TRANSFER_ITEMS } = await import("../db");
        const { syncMocksToDisk } = await import("../db");

        const nextId = MOCK_INVENTORY_TRANSFERS.length + 1;
        const transferNumber = `TR-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;
        const transferId = nextId;

        MOCK_INVENTORY_TRANSFERS.push({
          id: transferId,
          transferNumber,
          direction: 'to_production',
          status: 'completed',
          userId: ctx.user.id,
          notes: input.notes || null,
          createdAt: new Date()
        });

        for (const item of input.items) {
          const product = productsData.find((p: any) => p.id === item.productId);
          if (!product) continue;

          MOCK_INVENTORY_TRANSFER_ITEMS.push({
            id: MOCK_INVENTORY_TRANSFER_ITEMS.length + 1,
            transferId,
            productId: item.productId,
            quantity: item.quantity,
            productName: product.name,
            productUnit: product.unit || 'unidad',
            createdAt: new Date()
          });

          const currentInv = MOCK_INVENTORY.find((i: any) => i.productId === item.productId && !i.batchNumber);
          if (currentInv) {
            const newQty = (currentInv.quantity || 0) - item.quantity;
            currentInv.quantity = Math.max(0, newQty);
            currentInv.lastUpdated = new Date();
          }

          let prodStock = MOCK_PRODUCTION_INVENTORY.find((i: any) => i.productId === item.productId);
          const previousProdQty = prodStock?.quantity || 0;
          const nextProdQty = previousProdQty + item.quantity;

          if (prodStock) {
            prodStock.quantity = nextProdQty;
            prodStock.lastUpdated = new Date();
          } else {
            MOCK_PRODUCTION_INVENTORY.push({
              id: MOCK_PRODUCTION_INVENTORY.length + 1,
              productId: item.productId,
              quantity: item.quantity,
              lastUpdated: new Date()
            });
          }

          MOCK_MOVEMENTS.push({
            id: MOCK_MOVEMENTS.length + 1,
            productId: item.productId,
            userId: ctx.user.id,
            type: "exit",
            quantity: item.quantity,
            reason: "Traspaso a Producción",
            notes: `Traspaso ${transferNumber}${input.notes ? ': ' + input.notes : ''}`,
            createdAt: new Date()
          });

          transferDetails.push({
            productId: item.productId,
            productName: product.name,
            category: product.category,
            quantity: item.quantity,
            unit: product.unit || 'unidad',
            presentationQuantity: product.presentationQuantity || 1,
            presentationUnit: product.presentationUnit || product.unit || 'unidad',
            presentationVolumeMl: product.presentationVolumeMl || 0,
            presentationWeightGr: product.presentationWeightGr || 0,
            productionRole: product.productionRole || 'none'
          });
        }

        syncMocksToDisk();
        return { success: true, transferNumber, items: transferDetails };
      }
      
      const { createInventoryMovement, updateInventory } = await import("../db");
      const { productionInventory } = await import("../../drizzle/schema");
      
      // 1. Generate transfer number
      const countRes = await db.select({ value: count() }).from(inventoryTransfers);
      const nextId = countRes[0].value + 1;
      const transferNumber = `TR-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;

      // 2. Create Transfer Record
      const insertRes = await db.insert(inventoryTransfers).values({
        transferNumber,
        direction: 'to_production',
        status: 'completed',
        userId: ctx.user.id,
        notes: input.notes || null
      });
      const transferId = (insertRes[0] as any).insertId;

      for (const item of input.items) {
        const product = productsData.find((p: any) => p.id === item.productId);
        if (!product) continue;

        // 3. Create Transfer Item
        await db.insert(inventoryTransferItems).values({
          transferId,
          productId: item.productId,
          quantity: item.quantity,
          productName: product.name,
          productUnit: product.unit || 'unidad'
        });

        // 4. Update Inventory (General -> decrease)
        const currentInv = inventoryData.find((i: any) => i.productId === item.productId);
        const newQty = (currentInv?.quantity || 0) - item.quantity;
        await updateInventory(item.productId, Math.max(0, newQty), undefined, undefined, ctx.branchId);

        // 4.1 Incrementar el almacén de planta para que la vista de producción
        // refleje inmediatamente el stock transferido desde inventario general.
        const [prodStock] = await db.select().from(productionInventory).where(eq(productionInventory.productId, item.productId));
        const previousProdQty = prodStock?.quantity || 0;
        const nextProdQty = previousProdQty + item.quantity;

        if (prodStock) {
          await db.update(productionInventory)
            .set({ quantity: nextProdQty })
            .where(eq(productionInventory.id, prodStock.id));
        } else {
          await db.insert(productionInventory).values({
            productId: item.productId,
            quantity: item.quantity,
          });
        }

        // 5. Create Movement
        await createInventoryMovement({
          productId: item.productId,
          userId: ctx.user.id,
          type: "exit",
          quantity: item.quantity,
          reason: "Traspaso a Producción",
          notes: `Traspaso ${transferNumber}${input.notes ? ': ' + input.notes : ''}`,
        });

        const pool = (db as any).session?.client || (global as any)._pool;
        if (pool) {
          await pool.execute(
            'INSERT INTO kefir_movements (productId, productName, category, previousQuantity, newQuantity, changeAmount, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              item.productId.toString(),
              product.name,
              product.category,
              previousProdQty,
              nextProdQty,
              item.quantity,
              `Traspaso a Producción ${transferNumber}`,
            ]
          ).catch(console.error);
        }

        transferDetails.push({
          productId: item.productId,
          productName: product.name,
          category: product.category,
          quantity: item.quantity,
          unit: product.unit || 'unidad',
          presentationQuantity: product.presentationQuantity || 1,
          presentationUnit: product.presentationUnit || product.unit || 'unidad',
          presentationVolumeMl: product.presentationVolumeMl || 0,
          presentationWeightGr: product.presentationWeightGr || 0,
          productionRole: product.productionRole || 'none'
        });
      }

      return { success: true, transferNumber, items: transferDetails };
    }),

  transferToGeneral: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.number(),
        productName: z.string().optional(),
        quantity: z.number().positive()
      })),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      
      const db = await import("../db").then(m => m.getDb());
      const productsData = await getAllProducts();
      const inventoryData = await getAllInventory(ctx.branchId);
      const transferDetails = [];

      if (!db) {
        const { MOCK_INVENTORY, MOCK_PRODUCTION_INVENTORY, MOCK_MOVEMENTS, MOCK_INVENTORY_TRANSFERS, MOCK_INVENTORY_TRANSFER_ITEMS } = await import("../db");
        const { syncMocksToDisk } = await import("../db");

        const createdAt = new Date();
        const nextId = MOCK_INVENTORY_TRANSFERS.length + 1;
        const transferNumber = `TR-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;
        const transferId = nextId;

        MOCK_INVENTORY_TRANSFERS.push({
          id: transferId,
          transferNumber,
          direction: 'to_general',
          status: 'completed',
          userId: ctx.user.id,
          notes: input.notes || null,
          createdAt
        });

        for (const item of input.items) {
          const product = resolveFinishedProductReference(
            productsData,
            item.productId,
            item.productName
          );
          if (!product) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `No se encontro una referencia exacta para "${item.productName || item.productId}" en el inventario general. Cree o enlace primero ese producto.`,
            });
          }

          MOCK_INVENTORY_TRANSFER_ITEMS.push({
            id: MOCK_INVENTORY_TRANSFER_ITEMS.length + 1,
            transferId,
            productId: product.id,
            quantity: item.quantity,
            productName: product.name,
            productUnit: product.unit || 'unidad',
            createdAt
          });

          let currentInv = MOCK_INVENTORY.find((i: any) => i.productId === product!.id && !i.batchNumber);
          const newQty = (currentInv?.quantity || 0) + item.quantity;
          if (currentInv) {
            currentInv.quantity = newQty;
            currentInv.lastUpdated = new Date();
          } else {
            MOCK_INVENTORY.push({
              id: MOCK_INVENTORY.length + 1,
              productId: product!.id,
              batchNumber: null,
              quantity: item.quantity,
              minStock: 5,
              lastUpdated: new Date()
            });
          }

          let prodStock = MOCK_PRODUCTION_INVENTORY.find((i: any) => i.productId === product!.id);
          if (prodStock) {
            prodStock.quantity = Math.max(0, prodStock.quantity - item.quantity);
            prodStock.lastUpdated = new Date();
          }

          MOCK_MOVEMENTS.push({
            id: MOCK_MOVEMENTS.length + 1,
            productId: product.id,
            userId: ctx.user.id,
            type: "entry",
            quantity: item.quantity,
            reason: "Ingreso por Producción",
            notes: `Traspaso ${transferNumber}${input.notes ? ': ' + input.notes : ''}`,
            createdAt: new Date()
          });

          transferDetails.push({
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unit: product.unit || 'unidad',
            productUnit: product.unit || 'unidad'
          });
        }

        syncMocksToDisk();

        return {
          success: true,
          transferNumber,
          direction: 'to_general',
          status: 'completed',
          notes: input.notes || null,
          createdAt: createdAt.toISOString(),
          items: transferDetails
        };
      }
      
      const { createInventoryMovement, updateInventory } = await import("../db");
      
      // 1. Generate transfer number
      const createdAt = new Date();
      const countRes = await db.select({ value: count() }).from(inventoryTransfers);
      const nextId = countRes[0].value + 1;
      const transferNumber = `TR-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;

      // 2. Create Transfer Record
      const insertRes = await db.insert(inventoryTransfers).values({
        transferNumber,
        direction: 'to_general',
        status: 'completed',
        userId: ctx.user.id,
        notes: input.notes || null,
        createdAt
      });
      const transferId = (insertRes[0] as any).insertId;

      for (const item of input.items) {
        const product = resolveFinishedProductReference(
          productsData,
          item.productId,
          item.productName
        );
        if (!product) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No se encontro una referencia exacta para "${item.productName || item.productId}" en el inventario general. Cree o enlace primero ese producto.`,
          });
        }

        // 3. Create Transfer Item
        await db.insert(inventoryTransferItems).values({
          transferId,
          productId: product.id,
          quantity: item.quantity,
          productName: product.name,
          productUnit: product.unit || 'unidad'
        });

        // 4. Update Inventory (Production -> General, so general increases)
        const currentInv = inventoryData.find((i: any) => i.productId === product!.id);
        const newQty = (currentInv?.quantity || 0) + item.quantity;
        await updateInventory(product!.id, newQty, undefined, undefined, ctx.branchId);

        // 4.5 Deduct from production_inventory
        const { productionInventory } = await import("../../drizzle/schema");
        const [prodStock] = await db.select().from(productionInventory).where(eq(productionInventory.productId, product!.id));
        if (prodStock) {
          const newProdQty = Math.max(0, prodStock.quantity - item.quantity);
          await db.update(productionInventory)
            .set({ quantity: newProdQty })
            .where(eq(productionInventory.id, prodStock.id));
            
          // Registrar en Kardex de Planta (kefir_movements)
          const pool = (db as any).session?.client || (global as any)._pool;
          if (pool) {
            await pool.execute(
              'INSERT INTO kefir_movements (productId, productName, category, previousQuantity, newQuantity, changeAmount, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                product!.id.toString(),
                product!.name,
                product!.category,
                prodStock.quantity,
                newProdQty,
                -item.quantity,
                `Traspaso a General ${transferNumber}`
              ]
            ).catch(console.error);
          }
        }

        // 5. Create Movement
        await createInventoryMovement({
          productId: product.id,
          userId: ctx.user.id,
          type: "entry",
          quantity: item.quantity,
          reason: "Ingreso por Producción",
          notes: `Traspaso ${transferNumber}${input.notes ? ': ' + input.notes : ''}`,
        });

        transferDetails.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unit: product.unit || 'unidad',
          productUnit: product.unit || 'unidad'
        });
      }

      return {
        success: true,
        transferNumber,
        direction: 'to_general',
        status: 'completed',
        notes: input.notes || null,
        createdAt: createdAt.toISOString(),
        items: transferDetails
      };
    }),

  getTransfers: protectedProcedure.query(async () => {
    const db = await import("../db").then(m => m.getDb());
    if (!db) {
      const { MOCK_INVENTORY_TRANSFERS, MOCK_INVENTORY_TRANSFER_ITEMS, MOCK_USERS } = await import("../db");
      return MOCK_INVENTORY_TRANSFERS.map((t: any) => {
        const user = MOCK_USERS.find((u: any) => u.id === t.userId);
        return {
          id: t.id,
          transferNumber: t.transferNumber,
          direction: t.direction,
          status: t.status,
          userId: t.userId,
          sourceBranchId: t.sourceBranchId || 1,
          destinationBranchId: t.destinationBranchId || 1,
          notes: t.notes,
          createdAt: t.createdAt,
          username: user?.username || 'admin',
          userFullName: user?.name || 'Administrador (Modo Demo)',
          items: MOCK_INVENTORY_TRANSFER_ITEMS.filter((i: any) => i.transferId === t.id)
        };
      }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    
    // Fetch transfers
    const transfersRows = await db.select({
      id: inventoryTransfers.id,
      transferNumber: inventoryTransfers.transferNumber,
      direction: inventoryTransfers.direction,
      status: inventoryTransfers.status,
      userId: inventoryTransfers.userId,
      sourceBranchId: inventoryTransfers.sourceBranchId,
      destinationBranchId: inventoryTransfers.destinationBranchId,
      notes: inventoryTransfers.notes,
      createdAt: inventoryTransfers.createdAt,
      username: users.username,
      userFullName: users.name
    })
    .from(inventoryTransfers)
    .leftJoin(users, eq(inventoryTransfers.userId, users.id))
    .orderBy(desc(inventoryTransfers.createdAt));
    
    const transfers = transfersRows;
    if (!transfers || transfers.length === 0) return [];
    
    // Fetch items
    const transferIds = transfers.map((t: any) => t.id);
    
    const itemsRows = await db.select()
      .from(inventoryTransferItems)
      .where(inArray(inventoryTransferItems.transferId, transferIds));
    
    const items = itemsRows;
    
    // Assemble
    return transfers.map((t: any) => ({
      ...t,
      items: items.filter((i: any) => i.transferId === t.id)
    }));
  }),

  // Traspasos entre Sucursales (Origen)
  createBranchTransfer: protectedProcedure
    .input(z.object({
      destinationBranchId: z.number(),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number().min(1),
        productName: z.string().optional()
      })),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await import("../db").then(m => m.getDb());
      const { getAllInventory, updateInventory, createInventoryMovement } = await import("../db");
      
      // MOCK MODE
      if (!db) {
        const { MOCK_INVENTORY_TRANSFERS, MOCK_INVENTORY_TRANSFER_ITEMS, MOCK_INVENTORY } = await import("../db");
        
        // En modo demo, obtenemos el inventario global (sin filtro de sucursal)
        // ya que el mock no siempre tiene datos por branchId
        const inventoryData = await getAllInventory(); // sin filtro = todos
        
        for (const item of input.items) {
          const invItem = inventoryData.find((i: any) => i.productId === item.productId);
          if (!invItem || (invItem.quantity || 0) < item.quantity) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Stock insuficiente para el producto "${item.productName || item.productId}"` });
          }
        }

        const nextId = MOCK_INVENTORY_TRANSFERS.length + 1;
        const transferNumber = `TRB-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;
        
        MOCK_INVENTORY_TRANSFERS.push({
          id: nextId,
          transferNumber,
          direction: "branch_transfer",
          sourceBranchId: ctx.branchId,
          destinationBranchId: input.destinationBranchId,
          status: "completed",
          userId: ctx.user!.id,
          notes: input.notes,
          createdAt: new Date(),
        });

        const transferDetails = [];
        for (const item of input.items) {
          MOCK_INVENTORY_TRANSFER_ITEMS.push({
            id: MOCK_INVENTORY_TRANSFER_ITEMS.length + 1,
            transferId: nextId,
            productId: item.productId,
            quantity: item.quantity,
            productName: item.productName || "Producto",
            productUnit: "unidad"
          });

          // Deduct from origin (global mock)
          const mockInvItem = MOCK_INVENTORY.find((i: any) => i.productId === item.productId);
          if (mockInvItem) {
            mockInvItem.quantity = Math.max(0, (mockInvItem.quantity || 0) - item.quantity);
          }

          // Add to destination in mock inventory
          const destInvItem = MOCK_INVENTORY.find((i: any) => i.productId === item.productId && i.branchId === input.destinationBranchId);
          if (destInvItem) {
            destInvItem.quantity = (destInvItem.quantity || 0) + item.quantity;
          } else {
            // Create new entry for destination branch
            MOCK_INVENTORY.push({
              id: MOCK_INVENTORY.length + 1,
              productId: item.productId,
              branchId: input.destinationBranchId,
              quantity: item.quantity,
              minStock: 0,
              lastUpdated: new Date(),
            });
          }

          transferDetails.push({ ...item, productName: item.productName || "Producto" });
        }

        return { success: true, transferNumber, sourceBranchId: ctx.branchId, destinationBranchId: input.destinationBranchId, items: transferDetails, notes: input.notes };
      }

      // DB MODE
      const { inventoryTransfers, inventoryTransferItems, products } = await import("../../drizzle/schema");
      const { eq, count } = await import("drizzle-orm");

      // Check stock
      const inventoryData = await getAllInventory(ctx.branchId);
      for (const item of input.items) {
        const invItem = inventoryData.find((i: any) => i.productId === item.productId);
        if (!invItem || (invItem.quantity || 0) < item.quantity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Stock insuficiente para el producto ID ${item.productId} en sucursal origen` });
        }
      }

      // 1. Generate transfer number
      const countRes = await db.select({ value: count() }).from(inventoryTransfers);
      const nextId = (countRes[0]?.value || 0) + 1;
      const transferNumber = `TRB-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;

      // 2. Create Transfer Record
      const insertRes = await db.insert(inventoryTransfers).values({
        transferNumber,
        direction: "branch_transfer",
        sourceBranchId: ctx.branchId,
        destinationBranchId: input.destinationBranchId,
        status: "in_transit",
        userId: ctx.user!.id,
        notes: input.notes,
      });

      const transferId = (insertRes[0] as any).insertId;
      const transferDetails = [];

      for (const item of input.items) {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));

        // 3. Create Transfer Item
        await db.insert(inventoryTransferItems).values({
          transferId,
          productId: product.id,
          quantity: item.quantity,
          productName: product.name,
          productUnit: product.unit || 'unidad'
        });

        // 4. Update Origin Inventory (reduce)
        const currentInv = inventoryData.find((i: any) => i.productId === product.id);
        const newQty = (currentInv?.quantity || 0) - item.quantity;
        await updateInventory(product.id, newQty, undefined, undefined, ctx.branchId);

        // 5. Kardex Exit
        await createInventoryMovement({
          productId: product.id,
          type: "exit",
          quantity: item.quantity,
          reason: `Traspaso a Suc. #${input.destinationBranchId} ${transferNumber}`,
          notes: input.notes,
          userId: ctx.user!.id,
          branchId: ctx.branchId
        });

        transferDetails.push({ ...item, productName: product.name });
      }

      return { success: true, transferNumber, sourceBranchId: ctx.branchId, destinationBranchId: input.destinationBranchId, items: transferDetails, notes: input.notes };
    }),

  // Aceptar Traspaso en Sucursal Destino
  acceptBranchTransfer: protectedProcedure
    .input(z.object({
      transferId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await import("../db").then(m => m.getDb());
      const { getAllInventory, updateInventory, createInventoryMovement } = await import("../db");

      if (!db) {
        const { MOCK_INVENTORY_TRANSFERS, MOCK_INVENTORY_TRANSFER_ITEMS } = await import("../db");
        const transfer = MOCK_INVENTORY_TRANSFERS.find((t: any) => t.id === input.transferId);
        
        if (!transfer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transferencia no encontrada" });
        }
        if (transfer.status !== "in_transit") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La transferencia no está en tránsito" });
        }
        if (transfer.destinationBranchId !== ctx.branchId && ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo la sucursal destino o un administrador puede aceptar el traspaso" });
        }

        transfer.status = "completed";
        const itemsRows = MOCK_INVENTORY_TRANSFER_ITEMS.filter((i: any) => i.transferId === transfer.id);
        const destInventoryData = await getAllInventory(transfer.destinationBranchId);

        for (const item of itemsRows) {
          const currentInv = destInventoryData.find((i: any) => i.productId === item.productId);
          const newQty = (currentInv?.quantity || 0) + item.quantity;
          await updateInventory(item.productId, newQty, undefined, undefined, transfer.destinationBranchId);

          await createInventoryMovement({
            productId: item.productId,
            type: "entry",
            quantity: item.quantity,
            reason: `Recepción Traspaso ${transfer.transferNumber}`,
            notes: `Recibido desde sucursal #${transfer.sourceBranchId}`,
            userId: ctx.user!.id,
            branchId: transfer.destinationBranchId
          });
        }
        return { success: true };
      }

      const { inventoryTransfers, inventoryTransferItems } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const [transfer] = await db.select().from(inventoryTransfers).where(eq(inventoryTransfers.id, input.transferId));
      if (!transfer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transferencia no encontrada" });
      }

      if (transfer.status !== "in_transit") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La transferencia no está en tránsito" });
      }

      if (transfer.destinationBranchId !== ctx.branchId && ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la sucursal destino o un administrador puede aceptar el traspaso" });
      }

      // Update transfer status
      await db.update(inventoryTransfers).set({ status: "completed" }).where(eq(inventoryTransfers.id, transfer.id));

      const itemsRows = await db.select().from(inventoryTransferItems).where(eq(inventoryTransferItems.transferId, transfer.id));

      const destInventoryData = await getAllInventory(transfer.destinationBranchId);

      for (const item of itemsRows) {
        // Update Destination Inventory (increase)
        const currentInv = destInventoryData.find((i: any) => i.productId === item.productId);
        const newQty = (currentInv?.quantity || 0) + item.quantity;
        await updateInventory(item.productId, newQty, undefined, undefined, transfer.destinationBranchId);

        // Kardex Entry
        await createInventoryMovement({
          productId: item.productId,
          type: "entry",
          quantity: item.quantity,
          reason: `Recepción Traspaso ${transfer.transferNumber}`,
          notes: `Recibido desde sucursal #${transfer.sourceBranchId}`,
          userId: ctx.user!.id,
          branchId: transfer.destinationBranchId
        });
      }

      return { success: true };
    }),
});
