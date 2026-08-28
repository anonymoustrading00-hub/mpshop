import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function fixUnitsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "control_pedidos",
  });

  console.log("🔧 Corrigiendo tabla units...");

  try {
    // 1. Agregar warrantyStatus si no existe
    console.log("📝 Agregando campo warrantyStatus...");
    await connection.execute(`
      ALTER TABLE units 
      ADD COLUMN IF NOT EXISTS warrantyStatus ENUM('active', 'expired', 'n_a') NOT NULL DEFAULT 'n_a'
    `).catch((err) => {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log("✓ Campo warrantyStatus ya existe");
      } else {
        throw err;
      }
    });

    // 2. Actualizar enum de status para incluir reserved y scrapped
    console.log("📝 Actualizando enum de status...");
    
    // Primero verificamos qué valores tiene actualmente
    const [columns]: any = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'units' 
      AND COLUMN_NAME = 'status'
    `);

    const currentType = columns[0]?.COLUMN_TYPE || "";
    console.log(`   Estado actual: ${currentType}`);

    // Si no incluye 'reserved' o 'scrapped', actualizamos
    if (!currentType.includes('reserved') || !currentType.includes('scrapped')) {
      console.log("   Actualizando valores del enum...");
      await connection.execute(`
        ALTER TABLE units 
        MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') 
        NOT NULL DEFAULT 'in_diagnosis'
      `);
      console.log("✓ Enum de status actualizado");
    } else {
      console.log("✓ Enum de status ya está actualizado");
    }

    console.log("\n✅ Tabla units corregida exitosamente!");

  } catch (error: any) {
    console.error("❌ Error al corregir tabla:", error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

fixUnitsTable().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
