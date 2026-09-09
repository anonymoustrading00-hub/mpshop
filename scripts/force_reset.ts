/**
 * FORCE RESET - Borra TODOS los datos y reinicia la BD para uso desde cero.
 */
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const adminName = process.env.ADMIN_NAME || "Administrador";
const adminEmail = process.env.ADMIN_EMAIL || "admin@mpshop.com";

async function forceReset() {
  if (!databaseUrl) {
    console.error("[ForceReset] DATABASE_URL is required.");
    process.exit(1);
  }

  const connection = await mysql.createConnection(databaseUrl);

  try {
    console.log("[ForceReset] Iniciando reset completo del sistema...");

    await connection.query(
      CREATE TABLE IF NOT EXISTS systemSettings (
        id int AUTO_INCREMENT NOT NULL,
        \key\ varchar(100) NOT NULL,
        \alue\ text NOT NULL,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT systemSettings_id PRIMARY KEY(id),
        CONSTRAINT systemSettings_key_unique UNIQUE(\key\)
      )
    ).catch(() => {});

    await connection.query("DELETE FROM systemSettings WHERE \key\ = 'initial_clean_wipe_v3'");
    console.log("[ForceReset] Flag de wipe previo eliminado.");

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    const tablesToClean = [
      "creditPayments","accountsReceivable","saleItems","sales",
      "deliveryExpenses","operationalExpenses","financialTransactions",
      "cash_closures","cash_openings","payments",
      "accountsPayable","purchaseItems","purchases","suppliers",
      "warranties","returns","repairs","unitEvents",
      "generatedCodes","generatedCodeBatches","units",
      "gpsTracking","deliveryLoadItems","deliveryLoads","delivery_extra_load",
      "orderItems","orders",
      "quotationItems","quotations",
      "inventory_transfer_items","inventory_transfers",
      "production_inputs","production_outputs","production_inventory","production_batches",
      "inventoryMovements","inventory","products",
      "customers","auditLog","kpiSnapshots","sellerCashRegisters",
    ];

    for (const table of tablesToClean) {
      try {
        await connection.query(DELETE FROM \${table}\`);
        await connection.query(ALTER TABLE \${table}\ AUTO_INCREMENT = 1).catch(() => {});
        console.log([ForceReset] Limpiada: );
      } catch {}
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    await connection.query(
      INSERT INTO branches (id, name, address, phone, isMainWarehouse, status, createdAt, updatedAt)
      VALUES (1, 'Sucursal Principal', 'Casa Central', '+591 70000000', 1, 'active', NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = 'Sucursal Principal', status = 'active'
    ).catch(() => {});

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await connection.query(
      INSERT INTO users (openId, username, passwordHash, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
       VALUES (?, ?, ?, ?, ?, 'traditional', 'admin', NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE passwordHash=VALUES(passwordHash), name=VALUES(name), email=VALUES(email), role='admin', updatedAt=NOW(),
      [local_, adminUsername, passwordHash, adminName, adminEmail]
    );
    console.log([ForceReset] Admin listo: );

    await connection.query(
      INSERT INTO systemSettings (\key\, \alue\, updatedAt)
      VALUES ('initial_clean_wipe_v3', 'true', NOW())
      ON DUPLICATE KEY UPDATE \alue\ = 'true', updatedAt = NOW()
    );

    console.log("[ForceReset] Reset completo. Sistema listo para usar desde cero.");
  } finally {
    await connection.end();
  }
}

forceReset().catch((err) => {
  console.error("[ForceReset] Failed:", err);
  process.exit(1);
});
