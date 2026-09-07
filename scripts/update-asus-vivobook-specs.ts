/**
 * Script para actualizar especificaciones completas de modelos conocidos
 * Agrega características faltantes manteniendo las existentes
 */
import { getDb } from "../server/db";
import { units } from "../drizzle/schema";
import { eq, and, like, or } from "drizzle-orm";

// Base de datos de especificaciones completas por modelo
const MODEL_SPECS_DATABASE: Record<string, Record<string, any>> = {
  // Asus Vivobook E410M
  "asus vivobook e410m": {
    cpu: "Celeron N4010",
    ram: "4GB",
    storage: "128GB SSD",
    resolution: "FHD",
    os: "WINDOWS 11",
    screenSize: "14.0\"",
    gpu: "Intel UHD Graphics",
    connectivity: "WiFi, Bluetooth",
    batteryDuration: "Hasta 8 horas",
    weight: "1.3 kg",
    color: "Silver",
    caracteristicasAdicionales: "teclado luminoso"
  },
  
  // Puedes agregar más modelos aquí siguiendo el mismo formato:
  // "marca modelo": { cpu: "...", ram: "...", ... }
};

async function updateModelSpecs() {
  const db = await getDb();
  if (!db) {
    console.error("❌ No hay conexión a la base de datos");
    process.exit(1);
  }

  console.log("🔄 Actualizando especificaciones de modelos conocidos...\n");

  let totalUpdated = 0;
  let totalSkipped = 0;

  // Iterar sobre cada modelo en la base de datos
  for (const [modelKey, completeSpecs] of Object.entries(MODEL_SPECS_DATABASE)) {
    console.log(`\n📦 Buscando: ${modelKey.toUpperCase()}`);
    
    // Buscar unidades que coincidan con este modelo (búsqueda flexible)
    const allUnits = await db.select().from(units);
    
    const matchingUnits = allUnits.filter(unit => {
      const searchText = `${unit.brand} ${unit.model}`.toLowerCase();
      return searchText.includes(modelKey.toLowerCase());
    });

    if (matchingUnits.length === 0) {
      console.log(`   ⚠️  No se encontraron unidades para este modelo`);
      continue;
    }

    console.log(`   Encontradas ${matchingUnits.length} unidades\n`);

    for (const unit of matchingUnits) {
      try {
        // Parsear specs existentes
        let currentSpecs: Record<string, any> = {};
        if (unit.specs) {
          try {
            currentSpecs = typeof unit.specs === "string" ? JSON.parse(unit.specs) : unit.specs;
          } catch {
            currentSpecs = {};
          }
        }

        const beforeCount = Object.keys(currentSpecs).length;

        // Mergear: mantener valores existentes, agregar faltantes
        const mergedSpecs: Record<string, any> = { ...completeSpecs };
        
        // Sobrescribir con valores existentes (prioridad a lo que ya está guardado)
        for (const [key, value] of Object.entries(currentSpecs)) {
          if (value && String(value).trim() !== "" && String(value) !== "null") {
            mergedSpecs[key] = value;
          }
        }

        const afterCount = Object.keys(mergedSpecs).length;

        // Solo actualizar si hay cambios
        if (afterCount > beforeCount) {
          await db
            .update(units)
            .set({
              specs: JSON.stringify(mergedSpecs),
              updatedAt: new Date(),
            })
            .where(eq(units.id, unit.id));

          console.log(`   ✅ ${unit.brand} ${unit.model} (${unit.code})`);
          console.log(`      Campos: ${beforeCount} → ${afterCount} (+${afterCount - beforeCount})`);
          totalUpdated++;
        } else {
          console.log(`   ⏭️  ${unit.brand} ${unit.model} (${unit.code}) - Ya tiene todas las specs`);
          totalSkipped++;
        }
      } catch (error) {
        console.error(`   ❌ Error actualizando unidad ID ${unit.id}:`, error);
        totalSkipped++;
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Proceso completado`);
  console.log(`   Modelos procesados: ${Object.keys(MODEL_SPECS_DATABASE).length}`);
  console.log(`   Unidades actualizadas: ${totalUpdated}`);
  console.log(`   Unidades omitidas: ${totalSkipped}`);
  console.log(`${"=".repeat(60)}\n`);
  
  process.exit(0);
}

updateModelSpecs().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
