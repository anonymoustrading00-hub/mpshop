/**
 * Script para sincronizar ventas existentes con seller_cash_registers
 * Ejecutar una sola vez para actualizar cajas con ventas anteriores
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { sellerCashRegisters } from "../../drizzle/schema";

async function syncSellerSales() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }

  console.log("[Sync] Iniciando sincronización de ventas de vendedores...");

  try {
    // Obtener todas las cajas de vendedores
    const boxes = await db
      .select()
      .from(sellerCashRegisters)
      .where(sql`openingStatus = 'approved'`);

    console.log(`[Sync] Encontradas ${boxes.length} cajas para sincronizar`);

    for (const box of boxes) {
      // Calcular ventas del día para ese vendedor
      const [salesData] = await db.execute(sql`
        SELECT 
          COALESCE(SUM(CASE WHEN paymentMethod = 'cash' THEN total ELSE 0 END), 0) as totalCash,
          COALESCE(SUM(CASE WHEN paymentMethod = 'qr' THEN total ELSE 0 END), 0) as totalQr,
          COALESCE(SUM(CASE WHEN paymentMethod = 'transfer' THEN total ELSE 0 END), 0) as totalTransfer
        FROM sales
        WHERE userId = ${box.sellerId}
          AND DATE(createdAt) = ${box.date}
          AND status != 'cancelled'
      `) as any;

      if (salesData && salesData[0]) {
        const { totalCash, totalQr, totalTransfer } = salesData[0];
        
        await db
          .update(sellerCashRegisters)
          .set({
            salesCash: Number(totalCash),
            salesQr: Number(totalQr),
            salesTransfer: Number(totalTransfer),
          })
          .where(eq(sellerCashRegisters.id, box.id));

        console.log(
          `[Sync] Caja #${box.id} - Vendedor ${box.sellerId} - ${box.date}:`,
          `Efectivo: ${totalCash}, QR: ${totalQr}, Transfer: ${totalTransfer}`
        );
      }
    }

    console.log("[Sync] ✅ Sincronización completada");
  } catch (error) {
    console.error("[Sync] Error:", error);
  }
}

// Ejecutar
syncSellerSales().then(() => process.exit(0));
