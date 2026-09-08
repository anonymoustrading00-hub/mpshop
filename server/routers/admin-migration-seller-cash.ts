import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Router temporal para ejecutar migraciones de cajas de vendedores
 * SOLO PARA ADMINISTRADORES
 */
export const adminMigrationSellerCashRouter = router({
  /**
   * Ejecutar migración de tablas de cajas de vendedores
   */
  runSellerCashMigration: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden ejecutar migraciones" });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }

    try {
      const migrations = [];

      // 1. Crear tabla seller_cash_registers
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS seller_cash_registers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sellerId INT NOT NULL,
          branchId INT NOT NULL,
          date VARCHAR(10) NOT NULL,
          
          openingStatus ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          initialCash INT NOT NULL DEFAULT 0,
          openedAt TIMESTAMP NULL,
          openingApprovedBy INT NULL,
          openingApprovedAt TIMESTAMP NULL,
          openingNotes TEXT NULL,
          
          salesCash INT NOT NULL DEFAULT 0,
          salesQr INT NOT NULL DEFAULT 0,
          salesTransfer INT NOT NULL DEFAULT 0,
          
          partialDeliveriesCash INT NOT NULL DEFAULT 0,
          
          totalExpenses INT NOT NULL DEFAULT 0,
          
          closingStatus ENUM('open', 'pending', 'approved', 'rejected', 'forced_closed') NOT NULL DEFAULT 'open',
          reportedCash INT DEFAULT 0,
          reportedQr INT DEFAULT 0,
          reportedTransfer INT DEFAULT 0,
          differenceCash INT DEFAULT 0,
          differenceJustification TEXT NULL,
          closedAt TIMESTAMP NULL,
          closingApprovedBy INT NULL,
          closingApprovedAt TIMESTAMP NULL,
          closingNotes TEXT NULL,
          
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          FOREIGN KEY (sellerId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE,
          FOREIGN KEY (openingApprovedBy) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (closingApprovedBy) REFERENCES users(id) ON DELETE SET NULL,
          
          INDEX idx_seller_date (sellerId, date),
          INDEX idx_branch_date (branchId, date),
          INDEX idx_opening_status (openingStatus),
          INDEX idx_closing_status (closingStatus)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      migrations.push("seller_cash_registers");

      // 2. Crear tabla seller_partial_deliveries
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS seller_partial_deliveries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          cashRegisterId INT NOT NULL,
          sellerId INT NOT NULL,
          amount INT NOT NULL,
          status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          approvedBy INT NULL,
          approvedAt TIMESTAMP NULL,
          notes TEXT NULL,
          adminNotes TEXT NULL,
          
          FOREIGN KEY (cashRegisterId) REFERENCES seller_cash_registers(id) ON DELETE CASCADE,
          FOREIGN KEY (sellerId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (approvedBy) REFERENCES users(id) ON DELETE SET NULL,
          
          INDEX idx_status (status),
          INDEX idx_seller (sellerId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      migrations.push("seller_partial_deliveries");

      // 3. Crear tabla seller_cash_expenses
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS seller_cash_expenses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          cashRegisterId INT NOT NULL,
          sellerId INT NOT NULL,
          amount INT NOT NULL,
          concept VARCHAR(255) NOT NULL,
          status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          approvedBy INT NULL,
          approvedAt TIMESTAMP NULL,
          notes TEXT NULL,
          adminNotes TEXT NULL,
          receiptUrl TEXT NULL,
          
          FOREIGN KEY (cashRegisterId) REFERENCES seller_cash_registers(id) ON DELETE CASCADE,
          FOREIGN KEY (sellerId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (approvedBy) REFERENCES users(id) ON DELETE SET NULL,
          
          INDEX idx_status (status),
          INDEX idx_seller (sellerId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      migrations.push("seller_cash_expenses");

      // Verificar que las tablas se crearon (solo las filas, no los FieldPackets)
      const tablesRaw = await db.execute(sql`SHOW TABLES LIKE 'seller_%'`);
      const tablesCount = Array.isArray((tablesRaw as any)[0])
        ? (tablesRaw as any)[0].length
        : (Array.isArray(tablesRaw) ? tablesRaw.length : 0);

      return {
        success: true,
        message: "Migracion ejecutada correctamente",
        migratedTables: migrations,
        verifiedTablesCount: tablesCount,
      };
    } catch (error: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Error ejecutando migración: ${error.message}`,
      });
    }
  }),

  /**
   * Verificar estado de las tablas
   */
  checkSellerCashTables: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }

    try {
      // SHOW TABLES devuelve [rows, fields] — solo usar rows para contar
      const tablesRaw = await db.execute(sql`SHOW TABLES LIKE 'seller_%'`);
      const tableRows = Array.isArray((tablesRaw as any)[0])
        ? (tablesRaw as any)[0]
        : (Array.isArray(tablesRaw) ? tablesRaw : []);
      const tablesCount = tableRows.length;

      let counts = { cashRegisters: 0, deliveries: 0, expenses: 0 };

      try {
        const countRaw = await db.execute(sql`SELECT COUNT(*) as count FROM seller_cash_registers`) as any;
        const rows = Array.isArray(countRaw[0]) ? countRaw[0] : countRaw;
        counts.cashRegisters = Number(rows?.[0]?.count ?? 0);
      } catch {}

      try {
        const countRaw = await db.execute(sql`SELECT COUNT(*) as count FROM seller_partial_deliveries`) as any;
        const rows = Array.isArray(countRaw[0]) ? countRaw[0] : countRaw;
        counts.deliveries = Number(rows?.[0]?.count ?? 0);
      } catch {}

      try {
        const countRaw = await db.execute(sql`SELECT COUNT(*) as count FROM seller_cash_expenses`) as any;
        const rows = Array.isArray(countRaw[0]) ? countRaw[0] : countRaw;
        counts.expenses = Number(rows?.[0]?.count ?? 0);
      } catch {}

      return {
        success: true,
        tablesExist: tablesCount === 3,
        tablesCount,
        counts,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }),
});
