/**
 * Script de corrección: Recalcular subtotales de ventas con cantidad > 1
 * 
 * Bug: getLinePricing() tenía hardcoded quantity = 1
 * Resultado: Ventas con 3 unidades a Bs. 70 mostraban total de Bs. 70 en lugar de Bs. 210
 * 
 * Este script:
 * 1. Encuentra todos los sale_items con quantity > 1
 * 2. Recalcula subtotal = finalUnitPrice * quantity
 * 3. Actualiza sale_items
 * 4. Recalcula el total de cada venta afectada
 * 5. Actualiza la tabla sales
 */

import { getDb } from "../server/db";
import { sales, saleItems } from "../drizzle/schema";
import { eq, gt, sql } from "drizzle-orm";

interface SaleItem {
  id: number;
  saleId: number;
  quantity: number;
  finalUnitPrice: number;
  subtotal: number;
  basePrice: number;
  discountAmount: number;
}

interface Sale {
  id: number;
  saleNumber: string;
  subtotal: number;
  total: number;
  discountAmount: number;
}

async function fixSaleSubtotals() {
  const db = await getDb();
  
  if (!db) {
    console.log("⚠️  [Fix Subtotals] No hay conexión a base de datos - Saltando");
    process.exit(0);
  }

  console.log("🔍 [Fix Subtotals] Buscando sale_items con quantity > 1...\n");

  try {
    // Obtener todos los sale_items con quantity > 1
    const itemsWithQuantity = await db
      .select()
      .from(saleItems)
      .where(gt(saleItems.quantity, 1)) as SaleItem[];

    if (itemsWithQuantity.length === 0) {
      console.log("✅ [Fix Subtotals] No hay sale_items con quantity > 1 para corregir\n");
      process.exit(0);
    }

    console.log(`📦 [Fix Subtotals] Encontrados ${itemsWithQuantity.length} items con quantity > 1\n`);

    let itemsFixed = 0;
    const affectedSales = new Set<number>();

    // Procesar cada item
    for (const item of itemsWithQuantity) {
      const oldSubtotal = item.subtotal;
      const correctSubtotal = item.finalUnitPrice * item.quantity;

      // Solo actualizar si el subtotal está incorrecto
      if (oldSubtotal !== correctSubtotal) {
        console.log(`📌 Item ID ${item.id} (Sale #${item.saleId})`);
        console.log(`   Cantidad: ${item.quantity}`);
        console.log(`   Precio unitario: ${(item.finalUnitPrice / 100).toFixed(2)}`);
        console.log(`   Subtotal anterior: ${(oldSubtotal / 100).toFixed(2)}`);
        console.log(`   Subtotal correcto: ${(correctSubtotal / 100).toFixed(2)}`);

        await db
          .update(saleItems)
          .set({ 
            subtotal: correctSubtotal,
            updatedAt: new Date()
          })
          .where(eq(saleItems.id, item.id));

        itemsFixed++;
        affectedSales.add(item.saleId);
        console.log(`   ✅ Actualizado\n`);
      }
    }

    console.log("=".repeat(70));
    console.log(`✨ [Fix Subtotals] Items corregidos: ${itemsFixed}`);
    console.log(`📊 [Fix Subtotals] Ventas afectadas: ${affectedSales.size}`);
    console.log("=".repeat(70) + "\n");

    if (affectedSales.size === 0) {
      console.log("✅ [Fix Subtotals] No hay ventas para recalcular\n");
      process.exit(0);
    }

    // Ahora recalcular el total de cada venta afectada
    console.log("🔄 [Fix Subtotals] Recalculando totales de ventas afectadas...\n");

    let salesFixed = 0;

    for (const saleId of affectedSales) {
      // Obtener la venta
      const [sale] = await db
        .select()
        .from(sales)
        .where(eq(sales.id, saleId))
        .limit(1) as Sale[];

      if (!sale) continue;

      // Obtener todos los items de esta venta
      const items = await db
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, saleId)) as SaleItem[];

      // Calcular nuevo subtotal sumando todos los items
      const newSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const discountAmount = sale.discountAmount || 0;
      const newTotal = Math.max(0, newSubtotal - discountAmount);

      console.log(`📌 Venta ${sale.saleNumber} (ID: ${saleId})`);
      console.log(`   Subtotal anterior: ${(sale.subtotal / 100).toFixed(2)}`);
      console.log(`   Subtotal correcto: ${(newSubtotal / 100).toFixed(2)}`);
      console.log(`   Descuento: ${(discountAmount / 100).toFixed(2)}`);
      console.log(`   Total anterior: ${(sale.total / 100).toFixed(2)}`);
      console.log(`   Total correcto: ${(newTotal / 100).toFixed(2)}`);

      await db
        .update(sales)
        .set({
          subtotal: newSubtotal,
          total: newTotal,
          updatedAt: new Date()
        })
        .where(eq(sales.id, saleId));

      salesFixed++;
      console.log(`   ✅ Venta actualizada\n`);
    }

    console.log("=".repeat(70));
    console.log(`✨ [Fix Subtotals] COMPLETADO`);
    console.log(`   • Items corregidos: ${itemsFixed}`);
    console.log(`   • Ventas recalculadas: ${salesFixed}`);
    console.log(`   • Reportes, KPIs e ingresos ahora reflejarán valores correctos`);
    console.log("=".repeat(70) + "\n");

  } catch (error: any) {
    console.error("❌ [Fix Subtotals] Error:", error.message || error);
    throw error;
  }

  process.exit(0);
}

// Ejecutar
fixSaleSubtotals().catch((error) => {
  console.error("❌ [Fix Subtotals] Falló:", error);
  process.exit(1);
});
