import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function addWarrantyStatusField() {
  console.log("🔧 Intentando conectar a la base de datos...");
  
  const db = await getDb();
  
  if (!db) {
    console.log("❌ No hay conexión a base de datos (modo demo).");
    console.log("ℹ️  Si estás viendo el error de warrantyStatus, significa que tu aplicación");
    console.log("    está conectada a una base de datos remota o en otro servidor.");
    console.log("\n📝 Por favor, ejecuta este SQL manualmente en tu base de datos:");
    console.log("\n" + "=".repeat(80));
    console.log(`
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS warrantyStatus ENUM('active', 'expired', 'n_a') DEFAULT 'n_a';

ALTER TABLE units 
MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') 
NOT NULL DEFAULT 'in_diagnosis';
    `);
    console.log("=".repeat(80));
    process.exit(0);
  }

  console.log("✅ Conectado a la base de datos");
  console.log("🔧 Agregando campo warrantyStatus...");

  try {
    // Intentar agregar el campo warrantyStatus
    await db.execute(sql`
      ALTER TABLE units 
      ADD COLUMN warrantyStatus ENUM('active', 'expired', 'n_a') DEFAULT 'n_a'
    `);
    console.log("✅ Campo warrantyStatus agregado exitosamente");
  } catch (error: any) {
    if (error.message?.includes("Duplicate column")) {
      console.log("ℹ️  Campo warrantyStatus ya existe");
    } else {
      console.error("❌ Error al agregar warrantyStatus:", error.message);
    }
  }

  try {
    // Actualizar enum de status
    console.log("🔧 Actualizando enum de status...");
    await db.execute(sql`
      ALTER TABLE units 
      MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') 
      NOT NULL DEFAULT 'in_diagnosis'
    `);
    console.log("✅ Enum de status actualizado exitosamente");
  } catch (error: any) {
    console.error("❌ Error al actualizar status:", error.message);
  }

  // Verificar los cambios
  try {
    console.log("\n🔍 Verificando cambios...");
    const result: any = await db.execute(sql`
      SELECT 
        COLUMN_NAME, 
        COLUMN_TYPE, 
        IS_NULLABLE, 
        COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'units' 
      AND COLUMN_NAME IN ('status', 'warrantyStatus')
    `);

    console.log("\n📊 Resultado:");
    console.table(result[0]);
    console.log("\n✅ ¡Migración completada exitosamente!");
  } catch (error: any) {
    console.error("⚠️  No se pudo verificar los cambios:", error.message);
  }

  process.exit(0);
}

addWarrantyStatusField().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
