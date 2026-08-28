import { sql } from "drizzle-orm";

/**
 * Sistema de migraciones automáticas
 * Se ejecuta al iniciar el servidor y aplica cambios necesarios al schema
 */

export interface Migration {
  id: string;
  description: string;
  execute: (db: any) => Promise<void>;
}

export const migrations: Migration[] = [
  {
    id: "001_add_warrantyStatus_field",
    description: "Agregar campo warrantyStatus a tabla units",
    execute: async (db: any) => {
      try {
        // Verificar si la columna ya existe
        const checkColumn: any = await db.execute(sql`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'units' 
          AND COLUMN_NAME = 'warrantyStatus'
        `);

        if (checkColumn[0]?.length === 0) {
          console.log("  📝 Agregando campo warrantyStatus...");
          await db.execute(sql`
            ALTER TABLE units 
            ADD COLUMN warrantyStatus ENUM('active', 'expired', 'n_a') DEFAULT 'n_a'
          `);
          console.log("  ✅ Campo warrantyStatus agregado");
        } else {
          console.log("  ✓ Campo warrantyStatus ya existe");
        }
      } catch (error: any) {
        if (error.message?.includes("Duplicate column")) {
          console.log("  ✓ Campo warrantyStatus ya existe");
        } else {
          throw error;
        }
      }
    },
  },

  {
    id: "002_update_status_enum",
    description: "Actualizar enum de status con reserved y scrapped",
    execute: async (db: any) => {
      try {
        // Verificar el enum actual
        const checkEnum: any = await db.execute(sql`
          SELECT COLUMN_TYPE 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'units' 
          AND COLUMN_NAME = 'status'
        `);

        const currentType = checkEnum[0]?.[0]?.COLUMN_TYPE || "";
        
        if (!currentType.includes("reserved") || !currentType.includes("scrapped")) {
          console.log("  📝 Actualizando enum de status...");
          await db.execute(sql`
            ALTER TABLE units 
            MODIFY COLUMN status ENUM('in_diagnosis', 'in_repair', 'available', 'reserved', 'sold', 'returned', 'scrapped') 
            NOT NULL DEFAULT 'in_diagnosis'
          `);
          console.log("  ✅ Enum de status actualizado");
        } else {
          console.log("  ✓ Enum de status ya está actualizado");
        }
      } catch (error: any) {
        console.error("  ⚠️  Error al actualizar status enum:", error.message);
      }
    },
  },

  {
    id: "003_ensure_units_table_structure",
    description: "Verificar estructura completa de tabla units",
    execute: async (db: any) => {
      try {
        // Verificar que todos los campos críticos existan
        const checkColumns: any = await db.execute(sql`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'units'
        `);

        const existingColumns = checkColumns[0]?.map((row: any) => row.COLUMN_NAME) || [];
        const requiredColumns = [
          'id', 'code', 'rmaNumber', 'type', 'brand', 'model', 
          'status', 'warrantyStatus', 'purchasePrice', 'branchId'
        ];

        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

        if (missingColumns.length > 0) {
          console.log(`  ⚠️  Columnas faltantes detectadas: ${missingColumns.join(', ')}`);
        } else {
          console.log("  ✓ Estructura de tabla units verificada");
        }
      } catch (error: any) {
        console.error("  ⚠️  Error al verificar estructura:", error.message);
      }
    },
  },
];

export async function runAutoMigrations(db: any): Promise<void> {
  if (!db) {
    console.log("⚠️  Modo demo sin base de datos - migraciones omitidas");
    return;
  }

  console.log("\n🔄 Ejecutando migraciones automáticas...");

  // Crear tabla de migraciones si no existe
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id VARCHAR(255) PRIMARY KEY,
        description TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error: any) {
    console.log("  ℹ️  Tabla _migrations ya existe o no se pudo crear");
  }

  // Obtener migraciones ya ejecutadas
  let executedMigrations: string[] = [];
  try {
    const result: any = await db.execute(sql`SELECT id FROM _migrations`);
    executedMigrations = result[0]?.map((row: any) => row.id) || [];
  } catch (error) {
    console.log("  ℹ️  No se pudieron leer migraciones previas");
  }

  // Ejecutar migraciones pendientes
  for (const migration of migrations) {
    if (executedMigrations.includes(migration.id)) {
      console.log(`⏭️  [${migration.id}] ${migration.description} - YA EJECUTADA`);
      continue;
    }

    try {
      console.log(`🔧 [${migration.id}] ${migration.description}`);
      await migration.execute(db);

      // Registrar migración como ejecutada
      try {
        await db.execute(sql`
          INSERT INTO _migrations (id, description) 
          VALUES (${migration.id}, ${migration.description})
        `);
      } catch (error) {
        // Si falla el registro, continuamos
      }

      console.log(`✅ [${migration.id}] Completada`);
    } catch (error: any) {
      console.error(`❌ [${migration.id}] Error:`, error.message);
      // No detenemos el servidor por un error de migración
    }
  }

  console.log("✅ Migraciones completadas\n");
}
